package com.xiaoxiami.app.viewmodel

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.xiaoxiami.app.data.MemoryDatabase
import com.xiaoxiami.app.data.memory.LongTermMemory
import com.xiaoxiami.app.data.memory.MemoryType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * 长期记忆管理 ViewModel
 * 仅保留主对话和侧边栏会使用到的长期记忆能力。
 */
class MemoryViewModel(application: Application) : AndroidViewModel(application) {

    companion object {
        private const val TAG = "MemoryViewModel"
    }

    private val database = MemoryDatabase.getDatabase(application)
    private val longTermMemoryDao = database.longTermMemoryDao()

    val longTermMemories: StateFlow<List<LongTermMemory>> = longTermMemoryDao.getAllMemories()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val longTermMemoriesByType: StateFlow<Map<MemoryType, List<LongTermMemory>>> = longTermMemories
        .map { memories -> memories.groupBy { it.type } }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyMap()
        )

    val longTermMemoriesByCategory: StateFlow<Map<String, List<LongTermMemory>>> = longTermMemories
        .map { memories -> memories.groupBy { it.category } }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyMap()
        )

    val userMarkedLongTermMemories: StateFlow<List<LongTermMemory>> =
        longTermMemoryDao.getUserMarkedMemories()
            .stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(5000),
                initialValue = emptyList()
            )

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    val searchedLongTermMemories: StateFlow<List<LongTermMemory>> = _searchQuery
        .debounce(300)
        .flatMapLatest { query ->
            if (query.isBlank()) {
                flowOf(emptyList())
            } else {
                longTermMemoryDao.searchMemories(query)
            }
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    data class MemoryStats(
        val totalLongTermMemories: Int,
        val factCount: Int,
        val preferenceCount: Int,
        val decisionCount: Int,
        val lessonCount: Int,
        val avgImportance: Double,
        val totalUsageCount: Int
    )

    private val _memoryStats = MutableStateFlow(
        MemoryStats(
            totalLongTermMemories = 0,
            factCount = 0,
            preferenceCount = 0,
            decisionCount = 0,
            lessonCount = 0,
            avgImportance = 0.0,
            totalUsageCount = 0
        )
    )
    val memoryStats: StateFlow<MemoryStats> = _memoryStats.asStateFlow()

    init {
        refreshStats()
    }

    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun clearSearch() {
        _searchQuery.value = ""
    }

    fun refreshStats() {
        viewModelScope.launch {
            try {
                val totalLongTerm = longTermMemoryDao.getMemoryCount()
                val factCount = longTermMemoryDao.getMemoryCountByType(MemoryType.FACT)
                val preferenceCount = longTermMemoryDao.getMemoryCountByType(MemoryType.PREFERENCE)
                val decisionCount = longTermMemoryDao.getMemoryCountByType(MemoryType.DECISION)
                val lessonCount = longTermMemoryDao.getMemoryCountByType(MemoryType.LESSON)
                val avgImportance = longTermMemoryDao.getAverageImportance()
                val totalUsage = longTermMemoryDao.getTotalUsageCount()

                _memoryStats.value = MemoryStats(
                    totalLongTermMemories = totalLongTerm,
                    factCount = factCount,
                    preferenceCount = preferenceCount,
                    decisionCount = decisionCount,
                    lessonCount = lessonCount,
                    avgImportance = avgImportance,
                    totalUsageCount = totalUsage
                )

                Log.d(TAG, "📊 长期记忆统计已刷新: $totalLongTerm")
            } catch (e: Exception) {
                Log.e(TAG, "❌ 统计数据刷新失败", e)
            }
        }
    }

    fun updateLongTermMemoryContent(id: String, newContent: String) {
        viewModelScope.launch {
            try {
                longTermMemoryDao.updateContent(id, newContent)
                Log.d(TAG, "✏️ 记忆已更新: $id")
            } catch (e: Exception) {
                Log.e(TAG, "❌ 记忆更新失败", e)
            }
        }
    }

    fun updateLongTermMemoryImportance(id: String, importance: Int) {
        viewModelScope.launch {
            try {
                longTermMemoryDao.updateImportance(id, importance)
                Log.d(TAG, "⭐ 重要性已更新: $id -> $importance")
            } catch (e: Exception) {
                Log.e(TAG, "❌ 重要性更新失败", e)
            }
        }
    }

    fun markLongTermMemory(id: String, marked: Boolean) {
        viewModelScope.launch {
            try {
                longTermMemoryDao.markAsUserMarked(id, marked)
                Log.d(TAG, "🏷️ 记忆标记状态已更新: $id -> $marked")
            } catch (e: Exception) {
                Log.e(TAG, "❌ 标记更新失败", e)
            }
        }
    }

    fun deleteLongTermMemory(id: String) {
        viewModelScope.launch {
            try {
                longTermMemoryDao.deleteMemoryById(id)
                refreshStats()
                Log.d(TAG, "🗑️ 记忆已删除: $id")
            } catch (e: Exception) {
                Log.e(TAG, "❌ 记忆删除失败", e)
            }
        }
    }
}
