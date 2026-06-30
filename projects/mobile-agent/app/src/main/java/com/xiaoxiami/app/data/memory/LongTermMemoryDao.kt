package com.xiaoxiami.app.data.memory

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * 长期记忆数据访问对象
 */
@Dao
interface LongTermMemoryDao {
    
    // ============ 查询操作 ============
    
    /**
     * 获取所有长期记忆（按创建时间倒序）
     */
    @Query("SELECT * FROM long_term_memory_entries ORDER BY createdAt DESC")
    fun getAllMemories(): Flow<List<LongTermMemory>>
    
    /**
     * 根据类型获取记忆
     */
    @Query("SELECT * FROM long_term_memory_entries WHERE type = :type ORDER BY importance DESC, createdAt DESC")
    fun getMemoriesByType(type: MemoryType): Flow<List<LongTermMemory>>
    
    /**
     * 根据分类获取记忆
     */
    @Query("SELECT * FROM long_term_memory_entries WHERE category = :category ORDER BY importance DESC, createdAt DESC")
    fun getMemoriesByCategory(category: String): Flow<List<LongTermMemory>>
    
    /**
     * 根据ID获取记忆
     */
    @Query("SELECT * FROM long_term_memory_entries WHERE id = :id")
    suspend fun getMemoryById(id: String): LongTermMemory?
    
    /**
     * 获取最重要的记忆（top N）
     */
    @Query("SELECT * FROM long_term_memory_entries ORDER BY importance DESC, usageCount DESC LIMIT :limit")
    suspend fun getTopImportantMemories(limit: Int = 10): List<LongTermMemory>
    
    /**
     * 获取最常用的记忆（top N）
     */
    @Query("SELECT * FROM long_term_memory_entries ORDER BY usageCount DESC, importance DESC LIMIT :limit")
    suspend fun getMostUsedMemories(limit: Int = 10): List<LongTermMemory>
    
    /**
     * 获取最近使用的记忆
     */
    @Query("""
        SELECT * FROM long_term_memory_entries 
        WHERE lastUsedAt > 0 
        ORDER BY lastUsedAt DESC 
        LIMIT :limit
    """)
    suspend fun getRecentlyUsedMemories(limit: Int = 10): List<LongTermMemory>
    
    /**
     * 获取新鲜的记忆（最近30天有活动）
     */
    @Query("""
        SELECT * FROM long_term_memory_entries 
        WHERE lastUsedAt > :thirtyDaysAgo OR createdAt > :thirtyDaysAgo
        ORDER BY importance DESC, lastUsedAt DESC
    """)
    suspend fun getFreshMemories(thirtyDaysAgo: Long): List<LongTermMemory>
    
    /**
     * 获取用户手动标记的记忆
     */
    @Query("SELECT * FROM long_term_memory_entries WHERE isUserMarked = 1 ORDER BY importance DESC, createdAt DESC")
    fun getUserMarkedMemories(): Flow<List<LongTermMemory>>
    
    /**
     * 搜索记忆（内容、分类）
     */
    @Query("""
        SELECT * FROM long_term_memory_entries 
        WHERE content LIKE '%' || :query || '%' 
           OR category LIKE '%' || :query || '%'
        ORDER BY importance DESC, usageCount DESC
    """)
    fun searchMemories(query: String): Flow<List<LongTermMemory>>
    
    /**
     * 🆕 根据 ID 列表批量查询记忆（用于向量检索）
     * 
     * @param ids 记忆 ID 列表
     * @return 查询到的记忆列表（顺序可能与输入不同）
     */
    @Query("SELECT * FROM long_term_memory_entries WHERE id IN (:ids)")
    suspend fun getMemoriesByIds(ids: List<String>): List<LongTermMemory>
    
    /**
     * 关键词过滤 + 评分排序（用于RAG检索第一步）
     * 返回包含任一关键词的记忆
     */
    @Query("""
        SELECT * FROM long_term_memory_entries 
        WHERE content LIKE '%' || :keyword1 || '%'
           OR content LIKE '%' || :keyword2 || '%'
           OR content LIKE '%' || :keyword3 || '%'
           OR category LIKE '%' || :keyword1 || '%'
           OR category LIKE '%' || :keyword2 || '%'
           OR category LIKE '%' || :keyword3 || '%'
        ORDER BY 
            (importance * 0.4 + usageCount * 0.3 + 
             CASE WHEN lastUsedAt > :recentThreshold THEN 3 ELSE 1 END) DESC
        LIMIT :limit
    """)
    suspend fun searchByKeywords(
        keyword1: String, 
        keyword2: String, 
        keyword3: String,
        recentThreshold: Long,
        limit: Int = 10
    ): List<LongTermMemory>
    
    /**
     * 查找相似内容的记忆（用于去重检测）
     */
    @Query("""
        SELECT * FROM long_term_memory_entries 
        WHERE content LIKE '%' || :contentSnippet || '%'
          AND type = :type
        LIMIT 5
    """)
    suspend fun findSimilarMemories(contentSnippet: String, type: MemoryType): List<LongTermMemory>
    
    /**
     * 获取按类型分组的统计
     */
    @Query("""
        SELECT type, COUNT(*) as count, AVG(importance) as avgImportance, SUM(usageCount) as totalUsage
        FROM long_term_memory_entries
        GROUP BY type
    """)
    fun getMemoryStatsByType(): Flow<List<LongTermMemoryTypeStats>>
    
    /**
     * 获取按分类分组的统计
     */
    @Query("""
        SELECT category, COUNT(*) as count, AVG(importance) as avgImportance
        FROM long_term_memory_entries
        GROUP BY category
        ORDER BY count DESC
    """)
    fun getMemoryStatsByCategory(): Flow<List<LongTermMemoryCategoryStats>>
    
    // ============ 插入/更新操作 ============
    
    /**
     * 插入单条记忆
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMemory(memory: LongTermMemory)
    
    /**
     * 插入多条记忆
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMemories(memories: List<LongTermMemory>)
    
    /**
     * 更新记忆
     */
    @Update
    suspend fun updateMemory(memory: LongTermMemory)
    
    /**
     * 增加使用次数
     */
    @Query("""
        UPDATE long_term_memory_entries 
        SET usageCount = usageCount + 1, 
            lastUsedAt = :lastUsedAt,
            updatedAt = :updatedAt
        WHERE id = :id
    """)
    suspend fun incrementUsageCount(
        id: String, 
        lastUsedAt: Long = System.currentTimeMillis(),
        updatedAt: Long = System.currentTimeMillis()
    )
    
    /**
     * 批量增加使用次数
     */
    @Query("""
        UPDATE long_term_memory_entries 
        SET usageCount = usageCount + 1, 
            lastUsedAt = :lastUsedAt,
            updatedAt = :updatedAt
        WHERE id IN (:ids)
    """)
    suspend fun incrementUsageCountBatch(
        ids: List<String>, 
        lastUsedAt: Long = System.currentTimeMillis(),
        updatedAt: Long = System.currentTimeMillis()
    )
    
    /**
     * 更新重要性
     */
    @Query("UPDATE long_term_memory_entries SET importance = :importance, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateImportance(id: String, importance: Int, updatedAt: Long = System.currentTimeMillis())
    
    /**
     * 用户手动标记
     */
    @Query("UPDATE long_term_memory_entries SET isUserMarked = :marked, updatedAt = :updatedAt WHERE id = :id")
    suspend fun markAsUserMarked(id: String, marked: Boolean = true, updatedAt: Long = System.currentTimeMillis())
    
    /**
     * 更新内容
     */
    @Query("""
        UPDATE long_term_memory_entries 
        SET content = :content, 
            isUserEdited = 1, 
            updatedAt = :updatedAt 
        WHERE id = :id
    """)
    suspend fun updateContent(id: String, content: String, updatedAt: Long = System.currentTimeMillis())
    
    /**
     * 添加关联记忆ID
     */
    @Query("""
        UPDATE long_term_memory_entries 
        SET relatedMemoryIds = relatedMemoryIds || ',' || :relatedId,
            updatedAt = :updatedAt
        WHERE id = :id
    """)
    suspend fun addRelatedMemoryId(id: String, relatedId: String, updatedAt: Long = System.currentTimeMillis())
    
    // ============ 删除操作 ============
    
    /**
     * 删除单条记忆
     */
    @Delete
    suspend fun deleteMemory(memory: LongTermMemory)
    
    /**
     * 根据ID删除
     */
    @Query("DELETE FROM long_term_memory_entries WHERE id = :id")
    suspend fun deleteMemoryById(id: String)
    
    /**
     * 删除指定日期之前创建的记忆
     */
    @Query("DELETE FROM long_term_memory_entries WHERE createdAt < :thresholdTimestamp")
    suspend fun deleteMemoriesOlderThan(thresholdTimestamp: Long)
    
    /**
     * 删除未使用且重要性低的记忆（清理垃圾）
     */
    @Query("""
        DELETE FROM long_term_memory_entries 
        WHERE usageCount = 0 
          AND importance < 3 
          AND createdAt < :thresholdTimestamp
          AND isUserMarked = 0
    """)
    suspend fun deleteUnusedLowImportanceMemories(thresholdTimestamp: Long)
    
    /**
     * 清空所有记忆
     */
    @Query("DELETE FROM long_term_memory_entries")
    suspend fun deleteAllMemories()
    
    // ============ 统计操作 ============
    
    /**
     * 获取记忆总数
     */
    @Query("SELECT COUNT(*) FROM long_term_memory_entries")
    suspend fun getMemoryCount(): Int
    
    /**
     * 获取指定类型的记忆数量
     */
    @Query("SELECT COUNT(*) FROM long_term_memory_entries WHERE type = :type")
    suspend fun getMemoryCountByType(type: MemoryType): Int
    
    /**
     * 获取平均重要性
     */
    @Query("SELECT AVG(importance) FROM long_term_memory_entries")
    suspend fun getAverageImportance(): Double
    
    /**
     * 获取总使用次数
     */
    @Query("SELECT SUM(usageCount) FROM long_term_memory_entries")
    suspend fun getTotalUsageCount(): Int
}

/**
 * 长期记忆类型统计数据类
 */
data class LongTermMemoryTypeStats(
    val type: MemoryType,
    val count: Int,
    val avgImportance: Double,
    val totalUsage: Int
)

/**
 * 长期记忆分类统计数据类
 */
data class LongTermMemoryCategoryStats(
    val category: String,
    val count: Int,
    val avgImportance: Double
)
