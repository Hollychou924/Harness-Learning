package com.xiaoxiami.app.agent.tools

import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolContentRisk
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolScope
import com.xiaoxiami.app.agent.ToolValueType
import com.xiaoxiami.app.data.memory.MemoryType
import com.xiaoxiami.app.repository.MemoryRepository

class MemoryStoreTool(
    private val memoryRepository: MemoryRepository
) : Tool {
    override val schema = ToolSchema(
        name = "memory_store",
        description = "Store a durable long-term memory such as a fact, preference, decision, or lesson for future retrieval.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("memory", "memory_write", "user_context"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        scopes = listOf(ToolScope.MEMORY),
        contentRisks = listOf(ToolContentRisk.SENSITIVE_PERSONAL_DATA),
        inputSchema = listOf(
            ToolParameterSchema("content", ToolValueType.STRING, "The memory content to persist.", required = true),
            ToolParameterSchema("type", ToolValueType.STRING, "Optional memory type.", required = false, enumValues = MemoryType.entries.map { it.name.lowercase() }),
            ToolParameterSchema("category", ToolValueType.STRING, "Optional category override such as 工作、技术、生活。", required = false),
            ToolParameterSchema("importance", ToolValueType.INTEGER, "Optional importance from 0 to 10.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("action", ToolValueType.STRING, "created when a new memory is stored, existing when a duplicate already exists."),
            ToolFieldSchema("memoryId", ToolValueType.STRING, "Stored or matched memory ID."),
            ToolFieldSchema("type", ToolValueType.STRING, "Resolved memory type."),
            ToolFieldSchema("category", ToolValueType.STRING, "Resolved memory category.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val content = arguments.stringArg("content")
        if (content.isBlank()) {
            return ToolResult(false, "", "content 不能为空")
        }

        val requestedType = parseMemoryType(arguments.stringArg("type"))
        val outcome = memoryRepository.storeMemoryFromAgent(
            content = content,
            sessionId = context.sessionId,
            requestedType = requestedType,
            requestedCategory = arguments.stringArg("category"),
            importance = arguments.intArg("importance", 7)
        )
        val memory = outcome.memory
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "action" to outcome.action,
                    "memoryId" to memory.id,
                    "type" to memory.type.name.lowercase(),
                    "category" to memory.category,
                    "importance" to memory.importance,
                    "content" to memory.content
                )
            )
        )
    }
}

class MemoryForgetTool(
    private val memoryRepository: MemoryRepository
) : Tool {
    override val schema = ToolSchema(
        name = "memory_forget",
        description = "Delete one or more long-term memories by ID or semantic query.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("memory", "memory_delete", "user_context"),
        riskLevel = ToolRiskLevel.HIGH,
        scopes = listOf(ToolScope.MEMORY),
        contentRisks = listOf(ToolContentRisk.SENSITIVE_PERSONAL_DATA),
        approvalRequired = true,
        approvalReason = "删除长期记忆会永久改变用户记忆库。",
        approvalSummary = "Agent 请求删除长期记忆",
        inputSchema = listOf(
            ToolParameterSchema("memoryId", ToolValueType.STRING, "Exact memory ID to delete.", required = false),
            ToolParameterSchema("query", ToolValueType.STRING, "Semantic or lexical query for the memory to forget.", required = false),
            ToolParameterSchema("allMatches", ToolValueType.BOOLEAN, "Delete all matched memories instead of just the best match.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("deleted", ToolValueType.BOOLEAN, "Whether any memory was deleted."),
            ToolFieldSchema("deletedIds", ToolValueType.ARRAY, "Deleted memory IDs.", required = false),
            ToolFieldSchema("needsClarification", ToolValueType.BOOLEAN, "Whether multiple matches require disambiguation.", required = false)
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val memoryId = arguments.stringArg("memoryId")
        val query = arguments.stringArg("query")
        if (memoryId.isBlank() && query.isBlank()) {
            return ToolResult(false, "", "memoryId 或 query 至少提供一个")
        }

        val outcome = memoryRepository.forgetMemoryFromAgent(
            memoryId = memoryId.ifBlank { null },
            query = query.ifBlank { null },
            deleteAllMatches = arguments.booleanArg("allMatches", false)
        )

        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "deleted" to outcome.deletedIds.isNotEmpty(),
                    "deletedIds" to outcome.deletedIds,
                    "needsClarification" to outcome.needsClarification,
                    "candidates" to outcome.candidates.map { memory ->
                        mapOf(
                            "id" to memory.id,
                            "type" to memory.type.name.lowercase(),
                            "category" to memory.category,
                            "content" to memory.content
                        )
                    }
                )
            )
        )
    }
}

private fun parseMemoryType(value: String): MemoryType? {
    return when (value.trim().uppercase()) {
        "FACT" -> MemoryType.FACT
        "PREFERENCE" -> MemoryType.PREFERENCE
        "DECISION" -> MemoryType.DECISION
        "LESSON" -> MemoryType.LESSON
        else -> null
    }
}
