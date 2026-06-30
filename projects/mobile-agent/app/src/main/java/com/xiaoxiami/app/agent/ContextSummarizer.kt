package com.xiaoxiami.app.agent

import com.xiaoxiami.app.repository.GeminiRepository

/**
 * 上下文压缩器。
 *
 * 当对话历史 + 观察记录的估算 token 超过阈值时，
 * 保留最近 [keepRecentMessages] 条消息和最近 [keepRecentObservations] 个观察，
 * 把更早的内容用 LLM 压缩成一段摘要。
 *
 * 借鉴 OpenClaw 的标识符保护策略，确保压缩不丢失关键信息。
 */
class ContextSummarizer(
    private val geminiRepository: GeminiRepository,
    private val maxTokenEstimate: Int = 28_000,
    private val thresholdRatio: Float = 0.80f,
    private val keepRecentMessages: Int = 6,
    private val keepRecentObservations: Int = 3
) {
    private var cachedSummary: String? = null
    private var lastSummarizedSize: Int = 0

    /**
     * 评估当前上下文是否需要压缩，如果需要则生成摘要。
     * @return 摘要字符串（null 表示不需要压缩）
     */
    suspend fun summarizeIfNeeded(
        conversationHistory: List<Pair<String, String>>,
        observations: List<ToolObservation>
    ): String? {
        val totalChars = conversationHistory.sumOf { it.first.length + it.second.length } +
            observations.sumOf { it.rawOutput.length + it.toolName.length }
        val estimatedTokens = totalChars / 4

        if (estimatedTokens < (maxTokenEstimate * thresholdRatio).toInt()) {
            return cachedSummary
        }

        val earlyMessages = if (conversationHistory.size > keepRecentMessages) {
            conversationHistory.dropLast(keepRecentMessages)
        } else {
            return cachedSummary
        }
        val earlyObservations = if (observations.size > keepRecentObservations) {
            observations.dropLast(keepRecentObservations)
        } else {
            emptyList()
        }

        val contentSize = earlyMessages.size + earlyObservations.size
        if (contentSize == lastSummarizedSize && cachedSummary != null) {
            return cachedSummary
        }

        val contentToSummarize = buildString {
            appendLine("=== 早期对话 ===")
            earlyMessages.forEach { (role, content) ->
                appendLine("[$role]: ${content.take(800)}")
            }
            if (earlyObservations.isNotEmpty()) {
                appendLine("\n=== 早期工具观察 ===")
                earlyObservations.forEach { obs ->
                    appendLine("[${obs.toolName}]: ${obs.rawOutput.take(500)}")
                }
            }
        }

        val prompt = buildString {
            appendLine("请将以下对话历史和工具观察压缩为一段简明摘要（200-400字）。")
            appendLine()
            appendLine("保护规则（必须严格遵守）：")
            appendLine("1. 原样保留所有标识符：UUID、文件名、URL、API路径、电话号码、联系人姓名")
            appendLine("2. 保留当前进行中任务的状态和进度（如\"已完成 3/5 步\"）")
            appendLine("3. 保留用户最后一个请求的完整意图")
            appendLine("4. 保留所有决策及其理由")
            appendLine("5. 保留待办事项、约束条件、承诺")
            appendLine("6. 优先保留近期上下文，可适当压缩早期背景")
            appendLine("7. 不要编造原文中没有的信息")
            appendLine()
            appendLine(contentToSummarize)
            appendLine()
            appendLine("请直接输出摘要，不要加前缀或标题。")
        }

        cachedSummary = try {
            geminiRepository.generateContent(
                prompt = prompt,
                modelName = "gemini-2.0-flash"
            )
        } catch (e: Exception) {
            null
        }
        lastSummarizedSize = contentSize
        return cachedSummary
    }

    fun reset() {
        cachedSummary = null
        lastSummarizedSize = 0
    }
}
