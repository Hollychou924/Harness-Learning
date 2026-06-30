package com.xiaoxiami.app.agent.tools

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolAvailability
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolExecutionMode
import com.xiaoxiami.app.agent.ToolFamily
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolInteractionKind
import com.xiaoxiami.app.agent.ToolInteractionRequest
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolScope
import com.xiaoxiami.app.agent.ToolValueType
import com.xiaoxiami.app.browser.BrowserRuntimeManager
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.URLConnection
import java.util.concurrent.TimeUnit

class BrowserSessionCreateTool(
    private val browserRuntime: BrowserRuntimeManager
) : Tool {
    override val schema = ToolSchema(
        name = "browser_session_create",
        family = ToolFamily.BROWSER,
        description = "Create a managed browser session for multi-step browsing tasks.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("browser", "session_management"),
        riskLevel = ToolRiskLevel.LOW,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("browser_runtime"),
        scopes = listOf(ToolScope.BROWSER, ToolScope.NETWORK),
        accessRequirements = listOf(
            ToolAccessRequirement(
                kind = ToolAccessKind.NETWORK,
                identifier = "public_http",
                description = "需要联网浏览网页"
            )
        ),
        inputSchema = listOf(
            ToolParameterSchema("name", ToolValueType.STRING, "Optional session name.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("id", ToolValueType.STRING, "Browser session ID."),
            ToolFieldSchema("name", ToolValueType.STRING, "Browser session name."),
            ToolFieldSchema("url", ToolValueType.STRING, "Current session URL.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val snapshot = browserRuntime.createSession(arguments.stringArg("name"))
        return ToolResult(true, output = jsonOutput(snapshot))
    }
}

class BrowserSessionListTool(
    private val browserRuntime: BrowserRuntimeManager
) : Tool {
    override val schema = ToolSchema(
        name = "browser_session_list",
        family = ToolFamily.BROWSER,
        description = "List existing browser sessions and their current state.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("browser", "session_management"),
        riskLevel = ToolRiskLevel.LOW,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("browser_runtime"),
        scopes = listOf(ToolScope.BROWSER),
        inputSchema = emptyList(),
        outputSchema = listOf(
            ToolFieldSchema("items", ToolValueType.ARRAY, "Browser sessions.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        return ToolResult(
            success = true,
            output = jsonOutput(mapOf("items" to browserRuntime.listSessions()))
        )
    }
}

class BrowserSessionCloseTool(
    private val browserRuntime: BrowserRuntimeManager
) : Tool {
    override val schema = ToolSchema(
        name = "browser_session_close",
        family = ToolFamily.BROWSER,
        description = "Close a managed browser session and release its WebView resources.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("browser", "session_management"),
        riskLevel = ToolRiskLevel.LOW,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("browser_runtime"),
        scopes = listOf(ToolScope.BROWSER),
        inputSchema = listOf(
            ToolParameterSchema("sessionId", ToolValueType.STRING, "Browser session ID.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val sessionId = arguments.stringArg("sessionId")
        if (sessionId.isBlank()) return ToolResult(false, "", "sessionId 不能为空")
        val success = browserRuntime.closeSession(sessionId)
        return ToolResult(
            success = success,
            output = jsonOutput(mapOf("success" to success))
        )
    }
}

class BrowserNavigateTool(
    private val browserRuntime: BrowserRuntimeManager
) : Tool {
    override val schema = ToolSchema(
        name = "browser_navigate",
        family = ToolFamily.BROWSER,
        description = "Navigate a managed browser session to a public URL and wait for page load.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("browser", "navigation"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("browser_runtime"),
        scopes = listOf(ToolScope.BROWSER, ToolScope.NETWORK),
        accessRequirements = listOf(
            ToolAccessRequirement(
                kind = ToolAccessKind.NETWORK,
                identifier = "public_http",
                description = "需要联网浏览网页"
            )
        ),
        inputSchema = listOf(
            ToolParameterSchema("sessionId", ToolValueType.STRING, "Browser session ID.", required = false),
            ToolParameterSchema("url", ToolValueType.STRING, "Public http/https URL.", required = true),
            ToolParameterSchema("timeoutSeconds", ToolValueType.INTEGER, "Navigation timeout in seconds.", required = false),
            ToolParameterSchema("retry", ToolValueType.BOOLEAN, "Enable retry with exponential backoff on transient errors.", required = false),
            ToolParameterSchema("maxRetries", ToolValueType.INTEGER, "Max retry attempts (1-5). Only used when retry=true.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("id", ToolValueType.STRING, "Browser session ID."),
            ToolFieldSchema("url", ToolValueType.STRING, "Current URL."),
            ToolFieldSchema("title", ToolValueType.STRING, "Current page title.", required = false),
            ToolFieldSchema("authHint", ToolValueType.OBJECT, "Auth detection result if login page detected.", required = false)
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val url = runCatching {
            validatePublicNetworkUrl(arguments.stringArg("url"))
        }.getOrElse {
            return ToolResult(false, "", it.message ?: "url 不合法")
        }
        val timeoutMs = arguments.intArg("timeoutSeconds", 25).coerceIn(5, 120) * 1000L
        val retry = arguments.booleanArg("retry", false)
        val maxRetries = arguments.intArg("maxRetries", 3).coerceIn(1, 5)
        val sessionId = arguments.stringArg("sessionId")

        val snapshot = if (retry) {
            runCatching {
                browserRuntime.navigateWithRetry(
                    sessionId = sessionId,
                    url = url,
                    timeoutMs = timeoutMs,
                    maxRetries = maxRetries
                )
            }.getOrElse {
                return ToolResult(false, "", it.message ?: "导航重试失败")
            }
        } else {
            browserRuntime.navigate(sessionId = sessionId, url = url, timeoutMs = timeoutMs)
        }

        // Detect auth requirement after navigation
        val authHint = runCatching {
            browserRuntime.detectAuthRequired(snapshot.id)
        }.getOrNull()

        val output = mutableMapOf<String, Any?>(
            "id" to snapshot.id,
            "name" to snapshot.name,
            "url" to snapshot.url,
            "title" to snapshot.title,
            "loading" to snapshot.loading,
            "lastError" to snapshot.lastError
        )
        if (authHint != null && authHint["authRequired"] == true) {
            output["authHint"] = authHint
        }
        return ToolResult(true, output = jsonOutput(output))
    }
}

class BrowserDomSnapshotTool(
    private val browserRuntime: BrowserRuntimeManager
) : Tool {
    override val schema = ToolSchema(
        name = "browser_dom_snapshot",
        family = ToolFamily.BROWSER,
        description = "Capture a structured snapshot of the current browser session DOM state.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("browser", "dom_snapshot"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("browser_runtime"),
        scopes = listOf(ToolScope.BROWSER),
        inputSchema = listOf(
            ToolParameterSchema("sessionId", ToolValueType.STRING, "Browser session ID.", required = false),
            ToolParameterSchema("maxTextChars", ToolValueType.INTEGER, "Maximum text length.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("url", ToolValueType.STRING, "Current URL."),
            ToolFieldSchema("title", ToolValueType.STRING, "Current title.", required = false),
            ToolFieldSchema("text", ToolValueType.STRING, "Visible text snapshot.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val snapshot = browserRuntime.domSnapshot(
            sessionId = arguments.stringArg("sessionId"),
            maxTextChars = arguments.intArg("maxTextChars", 5000)
        )
        return ToolResult(true, output = jsonOutput(snapshot))
    }
}

class BrowserQueryElementsTool(
    private val browserRuntime: BrowserRuntimeManager
) : Tool {
    override val schema = ToolSchema(
        name = "browser_query_elements",
        family = ToolFamily.BROWSER,
        description = "Query DOM elements in the current browser session by CSS selector.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("browser", "dom_query"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("browser_runtime"),
        scopes = listOf(ToolScope.BROWSER),
        inputSchema = listOf(
            ToolParameterSchema("sessionId", ToolValueType.STRING, "Browser session ID.", required = false),
            ToolParameterSchema("selector", ToolValueType.STRING, "CSS selector to query.", required = true),
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum returned elements.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("selector", ToolValueType.STRING, "Queried selector."),
            ToolFieldSchema("items", ToolValueType.ARRAY, "Matched elements.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val selector = arguments.stringArg("selector")
        if (selector.isBlank()) return ToolResult(false, "", "selector 不能为空")
        val result = browserRuntime.queryElements(
            sessionId = arguments.stringArg("sessionId"),
            selector = selector,
            limit = arguments.intArg("limit", 20)
        )
        return ToolResult(true, output = jsonOutput(result))
    }
}

class BrowserClickTool(
    private val browserRuntime: BrowserRuntimeManager
) : Tool {
    override val schema = ToolSchema(
        name = "browser_click",
        family = ToolFamily.BROWSER,
        description = "Click an element in the current browser session using a CSS selector.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("browser", "dom_action", "click"),
        riskLevel = ToolRiskLevel.HIGH,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("browser_runtime"),
        scopes = listOf(ToolScope.BROWSER),
        approvalRequired = true,
        approvalReason = "浏览器点击可能触发登录、提交、跳转或外部状态修改。",
        approvalSummary = "Agent 请求执行浏览器点击动作",
        inputSchema = listOf(
            ToolParameterSchema("sessionId", ToolValueType.STRING, "Browser session ID.", required = false),
            ToolParameterSchema("selector", ToolValueType.STRING, "CSS selector to click.", required = true),
            ToolParameterSchema("index", ToolValueType.INTEGER, "Which matched element to click.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val selector = arguments.stringArg("selector")
        if (selector.isBlank()) return ToolResult(false, "", "selector 不能为空")
        val result = browserRuntime.click(
            sessionId = arguments.stringArg("sessionId"),
            selector = selector,
            index = arguments.intArg("index", 0)
        )
        val success = result["success"] as? Boolean ?: false
        return ToolResult(
            success = success,
            output = jsonOutput(result),
            error = if (success) null else result["error"]?.toString()
        )
    }
}

class BrowserFillFormTool(
    private val browserRuntime: BrowserRuntimeManager
) : Tool {
    override val schema = ToolSchema(
        name = "browser_fill_form",
        family = ToolFamily.BROWSER,
        description = "Fill an input or textarea element in the current browser session.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("browser", "dom_action", "fill"),
        riskLevel = ToolRiskLevel.HIGH,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("browser_runtime"),
        scopes = listOf(ToolScope.BROWSER),
        approvalRequired = true,
        approvalReason = "浏览器表单填写可能提交敏感数据或触发登录流程。",
        approvalSummary = "Agent 请求填写浏览器表单",
        inputSchema = listOf(
            ToolParameterSchema("sessionId", ToolValueType.STRING, "Browser session ID.", required = false),
            ToolParameterSchema("selector", ToolValueType.STRING, "CSS selector to fill.", required = true),
            ToolParameterSchema("value", ToolValueType.STRING, "Text value to set.", required = true),
            ToolParameterSchema("index", ToolValueType.INTEGER, "Which matched element to fill.", required = false),
            ToolParameterSchema("submit", ToolValueType.BOOLEAN, "Whether to submit the enclosing form.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val selector = arguments.stringArg("selector")
        val value = arguments.stringArg("value")
        if (selector.isBlank()) return ToolResult(false, "", "selector 不能为空")
        val result = browserRuntime.fill(
            sessionId = arguments.stringArg("sessionId"),
            selector = selector,
            value = value,
            index = arguments.intArg("index", 0),
            submit = arguments.booleanArg("submit", false)
        )
        val success = result["success"] as? Boolean ?: false
        return ToolResult(
            success = success,
            output = jsonOutput(result),
            error = if (success) null else result["error"]?.toString()
        )
    }
}

class BrowserWaitForTool(
    private val browserRuntime: BrowserRuntimeManager
) : Tool {
    override val schema = ToolSchema(
        name = "browser_wait_for",
        family = ToolFamily.BROWSER,
        description = "Wait for a selector or text to appear in the current browser session.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("browser", "wait"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("browser_runtime"),
        scopes = listOf(ToolScope.BROWSER),
        inputSchema = listOf(
            ToolParameterSchema("sessionId", ToolValueType.STRING, "Browser session ID.", required = false),
            ToolParameterSchema("selector", ToolValueType.STRING, "CSS selector to wait for.", required = false),
            ToolParameterSchema("text", ToolValueType.STRING, "Text to wait for.", required = false),
            ToolParameterSchema("timeoutSeconds", ToolValueType.INTEGER, "Timeout in seconds.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val selector = arguments.stringArg("selector")
        val text = arguments.stringArg("text")
        if (selector.isBlank() && text.isBlank()) {
            return ToolResult(false, "", "selector 或 text 至少填写一个")
        }
        val result = browserRuntime.waitFor(
            sessionId = arguments.stringArg("sessionId"),
            selector = selector,
            text = text,
            timeoutMs = arguments.intArg("timeoutSeconds", 15).coerceIn(1, 120) * 1000L
        )
        return ToolResult(true, output = jsonOutput(result))
    }
}

class BrowserExtractPageTool(
    private val browserRuntime: BrowserRuntimeManager
) : Tool {
    override val schema = ToolSchema(
        name = "browser_extract_page",
        family = ToolFamily.BROWSER,
        description = "Extract readable text from the current page in an active browser session.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("browser", "extract_content"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("browser_runtime"),
        scopes = listOf(ToolScope.BROWSER, ToolScope.KNOWLEDGE),
        inputSchema = listOf(
            ToolParameterSchema("sessionId", ToolValueType.STRING, "Browser session ID.", required = false),
            ToolParameterSchema("maxTextChars", ToolValueType.INTEGER, "Maximum extracted text length.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("url", ToolValueType.STRING, "Current URL."),
            ToolFieldSchema("title", ToolValueType.STRING, "Current page title."),
            ToolFieldSchema("text", ToolValueType.STRING, "Readable extracted text.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val result = browserRuntime.extractCurrentPage(
            sessionId = arguments.stringArg("sessionId"),
            maxTextChars = arguments.intArg("maxTextChars", 6000)
        )
        return ToolResult(true, output = jsonOutput(result))
    }
}

class BrowserScreenshotTool(
    private val browserRuntime: BrowserRuntimeManager
) : Tool {
    override val schema = ToolSchema(
        name = "browser_screenshot",
        family = ToolFamily.BROWSER,
        description = "Capture a screenshot of the current browser session viewport or full page.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("browser", "screenshot"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("browser_runtime"),
        scopes = listOf(ToolScope.BROWSER, ToolScope.SCREEN),
        inputSchema = listOf(
            ToolParameterSchema("sessionId", ToolValueType.STRING, "Browser session ID.", required = false),
            ToolParameterSchema("fullPage", ToolValueType.BOOLEAN, "Whether to capture the whole page.", required = false),
            ToolParameterSchema("maxHeightPx", ToolValueType.INTEGER, "Maximum full-page height cap in pixels.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("uri", ToolValueType.STRING, "Screenshot content URI."),
            ToolFieldSchema("width", ToolValueType.INTEGER, "Captured width."),
            ToolFieldSchema("height", ToolValueType.INTEGER, "Captured height.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val result = browserRuntime.captureScreenshot(
            sessionId = arguments.stringArg("sessionId"),
            fullPage = arguments.booleanArg("fullPage", false),
            maxHeightPx = arguments.intArg("maxHeightPx", 8_000).coerceIn(1_000, 20_000)
        )
        return ToolResult(true, output = jsonOutput(result))
    }
}

class BrowserHandoffToCustomTabTool(
    private val context: Context,
    private val browserRuntime: BrowserRuntimeManager
) : Tool {
    override val schema = ToolSchema(
        name = "browser_handoff_to_custom_tab",
        family = ToolFamily.BROWSER,
        description = "Open the current browser session URL or a provided URL in Android Custom Tabs for stronger auth and session handling.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("browser", "custom_tabs", "handoff"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("browser_runtime"),
        scopes = listOf(ToolScope.BROWSER, ToolScope.NETWORK),
        accessRequirements = listOf(
            ToolAccessRequirement(
                kind = ToolAccessKind.NETWORK,
                identifier = "public_http",
                description = "需要联网打开网页"
            )
        ),
        inputSchema = listOf(
            ToolParameterSchema("sessionId", ToolValueType.STRING, "Browser session ID.", required = false),
            ToolParameterSchema("url", ToolValueType.STRING, "Optional URL override.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val targetUrl = resolveTargetUrl(arguments, browserRuntime)
            ?: return ToolResult(false, "", "没有可接管的浏览器地址")
        val parsed = runCatching { Uri.parse(validatePublicNetworkUrl(targetUrl)) }.getOrElse {
            return ToolResult(false, "", it.message ?: "url 不合法")
        }
        return runCatching {
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()
            customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            customTabsIntent.launchUrl(this.context, parsed)
            ToolResult(true, output = jsonOutput(mapOf("success" to true, "url" to parsed.toString())))
        }.getOrElse {
            ToolResult(false, "", it.message ?: "无法打开 Custom Tab")
        }
    }
}

class BrowserDownloadFileTool(
    private val context: Context,
    private val browserRuntime: BrowserRuntimeManager
) : Tool {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    override val schema = ToolSchema(
        name = "browser_download_file",
        family = ToolFamily.BROWSER,
        description = "Download the current browser session URL or a provided public URL into Downloads/Xiaoxiami.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("browser", "download"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("browser_runtime"),
        scopes = listOf(ToolScope.BROWSER, ToolScope.NETWORK, ToolScope.FILE_SYSTEM),
        accessRequirements = listOf(
            ToolAccessRequirement(
                kind = ToolAccessKind.NETWORK,
                identifier = "public_http",
                description = "需要联网下载公开资源"
            )
        ),
        inputSchema = listOf(
            ToolParameterSchema("sessionId", ToolValueType.STRING, "Browser session ID.", required = false),
            ToolParameterSchema("url", ToolValueType.STRING, "Optional URL override.", required = false),
            ToolParameterSchema("displayName", ToolValueType.STRING, "Optional output file name.", required = false),
            ToolParameterSchema("timeoutSeconds", ToolValueType.INTEGER, "Download timeout in seconds.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("uri", ToolValueType.STRING, "Saved Downloads URI."),
            ToolFieldSchema("displayName", ToolValueType.STRING, "Saved file name."),
            ToolFieldSchema("mimeType", ToolValueType.STRING, "Resolved MIME type.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val targetUrl = resolveTargetUrl(arguments, browserRuntime)
            ?: return ToolResult(false, "", "没有可下载的浏览器地址")
        val validatedUrl = runCatching { validatePublicNetworkUrl(targetUrl) }.getOrElse {
            return ToolResult(false, "", it.message ?: "url 不合法")
        }
        val timeoutSeconds = arguments.intArg("timeoutSeconds", 30).coerceIn(5, 180)
        val request = Request.Builder()
            .url(validatedUrl)
            .header("User-Agent", "Mozilla/5.0 (Linux; Android 14) XiaoxiamiBrowserRuntime/1.0")
            .build()
        val response = runCatching {
            client.newBuilder()
                .connectTimeout(timeoutSeconds.toLong(), TimeUnit.SECONDS)
                .readTimeout(timeoutSeconds.toLong(), TimeUnit.SECONDS)
                .build()
                .newCall(request)
                .execute()
        }.getOrElse {
            return ToolResult(false, "", it.message ?: "下载失败")
        }
        response.use { http ->
            if (!http.isSuccessful) {
                return ToolResult(false, "", "下载失败: HTTP ${http.code}")
            }
            val bytes = http.body?.bytes() ?: return ToolResult(false, "", "下载内容为空")
            val mimeType = http.body?.contentType()?.toString()
                ?: URLConnection.guessContentTypeFromName(validatedUrl)
                ?: "application/octet-stream"
            val fileName = arguments.stringArg("displayName").ifBlank {
                deriveDownloadName(validatedUrl, mimeType)
            }
            val uri = writeBytesToDownloads(this.context, fileName, mimeType, bytes)
                ?: return ToolResult(false, "", "无法写入下载目录")
            return ToolResult(
                success = true,
                output = jsonOutput(
                    mapOf(
                        "uri" to uri.toString(),
                        "displayName" to fileName,
                        "mimeType" to mimeType,
                        "sizeBytes" to bytes.size
                    )
                )
            )
        }
    }
}

class BrowserUploadFileTool(
    private val browserRuntime: BrowserRuntimeManager
) : Tool {
    override val schema = ToolSchema(
        name = "browser_upload_file",
        family = ToolFamily.BROWSER,
        description = "Trigger a file upload on a file input element in the browser session. Requires user interaction to select files.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        executionMode = ToolExecutionMode.USER_INTERACTION,
        capabilities = listOf("browser", "file_upload"),
        riskLevel = ToolRiskLevel.HIGH,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("browser_runtime"),
        scopes = listOf(ToolScope.BROWSER, ToolScope.FILE_SYSTEM),
        approvalRequired = true,
        approvalReason = "浏览器文件上传需要用户选择文件并确认。",
        approvalSummary = "Agent 请求通过浏览器上传文件",
        inputSchema = listOf(
            ToolParameterSchema("sessionId", ToolValueType.STRING, "Browser session ID.", required = false),
            ToolParameterSchema("selector", ToolValueType.STRING, "CSS selector for the file input element.", required = true)
        ),
        outputSchema = listOf(
            ToolFieldSchema("success", ToolValueType.BOOLEAN, "Whether the upload was initiated."),
            ToolFieldSchema("message", ToolValueType.STRING, "Result message.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val selector = arguments.stringArg("selector")
        if (selector.isBlank()) return ToolResult(false, "", "selector 不能为空")

        val sessionId = arguments.stringArg("sessionId")
        val snapshot = browserRuntime.getSessionSnapshot(sessionId)

        // Click the file input to trigger onShowFileChooser
        val clickResult = browserRuntime.click(sessionId = snapshot.id, selector = selector)
        val clickSuccess = clickResult["success"] as? Boolean ?: false

        if (!clickSuccess) {
            return ToolResult(false, "", "无法点击文件输入: ${clickResult["error"]}")
        }

        // Request user interaction to show the browser panel for file selection
        val interactionResult = context.interactionHandler(
            ToolInteractionRequest(
                requestId = java.util.UUID.randomUUID().toString(),
                toolName = "browser_upload_file",
                kind = ToolInteractionKind.BROWSER_FILE_UPLOAD,
                title = "浏览器文件上传",
                description = "请在浏览器面板中选择要上传的文件",
                payload = mapOf(
                    "sessionId" to snapshot.id,
                    "selector" to selector,
                    "url" to snapshot.url
                )
            )
        )

        return if (interactionResult.success) {
            ToolResult(
                success = true,
                output = jsonOutput(mapOf(
                    "success" to true,
                    "message" to "文件上传已完成"
                ))
            )
        } else {
            ToolResult(
                success = false,
                output = jsonOutput(mapOf("success" to false)),
                error = interactionResult.error ?: "文件上传被取消或失败"
            )
        }
    }
}

private suspend fun resolveTargetUrl(
    arguments: Map<String, Any?>,
    browserRuntime: BrowserRuntimeManager
): String? {
    val directUrl = arguments.stringArg("url")
    if (directUrl.isNotBlank()) return directUrl
    val sessionId = arguments.stringArg("sessionId")
    if (sessionId.isBlank()) return null
    return browserRuntime.getSessionSnapshot(sessionId).url.takeIf { it.isNotBlank() }
}

private fun deriveDownloadName(url: String, mimeType: String): String {
    val parsed = runCatching { Uri.parse(url) }.getOrNull()
    val lastSegment = parsed?.lastPathSegment?.substringAfterLast('/')?.substringBefore('?').orEmpty()
    if (lastSegment.isNotBlank()) return lastSegment
    val extension = guessExtensionFromMimeType(mimeType)
    return "browser_download_${System.currentTimeMillis()}.$extension"
}
