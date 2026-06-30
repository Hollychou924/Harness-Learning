package com.xiaoxiami.app.service

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * 字节跳动（火山方舟）Embedding API 服务
 * 
 * 使用字节的 doubao-embedding-vision-251215 模型生成文本/图像的向量表示
 * 支持多模态输入（文本、图片、视频），适合 RAG 检索场景
 * 
 * 根据字节向量数据库接入指南优化：
 * - 使用 instructions 字段提升检索精度（非对称检索场景）
 * - 支持 encoding_format 和 dimensions 参数
 * - 符合最佳实践配置
 * 
 * API 文档: https://www.volcengine.com/docs/82379/1409291
 */
class DoubaoEmbeddingService(
    private val apiKey: String
) : EmbeddingService {
    companion object {
        private const val TAG = "DoubaoEmbedding"
        private const val API_URL = "https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal"
        private const val MODEL_ID = "doubao-embedding-vision-251215"
        
        // 向量维度：doubao-embedding-vision-251215 默认返回 2048 或 3072 维
        // 为了平衡精度和性能，我们统一使用 2048 维度进行存储和检索
        // 衔接 MemoryVector.kt 中的 @HnswIndex dimensions
        private const val EMBEDDING_DIM = 2048
        
        // 目标维度：通过 API 参数控制，确保与 MemoryVector 的 2048 维一致
        private const val TARGET_DIMENSIONS = 2048  // 目标维度
        
        private const val TIMEOUT_SECONDS = 30L
        
        // ============ Instructions 配置（根据字节文档最佳实践）============
        // 场景：非对称检索（Query：用户问题；Corpus：记忆内容）
        // 参考文档：https://www.volcengine.com/docs/82379/1409291#ff993d7a
        
        // Query 侧 Instruction（用户问题）
        // 使用跨模态问答场景的配置，因为记忆内容可能是文本或图片
        private const val QUERY_INSTRUCTION = "Target_modality: text.\nInstruction:根据这个问题，找到能回答这个问题的相应文本或图片\nQuery:"
        
        // Corpus 侧 Instruction（记忆内容）
        // 根据记忆内容的模态类型动态设置
        private const val CORPUS_TEXT_INSTRUCTION = "Instruction:Compress the text into one word.\nQuery:"
        private const val CORPUS_IMAGE_INSTRUCTION = "Instruction:Compress the image into one word.\nQuery:"
    }
    
    private val client = OkHttpClient.Builder()
        .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .build()
    
    private val gson = Gson()
    
    /**
     * 生成文本的 embedding 向量
     * 
     * @param text 输入文本
     * @param taskType 任务类型：
     *   - RETRIEVAL_QUERY: 查询场景（用户问题）- 使用 Query Instruction
     *   - RETRIEVAL_DOCUMENT: 文档场景（记忆内容）- 使用 Corpus Instruction
     * @return FloatArray（向量）
     * @throws Exception 如果 API 调用失败
     */
    override suspend fun generateEmbedding(
        text: String,
        taskType: String
    ): FloatArray = withContext(Dispatchers.IO) {
        try {
            if (text.isBlank()) {
                Log.w(TAG, "输入文本为空，返回零向量")
                return@withContext FloatArray(EMBEDDING_DIM)
            }
            
            // 截断过长文本（避免超出 token 限制）
            // 注意：字节 API 对文本长度有要求，建议不超过 8000 字符
            val truncatedText = if (text.length > 8000) {
                Log.w(TAG, "文本过长（${text.length}字），截断到 8000 字")
                text.take(8000)
            } else {
                text
            }
            
            Log.d(TAG, "生成 embedding (taskType=$taskType): ${truncatedText.take(50)}...")
            
            // 根据 taskType 选择对应的 instruction
            val instruction = when (taskType) {
                "RETRIEVAL_QUERY" -> QUERY_INSTRUCTION
                "RETRIEVAL_DOCUMENT" -> CORPUS_TEXT_INSTRUCTION  // 记忆内容默认是文本
                else -> CORPUS_TEXT_INSTRUCTION  // 默认使用 Corpus Instruction
            }
            
            // 构建请求体（根据字节 API 格式和最佳实践）
            val inputArray = JsonArray().apply {
                add(JsonObject().apply {
                    addProperty("type", "text")
                    addProperty("text", truncatedText)
                })
            }
            
            val requestBody = JsonObject().apply {
                addProperty("model", MODEL_ID)
                add("input", inputArray)
                addProperty("encoding_format", "float")  // 使用 float 格式
                addProperty("instructions", instruction)  // 🆕 关键：使用 instructions 提升精度
                
                // 🆕 设置目标维度为 2048，确保与向量库匹配
                addProperty("dimensions", TARGET_DIMENSIONS)
            }
            
            val request = Request.Builder()
                .url(API_URL)
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer $apiKey")
                .post(gson.toJson(requestBody).toRequestBody("application/json".toMediaType()))
                .build()
            
            // 执行请求
            val response = client.newCall(request).execute()
            
            if (!response.isSuccessful) {
                val errorBody = response.body?.string() ?: "Unknown error"
                Log.e(TAG, "API 调用失败 (${response.code}): $errorBody")
                throw Exception("Embedding API failed: ${response.code} - $errorBody")
            }
            
            val responseBody = response.body?.string()
                ?: throw Exception("Response body is null")
            
            Log.d(TAG, "API 响应: ${responseBody.take(200)}...")
            
            // 解析返回的 embedding 向量
            // 字节 API 返回格式：{ "data": { "embedding": [...] } }
            val jsonObject = gson.fromJson(responseBody, JsonObject::class.java)
            
            val embedding: FloatArray = when {
                // 格式1: { "data": { "embedding": [...] } } （单条返回）
                jsonObject.has("data") && jsonObject.get("data").isJsonObject -> {
                    val dataObj = jsonObject.getAsJsonObject("data")
                    if (!dataObj.has("embedding")) {
                        throw Exception("响应中没有 embedding 字段")
                    }
                    parseEmbeddingArray(dataObj.getAsJsonArray("embedding"))
                }
                // 格式2: { "data": [{ "embedding": [...], "index": 0 }] } （批量返回）
                jsonObject.has("data") && jsonObject.get("data").isJsonArray -> {
                    val dataArray = jsonObject.getAsJsonArray("data")
                    if (dataArray.size() == 0) {
                        throw Exception("响应中没有 embedding 数据")
                    }
                    val firstItem = dataArray[0].asJsonObject
                    if (!firstItem.has("embedding")) {
                        throw Exception("响应中没有 embedding 字段")
                    }
                    parseEmbeddingArray(firstItem.getAsJsonArray("embedding"))
                }
                // 格式3: { "embedding": [...] } （直接返回，不常见）
                jsonObject.has("embedding") -> {
                    parseEmbeddingArray(jsonObject.getAsJsonArray("embedding"))
                }
                else -> {
                    Log.e(TAG, "无法识别的响应格式: $responseBody")
                    throw Exception("Invalid response format: missing 'embedding' or 'data' field")
                }
            }
            
            // 检查维度并处理
            val finalEmbedding = when {
                embedding.size == EMBEDDING_DIM -> {
                    // 维度匹配，直接返回
                    embedding
                }
                embedding.size > EMBEDDING_DIM -> {
                    // 维度大于目标维度，截取前 N 维（降维）
                    Log.w(TAG, "⚠️ Embedding 维度 ${embedding.size} > 目标维度 $EMBEDDING_DIM，进行截取降维")
                    embedding.sliceArray(0 until EMBEDDING_DIM)
                }
                else -> {
                    // 维度小于目标维度，填充零向量
                    Log.w(TAG, "⚠️ Embedding 维度 ${embedding.size} < 目标维度 $EMBEDDING_DIM，进行零填充")
                    FloatArray(EMBEDDING_DIM).apply {
                        embedding.copyInto(this, 0, 0, minOf(embedding.size, EMBEDDING_DIM))
                    }
                }
            }
            
            Log.d(TAG, "✅ Embedding 生成成功: ${finalEmbedding.size} 维（原始: ${embedding.size} 维）")
            return@withContext finalEmbedding
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Embedding 生成失败", e)
            throw e
        }
    }
    
    /**
     * 解析 embedding 数组
     */
    private fun parseEmbeddingArray(jsonArray: JsonArray): FloatArray {
        val embedding = FloatArray(jsonArray.size()) { i ->
            jsonArray[i].asFloat
        }
        return embedding
    }
    
    /**
     * 批量生成 embedding（提高效率）
     * 
     * 字节 API 支持批量请求，可以在一个请求中传入多个 input
     * 注意：批量请求时，所有 input 使用相同的 instruction
     * 
     * @param texts 文本列表
     * @param taskType 任务类型（RETRIEVAL_QUERY 或 RETRIEVAL_DOCUMENT）
     * @return List<FloatArray> 向量列表（与输入顺序一致）
     */
    override suspend fun generateEmbeddingBatch(
        texts: List<String>,
        taskType: String
    ): List<FloatArray> = withContext(Dispatchers.IO) {
        try {
            if (texts.isEmpty()) {
                return@withContext emptyList()
            }
            
            // 根据 taskType 选择对应的 instruction
            val instruction = when (taskType) {
                "RETRIEVAL_QUERY" -> QUERY_INSTRUCTION
                "RETRIEVAL_DOCUMENT" -> CORPUS_TEXT_INSTRUCTION
                else -> CORPUS_TEXT_INSTRUCTION
            }
            
            // 构建批量请求体
            val inputArray = JsonArray().apply {
                texts.forEach { text ->
                    val truncatedText = if (text.length > 8000) text.take(8000) else text
                    add(JsonObject().apply {
                        addProperty("type", "text")
                        addProperty("text", truncatedText)
                    })
                }
            }
            
            val requestBody = JsonObject().apply {
                addProperty("model", MODEL_ID)
                add("input", inputArray)
                addProperty("encoding_format", "float")
                addProperty("instructions", instruction)
                // 🆕 批量请求也设置目标维度
                addProperty("dimensions", TARGET_DIMENSIONS)
            }
            
            val request = Request.Builder()
                .url(API_URL)
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer $apiKey")
                .post(gson.toJson(requestBody).toRequestBody("application/json".toMediaType()))
                .build()
            
            val response = client.newCall(request).execute()
            
            if (!response.isSuccessful) {
                val errorBody = response.body?.string() ?: "Unknown error"
                Log.e(TAG, "批量 API 调用失败 (${response.code}): $errorBody")
                // 批量失败时，回退到单个请求
                return@withContext texts.map { text ->
                    try {
                        generateEmbedding(text, taskType)
                    } catch (e: Exception) {
                        Log.e(TAG, "批量处理失败: ${text.take(30)}", e)
                        FloatArray(EMBEDDING_DIM) // 返回零向量作为fallback
                    }
                }
            }
            
            val responseBody = response.body?.string()
                ?: throw Exception("Response body is null")
            
            val jsonObject = gson.fromJson(responseBody, JsonObject::class.java)
            
            // 解析批量返回结果
            val embeddings = mutableListOf<FloatArray>()
            when {
                jsonObject.has("data") && jsonObject.get("data").isJsonArray -> {
                    val dataArray = jsonObject.getAsJsonArray("data")
                    for (i in 0 until dataArray.size()) {
                        val item = dataArray[i].asJsonObject
                        if (item.has("embedding")) {
                            val rawEmbedding = parseEmbeddingArray(item.getAsJsonArray("embedding"))
                            // 处理维度
                            val finalEmbedding = when {
                                rawEmbedding.size == EMBEDDING_DIM -> rawEmbedding
                                rawEmbedding.size > EMBEDDING_DIM -> rawEmbedding.sliceArray(0 until EMBEDDING_DIM)
                                else -> {
                                    FloatArray(EMBEDDING_DIM).apply {
                                        rawEmbedding.copyInto(this, 0, 0, minOf(rawEmbedding.size, EMBEDDING_DIM))
                                    }
                                }
                            }
                            embeddings.add(finalEmbedding)
                        } else {
                            Log.w(TAG, "批量响应中第 $i 项缺少 embedding 字段")
                            embeddings.add(FloatArray(EMBEDDING_DIM))
                        }
                    }
                }
                else -> {
                    Log.w(TAG, "批量响应格式异常，回退到单个请求")
                    return@withContext texts.map { text ->
                        try {
                            generateEmbedding(text, taskType)
                        } catch (e: Exception) {
                            Log.e(TAG, "批量处理失败: ${text.take(30)}", e)
                            FloatArray(EMBEDDING_DIM)
                        }
                    }
                }
            }
            
            Log.d(TAG, "✅ 批量 Embedding 生成成功: ${embeddings.size} 个向量")
            return@withContext embeddings
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ 批量 Embedding 生成失败，回退到单个请求", e)
            // 批量失败时，回退到单个请求
            return@withContext texts.map { text ->
                try {
                    generateEmbedding(text, taskType)
                } catch (e: Exception) {
                    Log.e(TAG, "批量处理失败: ${text.take(30)}", e)
                    FloatArray(EMBEDDING_DIM)
                }
            }
        }
    }
    
    /**
     * 计算两个向量的余弦相似度
     * 
     * 根据字节文档，稠密向量使用余弦相似度：先对向量做 L2 归一化，再计算点积
     * 
     * @param vec1 向量1
     * @param vec2 向量2
     * @return 相似度分数（0.0 ~ 1.0，1.0 表示完全相同）
     */
    override fun cosineSimilarity(vec1: FloatArray, vec2: FloatArray): Float {
        if (vec1.size != vec2.size) {
            throw IllegalArgumentException("向量维度不匹配: ${vec1.size} vs ${vec2.size}")
        }
        
        // L2 归一化
        val norm1 = kotlin.math.sqrt(vec1.sumOf { (it * it).toDouble() }).toFloat()
        val norm2 = kotlin.math.sqrt(vec2.sumOf { (it * it).toDouble() }).toFloat()
        
        if (norm1 == 0f || norm2 == 0f) {
            return 0f
        }
        
        // 归一化后的向量点积
        var dotProduct = 0f
        for (i in vec1.indices) {
            dotProduct += (vec1[i] / norm1) * (vec2[i] / norm2)
        }
        
        return dotProduct.coerceIn(-1f, 1f)  // 确保在 [-1, 1] 范围内
    }
}
