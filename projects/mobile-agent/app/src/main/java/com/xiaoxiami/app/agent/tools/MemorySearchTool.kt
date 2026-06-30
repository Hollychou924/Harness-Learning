package com.xiaoxiami.app.agent.tools

import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolValueType
import com.xiaoxiami.app.repository.MemoryRepository

class MemorySearchTool(
    private val memoryRepository: MemoryRepository
) : Tool {

    override val schema: ToolSchema = ToolSchema(
        name = "memory_search",
        description = "Search the user's long-term memory and return relevant past facts, preferences, and decisions.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("memory", "rag", "user_context"),
        inputSchema = listOf(
            ToolParameterSchema(
                name = "query",
                type = ToolValueType.STRING,
                description = "Semantic query used to retrieve relevant memory. Defaults to the current user goal.",
                required = false
            )
        ),
        outputSchema = listOf(
            ToolFieldSchema(
                name = "memory_context",
                type = ToolValueType.STRING,
                description = "Relevant memory facts, preferences, and past decisions."
            )
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val query = arguments["query"]?.toString()?.trim().orEmpty().ifBlank { context.userGoal }
        val memoryContext = memoryRepository.buildMemoryContext(query)
        return if (memoryContext.isBlank()) {
            ToolResult(
                success = true,
                output = "没有找到相关长期记忆。"
            )
        } else {
            ToolResult(
                success = true,
                output = memoryContext.trim()
            )
        }
    }
}
