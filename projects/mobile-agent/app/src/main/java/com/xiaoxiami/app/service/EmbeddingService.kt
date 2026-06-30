package com.xiaoxiami.app.service

/**
 * Embedding 服务接口
 * 统一不同提供商的 Embedding API 接口
 */
interface EmbeddingService {
    /**
     * 生成文本的 embedding 向量
     * 
     * @param text 输入文本
     * @param taskType 任务类型（某些服务可能不支持此参数）
     * @return FloatArray 向量
     */
    suspend fun generateEmbedding(
        text: String,
        taskType: String = "RETRIEVAL_DOCUMENT"
    ): FloatArray
    
    /**
     * 批量生成 embedding
     * 
     * @param texts 文本列表
     * @param taskType 任务类型
     * @return List<FloatArray> 向量列表
     */
    suspend fun generateEmbeddingBatch(
        texts: List<String>,
        taskType: String = "RETRIEVAL_DOCUMENT"
    ): List<FloatArray>
    
    /**
     * 计算两个向量的余弦相似度
     * 
     * @param vec1 向量1
     * @param vec2 向量2
     * @return 相似度分数（0.0 ~ 1.0）
     */
    fun cosineSimilarity(vec1: FloatArray, vec2: FloatArray): Float
}
