package com.xiaoxiami.app.data.memory

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

/**
 * 长期记忆实体 - MEMORY
 * 存储提炼后的事实/偏好/决策/教训
 */
@Entity(
    tableName = "long_term_memory_entries",
    indices = [
        androidx.room.Index(value = ["type"], name = "index_long_term_memory_entries_type"),
        androidx.room.Index(value = ["category"], name = "index_long_term_memory_entries_category"),
        androidx.room.Index(value = ["importance"], name = "index_long_term_memory_entries_importance"),
        androidx.room.Index(value = ["usageCount"], name = "index_long_term_memory_entries_usageCount"),
        androidx.room.Index(value = ["lastUsedAt"], name = "index_long_term_memory_entries_lastUsedAt"),
        androidx.room.Index(value = ["createdAt"], name = "index_long_term_memory_entries_createdAt")
    ]
)
data class LongTermMemory(
    @PrimaryKey 
    val id: String = UUID.randomUUID().toString(),
    
    // 核心信息
    val type: MemoryType,                   // 类型：FACT/PREFERENCE/DECISION/LESSON
    val content: String,                    // 记忆内容
    val category: String,                   // 分类（如：工作、生活、技术）
    
    // 来源追溯
    val sourceDate: String,                 // 来源日期 YYYY-MM-DD
    val sourceSessionIds: String,           // 来源会话ID（逗号分隔）
    val sourceDailyLogIds: String = "",     // 历史兼容字段
    
    // 时间信息
    val createdAt: Long,                    // 创建时间
    val updatedAt: Long,                    // 最后更新时间
    
    // 元数据
    val importance: Int = 5,                // 重要性 0-10
    val usageCount: Int = 0,                // 使用次数（检索命中）
    val lastUsedAt: Long = 0,               // 最后使用时间
    val isUserEdited: Boolean = false,      // 是否用户手动编辑
    val isUserMarked: Boolean = false,      // 是否用户手动标记重要
    
    // 相关性
    val relatedMemoryIds: String = "",      // 关联的其他记忆ID（逗号分隔）
    val conflictResolution: String = "",    // 冲突解决记录（JSON）
    
    // 语义向量（预留，用于未来的向量检索）
    val embedding: String? = null           // 语义向量（JSON数组）
) {
    /**
     * 获取来源会话ID列表
     */
    fun getSourceSessionIdList(): List<String> {
        return sourceSessionIds.split(",").map { it.trim() }.filter { it.isNotBlank() }
    }
    
    /**
     * 获取历史兼容字段中的来源 ID 列表
     */
    fun getSourceDailyLogIdList(): List<String> {
        return sourceDailyLogIds.split(",").map { it.trim() }.filter { it.isNotBlank() }
    }
    
    /**
     * 获取关联的记忆ID列表
     */
    fun getRelatedMemoryIdList(): List<String> {
        return relatedMemoryIds.split(",").map { it.trim() }.filter { it.isNotBlank() }
    }
    
    /**
     * 检查记忆是否新鲜（最近30天使用过）
     */
    fun isFresh(): Boolean {
        val thirtyDaysAgo = System.currentTimeMillis() - (30 * 24 * 60 * 60 * 1000L)
        return lastUsedAt > thirtyDaysAgo || createdAt > thirtyDaysAgo
    }
    
    /**
     * 计算记忆的综合评分（考虑重要性、使用频率、新鲜度）
     */
    fun calculateScore(): Double {
        val importanceWeight = 0.4
        val usageWeight = 0.3
        val freshnessWeight = 0.3
        
        val importanceScore = importance / 10.0
        val usageScore = minOf(usageCount / 10.0, 1.0)
        val freshnessScore = if (isFresh()) 1.0 else 0.5
        
        return importanceScore * importanceWeight + 
               usageScore * usageWeight + 
               freshnessScore * freshnessWeight
    }
}
