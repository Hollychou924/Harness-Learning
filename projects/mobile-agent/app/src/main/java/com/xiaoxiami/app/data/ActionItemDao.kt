package com.xiaoxiami.app.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * 行动指导 - 为待办事项提供具体执行建议
 */
data class ActionGuidance(
    val difficulty: String,              // 任务难度：简单/中等/复杂
    val estimatedTime: String,           // 预计耗时：如"30分钟"、"1-2小时"
    val bestTimeSlot: String,            // 最佳执行时段：早上/下午/晚上
    val bestTimeReason: String,          // 最佳时段原因
    val actionSteps: List<String>,       // 具体步骤：["第一步...", "第二步..."]
    val tips: List<String>,              // 执行建议：["注意事项", "效率技巧"]
    val relatedContext: String           // 相关背景：基于记忆内容的上下文
)

/**
 * 行动清单项（待办指南2.0升级版）
 */
@Entity(tableName = "action_items")
data class ActionItem(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val content: String,                    // 事项内容
    val dueTime: Long? = null,              // 截止时间
    val priority: String = "中",             // 高/中/低（兼容旧版）
    val sourceMemoryId: Long? = null,       // 来源记忆ID
    val sourceType: String = "",            // visual/audio
    val isCompleted: Boolean = false,       // 是否完成
    val completedAt: Long? = null,          // 完成时间
    val createdAt: Long = System.currentTimeMillis(),
    val dateKey: String = "",               // 日期key，格式：yyyy-MM-dd
    
    // 🆕 行动指导相关字段
    val estimatedTime: String = "",         // 预计耗时（一级页面简短显示）
    val bestTimeSlot: String = "",          // 最佳时段（一级页面简短显示）
    val actionGuidanceJson: String = "",    // 完整行动指导JSON（二级页面详细显示）
    
    // 🆕 待办指南2.0新增字段
    val timeLabel: String = "今天",          // 时间标签：今天/明天/本周/更远/无期限
    val isUrgent: Boolean = false,          // 是否紧急 🔥
    val isImportant: Boolean = false,       // 是否重要 🎯
    val ownershipStatus: String = "mine",   // 归属状态：mine/watching/pending/ignored
    val briefTip: String = "",              // 简短建议（主页面显示）
    val fullDescription: String = ""        // 完整描述（二级页面显示）
) {
    /**
     * 解析行动指导JSON为对象（用于UI展示）
     */
    fun getActionGuidance(): ActionGuidance? {
        if (actionGuidanceJson.isEmpty()) return null
        return try {
            val gson = com.google.gson.Gson()
            gson.fromJson(actionGuidanceJson, ActionGuidance::class.java)
        } catch (e: Exception) {
            null
        }
    }
}

/**
 * 行动清单 DAO
 */
@Dao
interface ActionItemDao {
    
    @Query("SELECT * FROM action_items WHERE dateKey = :dateKey ORDER BY isCompleted ASC, priority DESC, createdAt DESC")
    fun observeByDate(dateKey: String): Flow<List<ActionItem>>
    
    @Query("SELECT * FROM action_items WHERE dateKey = :dateKey ORDER BY isCompleted ASC, priority DESC, createdAt DESC")
    suspend fun getByDate(dateKey: String): List<ActionItem>
    
    @Query("SELECT * FROM action_items WHERE id = :id")
    suspend fun getById(id: Long): ActionItem?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: ActionItem): Long
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<ActionItem>)
    
    @Update
    suspend fun update(item: ActionItem)
    
    @Query("UPDATE action_items SET isCompleted = :completed, completedAt = :completedAt WHERE id = :id")
    suspend fun updateCompletion(id: Long, completed: Boolean, completedAt: Long?)
    
    @Delete
    suspend fun delete(item: ActionItem)
    
    @Query("DELETE FROM action_items WHERE id = :itemId")
    suspend fun deleteById(itemId: Long)
    
    @Query("DELETE FROM action_items WHERE dateKey = :dateKey")
    suspend fun deleteByDate(dateKey: String)
    
    @Query("DELETE FROM action_items")
    suspend fun deleteAll()
    
    @Query("SELECT COUNT(*) FROM action_items WHERE dateKey = :dateKey")
    suspend fun getCountByDate(dateKey: String): Int
    
    @Query("SELECT * FROM action_items WHERE sourceMemoryId = :memoryId AND sourceType = :sourceType LIMIT 1")
    suspend fun findBySource(memoryId: Long, sourceType: String): ActionItem?
}





