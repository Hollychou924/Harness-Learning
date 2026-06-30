package com.xiaoxiami.app.service

import android.util.Log
import com.xiaoxiami.app.BuildConfig
import com.google.gson.Gson
import com.google.gson.JsonParser
import com.google.gson.annotations.SerializedName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okio.BufferedSink
import java.io.OutputStreamWriter
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * 🆕 引用源数据类 - 用于联网搜索结果展示
 */
data class GroundingChunk(
    val web: WebSource? = null
)

data class WebSource(
    val uri: String = "",
    val title: String = ""
)

data class GroundingSegment(
    val startIndex: Int = 0,
    val endIndex: Int = 0,
    val text: String = ""
)

data class GroundingSupport(
    val segment: GroundingSegment? = null,
    val groundingChunkIndices: List<Int> = emptyList(),
    val confidenceScores: List<Double> = emptyList()
)

data class GroundingMetadata(
    val groundingChunks: List<GroundingChunk> = emptyList(),
    val groundingSupports: List<GroundingSupport> = emptyList(),
    val webSearchQueries: List<String> = emptyList()
)

/**
 * 🆕 流式响应结果 - 包含内容和引用元数据
 */
data class StreamResponse(
    val content: String,
    val groundingMetadata: GroundingMetadata? = null
)

/**
 * 🆕 从内容末尾提取 Grounding Sources HTML 并解析为 GroundingMetadata
 * 格式示例：
 * Grounding Sources
 * <ol>
 * <li><a href='url'>title</a></li>
 * </ol>
 */
fun parseGroundingSourcesFromContent(content: String): Pair<String, GroundingMetadata?> {
    val TAG = "GroundingParser"
    
    // 查找 "Grounding Sources" 标记
    val markerIndex = content.indexOf("Grounding Sources")
    if (markerIndex == -1) {
        Log.d(TAG, "⚠️ 内容中未找到 'Grounding Sources' 标记")
        return Pair(content, null)
    }
    
    Log.d(TAG, "✅ 找到 'Grounding Sources' 标记，位置: $markerIndex")
    
    // 分离正文和引用源部分
    val cleanContent = content.substring(0, markerIndex).trimEnd()
    val sourcesHtml = content.substring(markerIndex)
    
    Log.d(TAG, "📋 引用源HTML长度: ${sourcesHtml.length}")
    
    // 解析 HTML 中的链接
    val chunks = mutableListOf<GroundingChunk>()
    
    // 使用正则提取 <a href='url'>title</a> 格式的链接
    val linkPattern = Regex("""<a\s+href=['"](.*?)['"].*?>(.*?)</a>""", RegexOption.IGNORE_CASE)
    linkPattern.findAll(sourcesHtml).forEach { match ->
        val url = match.groupValues[1]
        val title = match.groupValues[2]
        Log.d(TAG, "🔗 解析到链接: title=$title, url=${url.take(50)}...")
        if (url.isNotBlank()) {
            chunks.add(GroundingChunk(
                web = WebSource(
                    uri = url,
                    title = title.ifBlank { "来源" }
                )
            ))
        }
    }
    
    Log.d(TAG, "📚 共解析到 ${chunks.size} 个引用源")
    
    return if (chunks.isNotEmpty()) {
        Pair(cleanContent, GroundingMetadata(
            groundingChunks = chunks,
            groundingSupports = emptyList(),
            webSearchQueries = emptyList()
        ))
    } else {
        Log.w(TAG, "⚠️ 未能解析出任何链接")
        Pair(content, null)
    }
}

/**
 * Proxy API Service for calling the middle-layer proxy service
 * to access various models with multimodal inputs.
 */
class ProxyApiService {
    
    /**
     * Supported model names for Proxy API
     */
    object Models {
        const val GEMINI_PRO = "geminiProV3Preview"
        const val GEMINI_FLASH = "geminiFlashV3Preview"
        // 🆕 已废弃：SKYLARK 已被直连豆包 1.8 (Responses API) 替代
        // const val SKYLARK = "skyLarkProMultiSeedV18"
        @Deprecated("使用 GeminiRepository.callDoubaoResponses() 直连豆包代替")
        const val SKYLARK = "skyLarkProMultiSeedV18"
    }

    /**
     * Custom RequestBody that streams JSON serialization to avoid OOM.
     */
    private class GsonRequestBody(
        private val gson: Gson,
        private val data: Any
    ) : RequestBody() {
        override fun contentType(): MediaType? = "application/json; charset=utf-8".toMediaType()

        override fun writeTo(sink: BufferedSink) {
            val writer = OutputStreamWriter(sink.outputStream(), StandardCharsets.UTF_8)
            val jsonWriter = gson.newJsonWriter(writer)
            gson.toJson(data, data.javaClass, jsonWriter)
            jsonWriter.flush()
        }
    }
    
    companion object {
        private const val TAG = "ProxyApiService"
        private const val BASE_URL = "https://i-preview4test.xiaomixiaoai.com"
        private const val ENDPOINT = "/api/universal/proxy/multimodal/chat/stream"
        private const val DEFAULT_MODEL = Models.GEMINI_FLASH  // Default to Flash for speed
    }
    
    private val apiKey = BuildConfig.PROXY_API_KEY
    private val apiSecret = BuildConfig.PROXY_API_SECRET
    
    private val gson = Gson()
    
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)  // 🆕 Gemini 模型超时时间调整为 90 秒
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    
    /**
     * Generate MD5 signature for the request.
     * sign = md5(apiSecret + requestId + timestamp)
     */
    private fun generateSign(requestId: String, timestamp: Long): String {
        val data = "$apiSecret$requestId$timestamp"
        val md = MessageDigest.getInstance("MD5")
        val digest = md.digest(data.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }
    
    /**
     * Call the multimodal chat API with Base64 audio/image data.
     * 
     * @param prompt The user prompt/question
     * @param systemPrompt The system prompt (optional)
     * @param audioBase64s List of audio file Base64 strings
     * @param imageBase64s List of image file Base64 strings
     * @param enableSearch 是否开启联网搜索（必填）
     * @param enableThinking 是否开启深度思考（必填）
     * @param isConversation 是否为对话场景（用于日志区分）
     * @return The model's response text
     * @throws Exception if the API call fails
     */
    suspend fun callMultimodalChat(
        prompt: String,
        systemPrompt: String = "",
        audioBase64s: List<String> = emptyList(),
        imageBase64s: List<String> = emptyList(),
        audioUrls: List<String> = emptyList(),  // 🆕 Support for TOS URLs
        modelName: String = DEFAULT_MODEL,
        enableSearch: Boolean = true,  // 🆕 开启联网搜索
        enableThinking: Boolean = false,  // 🆕 是否开启深度思考
        isConversation: Boolean = false,  // 🆕 是否为对话场景（用于日志）
        maxTokens: Int = 4096  // 🆕 最大生成长度（可自定义）
    ): String = withContext(Dispatchers.IO) {
        // 🔍 Detailed Logging for Payload Size Analysis
        val audioCount = audioBase64s.size
        val urlCount = audioUrls.size
        val imageCount = imageBase64s.size
        var totalBase64Len = 0L

        if (audioCount > 0) {
            Log.i(TAG, "Preparing to send $audioCount audio files (Base64) to Proxy API...")
            audioBase64s.forEachIndexed { index, b64 ->
                val len = b64.length
                totalBase64Len += len
                val approxBytes = (len * 0.75).toLong()
                val approxMB = approxBytes / (1024.0 * 1024.0)
                Log.i(TAG, "  Audio #$index: Base64 Length=$len chars, Approx Size=$approxBytes bytes (~${String.format("%.2f", approxMB)} MB)")
            }
        }
        
        if (urlCount > 0) {
            Log.i(TAG, "Preparing to send $urlCount audio URLs to Proxy API...")
            audioUrls.forEach { url ->
                Log.i(TAG, "  Audio URL: $url")
            }
        }
        
        if (imageCount > 0) {
            Log.i(TAG, "Preparing to send $imageCount image files to Proxy API...")
            imageBase64s.forEachIndexed { index, b64 ->
                val len = b64.length
                totalBase64Len += len
                val approxBytes = (len * 0.75).toLong()
                Log.i(TAG, "  Image #$index: Base64 Length=$len chars, Approx Size=$approxBytes bytes")
            }
        }
        
        val totalApproxMB = (totalBase64Len * 0.75) / (1024.0 * 1024.0)
        Log.i(TAG, "Total Multimedia Payload: ~${String.format("%.2f", totalApproxMB)} MB (Base64 Total: $totalBase64Len chars)")

        if (apiKey.isBlank() || apiSecret.isBlank()) {
            throw IllegalStateException("Proxy API credentials not configured. Check local.properties")
        }
        
        val requestId = UUID.randomUUID().toString()
        val timestamp = System.currentTimeMillis()
        val sign = generateSign(requestId, timestamp)
        
        // Determine scene types
        val sceneTypes = mutableListOf<String>()
        if (audioBase64s.isNotEmpty() || audioUrls.isNotEmpty()) sceneTypes.add("audio")
        if (imageBase64s.isNotEmpty()) sceneTypes.add("image")
        // 🆕 纯文本请求也需要指定 scene
        if (sceneTypes.isEmpty()) sceneTypes.add("text")
        
        // Combine all multimodal Data (Base64 strings + URLs)
        // The API field 'multiModalUrls' supports both Base64 strings and HTTP URLs.
        val multiModalData = audioBase64s + imageBase64s + audioUrls
        
        // 🆕 日志记录：是否开启联网搜索和深度思考
        val sceneTag = if (isConversation) "对话场景" else "非对话场景"
        Log.i(TAG, "📡 [$sceneTag] API调用参数: model=$modelName, enableSearch=$enableSearch, enableThinking=$enableThinking")
        
        // Build request body
        val requestBody = buildMap {
            put("prompt", prompt)
            put("model", modelName)
            put("generatedLength", maxTokens)
            put("scene", sceneTypes)  // 🆕 始终添加 scene 参数
            if (systemPrompt.isNotBlank()) put("system", systemPrompt)
            if (multiModalData.isNotEmpty()) put("multiModalUrls", multiModalData)
            
            // 🆕 新增必填字段
            put("enableSearch", enableSearch)
            put("enableThinking", enableThinking)
            
            // 🆕 如果开启深度思考，添加extra字段配置
            if (enableThinking) {
                put("extra", mapOf(
                    "reasoningContentEnabled" to true  // 通过reasoning字段下发思考内容
                ))
            }
        }
        
        // Use streaming RequestBody to avoid OOM with large Base64 strings
        Log.d(TAG, "Calling proxy API with streaming body")
        
        val request = Request.Builder()
            .url("$BASE_URL$ENDPOINT")
            .post(GsonRequestBody(gson, requestBody))
            .header("Request-Id", requestId)
            .header("timestamp", timestamp.toString())
            .header("apiKey", apiKey)
            .header("sign", sign)
            .build()
        
        var attempt = 0
        val maxRetries = 3
        var lastException: Exception? = null

        while (attempt < maxRetries) {
            try {
                attempt++
                Log.d(TAG, "Sending request to Proxy API (Attempt $attempt/$maxRetries). Streaming body...")
                val response = httpClient.newCall(request).execute()
                val responseBody = response.body?.string() ?: ""
                Log.d(TAG, "Raw Proxy Response Body: $responseBody")
                
                if (!response.isSuccessful) {
                    // Expanded logging for error debugging
                    Log.e(TAG, "Proxy API Error Details:")
                    Log.e(TAG, "  Status Code: ${response.code}")
                    Log.e(TAG, "  Message: ${response.message}")
                    Log.e(TAG, "  Error Body: $responseBody")
                    Log.e(TAG, "  Request ID: $requestId")
                    throw Exception("Proxy API error: ${response.code} - ${response.message} (RID: $requestId)\nBody: $responseBody")
                }
                
                // Parse SSE stream response
                val result = parseSSEResponse(responseBody)
                Log.d(TAG, "Proxy API response length: ${result.length}")
                
                return@withContext result
            } catch (e: Exception) {
                lastException = e
                // Only retry on network errors (IOException includes SocketException, UnknownHostException, etc.)
                val isNetworkError = e is java.io.IOException
                
                if (isNetworkError && attempt < maxRetries) {
                    Log.w(TAG, "Proxy API call failed (Attempt $attempt/$maxRetries): ${e.message}. Retrying in ${attempt}s...")
                    delay(1000L * attempt) // Backoff: 1s, 2s
                } else {
                    Log.e(TAG, "Proxy API call FAILED after $attempt attempts!", e)
                    Log.e(TAG, "Stack Trace:\n${Log.getStackTraceString(e)}")
                    throw e
                }
            }
        }
        throw lastException ?: Exception("Unknown error after $maxRetries attempts")
    }
    
    /**
     * Parse Server-Sent Events (SSE) response format.
     * Each line starts with "data: " followed by JSON.
     * The response ends with content "[DONE]".
     * 
     * @throws Exception if server returns error code (e.g., 406)
     */
    private fun parseSSEResponse(responseBody: String): String {
        val contentBuilder = StringBuilder()
        var errorCode: Int? = null
        var errorMessage: String? = null
        
        responseBody.lines().forEach { line ->
            if (line.startsWith("data: ")) {
                val jsonStr = line.removePrefix("data: ").trim()
                if (jsonStr.isNotEmpty()) {
                    try {
                        val jsonObj = JsonParser.parseString(jsonStr).asJsonObject
                        val code = jsonObj.get("code")?.asInt ?: 0
                        val content = jsonObj.get("content")?.asString ?: ""
                        
                        // 🆕 检测错误响应
                        if (code != 200 && code != 0) {
                            errorCode = code
                            if (content != "[DONE]") {
                                errorMessage = content
                            }
                            Log.e(TAG, "SSE Error detected: code=$code, content=$content")
                        } else if (code == 200 && content != "[DONE]") {
                            contentBuilder.append(content)
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to parse SSE line: $jsonStr")
                    }
                }
            }
        }
        
        // 🆕 如果检测到错误码，抛出明确的异常
        if (errorCode != null) {
            val errorDesc = when (errorCode) {
                406 -> "请求体过大 (406)，音频或图片数据超过服务器限制"
                400 -> "请求格式错误 (400)"
                401 -> "认证失败 (401)，API Key 无效"
                403 -> "访问被拒绝 (403)"
                429 -> "请求过于频繁 (429)，请稍后重试"
                500 -> "服务器内部错误 (500)"
                else -> "服务器错误 ($errorCode): ${errorMessage ?: "未知错误"}"
            }
            throw Exception(errorDesc)
        }
        
        return contentBuilder.toString()
    }
    
    /**
     * 🆕 Call multimodal chat with automatic fallback to secondary model.
     * 
     * @param prompt The user prompt/question
     * @param systemPrompt The system prompt (optional)
     * @param audioBase64s List of audio file Base64 strings
     * @param imageBase64s List of image file Base64 strings
     * @param primaryModel Primary model to try first (default: geminiFlashV3Preview)
     * @param fallbackModel Fallback model if primary fails (default: geminiProV3Preview)
     * @return The model's response text
     * @throws Exception if both models fail
     * 
     * 🆕 注意：此方法仅用于代理服务内部的 Gemini 模型切换
     * 豆包模型的 fallback 请使用 GeminiRepository.callProxyWithDoubaoFallback()
     */
    suspend fun callMultimodalChatWithFallback(
        prompt: String,
        systemPrompt: String = "",
        audioBase64s: List<String> = emptyList(),
        imageBase64s: List<String> = emptyList(),
        primaryModel: String = Models.GEMINI_FLASH,
        fallbackModel: String = Models.GEMINI_PRO  // 🆕 改为 Gemini Pro 作为 fallback
    ): String {
        return try {
            Log.d(TAG, "Calling Proxy with primary model: $primaryModel")
            callMultimodalChat(
                prompt = prompt,
                systemPrompt = systemPrompt,
                audioBase64s = audioBase64s,
                imageBase64s = imageBase64s,
                modelName = primaryModel
            )
        } catch (e: Exception) {
            Log.w(TAG, "Primary model ($primaryModel) failed: ${e.message}, trying fallback ($fallbackModel)...")
            callMultimodalChat(
                prompt = prompt,
                systemPrompt = systemPrompt,
                audioBase64s = audioBase64s,
                imageBase64s = imageBase64s,
                modelName = fallbackModel
            )
        }
    }

    /**
     * 调用多模态聊天（带单张图片）
     *
     * @param prompt 用户提示词
     * @param imageBase64 图片Base64字符串
     * @param systemPrompt 系统提示词
     * @param modelName 模型名称
     * @param enableSearch 是否开启联网搜索
     * @return AI回复内容
     */
    suspend fun callMultimodalChatWithImage(
        prompt: String,
        imageBase64: String,
        systemPrompt: String = "",
        modelName: String = DEFAULT_MODEL,
        enableSearch: Boolean = true
    ): String {
        return callMultimodalChat(
            prompt = prompt,
            systemPrompt = systemPrompt,
            imageBase64s = listOf(imageBase64),
            modelName = modelName,
            enableSearch = enableSearch
        )
    }
    
    /**
     * 🆕 流式调用多模态聊天 API（支持打字机效果）
     * @param enableSearch 是否开启联网搜索（必填）
     * @param enableThinking 是否开启深度思考（必填）
     * @param isConversation 是否为对话场景（用于日志）
     * @param onChunk 每个文本块的回调
     * @param onReasoning 🆕 思考内容块的回调（可选）
     * @param onGroundingMetadata 🆕 引用元数据回调（可选）
     * @return 完整的响应内容
     */
    suspend fun callMultimodalChatStream(
        prompt: String,
        systemPrompt: String = "",
        audioBase64s: List<String> = emptyList(),
        imageBase64s: List<String> = emptyList(),
        audioUrls: List<String> = emptyList(),
        modelName: String = DEFAULT_MODEL,
        enableSearch: Boolean = true,
        enableThinking: Boolean = false,  // 🆕 是否开启深度思考
        isConversation: Boolean = false,  // 🆕 是否为对话场景
        onChunk: (String) -> Unit,
        onReasoning: ((String) -> Unit)? = null,  // 🆕 思考内容回调
        onGroundingMetadata: ((GroundingMetadata) -> Unit)? = null  // 🆕 引用元数据回调
    ): String = withContext(Dispatchers.IO) {
        val requestId = UUID.randomUUID().toString()
        val timestamp = System.currentTimeMillis()
        val sign = generateSign(requestId, timestamp)
        
        // 🆕 日志记录
        val sceneTag = if (isConversation) "对话场景" else "非对话场景"
        Log.i(TAG, "📡 [$sceneTag] 流式API调用: model=$modelName, enableSearch=$enableSearch, enableThinking=$enableThinking")
        
        val sceneTypes = mutableListOf<String>()
        if (audioBase64s.isNotEmpty() || audioUrls.isNotEmpty()) sceneTypes.add("audio")
        if (imageBase64s.isNotEmpty()) sceneTypes.add("image")
        if (sceneTypes.isEmpty()) sceneTypes.add("text")
        
        val multiModalData = audioBase64s + imageBase64s + audioUrls
        
        val requestBody = buildMap {
            put("prompt", prompt)
            put("model", modelName)
            put("generatedLength", 4096)
            put("scene", sceneTypes)
            if (systemPrompt.isNotBlank()) put("system", systemPrompt)
            if (multiModalData.isNotEmpty()) put("multiModalUrls", multiModalData)
            
            // 🆕 新增必填字段
            put("enableSearch", enableSearch)
            put("enableThinking", enableThinking)
            
            // 🆕 如果开启深度思考，添加extra字段配置
            if (enableThinking) {
                put("extra", mapOf(
                    "reasoningContentEnabled" to true
                ))
            }
        }
        
        val request = Request.Builder()
            .url("$BASE_URL$ENDPOINT")
            .post(GsonRequestBody(gson, requestBody))
            .header("Request-Id", requestId)
            .header("timestamp", timestamp.toString())
            .header("apiKey", apiKey)
            .header("sign", sign)
            .build()
        
        try {
            Log.d(TAG, "Sending streaming request to Proxy API...")
            val response = httpClient.newCall(request).execute()
            
            if (!response.isSuccessful) {
                val errorBody = response.body?.string() ?: ""
                Log.e(TAG, "Proxy API Error: ${response.code} - ${response.message}\n$errorBody")
                throw Exception("Proxy API error: ${response.code} - ${response.message}")
            }
            
            val contentBuilder = StringBuilder()
            val reasoningBuilder = StringBuilder()  // 🆕 收集思考内容
            var finalGroundingMetadata: GroundingMetadata? = null  // 🆕 引用元数据
            
            response.body?.charStream()?.use { reader ->
                reader.forEachLine { line ->
                    if (line.startsWith("data: ")) {
                        val jsonStr = line.removePrefix("data: ").trim()
                        if (jsonStr.isNotEmpty()) {
                            try {
                                val jsonObj = JsonParser.parseString(jsonStr).asJsonObject
                                val code = jsonObj.get("code")?.asInt ?: 0
                                val content = jsonObj.get("content")?.asString ?: ""
                                
                                // 🆕 解析reasoning字段（深度思考内容）
                                val reasoning = jsonObj.get("reasoning")?.asString ?: ""
                                
                                // 🆕 解析groundingMetadata字段（引用元数据）
                                val groundingMetadataJson = jsonObj.get("groundingMetadata")?.asJsonObject
                                if (groundingMetadataJson != null) {
                                    try {
                                        val chunks = mutableListOf<GroundingChunk>()
                                        val supports = mutableListOf<GroundingSupport>()
                                        val queries = mutableListOf<String>()
                                        
                                        // 解析 groundingChunks
                                        groundingMetadataJson.get("groundingChunks")?.asJsonArray?.forEach { chunkJson ->
                                            val chunkObj = chunkJson.asJsonObject
                                            val webObj = chunkObj.get("web")?.asJsonObject
                                            if (webObj != null) {
                                                chunks.add(GroundingChunk(
                                                    web = WebSource(
                                                        uri = webObj.get("uri")?.asString ?: "",
                                                        title = webObj.get("title")?.asString ?: ""
                                                    )
                                                ))
                                            }
                                        }
                                        
                                        // 解析 groundingSupports
                                        groundingMetadataJson.get("groundingSupports")?.asJsonArray?.forEach { supportJson ->
                                            val supportObj = supportJson.asJsonObject
                                            val segmentObj = supportObj.get("segment")?.asJsonObject
                                            val segment = if (segmentObj != null) {
                                                GroundingSegment(
                                                    startIndex = segmentObj.get("startIndex")?.asInt ?: 0,
                                                    endIndex = segmentObj.get("endIndex")?.asInt ?: 0,
                                                    text = segmentObj.get("text")?.asString ?: ""
                                                )
                                            } else null
                                            
                                            val indices = supportObj.get("groundingChunkIndices")?.asJsonArray
                                                ?.map { it.asInt } ?: emptyList()
                                            val scores = supportObj.get("confidenceScores")?.asJsonArray
                                                ?.map { it.asDouble } ?: emptyList()
                                            
                                            supports.add(GroundingSupport(
                                                segment = segment,
                                                groundingChunkIndices = indices,
                                                confidenceScores = scores
                                            ))
                                        }
                                        
                                        // 解析 webSearchQueries
                                        groundingMetadataJson.get("webSearchQueries")?.asJsonArray?.forEach { query ->
                                            queries.add(query.asString)
                                        }
                                        
                                        finalGroundingMetadata = GroundingMetadata(
                                            groundingChunks = chunks,
                                            groundingSupports = supports,
                                            webSearchQueries = queries
                                        )
                                        
                                        Log.d(TAG, "📚 解析到引用源: ${chunks.size}个来源, ${supports.size}个引用关联")
                                    } catch (e: Exception) {
                                        Log.w(TAG, "解析groundingMetadata失败: ${e.message}")
                                    }
                                }
                                
                                if (code == 200) {
                                    // 🆕 处理思考内容
                                    if (reasoning.isNotEmpty()) {
                                        reasoningBuilder.append(reasoning)
                                        onReasoning?.invoke(reasoning)
                                    }
                                    
                                    // 处理正文内容
                                    if (content != "[DONE]" && content.isNotEmpty()) {
                                        contentBuilder.append(content)
                                        onChunk(content)
                                    }
                                }
                            } catch (e: Exception) {
                                Log.w(TAG, "Failed to parse SSE line: $jsonStr")
                            }
                        }
                    }
                }
            }
            
            // 🆕 日志记录思考内容（如果有）
            if (reasoningBuilder.isNotEmpty()) {
                Log.d(TAG, "🧠 收到思考内容: ${reasoningBuilder.length} 字符")
            }
            
            // 🆕 从内容中提取 Grounding Sources（如果存在）
            val fullContent = contentBuilder.toString()
            val (cleanContent, parsedMetadata) = parseGroundingSourcesFromContent(fullContent)
            
            // 优先使用 JSON 格式的 groundingMetadata，否则使用从内容解析的
            val metadataToUse = finalGroundingMetadata ?: parsedMetadata
            
            // 🆕 回调引用元数据
            if (metadataToUse != null && onGroundingMetadata != null) {
                Log.d(TAG, "📚 回调引用元数据: ${metadataToUse.groundingChunks.size}个来源")
                onGroundingMetadata(metadataToUse)
            }
            
            // 返回清理后的内容（不包含 Grounding Sources HTML）
            return@withContext cleanContent
        } catch (e: Exception) {
            Log.e(TAG, "Streaming API call failed!", e)
            throw e
        }
    }

    /**
     * Check if the proxy service is properly configured.
     */
    fun isConfigured(): Boolean {
        return apiKey.isNotBlank() && apiSecret.isNotBlank()
    }
    
    /**
     * 健康检查 - 检测代理服务是否可用
     * 发送简单请求，期望返回包含 "Yes" 的响应
     * 
     * @return true 如果代理服务响应正常，false 如果不可用
     */
    suspend fun healthCheck(): Boolean = withContext(Dispatchers.IO) {
        if (!isConfigured()) {
            Log.w(TAG, "Health check: API not configured")
            return@withContext false
        }
        
        try {
            val requestId = UUID.randomUUID().toString()
            val timestamp = System.currentTimeMillis()
            val sign = generateSign(requestId, timestamp)
            
            // 简单的健康检查请求
            val requestBody = buildMap {
                put("prompt", "请只回复一个单词：Yes")
                put("model", Models.GEMINI_FLASH)
                put("scene", listOf("text"))
                put("generatedLength", 4096)
            }
            
            val jsonBody = gson.toJson(requestBody)
            
            val request = Request.Builder()
                .url("$BASE_URL$ENDPOINT")
                .addHeader("Request-Id", requestId)
                .addHeader("timestamp", timestamp.toString())
                .addHeader("apiKey", apiKey)
                .addHeader("sign", sign)
                .addHeader("Content-Type", "application/json")
                .post(jsonBody.toRequestBody("application/json".toMediaType()))
                .build()
            
            // 健康检查使用适中的超时时间（不要太短，避免误报）
            val quickClient = httpClient.newBuilder()
                .connectTimeout(8, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .build()
            
            val response = quickClient.newCall(request).execute()
            
            if (!response.isSuccessful) {
                Log.w(TAG, "Health check: HTTP ${response.code}")
                return@withContext false
            }
            
            val responseBody = response.body?.string() ?: ""
            
            // 检查响应中是否包含 "Yes" 或成功的 code
            val containsYes = responseBody.contains("Yes", ignoreCase = true) || 
                              responseBody.contains("yes", ignoreCase = true) ||
                              responseBody.contains("\"code\":200")
            
            Log.d(TAG, "Health check: ${if (containsYes) "✅ OK" else "❌ Failed"}")
            containsYes
        } catch (e: Exception) {
            Log.w(TAG, "Health check failed: ${e.message}")
            false
        }
    }
}
