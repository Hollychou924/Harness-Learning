package com.xiaoxiami.app.browser

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.content.Context
import android.net.Uri
import android.util.Log
import android.view.ContextThemeWrapper
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.xiaoxiami.app.data.browser.BrowserSessionDao
import com.xiaoxiami.app.data.browser.BrowserSessionEntity
import com.xiaoxiami.app.utils.CameraUtils
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlin.coroutines.resume

// ── Data classes ──

data class BrowserSessionSnapshot(
    val id: String,
    val name: String,
    val url: String,
    val title: String,
    val loading: Boolean,
    val lastLoadedAt: Long?,
    val lastError: String,
    val consecutiveErrors: Int = 0
)

data class BrowserError(
    val timestamp: Long,
    val type: String,   // NETWORK, HTTP_ERROR, AUTH_REQUIRED, TIMEOUT
    val message: String,
    val url: String
)

data class BrowserAction(
    val timestamp: Long,
    val type: String,   // navigate, click, fill, waitFor, screenshot, etc.
    val params: Map<String, Any?>,
    val success: Boolean,
    val resultSummary: String
)

data class FileUploadRequest(
    val sessionId: String,
    val acceptTypes: Array<String>,
    val callback: ValueCallback<Array<Uri>>
)

// ── Manager ──

class BrowserRuntimeManager(
    private val appContext: Context,
    private val sessionDao: BrowserSessionDao? = null
) {
    companion object {
        private const val TAG = "BrowserRuntime"
        private const val PERSIST_DEBOUNCE_MS = 5_000L
    }

    private val gson = Gson()
    private val sessions = ConcurrentHashMap<String, BrowserSessionHolder>()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @Volatile
    private var activeSessionId: String? = null

    // Observable session list for Debug UI (Phase D)
    private val _sessionsFlow = MutableStateFlow<List<BrowserSessionSnapshot>>(emptyList())
    val sessionsFlow: StateFlow<List<BrowserSessionSnapshot>> = _sessionsFlow.asStateFlow()

    // File upload state for visible browser panel (Phase C)
    private val _pendingFileUpload = MutableStateFlow<FileUploadRequest?>(null)
    val pendingFileUpload: StateFlow<FileUploadRequest?> = _pendingFileUpload.asStateFlow()

    // ── Session management ──

    suspend fun createSession(name: String = ""): BrowserSessionSnapshot {
        val sessionId = "browser_${UUID.randomUUID().toString().take(8)}"
        val holder = withMain {
            val themedContext = ContextThemeWrapper(
                appContext,
                android.R.style.Theme_DeviceDefault_Light_NoActionBar
            )
            val webView = WebView(themedContext)
            val created = BrowserSessionHolder(
                id = sessionId,
                name = name.ifBlank { "Browser ${sessions.size + 1}" },
                webView = webView
            )
            configureWebView(created)
            sessions[sessionId] = created
            activeSessionId = sessionId
            created
        }
        refreshSessionsFlow()
        return holder.snapshot()
    }

    suspend fun listSessions(): List<BrowserSessionSnapshot> {
        return withMain {
            sessions.values
                .sortedByDescending { it.lastLoadedAt ?: 0L }
                .map { it.snapshot() }
        }
    }

    suspend fun closeSession(sessionId: String): Boolean {
        return withMain {
            val holder = sessions.remove(sessionId) ?: return@withMain false
            holder.webView.stopLoading()
            holder.webView.destroy()
            if (activeSessionId == sessionId) {
                activeSessionId = sessions.keys.firstOrNull()
            }
            // Delete from persistence
            scope.launch { sessionDao?.deleteById(sessionId) }
            refreshSessionsFlow()
            true
        }
    }

    suspend fun getSessionSnapshot(sessionId: String): BrowserSessionSnapshot {
        return resolveSession(sessionId).snapshot()
    }

    /** Expose WebView for embedding in Compose AndroidView (file upload panel / debug UI). */
    fun getWebView(sessionId: String): WebView? {
        return sessions[sessionId]?.webView
    }

    /** Detach WebView from any parent so it can be re-parented in Compose. */
    fun detachWebView(sessionId: String) {
        sessions[sessionId]?.webView?.let { wv ->
            (wv.parent as? ViewGroup)?.removeView(wv)
        }
    }

    // ── Navigation ──

    suspend fun navigate(
        sessionId: String,
        url: String,
        timeoutMs: Long = 25_000L
    ): BrowserSessionSnapshot {
        val holder = resolveSession(sessionId)
        withMain {
            holder.loading = true
            holder.lastError = ""
            holder.webView.loadUrl(url)
            activeSessionId = holder.id
        }
        waitUntilLoaded(holder, timeoutMs)
        logAction(holder, "navigate", mapOf("url" to url), holder.lastError.isBlank(), holder.url)
        schedulePersist(holder)
        refreshSessionsFlow()
        return holder.snapshot()
    }

    /** Navigate with exponential backoff retry (Phase B). */
    suspend fun navigateWithRetry(
        sessionId: String,
        url: String,
        timeoutMs: Long = 25_000L,
        maxRetries: Int = 3,
        backoffBaseMs: Long = 1_000L
    ): BrowserSessionSnapshot {
        var lastError: Exception? = null
        for (attempt in 1..maxRetries) {
            try {
                val snapshot = navigate(sessionId, url, timeoutMs)
                if (snapshot.lastError.isBlank()) return snapshot
                if (!isRetryableError(snapshot.lastError)) {
                    throw RuntimeException(snapshot.lastError)
                }
                lastError = RuntimeException(snapshot.lastError)
            } catch (e: Exception) {
                lastError = e
                if (!isRetryableError(e.message ?: "")) throw e
            }
            if (attempt < maxRetries) {
                delay(backoffBaseMs * (1L shl (attempt - 1)))
            }
        }
        throw lastError ?: RuntimeException("Navigation failed after $maxRetries attempts")
    }

    private fun isRetryableError(error: String): Boolean {
        return error.contains("net::ERR_", ignoreCase = true) ||
                error.contains("timeout", ignoreCase = true) ||
                error.startsWith("HTTP 5")
    }

    // ── DOM interaction ──

    suspend fun domSnapshot(
        sessionId: String,
        maxTextChars: Int = 5000
    ): Map<String, Any?> {
        val holder = resolveSession(sessionId)
        return evaluateJson(
            holder,
            """
            const text = (document.body?.innerText || '').trim();
            const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 20).map((el) => ({
              text: (el.innerText || '').trim().slice(0, 120),
              href: el.href || ''
            }));
            return {
              url: location.href,
              title: document.title || '',
              readyState: document.readyState,
              text: text.slice(0, $maxTextChars),
              textLength: text.length,
              forms: document.forms.length,
              linkCount: document.links.length,
              links
            };
            """.trimIndent()
        )
    }

    suspend fun queryElements(
        sessionId: String,
        selector: String,
        limit: Int = 20
    ): Map<String, Any?> {
        val holder = resolveSession(sessionId)
        val escaped = selector.jsQuoted()
        return evaluateJson(
            holder,
            """
            const selector = $escaped;
            const nodes = Array.from(document.querySelectorAll(selector))
              .slice(0, ${limit.coerceIn(1, 100)})
              .map((el, index) => ({
                index,
                tag: (el.tagName || '').toLowerCase(),
                id: el.id || '',
                name: el.getAttribute('name') || '',
                type: el.getAttribute('type') || '',
                text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 200),
                placeholder: el.getAttribute('placeholder') || '',
                href: el.href || '',
                visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
              }));
            return {
              selector,
              count: nodes.length,
              items: nodes
            };
            """.trimIndent()
        )
    }

    suspend fun click(
        sessionId: String,
        selector: String,
        index: Int = 0
    ): Map<String, Any?> {
        val holder = resolveSession(sessionId)
        val escaped = selector.jsQuoted()
        val result = evaluateJson(
            holder,
            """
            const nodes = Array.from(document.querySelectorAll($escaped));
            const target = nodes[$index];
            if (!target) {
              return { success: false, error: 'selector_not_found' };
            }
            target.click();
            return {
              success: true,
              tag: (target.tagName || '').toLowerCase(),
              text: (target.innerText || target.value || '').trim().slice(0, 200),
              href: target.href || '',
              url: location.href
            };
            """.trimIndent()
        )
        logAction(holder, "click", mapOf("selector" to selector, "index" to index),
            result["success"] as? Boolean ?: false, result["url"]?.toString() ?: "")
        return result
    }

    suspend fun fill(
        sessionId: String,
        selector: String,
        value: String,
        index: Int = 0,
        submit: Boolean = false
    ): Map<String, Any?> {
        val holder = resolveSession(sessionId)
        val escapedSelector = selector.jsQuoted()
        val escapedValue = value.jsQuoted()
        val result = evaluateJson(
            holder,
            """
            const nodes = Array.from(document.querySelectorAll($escapedSelector));
            const target = nodes[$index];
            if (!target) {
              return { success: false, error: 'selector_not_found' };
            }
            target.focus();
            target.value = $escapedValue;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
            if ($submit && target.form) {
              target.form.requestSubmit ? target.form.requestSubmit() : target.form.submit();
            }
            return {
              success: true,
              tag: (target.tagName || '').toLowerCase(),
              name: target.getAttribute('name') || '',
              valueLength: (target.value || '').length,
              submitted: ${submit}
            };
            """.trimIndent()
        )
        logAction(holder, "fill", mapOf("selector" to selector, "submit" to submit),
            result["success"] as? Boolean ?: false, "filled ${value.length} chars")
        return result
    }

    suspend fun waitFor(
        sessionId: String,
        selector: String = "",
        text: String = "",
        timeoutMs: Long = 15_000L
    ): Map<String, Any?> {
        val holder = resolveSession(sessionId)
        val selectorEscaped = selector.jsQuoted()
        val textEscaped = text.jsQuoted()
        val result = withTimeout(timeoutMs) {
            while (true) {
                val matched = evaluateJson(
                    holder,
                    """
                    const selector = $selectorEscaped;
                    const text = $textEscaped;
                    const selectorMatched = selector ? document.querySelector(selector) !== null : false;
                    const textMatched = text ? (document.body?.innerText || '').includes(text) : false;
                    return {
                      selectorMatched,
                      textMatched,
                      matched: selector ? selectorMatched : textMatched,
                      url: location.href,
                      title: document.title || ''
                    };
                    """.trimIndent()
                )
                if ((matched["matched"] as? Boolean) == true) {
                    return@withTimeout matched
                }
                delay(400L)
            }
            @Suppress("UNREACHABLE_CODE")
            emptyMap()
        }
        logAction(holder, "waitFor", mapOf("selector" to selector, "text" to text),
            result["matched"] as? Boolean ?: false, "")
        return result
    }

    suspend fun extractCurrentPage(
        sessionId: String,
        maxTextChars: Int = 6000
    ): Map<String, Any?> {
        val holder = resolveSession(sessionId)
        return evaluateJson(
            holder,
            """
            const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
            return {
              url: location.href,
              title: document.title || '',
              text: text.slice(0, $maxTextChars),
              truncated: text.length > $maxTextChars
            };
            """.trimIndent()
        )
    }

    // ── Screenshot ──

    suspend fun captureScreenshot(
        sessionId: String,
        fullPage: Boolean = false,
        maxHeightPx: Int = 8_000
    ): Map<String, Any?> {
        val holder = resolveSession(sessionId)
        val capture = withMain {
            val metrics = appContext.resources.displayMetrics
            val width = metrics.widthPixels.coerceAtLeast(720)
            val contentHeight = (holder.webView.contentHeight * holder.webView.scale).toInt().coerceAtLeast(1)
            val height = if (fullPage) {
                contentHeight.coerceIn(1, maxHeightPx.coerceAtLeast(1))
            } else {
                holder.webView.height.takeIf { it > 0 } ?: metrics.heightPixels.coerceAtLeast(1280)
            }
            holder.webView.measure(
                android.view.View.MeasureSpec.makeMeasureSpec(width, android.view.View.MeasureSpec.EXACTLY),
                android.view.View.MeasureSpec.makeMeasureSpec(height, android.view.View.MeasureSpec.EXACTLY)
            )
            holder.webView.layout(0, 0, width, height)
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            canvas.drawColor(Color.WHITE)
            holder.webView.draw(canvas)
            Triple(bitmap, width, height)
        }
        val outputFile = withContext(Dispatchers.IO) {
            val file = File(appContext.cacheDir, "browser_shot_${System.currentTimeMillis()}.png")
            FileOutputStream(file).use { stream ->
                capture.first.compress(Bitmap.CompressFormat.PNG, 100, stream)
            }
            capture.first.recycle()
            file
        }
        val uri = CameraUtils.getUriForFile(appContext, outputFile)
        logAction(holder, "screenshot", mapOf("fullPage" to fullPage), true, uri.toString())
        return mapOf(
            "uri" to uri.toString(),
            "width" to capture.second,
            "height" to capture.third,
            "fullPage" to fullPage,
            "url" to holder.url,
            "title" to holder.title
        )
    }

    // ── Auth detection (Phase B) ──

    suspend fun detectAuthRequired(sessionId: String): Map<String, Any?> {
        val holder = resolveSession(sessionId)
        return evaluateJson(
            holder,
            """
            const hasPasswordInput = !!document.querySelector('input[type=password]');
            const forms = Array.from(document.forms);
            const loginForm = forms.find(f => {
              const s = (f.action + ' ' + f.id + ' ' + f.className).toLowerCase();
              return s.includes('login') || s.includes('signin') || s.includes('auth');
            });
            const bodyText = (document.body?.innerText || '').toLowerCase();
            const hasLoginText = bodyText.includes('sign in') || bodyText.includes('log in') ||
                                 bodyText.includes('登录') || bodyText.includes('登入');
            const authRequired = hasPasswordInput || !!loginForm || hasLoginText;
            return {
              authRequired: authRequired,
              loginFormSelector: loginForm ? ('form' + (loginForm.id ? '#' + loginForm.id : '')) : null,
              hasPasswordInput: hasPasswordInput,
              suggestCustomTabs: authRequired
            };
            """.trimIndent()
        )
    }

    /** Get session health diagnostics (Phase B). */
    suspend fun getSessionHealth(sessionId: String): Map<String, Any?> {
        val holder = resolveSession(sessionId)
        val authCheck = runCatching { detectAuthRequired(sessionId) }.getOrDefault(emptyMap())
        return mapOf(
            "sessionId" to sessionId,
            "consecutiveErrors" to holder.consecutiveErrors,
            "recentErrors" to holder.errorHistory.takeLast(5).map {
                mapOf("type" to it.type, "message" to it.message, "url" to it.url)
            },
            "authRequired" to (authCheck["authRequired"] as? Boolean ?: false),
            "suggestCustomTabs" to (holder.consecutiveErrors >= 3 || authCheck["authRequired"] == true),
            "suggestRestart" to (holder.consecutiveErrors >= 5)
        )
    }

    // ── File upload support (Phase C) ──

    /** Resolve a pending file upload with user-selected URIs. */
    fun resolveFileUpload(uris: Array<Uri>?) {
        val pending = _pendingFileUpload.value ?: return
        pending.callback.onReceiveValue(uris)
        _pendingFileUpload.value = null
    }

    // ── Action log (Phase D) ──

    fun getActionLog(sessionId: String): List<BrowserAction> {
        return sessions[sessionId]?.actionLog?.toList() ?: emptyList()
    }

    /** Replay a sequence of recorded actions on a session. */
    suspend fun replayActions(sessionId: String, actions: List<BrowserAction>) {
        for (action in actions) {
            when (action.type) {
                "navigate" -> {
                    val url = action.params["url"]?.toString() ?: continue
                    navigate(sessionId, url)
                }
                "click" -> {
                    val selector = action.params["selector"]?.toString() ?: continue
                    val index = (action.params["index"] as? Number)?.toInt() ?: 0
                    click(sessionId, selector, index)
                }
                "fill" -> {
                    val selector = action.params["selector"]?.toString() ?: continue
                    val value = action.params["value"]?.toString() ?: continue
                    val submit = action.params["submit"] as? Boolean ?: false
                    fill(sessionId, selector, value, submit = submit)
                }
                "waitFor" -> {
                    val selector = action.params["selector"]?.toString() ?: ""
                    val text = action.params["text"]?.toString() ?: ""
                    waitFor(sessionId, selector, text)
                }
            }
            delay(500L) // pause between replayed actions
        }
    }

    // ── Persistence (Phase A) ──

    /** Restore sessions from Room DB on app startup. */
    suspend fun restoreSessions() {
        val dao = sessionDao ?: return
        val saved = dao.listAll()
        if (saved.isEmpty()) return
        Log.i(TAG, "Restoring ${saved.size} browser sessions")
        for (entity in saved) {
            try {
                val snapshot = createSession(entity.name)
                // Remap: the newly created session has a new ID, but we want the old one
                val holder = sessions.remove(snapshot.id) ?: continue
                sessions[entity.id] = BrowserSessionHolder(
                    id = entity.id,
                    name = entity.name,
                    webView = holder.webView
                ).also { newHolder ->
                    // Restore cookies before navigating
                    restoreCookies(entity.url, entity.cookiesJson)
                    configureWebView(newHolder)
                }
                if (entity.url.isNotBlank() && entity.url != "about:blank") {
                    navigate(entity.id, entity.url)
                }
                if (activeSessionId == snapshot.id) {
                    activeSessionId = entity.id
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to restore session ${entity.id}", e)
            }
        }
        refreshSessionsFlow()
    }

    private fun schedulePersist(holder: BrowserSessionHolder) {
        holder.persistJob?.cancel()
        holder.persistJob = scope.launch {
            delay(PERSIST_DEBOUNCE_MS)
            persistSession(holder)
        }
    }

    private suspend fun persistSession(holder: BrowserSessionHolder) {
        val dao = sessionDao ?: return
        val cookiesJson = withMain {
            CookieManager.getInstance().getCookie(holder.url) ?: ""
        }
        dao.upsert(
            BrowserSessionEntity(
                id = holder.id,
                name = holder.name,
                url = holder.url,
                title = holder.title,
                cookiesJson = cookiesJson,
                createdAt = holder.createdAt,
                updatedAt = System.currentTimeMillis()
            )
        )
    }

    private suspend fun restoreCookies(url: String, cookiesJson: String) {
        if (url.isBlank() || cookiesJson.isBlank()) return
        withMain {
            val cookieManager = CookieManager.getInstance()
            // Each cookie is separated by "; "
            cookiesJson.split("; ", "; ").forEach { cookie ->
                if (cookie.isNotBlank()) {
                    cookieManager.setCookie(url, cookie)
                }
            }
            cookieManager.flush()
        }
    }

    // ── Internal helpers ──

    private fun logAction(
        holder: BrowserSessionHolder,
        type: String,
        params: Map<String, Any?>,
        success: Boolean,
        resultSummary: String
    ) {
        holder.actionLog.add(
            BrowserAction(
                timestamp = System.currentTimeMillis(),
                type = type,
                params = params,
                success = success,
                resultSummary = resultSummary.take(200)
            )
        )
        // Keep last 100 actions per session
        if (holder.actionLog.size > 100) {
            holder.actionLog.removeAt(0)
        }
    }

    private fun refreshSessionsFlow() {
        _sessionsFlow.value = sessions.values
            .sortedByDescending { it.lastLoadedAt ?: 0L }
            .map { it.snapshot() }
    }

    private suspend fun waitUntilLoaded(
        holder: BrowserSessionHolder,
        timeoutMs: Long
    ) {
        withTimeout(timeoutMs) {
            while (holder.loading) {
                delay(250L)
            }
        }
    }

    private suspend fun resolveSession(sessionId: String): BrowserSessionHolder {
        val resolvedId = sessionId.ifBlank { activeSessionId.orEmpty() }
        return sessions[resolvedId]
            ?: throw IllegalArgumentException("browser session 不存在: ${if (resolvedId.isBlank()) "<empty>" else resolvedId}")
    }

    private fun configureWebView(holder: BrowserSessionHolder) {
        val webView = holder.webView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowContentAccess = true
            allowFileAccess = true
            loadsImagesAutomatically = true
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = true
            loadWithOverviewMode = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            userAgentString = "${userAgentString} XiaoxiamiBrowserRuntime/1.0"
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onReceivedTitle(view: WebView?, title: String?) {
                holder.title = title.orEmpty()
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                return true
            }

            // Phase C: File upload support
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                if (filePathCallback == null) return false
                _pendingFileUpload.value = FileUploadRequest(
                    sessionId = holder.id,
                    acceptTypes = fileChooserParams?.acceptTypes ?: arrayOf("*/*"),
                    callback = filePathCallback
                )
                return true
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                holder.loading = true
                holder.url = url.orEmpty()
                holder.lastError = ""
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                holder.loading = false
                holder.url = url.orEmpty()
                holder.title = view?.title.orEmpty()
                holder.lastLoadedAt = System.currentTimeMillis()
                holder.consecutiveErrors = 0  // Reset on success
                schedulePersist(holder)
                refreshSessionsFlow()
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame != false) {
                    holder.loading = false
                    val msg = error?.description?.toString().orEmpty().ifBlank { "load error" }
                    holder.lastError = msg
                    holder.consecutiveErrors++
                    holder.errorHistory.add(
                        BrowserError(
                            timestamp = System.currentTimeMillis(),
                            type = "NETWORK",
                            message = msg,
                            url = request?.url?.toString() ?: holder.url
                        )
                    )
                    refreshSessionsFlow()
                }
            }

            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: WebResourceResponse?
            ) {
                if (request?.isForMainFrame == true) {
                    val statusCode = errorResponse?.statusCode ?: 0
                    val msg = "HTTP $statusCode"
                    holder.lastError = msg
                    holder.consecutiveErrors++
                    holder.errorHistory.add(
                        BrowserError(
                            timestamp = System.currentTimeMillis(),
                            type = if (statusCode in 401..403) "AUTH_REQUIRED" else "HTTP_ERROR",
                            message = msg,
                            url = request.url?.toString() ?: holder.url
                        )
                    )
                    refreshSessionsFlow()
                }
            }
        }
        webView.loadUrl("about:blank")
    }

    private suspend fun evaluateJson(
        holder: BrowserSessionHolder,
        scriptBody: String
    ): Map<String, Any?> {
        val raw = evaluateJavascript(
            holder.webView,
            """
            (function() {
              try {
                const result = (() => {
                  $scriptBody
                })();
                return JSON.stringify(result ?? {});
              } catch (error) {
                return JSON.stringify({
                  success: false,
                  error: String(error && error.message ? error.message : error)
                });
              }
            })();
            """.trimIndent()
        )
        if (raw.isBlank() || raw == "null") return emptyMap()
        val decoded = runCatching {
            gson.fromJson(raw, String::class.java)
        }.getOrElse { raw }
        if (decoded.isBlank()) return emptyMap()
        return runCatching {
            gson.fromJson<Map<String, Any?>>(
                decoded,
                object : TypeToken<Map<String, Any?>>() {}.type
            )
        }.getOrDefault(emptyMap())
    }

    private suspend fun evaluateJavascript(
        webView: WebView,
        script: String
    ): String {
        return withMain {
            suspendCancellableCoroutine { continuation ->
                webView.evaluateJavascript(script, ValueCallback { value ->
                    continuation.resume(value ?: "")
                })
            }
        }
    }

    private suspend fun <T> withMain(block: suspend () -> T): T {
        return withContext(Dispatchers.Main.immediate) { block() }
    }

    // ── Session holder ──

    private class BrowserSessionHolder(
        val id: String,
        val name: String,
        val webView: WebView
    ) {
        val createdAt: Long = System.currentTimeMillis()

        @Volatile var url: String = "about:blank"
        @Volatile var title: String = ""
        @Volatile var loading: Boolean = false
        @Volatile var lastLoadedAt: Long? = null
        @Volatile var lastError: String = ""
        @Volatile var consecutiveErrors: Int = 0

        val errorHistory: MutableList<BrowserError> = mutableListOf()
        val actionLog: MutableList<BrowserAction> = mutableListOf()
        var persistJob: Job? = null

        fun snapshot(): BrowserSessionSnapshot {
            return BrowserSessionSnapshot(
                id = id,
                name = name,
                url = url,
                title = title,
                loading = loading,
                lastLoadedAt = lastLoadedAt,
                lastError = lastError,
                consecutiveErrors = consecutiveErrors
            )
        }
    }
}

private fun String.jsQuoted(): String {
    return Gson().toJson(this)
}
