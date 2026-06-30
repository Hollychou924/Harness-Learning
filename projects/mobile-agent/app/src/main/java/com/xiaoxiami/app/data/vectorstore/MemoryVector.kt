package com.xiaoxiami.app.data.vectorstore

import io.objectbox.annotation.Entity
import io.objectbox.annotation.HnswIndex
import io.objectbox.annotation.Id

/**
 * ObjectBox 向量存储实体
 * 用于存储长期记忆的 embedding 向量，支持高效的相似度检索
 */
@Entity
data class MemoryVector(
    @Id 
    var id: Long = 0,
    
    // ============ 记忆元数据 ============
    
    /**
     * 对应的长期记忆 ID
     * 关联到 LongTermMemory.id
     */
    var memoryId: String = "",
    
    /**
     * 记忆类型
     * FACT / PREFERENCE / DECISION / LESSON
     */
    var memoryType: String = "",
    
    /**
     * 记忆内容（用于显示和日志）
     * 不用于检索，仅作元数据
     */
    var content: String = "",
    
    // ============ 向量数据 ============
    
    /**
     * Embedding 向量（2048维）
     * 使用 HNSW 索引加速相似度搜索
     * 
     * 🔥 核心检索字段
     * ObjectBox 会自动创建 HNSW 索引，实现毫秒级向量检索
     * 🆕 切换为 COSINE 距离以匹配豆包 Embedding 模型
     */
    @HnswIndex(
        dimensions = 2048, 
        neighborsPerNode = 30, 
        indexingSearchCount = 100
    )
    var embeddingVector: FloatArray = FloatArray(2048),
    
    // ============ 时间戳 ============
    
    /**
     * 创建时间（毫秒时间戳）
     */
    var createdAt: Long = 0,
    
    /**
     * 最后使用时间（毫秒时间戳）
     * 每次被检索到时更新
     */
    var lastUsedAt: Long = 0
) {
    /**
     * 重写 equals 和 hashCode
     * FloatArray 默认使用引用比较，需要手动实现内容比较
     */
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as MemoryVector

        if (id != other.id) return false
        if (memoryId != other.memoryId) return false
        if (memoryType != other.memoryType) return false
        if (content != other.content) return false
        if (!embeddingVector.contentEquals(other.embeddingVector)) return false
        if (createdAt != other.createdAt) return false
        if (lastUsedAt != other.lastUsedAt) return false

        return true
    }

    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + memoryId.hashCode()
        result = 31 * result + memoryType.hashCode()
        result = 31 * result + content.hashCode()
        result = 31 * result + embeddingVector.contentHashCode()
        result = 31 * result + createdAt.hashCode()
        result = 31 * result + lastUsedAt.hashCode()
        return result
    }
}
