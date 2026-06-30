package com.xiaoxiami.app.repository

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.xiaoxiami.app.config.AIConfig
import com.xiaoxiami.app.data.ChatMessage
import com.xiaoxiami.app.data.MemoryDatabase
import com.xiaoxiami.app.data.memory.LongTermMemory
import com.xiaoxiami.app.data.memory.MemoryType
import com.xiaoxiami.app.service.EmbeddingService
import com.xiaoxiami.app.service.FaissVectorStoreService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID

/**
 * 长期记忆核心仓库。
 * 已移除历史摘要派生链路，只保留主对话和 Agent runtime 所需能力。
 */
class MemoryRepository(
    private val context: Context,
    private val embeddingService: EmbeddingService? = null,
    private val vectorStore: FaissVectorStoreService? = null
) {

    data class MemoryRetrievalInfo(
        val keywords: List<String> = emptyList(),
        val vectorSuccess: Boolean = false,
        val vectorResults: List<String> = emptyList(),
        val vectorError: String = "",
        val isFullInjection: Boolean = false,
        val matchedCount: Int = 0
    )

    data class MemoryStoreOutcome(
        val action: String,
        val memory: LongTermMemory
    )

    data class MemoryForgetOutcome(
        val deletedIds: List<String> = emptyList(),
        val candidates: List<LongTermMemory> = emptyList(),
        val needsClarification: Boolean = false
    )

    companion object {
        private const val TAG = "MemoryRepository"

        private val MEMORY_TRIGGER_KEYWORDS = listOf(
            "记一下", "记下来", "记住", "给我记", "帮我记", "记下", "记着",
            "别忘了", "不要忘", "别忘", "千万别忘", "可别忘",
            "记录", "记录一下", "记录下来",
            "备忘", "备注一下", "备注",
            "存一下", "存起来", "保存一下", "存下来",
            "牢记", "务必记住", "一定记住",
            "写下来", "写下",
            "提醒我", "到时候提醒", "记得提醒",
            "不能忘", "不可以忘",
            "就这样定", "就这么定", "就这么定了", "这样定了",
            "决定了", "确定了", "定了", "敲定",
            "就这么办", "就这样办", "就这样吧", "就这样",
            "最终方案", "最后决定",
            "我决定", "我选择", "我选",
            "很重要", "非常重要", "这个重要", "特别重要", "超级重要",
            "一定要记得", "务必", "切记", "千万记得",
            "这是关键", "关键是", "重点是",
            "绝对不能忘",
            "我喜欢", "我讨厌", "我不喜欢", "我特别喜欢", "我最喜欢",
            "我想要", "我需要", "我希望",
            "我认为", "我觉得", "我感觉",
            "我是", "我在", "我的",
            "我叫", "我名字叫", "我名字是", "我全名",
            "我住在", "我家在", "我住", "我家住",
            "我工作在", "我在工作", "我公司", "我的公司",
            "我出生", "我生日是", "我生日", "我的生日",
            "我今年", "我岁数", "我年龄",
            "我老婆", "我老公", "我爱人", "我对象", "我女朋友", "我男朋友",
            "我孩子", "我儿子", "我女儿", "我宝宝", "我闺女",
            "我爸", "我妈", "我父母", "我爷爷", "我奶奶", "我外公", "我外婆",
            "我哥", "我弟", "我姐", "我妹",
            "我爱吃", "我爱喝", "我爱", "我最爱",
            "我习惯", "我总是", "我经常", "我一般",
            "我从不", "我从来不", "我永远不", "我绝不",
            "我的口味", "我的爱好", "我的兴趣",
            "我的手机", "我手机号", "我电话",
            "我的邮箱", "我邮箱", "我的email",
            "我的账号", "我账号", "我的微信", "我微信号",
            "以后", "下次", "下回", "下一次",
            "之后", "过会", "过会儿", "待会", "待会儿",
            "改天", "明天", "后天", "下周", "下个月",
            "到时候", "那时候",
            "你记一下", "你记住", "你帮我记", "你给我记",
            "你存一下", "你保存", "你记下来",
            "麻烦记一下", "劳驾记一下",
            "请记住", "请记下",
            "记得啊", "记好了", "记牢", "记清楚",
            "别给忘了", "可不能忘", "忘不了",
            "这个得记", "得记住"
        )
    }

    private val database = MemoryDatabase.getDatabase(context)
    private val longTermMemoryDao = database.longTermMemoryDao()
    private val geminiRepository = GeminiRepository(context)
    private val gson = Gson()

    fun shouldTriggerMemory(message: String): Boolean {
        val memoryQueryPatterns = listOf(
            "你记住了", "你都记住", "记住了什么", "记住了哪些", "记住我什么", "记住我哪些",
            "你记得", "还记得", "记得什么", "记得哪些", "记得我什么", "记得我哪些",
            "你记录了", "记录了什么", "记录了哪些", "存了什么", "存了哪些", "保存了什么",
            "你知道我", "你了解我", "知道我什么", "了解我什么", "关于我的",
            "告诉我", "帮我查", "查一下", "搜索", "什么", "哪里", "怎么", "为什么", "哪些"
        )
        if (memoryQueryPatterns.any { message.contains(it) }) {
            Log.d(TAG, "🔍 检测到记忆查询（不触发记忆）: $message")
            return false
        }

        val explicitMemoryRequestKeywords = listOf(
            "记一下", "记下来", "给我记", "帮我记", "记下", "记着",
            "记住这个", "你记一下", "你帮我记", "你给我记",
            "请记住", "请记下", "麻烦记一下", "劳驾记一下",
            "别忘了", "不要忘", "别忘", "千万别忘", "可别忘", "别给忘了",
            "不能忘", "不可以忘", "绝对不能忘", "可不能忘",
            "记录一下", "记录下来", "备忘", "备注一下",
            "存一下", "存起来", "保存一下", "存下来", "你存一下", "你保存",
            "务必记住", "一定记住", "一定要记得", "务必", "切记", "千万记得",
            "牢记", "记好了", "记牢", "记清楚", "这个得记", "得记住",
            "提醒我", "到时候提醒", "记得提醒"
        )
        if (explicitMemoryRequestKeywords.any { message.contains(it) }) {
            Log.d(TAG, "🧠 检测到明确记忆请求: $message")
            return true
        }

        val questionMarkers = listOf("吗", "呢", "？", "?", "是否", "有没有", "能不能", "会不会")
        if (questionMarkers.any { message.contains(it) }) {
            return false
        }

        return MEMORY_TRIGGER_KEYWORDS.any { message.contains(it) }
    }

    suspend fun extractImportantMemory(
        message: ChatMessage,
        sessionId: String
    ): LongTermMemory? = withContext(Dispatchers.IO) {
        try {
            val content = message.content.trim()
            if (content.isBlank()) {
                return@withContext null
            }

            val memoryType = detectMemoryType(content)
            val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
            val longTermMemory = LongTermMemory(
                id = UUID.randomUUID().toString(),
                type = memoryType,
                content = content,
                category = inferCategory(content),
                sourceDate = today,
                sourceSessionIds = sessionId,
                sourceDailyLogIds = "",
                createdAt = System.currentTimeMillis(),
                updatedAt = System.currentTimeMillis(),
                importance = 8,
                isUserMarked = true
            )

            val handled = handleMemoryConflict(longTermMemory)
            if (!handled) {
                saveLongTermMemory(longTermMemory)
            }

            Log.d(TAG, "✅ 即时长期记忆提取成功: ${content.take(40)}")
            return@withContext longTermMemory
        } catch (e: Exception) {
            Log.e(TAG, "❌ 即时记忆提取失败", e)
            return@withContext null
        }
    }

    suspend fun saveLongTermMemory(memory: LongTermMemory) = withContext(Dispatchers.IO) {
        try {
            longTermMemoryDao.insertMemory(memory)
            Log.d(TAG, "✅ 长期记忆已保存到 Room: ${memory.type} - ${memory.content.take(50)}")

            if (embeddingService != null && vectorStore != null) {
                try {
                    val embedding = embeddingService.generateEmbedding(
                        text = memory.content,
                        taskType = "RETRIEVAL_DOCUMENT"
                    )

                    vectorStore.saveMemoryVector(
                        memoryId = memory.id,
                        memoryType = memory.type.name,
                        content = memory.content,
                        embedding = embedding
                    )

                    Log.d(TAG, "✅ 向量已生成并保存: ${memory.content.take(30)}...")
                } catch (e: Exception) {
                    Log.e(TAG, "⚠️ 向量生成失败（不影响记忆保存）", e)
                }
            } else {
                Log.d(TAG, "⚠️ 向量服务未初始化，跳过 embedding 生成")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ 保存长期记忆失败", e)
        }
    }

    suspend fun storeMemoryFromAgent(
        content: String,
        sessionId: String,
        requestedType: MemoryType? = null,
        requestedCategory: String? = null,
        importance: Int = 7
    ): MemoryStoreOutcome = withContext(Dispatchers.IO) {
        val normalizedContent = content.trim()
        require(normalizedContent.isNotBlank()) { "记忆内容不能为空" }

        val resolvedType = requestedType ?: detectMemoryType(normalizedContent)
        val duplicate = longTermMemoryDao.findSimilarMemories(
            contentSnippet = normalizedContent.take(30),
            type = resolvedType
        ).firstOrNull { it.content.trim() == normalizedContent }

        if (duplicate != null) {
            return@withContext MemoryStoreOutcome(
                action = "existing",
                memory = duplicate
            )
        }

        val now = System.currentTimeMillis()
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        val memory = LongTermMemory(
            id = UUID.randomUUID().toString(),
            type = resolvedType,
            content = normalizedContent,
            category = requestedCategory?.trim().orEmpty().ifBlank { inferCategory(normalizedContent) },
            sourceDate = today,
            sourceSessionIds = sessionId.ifBlank { "agent_tool" },
            sourceDailyLogIds = "",
            createdAt = now,
            updatedAt = now,
            importance = importance.coerceIn(0, 10),
            isUserMarked = false
        )

        saveLongTermMemory(memory)
        return@withContext MemoryStoreOutcome(
            action = "created",
            memory = memory
        )
    }

    suspend fun forgetMemoryFromAgent(
        memoryId: String? = null,
        query: String? = null,
        deleteAllMatches: Boolean = false
    ): MemoryForgetOutcome = withContext(Dispatchers.IO) {
        val normalizedId = memoryId?.trim().orEmpty()
        val normalizedQuery = query?.trim().orEmpty()

        if (normalizedId.isBlank() && normalizedQuery.isBlank()) {
            return@withContext MemoryForgetOutcome()
        }

        if (normalizedId.isNotBlank()) {
            val memory = longTermMemoryDao.getMemoryById(normalizedId)
                ?: return@withContext MemoryForgetOutcome()
            longTermMemoryDao.deleteMemoryById(memory.id)
            vectorStore?.deleteByMemoryId(memory.id)
            return@withContext MemoryForgetOutcome(
                deletedIds = listOf(memory.id),
                candidates = listOf(memory)
            )
        }

        val lexicalMatches = longTermMemoryDao.searchMemories(normalizedQuery).first().take(5)
        val matches = if (lexicalMatches.isNotEmpty()) {
            lexicalMatches
        } else {
            searchRelevantMemories(normalizedQuery, limit = 5)
        }

        if (matches.isEmpty()) {
            return@withContext MemoryForgetOutcome()
        }

        if (matches.size > 1 && !deleteAllMatches) {
            return@withContext MemoryForgetOutcome(
                candidates = matches,
                needsClarification = true
            )
        }

        val targets = if (deleteAllMatches) matches else listOf(matches.first())
        targets.forEach { memory ->
            longTermMemoryDao.deleteMemoryById(memory.id)
            vectorStore?.deleteByMemoryId(memory.id)
        }

        return@withContext MemoryForgetOutcome(
            deletedIds = targets.map { it.id },
            candidates = targets
        )
    }

    suspend fun reindexMemoriesIfNeeded() = withContext(Dispatchers.IO) {
        if (embeddingService == null || vectorStore == null) {
            return@withContext
        }

        try {
            Log.d(TAG, "🔍 开始检查索引完整性...")
            val allMemories = longTermMemoryDao.getAllMemories().first()
            if (allMemories.isEmpty()) {
                Log.d(TAG, "⏹️ 无长期记忆，无需重构索引")
                return@withContext
            }

            var updateCount = 0
            allMemories.forEach { memory ->
                val existingVector = vectorStore.getVectorByMemoryId(memory.id)
                val needsReindex = existingVector == null || existingVector.embeddingVector.size != 2048

                if (needsReindex) {
                    try {
                        Log.d(TAG, "🔄 正在为记忆重构索引 [${memory.id}]: ${memory.content.take(20)}...")
                        val embedding = embeddingService.generateEmbedding(
                            text = memory.content,
                            taskType = "RETRIEVAL_DOCUMENT"
                        )

                        vectorStore.saveMemoryVector(
                            memoryId = memory.id,
                            memoryType = memory.type.name,
                            content = memory.content,
                            embedding = embedding
                        )
                        updateCount++
                        delay(100)
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ 重构单条记忆索引失败: ${memory.id}", e)
                    }
                }
            }

            if (updateCount > 0) {
                Log.d(TAG, "✅ 索引重构完成，更新了 $updateCount 条记忆")
            } else {
                Log.d(TAG, "✅ 所有记忆索引均已就绪")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ 索引重构过程出错", e)
        }
    }

    suspend fun detectMemoryType(content: String): MemoryType = withContext(Dispatchers.IO) {
        try {
            val prompt = AIConfig.PROMPT_MEMORY_TYPE_DETECTION.replace("{content}", content)
            val response = geminiRepository.generateContent(prompt = prompt, modelName = "gemini-3-flash")
            val typeStr = response.trim().uppercase()
            return@withContext when {
                typeStr.contains("FACT") -> MemoryType.FACT
                typeStr.contains("PREFERENCE") -> MemoryType.PREFERENCE
                typeStr.contains("DECISION") -> MemoryType.DECISION
                typeStr.contains("LESSON") -> MemoryType.LESSON
                else -> MemoryType.FACT
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ 记忆类型判断失败，使用默认类型 FACT", e)
            return@withContext MemoryType.FACT
        }
    }

    private suspend fun handleMemoryConflict(newMemory: LongTermMemory): Boolean = withContext(Dispatchers.IO) {
        try {
            val contentSnippet = newMemory.content.take(30)
            val initialCandidates =
                longTermMemoryDao.findSimilarMemories(contentSnippet, newMemory.type).toMutableList()

            if (embeddingService != null && vectorStore != null) {
                try {
                    val embedding = embeddingService.generateEmbedding(
                        text = newMemory.content,
                        taskType = "RETRIEVAL_QUERY"
                    )
                    val vectorCandidates = vectorStore.searchSimilar(
                        queryEmbedding = embedding,
                        topK = 5,
                        minScore = 0.5f
                    )

                    if (vectorCandidates.isNotEmpty()) {
                        val vectorMemories = longTermMemoryDao.getMemoriesByIds(
                            vectorCandidates.map { it.first.memoryId }
                        )
                        initialCandidates.addAll(vectorMemories)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "⚠️ 冲突检测中的向量搜索失败", e)
                }
            }

            val similarMemories = initialCandidates.distinctBy { it.id }
            if (similarMemories.isEmpty()) {
                return@withContext false
            }

            val existingMemoriesJson = similarMemories.mapIndexed { index, memory ->
                mapOf(
                    "id" to memory.id,
                    "index" to index,
                    "content" to memory.content,
                    "type" to memory.type.name,
                    "importance" to memory.importance
                )
            }

            val prompt = AIConfig.PROMPT_MEMORY_SIMILARITY_CHECK
                .replace("{new_memory}", newMemory.content)
                .replace("{existing_memories}", gson.toJson(existingMemoriesJson))

            val response = geminiRepository.generateContent(prompt = prompt, modelName = "gemini-3-flash")
            val resultJson = parseJsonResponse(response)
            val mostSimilarId = resultJson.get("most_similar_id")?.asString
            val suggestedAction = resultJson.get("suggested_action")?.asString ?: "save_new"
            val mergedContent = resultJson.get("merged_content")?.asString

            when (suggestedAction) {
                "merge" -> {
                    if (mostSimilarId != null && !mergedContent.isNullOrBlank()) {
                        longTermMemoryDao.updateContent(mostSimilarId, mergedContent)
                        Log.d(TAG, "🔀 记忆已合并: $mostSimilarId")
                        return@withContext true
                    }
                }

                "replace" -> {
                    if (mostSimilarId != null) {
                        longTermMemoryDao.deleteMemoryById(mostSimilarId)
                        vectorStore?.deleteByMemoryId(mostSimilarId)
                        Log.d(TAG, "♻️ 记忆已替换: $mostSimilarId")
                        return@withContext false
                    }
                }

                "link" -> {
                    if (mostSimilarId != null) {
                        longTermMemoryDao.addRelatedMemoryId(mostSimilarId, newMemory.id)
                        Log.d(TAG, "🔗 记忆已关联: $mostSimilarId")
                        return@withContext false
                    }
                }
            }

            return@withContext false
        } catch (e: Exception) {
            Log.e(TAG, "❌ 记忆冲突处理失败", e)
            return@withContext false
        }
    }

    suspend fun searchRelevantMemories(
        query: String,
        limit: Int = 10,
        onInfo: ((MemoryRetrievalInfo) -> Unit)? = null
    ): List<LongTermMemory> = withContext(Dispatchers.IO) {
        val info = MemoryRetrievalInfo()
        try {
            val totalMemories = longTermMemoryDao.getMemoryCount()
            Log.d(TAG, "📊 数据库中共有 $totalMemories 条长期记忆")
            if (totalMemories == 0) {
                onInfo?.invoke(info)
                return@withContext emptyList()
            }

            if (embeddingService != null && vectorStore != null) {
                return@withContext searchByVectorSimilarity(query, limit, onInfo)
            }

            return@withContext searchByKeywords(query, limit, onInfo)
        } catch (e: Exception) {
            Log.e(TAG, "❌ 记忆检索失败: ${e.message}", e)
            onInfo?.invoke(info.copy(vectorError = e.message ?: "未知错误"))
            return@withContext emptyList()
        }
    }

    private suspend fun searchByVectorSimilarity(
        query: String,
        limit: Int,
        onInfo: ((MemoryRetrievalInfo) -> Unit)? = null
    ): List<LongTermMemory> = withContext(Dispatchers.IO) {
        var info = MemoryRetrievalInfo(keywords = extractKeywords(query))
        try {
            val queryEmbedding = embeddingService!!.generateEmbedding(
                text = query,
                taskType = "RETRIEVAL_QUERY"
            )

            val results = vectorStore!!.searchSimilar(
                queryEmbedding = queryEmbedding,
                topK = limit,
                minScore = 0.3f
            )

            if (results.isEmpty()) {
                return@withContext searchByKeywords(query, limit, onInfo)
            }

            val memoryIds = results.map { it.first.memoryId }
            val memories = longTermMemoryDao.getMemoriesByIds(memoryIds)
            memories.forEach { memory ->
                longTermMemoryDao.incrementUsageCount(memory.id, System.currentTimeMillis())
            }

            val sortedMemories = results.mapNotNull { (vector, _) ->
                memories.find { it.id == vector.memoryId }
            }

            info = info.copy(
                vectorSuccess = true,
                vectorResults = sortedMemories.map { it.content },
                matchedCount = sortedMemories.size
            )
            onInfo?.invoke(info)
            return@withContext sortedMemories
        } catch (e: Exception) {
            Log.e(TAG, "❌ 向量检索失败", e)
            onInfo?.invoke(info.copy(vectorError = e.message ?: "未知错误"))
            return@withContext emptyList()
        }
    }

    private suspend fun searchByKeywords(
        query: String,
        limit: Int,
        onInfo: ((MemoryRetrievalInfo) -> Unit)? = null
    ): List<LongTermMemory> = withContext(Dispatchers.IO) {
        val keywords = extractKeywords(query)
        var info = MemoryRetrievalInfo(keywords = keywords)
        try {
            if (keywords.isEmpty()) {
                onInfo?.invoke(info)
                return@withContext emptyList()
            }

            val recentThreshold = System.currentTimeMillis() - (365L * 24 * 60 * 60 * 1000)
            val candidates = longTermMemoryDao.searchByKeywords(
                keyword1 = keywords.getOrElse(0) { "" },
                keyword2 = keywords.getOrElse(1) { "" },
                keyword3 = keywords.getOrElse(2) { "" },
                recentThreshold = recentThreshold,
                limit = 10
            )

            if (candidates.isEmpty()) {
                onInfo?.invoke(info)
                return@withContext emptyList()
            }

            val candidatesJson = candidates.mapIndexed { index, memory ->
                mapOf(
                    "memory_id" to memory.id,
                    "index" to index,
                    "type" to memory.type.name,
                    "content" to memory.content,
                    "category" to memory.category
                )
            }

            val prompt = AIConfig.PROMPT_MEMORY_SEMANTIC_SCORING
                .replace("{query}", query)
                .replace("{candidate_memories}", gson.toJson(candidatesJson))

            val response = geminiRepository.generateContent(prompt = prompt, modelName = "gemini-3-flash")
            val scoresArray = parseJsonArrayResponse(response)
            val scoredMemories = mutableMapOf<String, Int>()
            for (element in scoresArray) {
                val obj = element.asJsonObject
                val memoryId = obj.get("memory_id")?.asString ?: continue
                val score = obj.get("score")?.asInt ?: 0
                scoredMemories[memoryId] = score
            }

            val relevantMemories = candidates
                .filter { (scoredMemories[it.id] ?: 0) >= 5 }
                .sortedByDescending { scoredMemories[it.id] ?: 0 }
                .take(limit)

            val memoryIds = relevantMemories.map { it.id }
            if (memoryIds.isNotEmpty()) {
                longTermMemoryDao.incrementUsageCountBatch(memoryIds)
            }

            info = info.copy(
                vectorResults = relevantMemories.map { it.content },
                matchedCount = relevantMemories.size
            )
            onInfo?.invoke(info)
            return@withContext relevantMemories
        } catch (e: Exception) {
            Log.e(TAG, "❌ 关键词检索失败", e)
            onInfo?.invoke(info.copy(vectorError = e.message ?: "未知错误"))
            return@withContext emptyList()
        }
    }

    suspend fun buildMemoryContext(
        query: String,
        onInfo: ((MemoryRetrievalInfo) -> Unit)? = null
    ): String = withContext(Dispatchers.IO) {
        var currentInfo = MemoryRetrievalInfo()
        var memories = searchRelevantMemories(query, limit = 10) {
            currentInfo = it
        }

        if (memories.isEmpty()) {
            val allMemories = longTermMemoryDao.getAllMemories().first().take(20)
            if (allMemories.isEmpty()) {
                onInfo?.invoke(currentInfo)
                return@withContext ""
            }

            memories = allMemories
            currentInfo = currentInfo.copy(
                isFullInjection = true,
                matchedCount = allMemories.size,
                vectorResults = allMemories.map { it.content }
            )
        }

        onInfo?.invoke(currentInfo)

        val contextBuilder = StringBuilder("\n\n【背景记忆】\n")
        for (memory in memories) {
            val typeLabel = when (memory.type) {
                MemoryType.FACT -> "事实"
                MemoryType.PREFERENCE -> "偏好"
                MemoryType.DECISION -> "决策"
                MemoryType.LESSON -> "教训"
            }
            contextBuilder.append("- [$typeLabel] ${memory.content}\n")
        }

        return@withContext contextBuilder.toString()
    }

    private fun inferCategory(content: String): String {
        return when {
            content.contains(Regex("工作|项目|任务|会议|业务")) -> "工作"
            content.contains(Regex("技术|代码|编程|开发|API")) -> "技术"
            content.contains(Regex("健康|睡眠|运动|饮食")) -> "健康"
            content.contains(Regex("学习|课程|书籍|知识")) -> "学习"
            content.contains(Regex("兴趣|爱好|娱乐|游戏")) -> "兴趣"
            else -> "生活"
        }
    }

    private fun extractKeywords(query: String): List<String> {
        val cleanQuery = query.replace(Regex("[，。！？、；：\"'（）《》【】\\s]+"), " ")
        return cleanQuery.split(" ")
            .filter { it.length >= 2 }
            .take(3)
    }

    private fun parseJsonResponse(response: String): JsonObject {
        return try {
            val jsonStr = response
                .replace("```json", "")
                .replace("```", "")
                .trim()
            JsonParser.parseString(jsonStr).asJsonObject
        } catch (e: Exception) {
            Log.e(TAG, "❌ JSON 解析失败: $response", e)
            JsonParser.parseString("{}").asJsonObject
        }
    }

    private fun parseJsonArrayResponse(response: String): JsonArray {
        var jsonStr = response
            .replace("```json", "")
            .replace("```", "")
            .trim()

        try {
            return JsonParser.parseString(jsonStr).asJsonArray
        } catch (_: Exception) {
            Log.w(TAG, "⚠️ JSON 解析失败，尝试修复截断的 JSON...")
        }

        try {
            val lastCompleteObjectEnd = jsonStr.lastIndexOf("}")
            if (lastCompleteObjectEnd > 0) {
                var fixedJson = jsonStr.substring(0, lastCompleteObjectEnd + 1)
                fixedJson = fixedJson.trimEnd().trimEnd(',').trimEnd()
                if (!fixedJson.endsWith("]")) {
                    fixedJson = "$fixedJson]"
                }
                if (!fixedJson.startsWith("[")) {
                    fixedJson = "[$fixedJson"
                }
                return JsonParser.parseString(fixedJson).asJsonArray
            }
        } catch (_: Exception) {
            Log.w(TAG, "⚠️ JSON 修复失败，尝试提取单个对象...")
        }

        try {
            val firstObjectStart = jsonStr.indexOf("{")
            val firstObjectEnd = findMatchingBrace(jsonStr, firstObjectStart)
            if (firstObjectStart >= 0 && firstObjectEnd > firstObjectStart) {
                val singleObject = jsonStr.substring(firstObjectStart, firstObjectEnd + 1)
                val array = JsonArray()
                array.add(JsonParser.parseString(singleObject).asJsonObject)
                return array
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ JSON 数组解析完全失败: $response", e)
        }

        return JsonParser.parseString("[]").asJsonArray
    }

    private fun findMatchingBrace(str: String, startIndex: Int): Int {
        if (startIndex < 0 || startIndex >= str.length || str[startIndex] != '{') {
            return -1
        }

        var depth = 0
        var inString = false
        var escape = false

        for (i in startIndex until str.length) {
            val char = str[i]
            if (escape) {
                escape = false
                continue
            }

            when {
                char == '\\' && inString -> escape = true
                char == '"' -> inString = !inString
                !inString && char == '{' -> depth++
                !inString && char == '}' -> {
                    depth--
                    if (depth == 0) {
                        return i
                    }
                }
            }
        }

        return -1
    }

    suspend fun incrementUsageCount(id: String) = withContext(Dispatchers.IO) {
        longTermMemoryDao.incrementUsageCount(id)
    }
}
