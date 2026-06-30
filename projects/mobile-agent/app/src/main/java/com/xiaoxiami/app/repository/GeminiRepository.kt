package com.xiaoxiami.app.repository

import android.content.Context
import android.graphics.Bitmap
import android.util.Base64
import android.util.Log
import com.xiaoxiami.app.BuildConfig
import com.xiaoxiami.app.config.AIConfig
import com.xiaoxiami.app.config.DebugConfig
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.awaitAll
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.content
import com.google.ai.client.generativeai.type.generationConfig
import com.google.ai.client.generativeai.type.BlockThreshold
import com.google.ai.client.generativeai.type.HarmCategory
import com.google.ai.client.generativeai.type.SafetySetting
import java.util.UUID

// REMOVED: SourceSignalDTO, AudioEventDTO, TagDTO - visual/auditory memory data classes

data class ExtractedField(
    val fieldKey: String,   // 字段键：姓名、手机号 等
    val fieldValue: String  // 字段值
)

class GeminiRepository(private val context: Context) {
    
    companion object {
        private const val TAG = "GeminiRepository"
        private const val API_TIMEOUT_MS = 60_000L
        // P0: 解决“Gemini 卡住很久才回退”——10s 连接/首包超时后立刻走兜底模型
        private const val GEMINI_CONNECT_TIMEOUT_SECONDS = 60L
        private const val GEMINI_STREAM_FIRST_DATA_TIMEOUT_MS = 60_000L
    }
    
    private val gson = Gson()
    
    // Proxy Service dependencies for fallback
    private val tosStorageService: com.xiaoxiami.app.service.TosStorageService by lazy { 
        com.xiaoxiami.app.service.TosStorageService() 
    }
    private val proxyApiService: com.xiaoxiami.app.service.ProxyApiService by lazy { 
        com.xiaoxiami.app.service.ProxyApiService() 
    }
    
    // HTTP Client for Doubao & Qwen
    private val client: OkHttpClient = getUnsafeOkHttpClient()
    private val safeClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(300, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        // Let OkHttp choose the best protocol (HTTP/2 or HTTP/1.1)
        .build()

    // Gemini Streaming 专用：缩短 connectTimeout，避免在不可达网络下卡住 60s+ 才回退
    private val geminiStreamClient: OkHttpClient by lazy {
        client.newBuilder()
            .connectTimeout(GEMINI_CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .build()
    }
    private val geminiStreamSafeClient: OkHttpClient by lazy {
        safeClient.newBuilder()
            .connectTimeout(GEMINI_CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .build()
    }

    private fun getUnsafeOkHttpClient(): OkHttpClient {
        try {
            // Create a trust manager that does not validate certificate chains
            val trustAllCerts = arrayOf<javax.net.ssl.TrustManager>(object : javax.net.ssl.X509TrustManager {
                override fun checkClientTrusted(chain: Array<java.security.cert.X509Certificate>, authType: String) {}
                override fun checkServerTrusted(chain: Array<java.security.cert.X509Certificate>, authType: String) {}
                override fun getAcceptedIssuers(): Array<java.security.cert.X509Certificate> = arrayOf()
            })

            // Install the all-trusting trust manager
            val sslContext = javax.net.ssl.SSLContext.getInstance("TLS")
            sslContext.init(null, trustAllCerts, java.security.SecureRandom())

            val sslSocketFactory = sslContext.socketFactory

            val builder = OkHttpClient.Builder()
                .connectTimeout(60, TimeUnit.SECONDS)
                .readTimeout(300, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS)
                .sslSocketFactory(sslSocketFactory, trustAllCerts[0] as javax.net.ssl.X509TrustManager)
                .hostnameVerifier { _, _ -> true }
                
            return builder.build()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create unsafe client, falling back to safe client", e)
            return OkHttpClient.Builder()
                .connectTimeout(60, TimeUnit.SECONDS)
                .readTimeout(300, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS)
                .build()
        }
    }

    // ==================== 辅助模型类 (兼容旧代码) ====================
    
    /**
     * 模拟 GenerativeModel 的简化包装类，内部使用 ProxyApiService
     */
    inner class ProxyGenerativeModel(
        private val modelName: String,
        private val jsonMode: Boolean = false
    ) {
        suspend fun generateContent(prompt: String): ProxyGenerateContentResponse {
            val response = proxyApiService.callMultimodalChat(
                prompt = prompt,
                modelName = modelName
            )
            return ProxyGenerateContentResponse(response)
        }
        
        suspend fun generateContent(vararg parts: Any): ProxyGenerateContentResponse {
            // 提取文本内容
            val textParts = parts.filterIsInstance<String>()
            val prompt = textParts.joinToString("\n")
            return generateContent(prompt)
        }
    }
    
    data class ProxyGenerateContentResponse(val text: String?)
    
    /**
     * 获取模型实例 (使用 Proxy 代理)
     */
    private fun getModel(modelName: String, jsonMode: Boolean = false): ProxyGenerativeModel {
        val proxyModel = when {
            modelName.contains("pro", ignoreCase = true) -> 
                com.xiaoxiami.app.service.ProxyApiService.Models.GEMINI_PRO
            else -> 
                com.xiaoxiami.app.service.ProxyApiService.Models.GEMINI_FLASH
        }
        return ProxyGenerativeModel(proxyModel, jsonMode)
    }
    
    /**
     * 获取旧版模型 (兼容层，使用 Proxy)
     */
    private fun getLegacyModel(): ProxyGenerativeModel {
        return ProxyGenerativeModel(
            com.xiaoxiami.app.service.ProxyApiService.Models.GEMINI_FLASH
        )
    }
    
    /**
     * 调用 Gemini Interactions API (使用 Proxy 代理)
     */
    private suspend fun callGeminiInteractionsAPI(
        systemPrompt: String,
        userPrompt: String,
        jsonMode: Boolean = false,
        enableGoogleSearch: Boolean = false,
        enableThinking: Boolean = false
    ): String {
        return proxyApiService.callMultimodalChat(
            prompt = "$systemPrompt\n\n$userPrompt",
            systemPrompt = systemPrompt,
            modelName = com.xiaoxiami.app.service.ProxyApiService.Models.GEMINI_PRO
        )
    }



    /**
     * 🆕 统一调用方法：优先使用 Proxy Gemini，失败后直连豆包 1.8
     * 用于替代 proxyApiService.callMultimodalChatWithFallback + SKYLARK
     * 
     * @param prompt 用户输入
     * @param systemPrompt 系统提示词
     * @param imageBase64s 图片 Base64 列表（可选）
     * @return 响应内容
     */
    suspend fun callProxyWithDoubaoFallback(
        prompt: String,
        systemPrompt: String = "",
        imageBase64s: List<String> = emptyList()
    ): String = withContext(Dispatchers.IO) {
        // 1. 优先使用 Proxy Gemini Flash
        try {
            Log.d(TAG, "📡 调用 Proxy Gemini Flash...")
            val response = proxyApiService.callMultimodalChat(
                prompt = prompt,
                systemPrompt = systemPrompt,
                imageBase64s = imageBase64s,
                modelName = com.xiaoxiami.app.service.ProxyApiService.Models.GEMINI_FLASH
            )
            if (response.isNotBlank()) {
                Log.d(TAG, "✅ Proxy Gemini Flash 成功")
                return@withContext response
            }
            Log.w(TAG, "⚠️ Proxy Gemini Flash 返回空，尝试直连豆包...")
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            Log.w(TAG, "⚠️ Proxy Gemini Flash 失败: ${e.message}，尝试直连豆包...")
        }
        
        // 2. Fallback: 直连豆包 1.8 (Responses API)
        try {
            Log.d(TAG, "📡 直连豆包 1.8 (Responses API)...")
            val combinedPrompt = if (systemPrompt.isNotBlank()) {
                "$systemPrompt\n\n$prompt"
            } else {
                prompt
            }
            val response = callDoubaoResponses(
                prompt = combinedPrompt,
                systemPrompt = "",
                enableSearch = false  // 非对话场景关闭联网搜索
            )
            if (response.isNotBlank()) {
                Log.d(TAG, "✅ 直连豆包 1.8 成功")
                return@withContext response
            }
            throw Exception("豆包 1.8 返回空内容")
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            Log.e(TAG, "❌ 直连豆包 1.8 失败: ${e.message}")
            throw e
        }
    }
    
    /**
     * Unified Chat Method: Prioritize Gemini (via Proxy), Fallback to Doubao
     */
    private suspend fun callSmartChat(
        systemPrompt: String,
        userPrompt: String,
        fallbackDoubaoModel: String = AIConfig.DOUBAO_MODEL_ID,
        jsonMode: Boolean = false,
        enableGoogleSearch: Boolean = false
    ): String = withContext(Dispatchers.IO) {
        // 1. Try Gemini via Proxy (Priority)
        try {
            // Use Proxy Service instead of direct call
            val responseText = proxyApiService.callMultimodalChat(
                prompt = userPrompt,
                systemPrompt = systemPrompt,
                modelName = com.xiaoxiami.app.service.ProxyApiService.Models.GEMINI_PRO // Use Pro for "Smart" chat
            )
            
            // Proxy returns the text content directly (or we might need to parse if it was JSON-wrapped, 
            // but callMultimodalChat usually returns the content string)
            if (responseText.isNotBlank()) return@withContext responseText
            
            Log.w(TAG, "Gemini Proxy returned empty text, falling back...")
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            Log.w(TAG, "Gemini Smart Chat (Proxy) failed: ${e.message}, falling back to Doubao...")
        }

        // 2. Fallback to Doubao
        return@withContext callDoubaoChat(systemPrompt, userPrompt, fallbackDoubaoModel)
    }
    
    // ==================== Connectivity Test Implementation ====================

    enum class TestModelGroup(val displayName: String) {
        TEXT_GEN("生文模型"),
        IMAGE_GEN("生图模型"),
        DEEP_RESEARCH("深度研究模型"),
        WEBPAGE_GEN("网页生成模型")
    }

    data class TestModel(
        val id: String,
        val name: String,
        val group: TestModelGroup,
        val query: String
    )

    data class TestResult(
        val status: String, // 成功 / 失败 / 超时 / 其他
        val errorCode: String? = null,
        val errorMessage: String? = null,
        val reason: String? = null,
        val suggestion: String? = null,
        val rawResponse: String? = null
    )

    val testModels = listOf(
        // 1. 生文模型 (各个阶段备选)
        TestModel("doubao_text", "豆包 1.6 文本 (默认)", TestModelGroup.TEXT_GEN, "这是连通性测试，收到请回复OK"),
        TestModel("doubao_vision", "豆包 1.6 视觉 (默认)", TestModelGroup.TEXT_GEN, "这是连通性测试，收到请回复OK"),
        TestModel("gemini_3_pro", "Gemini 3 Pro (智力最强)", TestModelGroup.TEXT_GEN, "这是连通性测试，收到请回复OK"),
        TestModel("gemini_3_flash", "Gemini 3 Flash (文本生成)", TestModelGroup.TEXT_GEN, "这是连通性测试，收到请回复OK"),
        // 🆕 三个 Proxy 模型
        TestModel("proxy_gemini_pro_v3", "中间代理 geminiProV3Preview", TestModelGroup.TEXT_GEN, "这是连通性测试，收到请回复OK"),
        TestModel("proxy_gemini_flash_v3", "中间代理 geminiFlashV3Preview", TestModelGroup.TEXT_GEN, "这是连通性测试，收到请回复OK"),
        TestModel("doubao_direct", "直连豆包 1.8 (Responses API)", TestModelGroup.TEXT_GEN, "这是连通性测试，收到请回复OK"),

        TestModel("mify_mimo_text", "Mify mimo-v2-flash (文本)", TestModelGroup.TEXT_GEN, "这是连通性测试，收到请回复OK"),
        
        // 2. 生图模型
        TestModel("doubao_seed", "豆包 Seed (主题配图)", TestModelGroup.IMAGE_GEN, "画一个小狗"),
        
        // 3. 网页生成模型
        TestModel("web_gen_gemini", "Gemini 网页生成 (gemini-3-flash-preview)", TestModelGroup.WEBPAGE_GEN, "帮我完全复刻一个百度搜索框的网页"),
        TestModel("web_gen_doubao", "豆包 网页生成 (doubao-code-preview)", TestModelGroup.WEBPAGE_GEN, "帮我完全复刻一个百度搜索框的网页"),
        TestModel("web_gen_mify", "Mify 网页生成 (mimo-v2-flash)", TestModelGroup.WEBPAGE_GEN, "帮我完全复刻一个百度搜索框的网页")
    )

    suspend fun performConnectivityTest(model: TestModel): TestResult = withContext(Dispatchers.IO) {
        Log.d(TAG, "开始连通性测试: [${model.group.displayName}] ${model.name} (ID: ${model.id})")
        val startTime = System.currentTimeMillis()
        try {
            val result = when (model.id) {
                "doubao_text", "doubao_vision" -> {
                    val endpoint = AIConfig.DOUBAO_ENDPOINT
                    val modelId = if (model.id == "doubao_text") AIConfig.DOUBAO_MODEL_ID else AIConfig.DOUBAO_MODEL_VISION
                    testChatCompletion(endpoint, AIConfig.DOUBAO_API_KEY, modelId, model.query)
                }
                "gemini_3_pro", "gemini_3_flash" -> {
                    val modelName = when(model.id) {
                        "gemini_3_pro" -> AIConfig.MODEL_SMART
                        else -> AIConfig.MODEL_FLASH
                    }
                    val generativeModel = getModel(modelName, jsonMode = false)
                    val response = generativeModel.generateContent(model.query)
                    if (response.text?.isNotBlank() == true) {
                        TestResult("成功", rawResponse = response.text)
                    } else {
                        TestResult("失败", errorCode = "EMPTY_RESPONSE", errorMessage = "模型返回内容为空")
                    }
                }
                "proxy_gemini_pro_v3" -> {
                    if (!proxyApiService.isConfigured()) {
                         TestResult("失败", errorCode = "CONFIG_MISSING", errorMessage = "代理服务未配置 (API Key/Secret)", suggestion = "请检查 local.properties 配置")
                    } else {
                        try {
                            val response = proxyApiService.callMultimodalChat(
                                prompt = model.query,
                                modelName = com.xiaoxiami.app.service.ProxyApiService.Models.GEMINI_PRO
                            )
                            if (response.isNotBlank()) TestResult("成功", rawResponse = response) else TestResult("失败", errorMessage = "返回内容为空")
                        } catch (e: Exception) {
                            TestResult("失败", errorCode = "PROXY_ERROR", errorMessage = e.message, reason = Log.getStackTraceString(e))
                        }
                    }
                }
                "proxy_gemini_flash_v3" -> {
                    if (!proxyApiService.isConfigured()) {
                         TestResult("失败", errorCode = "CONFIG_MISSING", errorMessage = "代理服务未配置 (API Key/Secret)", suggestion = "请检查 local.properties 配置")
                    } else {
                        try {
                            val response = proxyApiService.callMultimodalChat(
                                prompt = model.query,
                                modelName = com.xiaoxiami.app.service.ProxyApiService.Models.GEMINI_FLASH
                            )
                            if (response.isNotBlank()) TestResult("成功", rawResponse = response) else TestResult("失败", errorMessage = "返回内容为空")
                        } catch (e: Exception) {
                            TestResult("失败", errorCode = "PROXY_ERROR", errorMessage = e.message, reason = Log.getStackTraceString(e))
                        }
                    }
                }
                "doubao_direct" -> {
                    // 🆕 测试直连豆包 1.8 (Responses API)
                    try {
                        val response = callDoubaoResponses(
                            prompt = model.query,
                            systemPrompt = "",
                            enableSearch = false
                        )
                        if (response.isNotBlank()) TestResult("成功", rawResponse = response) else TestResult("失败", errorMessage = "返回内容为空")
                    } catch (e: Exception) {
                        TestResult("失败", errorCode = "DOUBAO_DIRECT_ERROR", errorMessage = e.message, reason = Log.getStackTraceString(e))
                    }
                }
                "doubao_seed" -> {
                    val payload = mapOf(
                        "model" to AIConfig.DOUBAO_MODEL_IMAGE,
                        "prompt" to model.query
                    )
                    val request = Request.Builder()
                        .url(AIConfig.DOUBAO_IMAGE_ENDPOINT)
                        .addHeader("Authorization", "Bearer ${AIConfig.DOUBAO_IMAGE_KEY}")
                        .post(gson.toJson(payload).toRequestBody("application/json".toMediaType()))
                        .build()
                    
                    callWithFallback(request).use { response ->
                        if (response.isSuccessful) {
                            TestResult("成功", rawResponse = "图片生成请求已发送成功")
                        } else {
                            parseErrorResponse(response)
                        }
                    }
                }
                "web_gen_gemini", "web_gen_doubao", "web_gen_mify" -> {
                    if (model.id == "web_gen_gemini") {
                        val generativeModel = getModel(AIConfig.MODEL_FLASH, jsonMode = false)
                        val response = generativeModel.generateContent(model.query)
                        if (response.text?.isNotBlank() == true) TestResult("成功") else TestResult("失败")
                    } else if (model.id == "web_gen_doubao") {
                        testChatCompletion(AIConfig.DOUBAO_ENDPOINT, AIConfig.DOUBAO_API_KEY, AIConfig.DOUBAO_MODEL_CODE, model.query)
                    } else {
                        // web_gen_mify - try HTTPS, then HTTP, then Backup
                        var lastException: Exception? = null
                        val endpoints = listOf(AIConfig.MIFY_ENDPOINT, AIConfig.MIFY_ENDPOINT_HTTP, AIConfig.MIFY_ENDPOINT_BACKUP)
                        for (url in endpoints) {
                            try {
                                val res = testChatCompletion(url, AIConfig.MIFY_API_KEY, AIConfig.MIFY_MODEL_MIMO_V2_FLASH, model.query)
                                if (res.status == "成功") return@withContext res
                            } catch (e: Exception) {
                                lastException = e
                                Log.w(TAG, "Mify web test failed for $url: ${e.message}")
                            }
                        }
                        TestResult("失败", errorCode = "MIFY_FAILED", errorMessage = lastException?.message ?: "所有 Mify 端点失败")
                    }
                }
                "mify_mimo_text" -> {
                    // try HTTPS, then HTTP, then Backup
                    var lastException: Exception? = null
                    val endpoints = listOf(AIConfig.MIFY_ENDPOINT, AIConfig.MIFY_ENDPOINT_HTTP, AIConfig.MIFY_ENDPOINT_BACKUP)
                    for (url in endpoints) {
                        try {
                            val res = testChatCompletion(url, AIConfig.MIFY_API_KEY, AIConfig.MIFY_MODEL_MIMO_V2_FLASH, model.query)
                            if (res.status == "成功") return@withContext res
                        } catch (e: Exception) {
                            lastException = e
                            Log.w(TAG, "Mify text test failed for $url: ${e.message}")
                        }
                    }
                    TestResult("失败", errorCode = "MIFY_FAILED", errorMessage = lastException?.message ?: "所有 Mify 端点失败")
                }
                else -> TestResult("其他", errorMessage = "未实现的测试模型")
            }
            
            val duration = System.currentTimeMillis() - startTime
            if (result.status == "成功") {
                Log.i(TAG, "测试成功 [${model.name}]: 耗时 ${duration}ms")
            } else {
                Log.e(TAG, "测试失败 [${model.name}]: 错误码=${result.errorCode}, 错误信息=${result.errorMessage}, 详情=${result.reason}, 耗时 ${duration}ms")
            }
            result
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            val result = if (e is java.net.SocketTimeoutException) {
                TestResult("超时", errorCode = "TIMEOUT", errorMessage = "连接超时，请检查网络或VPN设置", suggestion = "请确保已开启全局梯子并能正常访问对应服务域名")
            } else {
                val message = e.message ?: ""
                if (message.contains("User location is not supported") || 
                   (message.contains("Unexpected Response") && message.contains("400"))) {
                     TestResult("失败", 
                        errorCode = "REGION_ERROR", 
                        errorMessage = "当前地区不支持 Gemini API", 
                        reason = "User location is not supported (HTTP 400)", 
                        suggestion = "请切换 VPN 节点到美国/新加坡等支持地区"
                     )
                } else {
                    TestResult("失败", errorCode = e.javaClass.simpleName, errorMessage = e.message ?: "未知错误", reason = e.cause?.message, suggestion = "检查 API Key 是否正确，网络是否通畅")
                }
            }
            Log.e(TAG, "测试异常 [${model.name}]: 错误码=${result.errorCode}, 错误信息=${result.errorMessage}, 耗时 ${duration}ms", e)
            result
        }
    }

    private suspend fun testChatCompletion(url: String, key: String, modelId: String, query: String): TestResult {
        val payload = mapOf(
            "model" to modelId,
            "messages" to listOf(mapOf("role" to "user", "content" to query))
        )
        val requestBuilder = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $key")
            .addHeader("Content-Type", "application/json")
        
        // Mify (mimo) endpoints might need the provider ID header
        if (url.contains("mify.p.xiaomi.com") || url.contains("mify.io")) {
            requestBuilder.addHeader("X-Model-Provider-Id", "xiaomi")
        }
            
        val request = requestBuilder
            .post(gson.toJson(payload).toRequestBody("application/json".toMediaType()))
            .build()

        return try {
            callWithFallback(request).use { response ->
                if (response.isSuccessful) {
                    TestResult("成功")
                } else {
                    val result = parseErrorResponse(response)
                    result.copy(
                        errorMessage = "请求失败 (${response.code}): ${result.errorMessage}",
                        reason = "URL: $url\n${result.reason}"
                    )
                }
            }
        } catch (e: Exception) {
            TestResult(
                "失败",
                errorCode = e.javaClass.simpleName,
                errorMessage = "网络请求异常: ${e.message}",
                reason = "URL: $url\nCause: ${e.cause?.message ?: "无"}",
                suggestion = "检查网络连接、VPN状态或该模型服务是否可用"
            )
        }
    }

    private suspend fun executeRequest(httpClient: OkHttpClient, request: Request): TestResult {
        return httpClient.newCall(request).await().use { response ->
            if (response.isSuccessful) {
                TestResult("成功")
            } else {
                parseErrorResponse(response)
            }
        }
    }

    /**
     * Helper to execute a call with automatic fallback from unsafe client to safe client
     * on HTTPS "connection closed" or "handshake" errors.
     */
    private suspend fun callWithFallback(
        request: Request,
        isStream: Boolean = false,
        httpClient: OkHttpClient = client,
        safeHttpClient: OkHttpClient = safeClient
    ): Response {
        return try {
            httpClient.newCall(request).await()
        } catch (e: Exception) {
            val msg = e.message ?: ""
            val isHttps = request.url.isHttps
            if (isHttps && (msg.contains("connection closed") || msg.contains("handshake") || msg.contains("EOF"))) {
                Log.w(TAG, "Unsafe client failed for ${request.url} (${e.message}), retrying with safe client...")
                try {
                    safeHttpClient.newCall(request).await()
                } catch (eSafe: Exception) {
                    throw eSafe
                }
            } else {
                throw e
            }
        }
    }

    private fun parseErrorResponse(response: Response): TestResult {
        val body = response.body?.string()
        return try {
            val json = gson.fromJson(body, com.google.gson.JsonObject::class.java)
            val error = json.getAsJsonObject("error")
            val code = error?.get("code")?.asString ?: response.code.toString()
            val message = error?.get("message")?.asString ?: "HTTP Error"
            TestResult("失败", errorCode = code, errorMessage = message, reason = body, suggestion = "请根据错误码核对 API 文档或检查额度")
        } catch (e: Exception) {
            TestResult("失败", errorCode = response.code.toString(), errorMessage = "解析错误响应失败", reason = body)
        }
    }

    suspend fun testConnection(): Result<String> = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "Testing connection via Proxy Service...")
            
            // Check if configured
            if (!proxyApiService.isConfigured()) {
                return@withContext Result.failure(Exception("Proxy Service not configured (API Key/Secret missing)"))
            }
            
            val response = proxyApiService.callMultimodalChat(
                prompt = "Say hello",
                systemPrompt = "",
                modelName = com.xiaoxiami.app.service.ProxyApiService.Models.GEMINI_FLASH
            )
            
            if (response.isNotBlank()) {
                Log.d(TAG, "Test success: ${response.take(50)}")
                Result.success("✓ Proxy Connected (Gemini Flash)")
            } else {
                Log.e(TAG, "Test failed: Empty response")
                Result.failure(Exception("Empty response from Proxy"))
            }
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            Log.e(TAG, "Test connection exception: ${e.message}", e)
            Result.failure(e)
        }
    }

    private suspend fun <T> retryWithBackoff(
        times: Int = 3,
        initialDelay: Long = 2000,
        factor: Double = 2.0,
        block: suspend () -> T
    ): T {
        var currentDelay = initialDelay
        repeat(times - 1) {
            try {
                return block()
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                val msg = e.message ?: ""
                // Check for Rate Limit (429) or Quota issues
                if (msg.contains("429") || msg.contains("RATE_LIMIT") || msg.contains("Too Many Requests") || msg.contains("quota")) {
                    Log.w(TAG, "Rate limit detected. Retrying in ${currentDelay}ms...", e)
                    delay(currentDelay)
                    currentDelay = (currentDelay * factor).toLong()
                } else {
                    throw e
                }
            }
        }
        return block() // Last attempt
    }



    private suspend fun callDoubaoVision(
        systemPrompt: String,
        userPrompt: String,
        bitmap: Bitmap
    ): String = withContext(Dispatchers.IO) {
        retryWithBackoff {
            val jsonMediaType = "application/json; charset=utf-8".toMediaType()

            // Convert Bitmap to Base64
            val byteArrayOutputStream = java.io.ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 80, byteArrayOutputStream)
            val imageBytes = byteArrayOutputStream.toByteArray()
            val base64Image = Base64.encodeToString(imageBytes, Base64.NO_WRAP)
            
            // Construct Request Body
            val userContentList = listOf(
                mapOf(
                    "type" to "text",
                    "text" to userPrompt
                ),
                mapOf(
                    "type" to "image_url",
                    "image_url" to mapOf(
                        "url" to "data:image/jpeg;base64,$base64Image"
                    )
                )
            )

            val messages = listOf(
                mapOf("role" to "system", "content" to systemPrompt),
                mapOf("role" to "user", "content" to userContentList)
            )
            
            val requestBodyMap = mapOf(
                "model" to AIConfig.DOUBAO_MODEL_VISION,
                "messages" to messages,
                "max_tokens" to 8192
            )
            val requestBodyJson = gson.toJson(requestBodyMap)
            
            val request = Request.Builder()
                .url(AIConfig.DOUBAO_ENDPOINT)
                .addHeader("Authorization", "Bearer ${AIConfig.DOUBAO_API_KEY}")
                .addHeader("Content-Type", "application/json")
                .post(requestBodyJson.toRequestBody(jsonMediaType))
                .build()

            callWithFallback(request).use { response ->
                if (!response.isSuccessful) {
                    val errorBody = response.body?.string()
                    throw Exception("Doubao Vision API Error: ${response.code} $errorBody")
                }
                val responseBody = response.body?.string() ?: throw Exception("Empty Doubao Vision response")
                
                val jsonObject = gson.fromJson(responseBody, com.google.gson.JsonObject::class.java)
                val choices = jsonObject.getAsJsonArray("choices")
                if (choices == null || choices.size() == 0) throw Exception("No choices in Doubao response")
                
                val message = choices.get(0).asJsonObject.getAsJsonObject("message")
                message.get("content").asString
            }
        }
    }

    private suspend fun callDoubaoVisionMulti(
        systemPrompt: String,
        userPrompt: String,
        bitmaps: List<Bitmap>
    ): String = withContext(Dispatchers.IO) {
        retryWithBackoff {
            val jsonMediaType = "application/json; charset=utf-8".toMediaType()
            val userContentList = mutableListOf<Map<String, Any>>()
            userContentList.add(mapOf("type" to "text", "text" to userPrompt))
            bitmaps.forEach { bmp ->
                val baos = java.io.ByteArrayOutputStream()
                bmp.compress(Bitmap.CompressFormat.JPEG, 80, baos)
                val imageBytes = baos.toByteArray()
                val base64Image = Base64.encodeToString(imageBytes, Base64.NO_WRAP)
                userContentList.add(
                    mapOf(
                        "type" to "image_url",
                        "image_url" to mapOf("url" to "data:image/jpeg;base64,$base64Image")
                    )
                )
            }
            val messages = listOf(
                mapOf("role" to "system", "content" to systemPrompt),
                mapOf("role" to "user", "content" to userContentList)
            )
            val requestBodyMap = mapOf(
                "model" to AIConfig.DOUBAO_MODEL_VISION,
                "messages" to messages,
                "max_tokens" to 8192
            )
            val requestBodyJson = gson.toJson(requestBodyMap)
            
            val request = Request.Builder()
                .url(AIConfig.DOUBAO_ENDPOINT)
                .addHeader("Authorization", "Bearer ${AIConfig.DOUBAO_API_KEY}")
                .addHeader("Content-Type", "application/json")
                .post(requestBodyJson.toRequestBody(jsonMediaType))
                .build()
            callWithFallback(request).use { response ->
                if (!response.isSuccessful) {
                    val errorBody = response.body?.string()
                    throw Exception("Doubao Vision API Error (multi): ${response.code} $errorBody")
                }
                val responseBody = response.body?.string() ?: throw Exception("Empty Doubao Vision response (multi)")
                val jsonObject = gson.fromJson(responseBody, com.google.gson.JsonObject::class.java)
                val choices = jsonObject.getAsJsonArray("choices")
                if (choices == null || choices.size() == 0) throw Exception("No choices in Doubao response (multi)")
                val message = choices.get(0).asJsonObject.getAsJsonObject("message")
                message.get("content").asString
            }
        }
    }

    private suspend fun callDoubaoImageGeneration(prompt: String, model: String = AIConfig.DOUBAO_MODEL_IMAGE): String = withContext(Dispatchers.IO) {
        retryWithBackoff(times = 2) { // Less retries for image
            val jsonMediaType = "application/json; charset=utf-8".toMediaType()
            
            val requestBodyMap = mapOf(
                "model" to model,
                "prompt" to prompt,
                "size" to "2048x2048" // Updated to meet 3.6MP requirement (2048x2048 = 4.19MP)
            )
            val requestBodyJson = gson.toJson(requestBodyMap)
            
            val request = Request.Builder()
                .url(AIConfig.DOUBAO_IMAGE_ENDPOINT)
                .addHeader("Authorization", "Bearer ${AIConfig.DOUBAO_IMAGE_KEY}")
                .addHeader("Content-Type", "application/json")
                .post(requestBodyJson.toRequestBody(jsonMediaType))
                .build()

            callWithFallback(request).use { response ->
                if (!response.isSuccessful) {
                    val errorBody = response.body?.string()
                    // Throw explicit error with code and body for debugging
                    throw Exception("Doubao Image API Error ($model): ${response.code} $errorBody")
                }
                val responseBody = response.body?.string() ?: throw Exception("Empty Doubao Image response")
                
                val jsonObject = gson.fromJson(responseBody, com.google.gson.JsonObject::class.java)
                val data = jsonObject.getAsJsonArray("data")
                if (data == null || data.size() == 0) throw Exception("No image data in response: $responseBody")
                
                data.get(0).asJsonObject.get("url").asString
            }
        }
    }

    private suspend fun callDoubaoChat(
        systemPrompt: String,
        userPrompt: String,
        model: String = AIConfig.DOUBAO_MODEL_ID
    ): String = withContext(Dispatchers.IO) {
        retryWithBackoff {
            val jsonMediaType = "application/json; charset=utf-8".toMediaType()
            
            // Construct Request Body
            val messages = listOf(
                mapOf("role" to "system", "content" to systemPrompt),
                mapOf("role" to "user", "content" to userPrompt)
            )
            val maxTokens = if (model == AIConfig.DOUBAO_MODEL_CODE) 32768 else 8192
            val requestBodyMap = mapOf(
                "model" to model,
                "messages" to messages,
                "max_tokens" to maxTokens
            )
            val requestBodyJson = gson.toJson(requestBodyMap)
            
            val request = Request.Builder()
                .url(AIConfig.DOUBAO_ENDPOINT)
                .addHeader("Authorization", "Bearer ${AIConfig.DOUBAO_API_KEY}")
                .addHeader("Content-Type", "application/json")
                .post(requestBodyJson.toRequestBody(jsonMediaType))
                .build()

            callWithFallback(request).use { response ->
                if (!response.isSuccessful) {
                    val errorBody = response.body?.string()
                    throw Exception("Doubao API Error: ${response.code} $errorBody")
                }
                val responseBody = response.body?.string() ?: throw Exception("Empty Doubao response")
                
                val jsonObject = gson.fromJson(responseBody, com.google.gson.JsonObject::class.java)
                
                // Check for API-level errors in response body (if 200 OK but contains error field)
                if (jsonObject.has("error")) {
                    val errorObj = jsonObject.getAsJsonObject("error")
                    val errorMsg = errorObj.get("message")?.asString ?: errorObj.toString()
                    throw Exception("Doubao API Error (In Body): $errorMsg")
                }

                val choices = jsonObject.getAsJsonArray("choices")
                if (choices == null || choices.size() == 0) throw Exception("No choices in Doubao response: $responseBody")
                
                val message = choices.get(0).asJsonObject.getAsJsonObject("message")
                message.get("content").asString
            }
        }
    }

    // REMOVED: parseSourceSignal, parseAudioSourceSignal and related methods
    // (visual/auditory memory parsing pipeline - no longer needed)

    /**
     * Phase 3: Expression (Image Generation)
     */
    suspend fun generateImage(prompt: String): String? = withContext(Dispatchers.IO) {
        try {
             return@withContext callDoubaoImageGeneration(prompt)
        } catch (e: Exception) {
             Log.e(TAG, "Failed to generate image", e)
             null
        }
    }

    /**
     * 清洗 Tag 名称：去括号、知识更新、去符号
     */
    private fun cleanTagName(tagName: String): String {
        var name = tagName.trim()
        
        // 1. 去除括号及其内容 (英文括号和中文括号)
        // 例如: "手机厂商(MIUI)" -> "手机厂商"
        name = name.replace(Regex("\\(.*?\\)|（.*?）"), "").trim()
        
        // 2. 品牌词更新 (Knowledge Injection)
        name = when (name.lowercase()) {
            "miui" -> "小米澎湃OS"
            "hyperos" -> "小米澎湃OS"
            "twitter" -> "X"
            "facebook" -> "Meta"
            else -> name
        }
        
        // 3. 去除首尾特殊符号
        name = name.trim(' ', '　', '.', ',', '，', '。', '-', '_', ':', '：', '《', '》')
        
        return name
    }

    // ==================== Legacy Methods (Wrappers or Original) ====================
    
    /**
     * 通用文本分析方法 - 接受任意 prompt，返回 AI 响应文本
     * 用于通用结构化文本分析场景
     */
    suspend fun analyzeText(prompt: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "Analyzing text via Proxy...")
            
            if (!proxyApiService.isConfigured()) {
                return@withContext Result.failure(Exception("Proxy Service not configured"))
            }
            
            // 🆕 使用 Proxy Gemini Flash -> 直连豆包 1.8 (替代 SKYLARK)
            val text = callProxyWithDoubaoFallback(
                prompt = prompt,
                systemPrompt = ""
            )
            
            if (text.isBlank()) {
                Log.e(TAG, "Text analysis: empty response")
                return@withContext Result.failure(Exception("Empty response"))
            }
            
            Log.d(TAG, "✓ Text analysis response: ${text.take(100)}...")
            Result.success(text)
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            Log.e(TAG, "analyzeText failed: ${e.message}", e)
            Result.failure(e)
        }
    }

    private suspend fun processStream(
        source: okio.BufferedSource?,
        onChunk: (String) -> Unit,
        seqCounter: AtomicInteger,
        throwException: Boolean = false,
        // 仅用于“首包等待过久”场景：N ms 内没有任何 stream 数据，则抛错触发 fallback
        firstDataTimeoutMs: Long? = null
    ) {
        val source = source ?: throw Exception("No body")
        val buffer = StringBuilder()
        var hasStarted = false // Strict Mode: Drop text until first JSON
        var firstDataReceived = false
        val firstDataStartTs = System.currentTimeMillis()
        
        fun nowIso(): String = System.currentTimeMillis().toString()
        
        fun sanitizeHtml(s: String): String {
            return s
                .replace("\\", "\\\\")
                .replace("\n", "<br>")
                .replace("\r", "")
                .replace("\"", "\\\"")
                .replace("—", "--")
        }
        
        fun isValidContent(text: String): Boolean {
            // 过滤掉空白或无意义的内容块
            val trimmed = text.trim()
            if (trimmed.isEmpty()) return false
            if (trimmed.length < 10) return false // 太短的内容可能是噪音
            
            // 过滤掉只包含空白字符、换行、标点的块
            val meaningfulChars = trimmed.replace(Regex("[\\s\\n\\r\\t,.，。、；;：:！!？?]+"), "")
            if (meaningfulChars.length < 5) return false
            
            return true
        }

        fun wrapAppendSection(html: String): String {
            val payloadHtml = "<section><div class=\"stream-chunk\" style=\"max-width:760px;margin:0 auto;padding:12px 16px\"><p>" + sanitizeHtml(html) + "</p></div></section>"
            val obj = mapOf(
                "type" to "append_section",
                "seq" to seqCounter.getAndIncrement(),
                "ts" to nowIso(),
                "payload" to mapOf("html" to payloadHtml)
            )
            return gson.toJson(obj)
        }
        
        // Helper to validate and emit
        fun emitJson(jsonStr: String) {
            try {
                // Validate JSON format roughly
                if (!jsonStr.trim().startsWith("{")) return
                
                // Check specific events to mark start
                if (jsonStr.contains("\"meta\"") || jsonStr.contains("\"bootstrap_html\"")) {
                    hasStarted = true
                    Log.d(TAG, "Stream Started with event: ${jsonStr.take(50)}...")
                }
                
                if (hasStarted) {
                    if (BuildConfig.DEBUG) {
                         // Log first few chunks
                         if (seqCounter.get() < 5) Log.d(TAG, "Emit Chunk: $jsonStr")
                    }
                    onChunk(jsonStr)
                } else {
                    Log.w(TAG, "Dropping pre-start text: $jsonStr")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Emit JSON failed", e)
            }
        }

        try {
            while (!source.exhausted()) {
                currentCoroutineContext().ensureActive()
                val line = if (!firstDataReceived && firstDataTimeoutMs != null) {
                    val elapsed = System.currentTimeMillis() - firstDataStartTs
                    val remaining = firstDataTimeoutMs - elapsed
                    if (remaining <= 0) {
                        throw Exception("No stream data within ${firstDataTimeoutMs}ms (first chunk timeout)")
                    }
                    withTimeoutOrNull(remaining) { source.readUtf8Line() }
                        ?: throw Exception("No stream data within ${firstDataTimeoutMs}ms (first chunk timeout)")
                } else {
                    source.readUtf8Line()
                } ?: break
                
                if (line.startsWith("data:")) {
                    val jsonStr = line.substring(5).trim()
                    if (jsonStr == "[DONE]") break
                    if (jsonStr.isEmpty()) continue
                    if (!firstDataReceived) firstDataReceived = true
                    
                    try {
                        val json = gson.fromJson(jsonStr, com.google.gson.JsonObject::class.java)
                        val choices = json.getAsJsonArray("choices")
                        if (choices != null && choices.size() > 0) {
                            val choice0 = choices.get(0).asJsonObject
                            val delta = choice0.getAsJsonObject("delta")
                                ?: choice0.getAsJsonObject("message")
                                ?: choice0

                            var content: String? = null
                            when {
                                delta.has("content") && delta.get("content").isJsonPrimitive -> {
                                    content = delta.get("content").asString
                                }
                                delta.has("content") && delta.get("content").isJsonArray -> {
                                    // Handle array content (Gemini sometimes does this)
                                    val arr = delta.getAsJsonArray("content")
                                    val sb = StringBuilder()
                                    arr.forEach { el ->
                                        if (el.isJsonObject) {
                                            val obj = el.asJsonObject
                                            if (obj.has("text")) sb.append(obj.get("text").asString)
                                        } else if (el.isJsonPrimitive && el.asJsonPrimitive.isString) {
                                            sb.append(el.asString)
                                        }
                                    }
                                    content = sb.toString()
                                }
                                delta.has("output_text") -> content = delta.get("output_text").asString
                            }

                            if (!content.isNullOrEmpty()) {
                                buffer.append(content)
                                
                                // Process Buffer
                                var processed = true
                                while (processed) {
                                    processed = false
                                    val bufStr = buffer.toString()
                                    val newlineIdx = bufStr.indexOf("\n")
                                    
                                    if (newlineIdx >= 0) {
                                        val completeLine = bufStr.substring(0, newlineIdx).trim()
                                        buffer.delete(0, newlineIdx + 1)
                                        processed = true
                                        
                                        if (completeLine.isNotEmpty()) {
                                            if (completeLine.startsWith("{") && completeLine.endsWith("}")) {
                                                emitJson(completeLine)
                                            } else {
                                                // Text line? Only if started and valid content
                                                if (hasStarted && isValidContent(completeLine)) {
                                                    onChunk(wrapAppendSection(completeLine))
                                                } else if (hasStarted && !isValidContent(completeLine)) {
                                                    Log.d(TAG, "Filtered out invalid content: ${completeLine.take(50)}")
                                                }
                                            }
                                        }
                                    } else if (bufStr.trimStart().startsWith("{")) {
                                        // Brace Counting Logic
                                        var braceCount = 0
                                        var inQuote = false
                                        var escape = false
                                        var foundEnd = -1
                                        
                                        // Optimization: Only scan if length reasonable
                                        if (bufStr.length > 2) {
                                            for (i in 0 until bufStr.length) {
                                                val c = bufStr[i]
                                                if (escape) {
                                                    escape = false
                                                } else if (c == '\\') {
                                                    escape = true
                                                } else if (c == '"') {
                                                    inQuote = !inQuote
                                                } else if (!inQuote) {
                                                    if (c == '{') braceCount++
                                                    else if (c == '}') {
                                                        braceCount--
                                                        if (braceCount == 0) {
                                                            foundEnd = i
                                                            break
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        
                                        if (foundEnd != -1) {
                                            val completeObj = bufStr.substring(0, foundEnd + 1)
                                            buffer.delete(0, foundEnd + 1)
                                            processed = true
                                            emitJson(completeObj)
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Stream chunk parse error: ${e.message}")
                    }
                }
            }
            
            // Flush remaining buffer
            if (buffer.isNotEmpty()) {
                val remaining = buffer.toString().trim()
                if (remaining.isNotEmpty()) {
                    if (remaining.startsWith("{") && remaining.endsWith("}")) {
                        emitJson(remaining)
                    } else if (hasStarted && isValidContent(remaining)) {
                        onChunk(wrapAppendSection(remaining))
                    } else if (hasStarted && !isValidContent(remaining)) {
                        Log.d(TAG, "Filtered out invalid remaining content: ${remaining.take(50)}")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Process Stream Fatal Error", e)
            val errorPayload = mapOf(
                "type" to "error",
                "payload" to mapOf(
                    "message" to "Stream Interrupted: ${e.message}",
                    "safe_fallback" to "显示错误信息"
                )
            )
            onChunk(gson.toJson(errorPayload))
            if (throwException) throw e
        }
    }
    /**
     * 🆕 流式生成对话内容 - 使用Gemini 3 Flash模型（支持打字机效果）
     * @param prompt 用户输入
     * @param conversationHistory 对话历史
     * @param modelName 模型名称
     * @param onChunk 每个文本块的回调
     * @param enableSearch 🆕 是否开启联网搜索（默认true，对话场景开启）
     * @param enableThinking 🆕 是否开启深度思考（默认false）
     * @param isConversation 🆕 是否为对话场景（用于日志）
     * @param onGroundingMetadata 🆕 引用元数据回调（联网搜索时返回引用源）
     * @return AI回复完整内容
     */
    suspend fun generateContentStream(
        prompt: String,
        conversationHistory: List<Pair<String, String>> = emptyList(),
        systemPrompt: String? = null,
        modelName: String = "gemini-3-flash",
        enableSearch: Boolean = true,  // 🆕 对话场景默认开启联网搜索
        enableThinking: Boolean = false,  // 🆕 默认不开启深度思考
        isConversation: Boolean = true,  // 🆕 默认为对话场景
        onChunk: (String) -> Unit,
        onGroundingMetadata: ((com.xiaoxiami.app.service.GroundingMetadata) -> Unit)? = null  // 🆕 引用元数据回调
    ): String = withContext(Dispatchers.IO) {
        try {
            val finalSystemPrompt = systemPrompt ?: """你是小米澎湃OS的智能助手，拥有AI认知能力、设备控制能力和全场景感知能力。

## 回复风格:
- 简洁、自然、充满智慧
- 像朋友一样对话，但保持适当的专业界限
- 优先使用短句，在屏幕交互时多使用列表和结构化排版
- 直接回答问题，不要在回复开头自我介绍

## 能力范围:
- 系统智控、生活助手、创意中心、米家智能

## 重要约束:
- 拒绝任何违法、暴力、有害内容的生成
- 保护用户隐私，不存储任何非必要的敏感数据
- 若无法完成任务，应明确说明原因并提供备选方案"""

            val contextBuilder = StringBuilder()
            conversationHistory.forEach { (role, content) ->
                when (role) {
                    "user" -> contextBuilder.append("用户: $content\n")
                    "model" -> contextBuilder.append("AI: $content\n")
                }
            }

            val fullPrompt = if (contextBuilder.isNotEmpty()) {
                "${contextBuilder}用户: $prompt"
            } else {
                prompt
            }
            
            // 🆕 检查是否为豆包模型（直接调用火山引擎 Responses API）
            val isDoubao2 = modelName == "doubao-2.0"
            val isDoubao18 = modelName == "doubao-1.8"
            val isDoubaoModel = isDoubao2 || isDoubao18
            
            // 🆕 将模型名称映射为API支持的格式
            val apiModelName = when {
                isDoubao2 -> AIConfig.DOUBAO_2_MODEL_ID  // Doubao 2.0 模型ID
                isDoubao18 -> AIConfig.DOUBAO_RESPONSES_MODEL_ID  // Doubao 1.8 使用 Responses API 兼容的模型ID
                modelName.contains("gemini", ignoreCase = true) && modelName.contains("pro", ignoreCase = true) -> 
                    com.xiaoxiami.app.service.ProxyApiService.Models.GEMINI_PRO
                modelName.contains("gemini", ignoreCase = true) -> 
                    com.xiaoxiami.app.service.ProxyApiService.Models.GEMINI_FLASH
                // 🆕 移除 SKYLARK 映射，豆包模型统一使用直连 Responses API
                else -> com.xiaoxiami.app.service.ProxyApiService.Models.GEMINI_FLASH
            }
            
            // 🆕 日志记录API调用参数
            Log.d(TAG, "📡 generateContentStream: model=$apiModelName, enableSearch=$enableSearch, enableThinking=$enableThinking, isConversation=$isConversation, isDoubaoModel=$isDoubaoModel")

            // 🆕 所有豆包模型都使用火山方舟 Responses API（直连，支持联网搜索）
            val response = if (isDoubaoModel) {
                // 根据模型选择不同的 API Key
                val doubaoApiKey = if (isDoubao2) AIConfig.DOUBAO_2_API_KEY else AIConfig.DOUBAO_API_KEY
                callDoubaoResponsesStream(
                    prompt = fullPrompt,
                    systemPrompt = finalSystemPrompt,
                    enableSearch = enableSearch,
                    onChunk = onChunk,
                    modelId = apiModelName,
                    apiKey = doubaoApiKey
                )
            } else {
                // 🌟 使用流式API，每次回调都会更新UI
                proxyApiService.callMultimodalChatStream(
                    prompt = fullPrompt,
                    systemPrompt = finalSystemPrompt,
                    modelName = apiModelName,
                    enableSearch = enableSearch,  // 🆕 传递联网搜索参数
                    enableThinking = enableThinking,  // 🆕 传递深度思考参数
                    isConversation = isConversation,  // 🆕 传递场景标识
                    onChunk = onChunk,
                    onGroundingMetadata = onGroundingMetadata  // 🆕 传递引用元数据回调
                )
            }

            if (response.isBlank()) {
                throw Exception("Empty response from model")
            }

            return@withContext response

        } catch (e: Exception) {
            if (e is CancellationException) throw e
            Log.e(TAG, "Failed to generate streaming content: ${e.message}", e)
            throw e
        }
    }
    
    /**
     * 🆕 使用火山方舟 Responses API 调用豆包模型（流式）
     * Responses API 是火山方舟最新推出的 API 接口，原生支持联网搜索等内置工具
     * 文档：https://www.volcengine.com/docs/82379/1585128
     * 
     * @param prompt 用户输入
     * @param systemPrompt 系统提示词
     * @param enableSearch 是否开启联网搜索（默认true）
     * @param onChunk 每个流式片段的回调
     * @param modelId 模型ID（默认使用 Doubao 2.0）
     * @param apiKey API密钥（默认使用 Doubao 2.0 密钥）
     * @return 完整响应内容
     */
    private suspend fun callDoubaoResponsesStream(
        prompt: String,
        systemPrompt: String,
        enableSearch: Boolean = true,
        onChunk: (String) -> Unit,
        modelId: String = AIConfig.DOUBAO_2_MODEL_ID,
        apiKey: String = AIConfig.DOUBAO_2_API_KEY
    ): String = withContext(Dispatchers.IO) {
        // 🆕 内部函数：执行实际的 API 调用，返回 (内容, 是否联网搜索未激活)
        suspend fun doRequest(useSearch: Boolean): Pair<String, Boolean> {
            val contentBuilder = StringBuilder()
            var webSearchNotActivated = false  // 🆕 追踪联网搜索是否未激活
            
            val url = AIConfig.DOUBAO_RESPONSES_ENDPOINT
            
            Log.d(TAG, "🤖 调用火山方舟 Responses API: model=$modelId, enableSearch=$useSearch")
            
            // 构建输入列表
            val inputList = mutableListOf<Map<String, Any>>()
            
            if (systemPrompt.isNotBlank()) {
                inputList.add(mapOf(
                    "role" to "system",
                    "content" to listOf(mapOf(
                        "type" to "input_text",
                        "text" to systemPrompt
                    ))
                ))
            }
            
            inputList.add(mapOf(
                "role" to "user",
                "content" to listOf(mapOf(
                    "type" to "input_text",
                    "text" to prompt
                ))
            ))
            
            // 构建请求体
            val requestBody = mutableMapOf<String, Any>(
                "model" to modelId,
                "input" to inputList,
                "stream" to true,
                "max_output_tokens" to 4096,
                "thinking" to mapOf("type" to "disabled"),
                "store" to false
            )
            
            // 添加联网搜索工具
            if (useSearch) {
                requestBody["tools"] = listOf(mapOf(
                    "type" to "web_search",
                    "max_keyword" to 3
                ))
                Log.d(TAG, "🔍 已启用联网搜索工具 (web_search)")
            }
            
            val jsonBody = Gson().toJson(requestBody)
            Log.d(TAG, "📤 Responses API 请求体长度: ${jsonBody.length}")
            
            val request = Request.Builder()
                .url(url)
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer $apiKey")
                .post(jsonBody.toRequestBody("application/json; charset=utf-8".toMediaType()))
                .build()
            
            val client = OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(180, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build()
            
            val response = client.newCall(request).execute()
            
            if (!response.isSuccessful) {
                val errorBody = response.body?.string() ?: "Unknown error"
                Log.e(TAG, "❌ Responses API 错误: ${response.code} - $errorBody")
                throw Exception("火山方舟 Responses API 调用失败: ${response.code} - $errorBody")
            }
            
            // 解析 SSE 流式响应
            response.body?.charStream()?.use { reader ->
                var currentEventType = ""
                
                reader.forEachLine { line ->
                    val trimmedLine = line.trim()
                    
                    if (trimmedLine.startsWith("event:")) {
                        currentEventType = trimmedLine.removePrefix("event:").trim()
                    }
                    else if (trimmedLine.startsWith("data:")) {
                        val jsonStr = trimmedLine.removePrefix("data:").trim()
                        if (jsonStr.isNotEmpty() && jsonStr != "[DONE]") {
                            try {
                                val jsonObj = com.google.gson.JsonParser.parseString(jsonStr).asJsonObject
                                
                                // 处理文本增量事件
                                if (currentEventType == "response.output_text.delta") {
                                    val delta = jsonObj.get("delta")?.asString
                                    if (!delta.isNullOrEmpty()) {
                                        contentBuilder.append(delta)
                                        onChunk(delta)
                                    }
                                }
                                // 处理文本完成事件
                                else if (currentEventType == "response.output_text.done") {
                                    val text = jsonObj.get("text")?.asString
                                    if (!text.isNullOrEmpty() && contentBuilder.isEmpty()) {
                                        contentBuilder.append(text)
                                        onChunk(text)
                                    }
                                    Log.d(TAG, "✅ 文本输出完成")
                                }
                                // 处理响应完成事件
                                else if (currentEventType == "response.completed") {
                                    Log.d(TAG, "✅ Responses API 完成")
                                }
                                // 处理联网搜索事件
                                else if (currentEventType.contains("web_search")) {
                                    Log.d(TAG, "🔍 联网搜索事件: $currentEventType")
                                }
                                // 🆕 处理错误事件（检测联网搜索未激活）
                                else if (currentEventType == "error") {
                                    val errorMsg = jsonObj.get("message")?.asString ?: "Unknown error"
                                    Log.e(TAG, "❌ 流式响应错误: $errorMsg")
                                    // 检测联网搜索未激活的错误
                                    if (errorMsg.contains("not activated web search", ignoreCase = true)) {
                                        webSearchNotActivated = true
                                    }
                                }
                                
                            } catch (e: Exception) {
                                Log.w(TAG, "⚠️ 解析 Responses API SSE 行失败: eventType=$currentEventType, data=$jsonStr, 错误: ${e.message}")
                            }
                        }
                    }
                }
            }
            
            Log.d(TAG, "✅ Responses API 响应完成，长度: ${contentBuilder.length}")
            
            // 🆕 返回结果和是否联网搜索未激活的标志
            return Pair(contentBuilder.toString(), webSearchNotActivated)
        }
        
        try {
            // 首次尝试（可能包含联网搜索）
            val (result, webSearchNotActivated) = doRequest(enableSearch)
            
            // 🆕 如果联网搜索未激活且响应为空，自动关闭搜索重试
            if (webSearchNotActivated && result.isEmpty()) {
                Log.w(TAG, "⚠️ 联网搜索未激活，自动关闭搜索重试...")
                val (retryResult, _) = doRequest(false)
                if (retryResult.isNotEmpty()) {
                    return@withContext retryResult
                }
            }
            
            if (result.isNotEmpty()) {
                return@withContext result
            }
            
            // 如果结果为空且启用了联网搜索，尝试关闭联网搜索重试
            if (enableSearch) {
                Log.w(TAG, "⚠️ 响应为空，尝试关闭联网搜索重试...")
                val (retryResult, _) = doRequest(false)
                if (retryResult.isNotEmpty()) {
                    return@withContext retryResult
                }
            }
            
            throw Exception("Empty response from model")
            
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            Log.e(TAG, "❌ Responses API 调用失败: ${e.message}", e)
            throw e
        }
    }
    
    /**
     * 🆕 使用火山方舟 Responses API 调用豆包模型（非流式）
     * 用于替代代理服务中的 SKYLARK (skyLarkProMultiSeedV18) 作为 fallback
     * 
     * @param prompt 用户输入
     * @param systemPrompt 系统提示词
     * @param enableSearch 是否开启联网搜索（默认false，非对话场景关闭以提高稳定性）
     * @param modelId 模型ID（默认使用 Doubao 1.8）
     * @param apiKey API密钥（默认使用 Doubao API Key）
     * @return 完整响应内容
     */
    suspend fun callDoubaoResponses(
        prompt: String,
        systemPrompt: String = "",
        enableSearch: Boolean = false,
        modelId: String = AIConfig.DOUBAO_RESPONSES_MODEL_ID,
        apiKey: String = AIConfig.DOUBAO_API_KEY
    ): String = withContext(Dispatchers.IO) {
        val contentBuilder = StringBuilder()
        
        try {
            val url = AIConfig.DOUBAO_RESPONSES_ENDPOINT
            
            Log.d(TAG, "🤖 调用火山方舟 Responses API (非流式): model=$modelId, enableSearch=$enableSearch")
            
            // 构建输入列表
            val inputList = mutableListOf<Map<String, Any>>()
            
            if (systemPrompt.isNotBlank()) {
                inputList.add(mapOf(
                    "role" to "system",
                    "content" to listOf(mapOf(
                        "type" to "input_text",
                        "text" to systemPrompt
                    ))
                ))
            }
            
            inputList.add(mapOf(
                "role" to "user",
                "content" to listOf(mapOf(
                    "type" to "input_text",
                    "text" to prompt
                ))
            ))
            
            // 构建请求体（非流式）
            val requestBody = mutableMapOf<String, Any>(
                "model" to modelId,
                "input" to inputList,
                "stream" to false,  // 非流式
                "max_output_tokens" to 4096,
                "thinking" to mapOf("type" to "disabled"),
                "store" to false
            )
            
            // 非对话场景通常不需要联网搜索
            if (enableSearch) {
                requestBody["tools"] = listOf(mapOf(
                    "type" to "web_search",
                    "max_keyword" to 3
                ))
            }
            
            val jsonBody = Gson().toJson(requestBody)
            Log.d(TAG, "📤 Responses API 请求体长度 (非流式): ${jsonBody.length}")
            
            val request = Request.Builder()
                .url(url)
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer $apiKey")
                .post(jsonBody.toRequestBody("application/json; charset=utf-8".toMediaType()))
                .build()
            
            val client = OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(120, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build()
            
            val response = client.newCall(request).execute()
            
            if (!response.isSuccessful) {
                val errorBody = response.body?.string() ?: "Unknown error"
                Log.e(TAG, "❌ Responses API 错误 (非流式): ${response.code} - $errorBody")
                throw Exception("火山方舟 Responses API 调用失败: ${response.code}")
            }
            
            // 解析非流式响应
            val responseBody = response.body?.string() ?: throw Exception("Response body is null")
            val jsonObj = com.google.gson.JsonParser.parseString(responseBody).asJsonObject
            
            // 从 output 数组中提取文本内容
            val output = jsonObj.getAsJsonArray("output")
            if (output != null && output.size() > 0) {
                for (i in 0 until output.size()) {
                    val item = output[i].asJsonObject
                    val type = item.get("type")?.asString
                    if (type == "message") {
                        val content = item.getAsJsonArray("content")
                        if (content != null) {
                            for (j in 0 until content.size()) {
                                val contentItem = content[j].asJsonObject
                                val contentType = contentItem.get("type")?.asString
                                if (contentType == "output_text") {
                                    val text = contentItem.get("text")?.asString
                                    if (!text.isNullOrEmpty()) {
                                        contentBuilder.append(text)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            Log.d(TAG, "✅ Responses API 响应完成 (非流式)，长度: ${contentBuilder.length}")
            
            contentBuilder.toString()
            
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            Log.e(TAG, "❌ Responses API 调用失败 (非流式): ${e.message}", e)
            throw e
        }
    }

    /**
     * 生成对话内容 - 使用Gemini 3 Flash模型
     * @param prompt 用户输入
     * @param conversationHistory 对话历史
     * @param modelName 模型名称
     * @param enableSearch 🆕 是否开启联网搜索（默认false，非对话场景关闭）
     * @param enableThinking 🆕 是否开启深度思考（默认false）
     * @param isConversation 🆕 是否为对话场景（用于日志）
     * @return AI回复内容
     */
    suspend fun generateContent(
        prompt: String,
        conversationHistory: List<Pair<String, String>> = emptyList(),
        modelName: String = "gemini-3-flash",
        enableSearch: Boolean = false,  // 🆕 非对话场景默认关闭联网搜索
        enableThinking: Boolean = false,  // 🆕 默认不开启深度思考
        isConversation: Boolean = false  // 🆕 默认为非对话场景
    ): String = withContext(Dispatchers.IO) {
        try {
            // 构建系统提示词
            val systemPrompt = """你是小米澎湃OS的智能助手，拥有AI认知能力、设备控制能力和全场景感知能力。

## 回复风格:
- 简洁、自然、充满智慧
- 像朋友一样对话，但保持适当的专业界限
- 优先使用短句，在屏幕交互时多使用列表和结构化排版
- 直接回答问题，不要在回复开头自我介绍

## 能力范围:
- 系统智控、生活助手、创意中心、米家智能

## 重要约束:
- 拒绝任何违法、暴力、有害内容的生成
- 保护用户隐私，不存储任何非必要的敏感数据
- 若无法完成任务，应明确说明原因并提供备选方案"""

            // 构建对话上下文
            val contextBuilder = StringBuilder()
            conversationHistory.forEach { (role, content) ->
                when (role) {
                    "user" -> contextBuilder.append("用户: $content\n")
                    "model" -> contextBuilder.append("AI: $content\n")
                }
            }

            // 构建完整提示词
            val fullPrompt = if (contextBuilder.isNotEmpty()) {
                "${contextBuilder}用户: $prompt"
            } else {
                prompt
            }
            
            // 🆕 日志记录
            val sceneTag = if (isConversation) "对话场景" else "非对话场景"
            Log.d(TAG, "📡 generateContent [$sceneTag]: enableSearch=$enableSearch, enableThinking=$enableThinking")

            // 使用Proxy服务调用Gemini模型
            val response = proxyApiService.callMultimodalChat(
                prompt = fullPrompt,
                systemPrompt = systemPrompt,
                modelName = com.xiaoxiami.app.service.ProxyApiService.Models.GEMINI_FLASH,
                enableSearch = enableSearch,  // 🆕 传递联网搜索参数
                enableThinking = enableThinking,  // 🆕 传递深度思考参数
                isConversation = isConversation  // 🆕 传递场景标识
            )

            if (response.isBlank()) {
                throw Exception("Empty response from model")
            }

            return@withContext response

        } catch (e: Exception) {
            if (e is CancellationException) throw e
            Log.e(TAG, "Failed to generate content: ${e.message}", e)
            throw e
        }
    }

    /**
     * 生成带图片的内容 - 使用Gemini多模态能力（支持单张图片，向后兼容）
     *
     * @param prompt 用户输入的提示词
     * @param imageUri 图片URI
     * @param conversationHistory 对话历史
     * @param modelName 模型名称
     * @return AI回复内容
     */
    suspend fun generateContentWithImage(
        prompt: String,
        imageUri: android.net.Uri,
        conversationHistory: List<Pair<String, String>> = emptyList(),
        modelName: String = "gemini-3-flash"
    ): String {
        return generateContentWithImages(
            prompt = prompt,
            imageUris = listOf(imageUri),
            conversationHistory = conversationHistory,
            modelName = modelName
        )
    }
    
    /**
     * 🆕 生成带多张图片的内容 - 使用Gemini多模态能力
     *
     * @param prompt 用户输入的提示词
     * @param imageUris 图片URI列表（支持多张图片）
     * @param conversationHistory 对话历史
     * @param modelName 模型名称
     * @param enableSearch 🆕 是否开启联网搜索（默认true，对话场景开启）
     * @param enableThinking 🆕 是否开启深度思考（默认false）
     * @param isConversation 🆕 是否为对话场景（用于日志）
     * @return AI回复内容
     */
    suspend fun generateContentWithImages(
        prompt: String,
        imageUris: List<android.net.Uri>,
        conversationHistory: List<Pair<String, String>> = emptyList(),
        modelName: String = "gemini-3-flash",
        enableSearch: Boolean = true,  // 🆕 对话场景默认开启联网搜索
        enableThinking: Boolean = false,  // 🆕 默认不开启深度思考
        isConversation: Boolean = true  // 🆕 默认为对话场景
    ): String = withContext(Dispatchers.IO) {
        try {
            // 🆕 将所有图片转换为Base64列表
            val imageBase64List = mutableListOf<String>()
            
            for ((index, imageUri) in imageUris.withIndex()) {
                try {
                    val bitmap = android.graphics.BitmapFactory.decodeStream(
                        context.contentResolver.openInputStream(imageUri)
                    )
                    if (bitmap != null) {
                        val outputStream = java.io.ByteArrayOutputStream()
                        bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 90, outputStream)
                        val imageBytes = outputStream.toByteArray()
                        val base64Image = android.util.Base64.encodeToString(imageBytes, android.util.Base64.NO_WRAP)
                        imageBase64List.add(base64Image)
                        Log.d(TAG, "成功转换图片 ${index + 1}/${imageUris.size} 为Base64")
                    } else {
                        Log.w(TAG, "无法解码图片 ${index + 1}: $imageUri")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "转换图片 ${index + 1} 失败: ${e.message}")
                }
            }
            
            if (imageBase64List.isEmpty()) {
                throw Exception("所有图片都无法解码")
            }
            
            Log.d(TAG, "共成功转换 ${imageBase64List.size}/${imageUris.size} 张图片")

            // 构建系统提示词（根据图片数量调整）
            val imageContextDescription = if (imageBase64List.size > 1) {
                "用户发送了${imageBase64List.size}张图片，请综合分析所有图片内容并结合文字描述来回答。"
            } else {
                "用户发送了一张图片，请根据图片内容和文字描述来回答。"
            }
            
            val systemPrompt = """你是小米澎湃OS的智能助手，拥有AI认知能力、设备控制能力和全场景感知能力。

## 回复风格:
- 简洁、自然、充满智慧
- 像朋友一样对话，但保持适当的专业界限
- 优先使用短句，在屏幕交互时多使用列表和结构化排版
- 直接回答问题，不要在回复开头自我介绍

## 能力范围:
- 系统智控、生活助手、创意中心、米家智能

## 重要约束:
- 拒绝任何违法、暴力、有害内容的生成
- 保护用户隐私，不存储任何非必要的敏感数据
- 若无法完成任务，应明确说明原因并提供备选方案

## Context:
- $imageContextDescription"""

            // 构建对话上下文
            val contextBuilder = StringBuilder()
            conversationHistory.forEach { (role, content) ->
                when (role) {
                    "user" -> contextBuilder.append("用户: $content\n")
                    "model" -> contextBuilder.append("AI: $content\n")
                }
            }

            // 构建完整提示词
            val fullPrompt = if (contextBuilder.isNotEmpty()) {
                "${contextBuilder}用户: $prompt"
            } else {
                prompt
            }

            // 🆕 日志记录
            val sceneTag = if (isConversation) "对话场景" else "非对话场景"
            Log.d(TAG, "📡 generateContentWithImages [$sceneTag]: enableSearch=$enableSearch, enableThinking=$enableThinking, images=${imageBase64List.size}")
            
            // 🆕 使用Proxy服务调用Gemini多模态模型（支持多张图片）
            val response = proxyApiService.callMultimodalChat(
                prompt = fullPrompt,
                systemPrompt = systemPrompt,
                imageBase64s = imageBase64List,  // 🆕 传入多张图片
                modelName = com.xiaoxiami.app.service.ProxyApiService.Models.GEMINI_FLASH,
                enableSearch = enableSearch,  // 🆕 传递联网搜索参数
                enableThinking = enableThinking,  // 🆕 传递深度思考参数
                isConversation = isConversation  // 🆕 传递场景标识
            )

            if (response.isBlank()) {
                throw Exception("Empty response from model")
            }

            return@withContext response

        } catch (e: Exception) {
            if (e is CancellationException) throw e
            Log.e(TAG, "Failed to generate content with images: ${e.message}", e)
            throw e
        }
    }
} // End of GeminiRepository class

// Extension function for OkHttp Call
private suspend fun Call.await(): Response = suspendCancellableCoroutine { continuation ->
    continuation.invokeOnCancellation {
        this.cancel()
    }
    this.enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) {
            continuation.resume(response)
        }
        override fun onFailure(call: Call, e: IOException) {
            if (continuation.isActive) {
                continuation.resumeWithException(e)
            }
        }
    })
}
