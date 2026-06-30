package com.xiaoxiami.app.service

import android.content.Context
import android.util.Log
import com.xiaoxiami.app.data.vectorstore.MemoryVector
import com.xiaoxiami.app.data.vectorstore.MyObjectBox
import io.objectbox.Box
import io.objectbox.BoxStore
import io.objectbox.kotlin.boxFor
import io.objectbox.query.QueryBuilder.StringOrder

/**
 * Faiss 风格向量存储服务 (基于 ObjectBox HNSW 实现)
 * 
 * 提供 2048 维向量的高效 CRUD 和相似度检索功能
 * 使用 HNSW 算法实现 FAISS 级别的近似最近邻搜索
 * 默认使用 Cosine 距离，完美匹配 doubao-embedding-vision-251215 模型
 */
class FaissVectorStoreService(context: Context) {
    
    companion object {
        private const val TAG = "FaissVectorStore"
    }
    
    // ObjectBox BoxStore 实例（单例）
    private val boxStore: BoxStore = MyObjectBox.builder()
        .androidContext(context.applicationContext)
        .build()
    
    // MemoryVector 的 Box（类似 DAO）
    private val memoryVectorBox: Box<MemoryVector> = boxStore.boxFor()
    
    /**
     * 保存或更新记忆向量
     * 
     * @param memoryId 记忆 ID（LongTermMemory.id）
     * @param memoryType 记忆类型（FACT/PREFERENCE/DECISION/LESSON）
     * @param content 记忆内容
     * @param embedding Embedding 向量（2048维）
     * @return 保存的向量 ID
     */
    fun saveMemoryVector(
        memoryId: String,
        memoryType: String,
        content: String,
        embedding: FloatArray
    ): Long {
        try {
            // 检查是否已存在（根据 memoryId）
            val existing = memoryVectorBox.query()
                .equal(com.xiaoxiami.app.data.vectorstore.MemoryVector_.memoryId, memoryId, StringOrder.CASE_SENSITIVE)
                .build()
                .findFirst()
            
            val vector = if (existing != null) {
                // 更新现有向量
                Log.d(TAG, "更新已有向量: $memoryId")
                existing.apply {
                    this.memoryType = memoryType
                    this.content = content
                    this.embeddingVector = embedding
                    this.lastUsedAt = System.currentTimeMillis()
                }
            } else {
                // 创建新向量
                Log.d(TAG, "创建新向量: $memoryId")
                MemoryVector(
                    memoryId = memoryId,
                    memoryType = memoryType,
                    content = content,
                    embeddingVector = embedding,
                    createdAt = System.currentTimeMillis(),
                    lastUsedAt = System.currentTimeMillis()
                )
            }
            
            val id = memoryVectorBox.put(vector)
            Log.d(TAG, "✅ 向量已保存: ID=$id, memoryId=$memoryId")
            return id
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ 保存向量失败: $memoryId", e)
            throw e
        }
    }
    
    /**
     * 向量相似度搜索（Top-K）
     * 
     * 使用 HNSW 算法进行近似最近邻搜索
     * 
     * @param queryEmbedding 查询向量（2048维）
     * @param topK 返回前 K 个最相似的结果
     * @param minScore 最小相似度阈值（0.0 ~ 1.0），低于此值的结果会被过滤
     * @return List<Pair<MemoryVector, Float>> (记忆向量, 相似度分数)
     */
    fun searchSimilar(
        queryEmbedding: FloatArray,
        topK: Int = 10,
        minScore: Float = 0.0f
    ): List<Pair<MemoryVector, Float>> {
        try {
            Log.d(TAG, "🔍 向量相似度搜索: topK=$topK, minScore=$minScore")
            
            // 构建向量查询
            val query = memoryVectorBox.query()
                .nearestNeighbors(
                    com.xiaoxiami.app.data.vectorstore.MemoryVector_.embeddingVector,
                    queryEmbedding,
                    topK
                )
                .build()
            
            // 执行查询并获取结果（带分数）
            val results = query.findWithScores()
            
            // 过滤低分结果并转换为 Pair
            val filtered = results.mapNotNull { result ->
                val vector = result.get()
                val score = result.score.toFloat()
                
                if (vector != null && score >= minScore) {
                    vector to score
                } else {
                    null
                }
            }
            
            Log.d(TAG, "✅ 找到 ${filtered.size} 条相关向量（原始 ${results.size} 条）")
            
            // 更新最后使用时间
            val now = System.currentTimeMillis()
            val vectorsToUpdate = filtered.map { (vector, _) ->
                vector.lastUsedAt = now
                vector
            }
            if (vectorsToUpdate.isNotEmpty()) {
                memoryVectorBox.put(vectorsToUpdate)
            }
            
            return filtered
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ 向量检索失败", e)
            return emptyList()
        }
    }
    
    /**
     * 根据记忆 ID 获取向量
     * 
     * @param memoryId 记忆 ID
     * @return MemoryVector? 如果不存在返回 null
     */
    fun getVectorByMemoryId(memoryId: String): MemoryVector? {
        return try {
            memoryVectorBox.query()
                .equal(com.xiaoxiami.app.data.vectorstore.MemoryVector_.memoryId, memoryId, StringOrder.CASE_SENSITIVE)
                .build()
                .findFirst()
        } catch (e: Exception) {
            Log.e(TAG, "❌ 查询向量失败: $memoryId", e)
            null
        }
    }
    
    /**
     * 根据记忆 ID 删除向量
     * 
     * @param memoryId 记忆 ID
     * @return 删除的向量数量
     */
    fun deleteByMemoryId(memoryId: String): Long {
        return try {
            val count = memoryVectorBox.query()
                .equal(com.xiaoxiami.app.data.vectorstore.MemoryVector_.memoryId, memoryId, StringOrder.CASE_SENSITIVE)
                .build()
                .remove()
            
            Log.d(TAG, "✅ 删除向量: $memoryId (删除 $count 条)")
            count
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ 删除向量失败: $memoryId", e)
            0L
        }
    }
    
    /**
     * 批量删除向量
     * 
     * @param memoryIds 记忆 ID 列表
     * @return 删除的向量数量
     */
    fun deleteBatch(memoryIds: List<String>): Long {
        return try {
            var totalDeleted = 0L
            memoryIds.forEach { memoryId ->
                totalDeleted += deleteByMemoryId(memoryId)
            }
            Log.d(TAG, "✅ 批量删除向量: ${memoryIds.size} 个 ID, 删除 $totalDeleted 条向量")
            totalDeleted
        } catch (e: Exception) {
            Log.e(TAG, "❌ 批量删除失败", e)
            0L
        }
    }
    
    /**
     * 获取所有向量数量
     */
    fun getVectorCount(): Long {
        return memoryVectorBox.count()
    }
    
    /**
     * 清空所有向量（谨慎使用）
     */
    fun clearAll() {
        memoryVectorBox.removeAll()
        Log.w(TAG, "⚠️ 已清空所有向量")
    }
    
    /**
     * 关闭 BoxStore（在应用退出时调用）
     */
    fun close() {
        boxStore.close()
        Log.d(TAG, "BoxStore 已关闭")
    }
    
    /**
     * 获取数据库统计信息（用于调试）
     */
    fun getStats(): Map<String, Any> {
        return mapOf(
            "totalVectors" to getVectorCount(),
            "boxStoreOpen" to !boxStore.isClosed,
            "dbSizeMB" to (boxStore.sizeOnDisk() / 1024.0 / 1024.0)
        )
    }
}
