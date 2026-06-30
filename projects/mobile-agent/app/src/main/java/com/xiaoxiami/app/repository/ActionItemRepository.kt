package com.xiaoxiami.app.repository

import android.content.Context
import android.util.Log
import com.xiaoxiami.app.config.DebugConfig
import com.xiaoxiami.app.data.ActionItem
import com.xiaoxiami.app.data.ActionItemDao
import com.xiaoxiami.app.data.MemoryDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

/**
 * 行动清单仓库
 * 负责从记忆中提取待办事项并存储
 */
class ActionItemRepository(
    private val context: Context,
    private val geminiRepository: GeminiRepository
) {
    companion object {
        private const val TAG = "ActionItemRepo"
    }
    
    private val database by lazy { MemoryDatabase.getDatabase(context) }
    private val actionItemDao: ActionItemDao by lazy { database.actionItemDao() }
    /**
     * 获取 DAO 用于直接操作（如更新归属状态）
     */
    fun getDao(): ActionItemDao = actionItemDao
    
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    
    /**
     * 获取今日行动清单（实时监听）
     */
    fun observeTodayItems(): Flow<List<ActionItem>> {
        val today = dateFormat.format(Date())
        return actionItemDao.observeByDate(today)
    }
    
    /**
     * 获取今日行动清单（一次性）
     */
    suspend fun getTodayItems(): List<ActionItem> {
        val today = dateFormat.format(Date())
        return actionItemDao.getByDate(today)
    }
    
    /**
     * 从单条记忆中提取行动事项
     * 每条记忆保存后都会调用此方法
     */
    suspend fun extractFromMemory(
        memoryId: Long,
        memoryTitle: String,
        memoryDetail: String,
        sourceType: String  // "visual" or "audio"
    ) {
        Log.d(TAG, "=== extractFromMemory called ===")
        Log.d(TAG, "memoryId=$memoryId, sourceType=$sourceType")
        Log.d(TAG, "title: $memoryTitle")
        Log.d(TAG, "detail: ${memoryDetail.take(100)}...")
        
        // 检查是否已经从这条记忆提取过
        val existing = actionItemDao.findBySource(memoryId, sourceType)
        if (existing != null) {
            Log.d(TAG, "Already extracted from this memory, skip")
            return
        }
        
        withContext(Dispatchers.IO) {
            try {
                // 获取今日已有事项用于去重
                val today = dateFormat.format(Date())
                val existingItems = actionItemDao.getByDate(today)
                val existingItemsStr = if (existingItems.isEmpty()) {
                    "无"
                } else {
                    existingItems.joinToString("\n") { "- ${it.content}" }
                }
                Log.d(TAG, "Existing items for dedup: $existingItemsStr")
                
                // 构建 prompt（包含已有事项）
                val prompt = DebugConfig.actionItemPrompt.value
                    .replace("{memory_content}", "[${if (sourceType == "audio") "听觉" else "视觉"}] 标题: $memoryTitle\n详情: $memoryDetail")
                    .replace("{existing_items}", existingItemsStr)
                
                Log.d(TAG, "Calling Gemini to extract action items...")
                
                val result = geminiRepository.analyzeText(prompt)
                if (result.isSuccess) {
                    val response = result.getOrNull() ?: ""
                    Log.d(TAG, "Gemini response: $response")
                    
                    // 解析响应
                    val items = parseActionItems(response, memoryId, sourceType)
                    Log.d(TAG, "Parsed ${items.size} action items")
                    
                    if (items.isNotEmpty()) {
                        actionItemDao.insertAll(items)
                        Log.d(TAG, "Saved ${items.size} action items to database")
                    }
                } else {
                    Log.e(TAG, "Gemini failed: ${result.exceptionOrNull()?.message}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Extract error", e)
            }
        }
    }
    
    /**
     * 解析 Gemini 响应为 ActionItem 列表
     * 响应格式：事项内容|日期|具体时间|优先级|预计耗时|最佳时段|行动指导JSON
     */
    /**
     * 解析 Gemini 响应为 ActionItem 列表
     * 待办指南2.0格式（12字段）：
     * 事项内容|日期|具体时间|优先级|预计耗时|最佳时段|时间标签|是否紧急|是否重要|归属状态|简短建议|行动指导JSON
     * 
     * 兼容旧格式（7字段）：
     * 事项内容|日期|具体时间|优先级|预计耗时|最佳时段|行动指导JSON
     */
    private fun parseActionItems(
        response: String,
        memoryId: Long,
        sourceType: String
    ): List<ActionItem> {
        val today = dateFormat.format(Date())
        val items = mutableListOf<ActionItem>()
        
        val lines = response.lines()
            .map { it.trim() }
            .filter { it.isNotBlank() && it != "无" && !it.startsWith("【") }
        
        for (line in lines) {
            val parts = line.split("|")
            if (parts.isEmpty()) continue
            
            val content = parts[0].trim()
            if (content.isBlank() || content == "无" || content.length < 3) continue
            
            // 解析日期和具体时间
            val dateGroup = parts.getOrNull(1)?.trim() ?: "无期限"
            val specificTime = parts.getOrNull(2)?.trim()?.takeIf { it.isNotBlank() }
            val dueTime = parseDueTime(dateGroup, specificTime)
            
            // 解析优先级
            val priorityStr = parts.getOrNull(3)?.trim() ?: "中"
            val priority = when {
                priorityStr.contains("高") -> "高"
                priorityStr.contains("低") -> "低"
                else -> "中"
            }
            
            // 解析预计耗时
            val estimatedTime = parts.getOrNull(4)?.trim() ?: ""
            
            // 解析最佳时段
            val bestTimeSlot = parts.getOrNull(5)?.trim() ?: ""
            
            // 🆕 待办指南2.0新字段（兼容旧格式）
            val isNewFormat = parts.size >= 12
            
            // 时间标签（新格式第7字段）
            val timeLabel = if (isNewFormat) {
                parts.getOrNull(6)?.trim() ?: dateGroup
            } else {
                // 旧格式：根据日期组推断
                when {
                    dateGroup.contains("今天") -> "今天"
                    dateGroup.contains("明天") -> "明天"
                    dateGroup.contains("本周") || dateGroup.contains("周") -> "本周"
                    dateGroup.contains("下周") || dateGroup.contains("下月") || dateGroup.contains("月") -> "更远"
                    else -> "无期限"
                }
            }
            
            // 是否紧急（新格式第8字段）
            val isUrgent = if (isNewFormat) {
                parts.getOrNull(7)?.trim()?.lowercase() == "true"
            } else {
                // 旧格式：高优先级默认紧急
                priority == "高"
            }
            
            // 是否重要（新格式第9字段）
            val isImportant = if (isNewFormat) {
                parts.getOrNull(8)?.trim()?.lowercase() == "true"
            } else {
                // 旧格式：高优先级默认重要
                priority == "高"
            }
            
            // 归属状态（新格式第10字段）
            val ownershipStatus = if (isNewFormat) {
                parts.getOrNull(9)?.trim() ?: "mine"
            } else {
                "mine"
            }
            
            // 简短建议（新格式第11字段）
            val briefTip = if (isNewFormat) {
                parts.getOrNull(10)?.trim() ?: ""
            } else {
                // 旧格式：生成简短建议
                buildString {
                    if (bestTimeSlot.isNotBlank()) append("${bestTimeSlot}执行")
                    if (estimatedTime.isNotBlank()) {
                        if (isNotBlank()) append("，")
                        append("约${estimatedTime}")
                    }
                }
            }
            
            // 行动指导JSON（新格式第12字段，旧格式第7字段）
            val actionGuidanceJson = if (isNewFormat) {
                parts.getOrNull(11)?.trim() ?: ""
            } else {
                parts.getOrNull(6)?.trim() ?: ""
            }
            
            // 完整描述（从行动指导中提取relatedContext，或生成默认描述）
            val fullDescription = try {
                val guidance = com.google.gson.Gson().fromJson(actionGuidanceJson, com.xiaoxiami.app.data.ActionGuidance::class.java)
                guidance?.relatedContext ?: "来自${if (sourceType == "visual") "视觉" else "听觉"}记忆的待办事项"
            } catch (e: Exception) {
                "来自${if (sourceType == "visual") "视觉" else "听觉"}记忆的待办事项"
            }
            
            Log.d(TAG, "解析待办事项2.0: content=$content, timeLabel=$timeLabel, isUrgent=$isUrgent, isImportant=$isImportant, ownershipStatus=$ownershipStatus")
            
            items.add(ActionItem(
                content = content,
                dueTime = dueTime,
                priority = priority,
                sourceMemoryId = memoryId,
                sourceType = sourceType,
                dateKey = today,
                estimatedTime = estimatedTime,
                bestTimeSlot = bestTimeSlot,
                actionGuidanceJson = actionGuidanceJson,
                // 🆕 待办指南2.0新字段
                timeLabel = timeLabel,
                isUrgent = isUrgent,
                isImportant = isImportant,
                ownershipStatus = ownershipStatus,
                briefTip = briefTip,
                fullDescription = fullDescription
            ))
        }
        
        return items
    }
    
    /**
     * 解析截止时间
     * @param dateGroup 日期组：今天/明天/后天/无期限
     * @param specificTime 具体时间：如15:00，可为null
     */
    private fun parseDueTime(dateGroup: String, specificTime: String?): Long? {
        if (dateGroup == "无期限" || dateGroup.isBlank()) return null
        
        val cal = Calendar.getInstance()
        
        // 解析日期部分
        when {
            dateGroup.contains("今天") -> { /* 默认就是今天 */ }
            dateGroup.contains("明天") -> cal.add(Calendar.DAY_OF_MONTH, 1)
            dateGroup.contains("后天") -> cal.add(Calendar.DAY_OF_MONTH, 2)
        }
        
        // 解析具体时间部分（如 15:00）
        if (specificTime != null) {
            val timePattern = Regex("(\\d{1,2})[:：](\\d{2})")
            timePattern.find(specificTime)?.let { match ->
                val hour = match.groupValues[1].toIntOrNull() ?: return@let
                val minute = match.groupValues[2].toIntOrNull() ?: return@let
                cal.set(Calendar.HOUR_OF_DAY, hour)
                cal.set(Calendar.MINUTE, minute)
                cal.set(Calendar.SECOND, 0)
            }
        } else {
            // 无具体时间时设置为23:59
            cal.set(Calendar.HOUR_OF_DAY, 23)
            cal.set(Calendar.MINUTE, 59)
            cal.set(Calendar.SECOND, 59)
        }
        
        return cal.timeInMillis
    }
    
    /**
     * 切换完成状态
     */
    suspend fun toggleCompletion(itemId: Long) {
        val item = actionItemDao.getById(itemId) ?: return
        val newCompleted = !item.isCompleted
        val completedAt = if (newCompleted) System.currentTimeMillis() else null
        actionItemDao.updateCompletion(itemId, newCompleted, completedAt)
        Log.d(TAG, "Toggled item $itemId completion to $newCompleted")
    }
    
    /**
     * 删除事项
     */
    suspend fun deleteItem(item: ActionItem) {
        actionItemDao.delete(item)
    }
    
    /**
     * 清空今日所有事项
     */
    suspend fun clearToday() {
        val today = dateFormat.format(Date())
        actionItemDao.deleteByDate(today)
        Log.d(TAG, "Cleared all items for $today")
    }
}
