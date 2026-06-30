package com.xiaoxiami.app.agent.tools

import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolValueType
import com.xiaoxiami.app.repository.GeminiRepository

class WebSearchTool(
    private val geminiRepository: GeminiRepository
) : Tool {

    override val schema: ToolSchema = ToolSchema(
        name = "web_search",
        description = "Search the web for the latest information and return a concise fact-based summary.",
        hostKind = ToolHostKind.CLOUD_SERVICE,
        capabilities = listOf("web", "search", "fresh_information"),
        inputSchema = listOf(
            ToolParameterSchema(
                name = "query",
                type = ToolValueType.STRING,
                description = "Search query for retrieving up-to-date public information.",
                required = false
            )
        ),
        outputSchema = listOf(
            ToolFieldSchema(
                name = "summary",
                type = ToolValueType.STRING,
                description = "Fact-based summary synthesized from web search results."
            )
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val query = arguments["query"]?.toString()?.trim().orEmpty().ifBlank { context.userGoal }
        val prompt = """
            请联网搜索并回答下面的问题。
            要求：
            1. 只输出与问题直接相关的关键信息。
            2. 如果信息不确定，明确说明。
            3. 不要编造来源，不要输出多余寒暄。

            问题：$query
        """.trimIndent()

        val buffer = StringBuilder()
        return try {
            val answer = geminiRepository.generateContentStream(
                prompt = prompt,
                conversationHistory = emptyList(),
                modelName = context.modelId,
                enableSearch = true,
                enableThinking = false,
                isConversation = false,
                onChunk = { chunk -> buffer.append(chunk) }
            )
            ToolResult(
                success = true,
                output = answer.ifBlank { buffer.toString() }.trim()
            )
        } catch (e: Exception) {
            ToolResult(
                success = false,
                output = "",
                error = e.message ?: "web_search failed"
            )
        }
    }
}
