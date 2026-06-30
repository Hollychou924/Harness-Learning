package com.xiaoxiami.app.agent.tools

import android.content.Context
import com.xiaoxiami.app.agent.AgentEvent
import com.xiaoxiami.app.agent.AgentRuntime
import com.xiaoxiami.app.agent.AndroidToolRegistry
import com.xiaoxiami.app.agent.GeminiLlmAdapter
import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolCallerIdentity
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolExecutionMode
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolPolicy
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolScope
import com.xiaoxiami.app.agent.ToolValueType
import com.xiaoxiami.app.agent.ToolExecutor
import com.xiaoxiami.app.data.MemoryDatabase
import com.xiaoxiami.app.data.trace.TraceManager
import com.xiaoxiami.app.repository.GeminiRepository
import com.xiaoxiami.app.repository.MemoryRepository
import kotlinx.coroutines.flow.collect

class DelegateTool(
    private val appContext: Context,
    private val geminiRepository: GeminiRepository,
    private val memoryRepository: MemoryRepository
) : Tool {
    override val schema = ToolSchema(
        name = "delegate",
        description = "Delegate a bounded subtask to a fresh sub-agent run and return its result.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        executionMode = ToolExecutionMode.DIRECT,
        capabilities = listOf("delegation", "sub_agent", "planning"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        scopes = listOf(ToolScope.DELEGATION),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        inputSchema = listOf(
            ToolParameterSchema("task", ToolValueType.STRING, "Self-contained subtask for the delegated agent.", required = true),
            ToolParameterSchema("notes", ToolValueType.STRING, "Optional constraints or context for the subtask.", required = false),
            ToolParameterSchema("modelId", ToolValueType.STRING, "Optional model for the sub-agent.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("finalAnswer", ToolValueType.STRING, "Delegated agent final answer."),
            ToolFieldSchema("traceId", ToolValueType.STRING, "Trace ID for the delegated run.", required = false)
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val task = arguments.stringArg("task")
        if (task.isBlank()) {
            return ToolResult(false, "", "task 不能为空")
        }

        val notes = arguments.stringArg("notes")
        val subGoal = buildString {
            append(task.trim())
            if (notes.isNotBlank()) {
                append("\n\n附加约束:\n")
                append(notes.trim())
            }
            append("\n\n要求:")
            append("\n1. 这是一个委派子任务，只完成这个子任务本身。")
            append("\n2. 不要再次使用 delegate，避免无限递归。")
            append("\n3. 如果信息不足，要明确指出不足。")
        }

        val traceManager = TraceManager(
            MemoryDatabase.getDatabase(appContext).traceDao()
        )
        val delegatedTools = AndroidToolRegistry.build(
            context = appContext,
            geminiRepository = geminiRepository,
            memoryRepository = memoryRepository
        ).filterNot { it.name == name }

        val runtime = AgentRuntime(
            llmAdapter = GeminiLlmAdapter(geminiRepository),
            toolExecutor = ToolExecutor(
                delegatedTools,
                androidContext = appContext,
                policy = ToolPolicy.delegated()
            ),
            traceManager = traceManager,
            approvalHandler = {
                com.xiaoxiami.app.agent.ToolApprovalDecision(
                    approved = false,
                    message = "委派子任务不允许自动执行需要审批的工具：${it.toolName}"
                )
            },
            skillRegistry = (appContext.applicationContext as com.xiaoxiami.app.MyApplication).skillRegistry,
            maxIterations = 3
        )

        var traceId = ""
        var finalAnswer = ""
        runtime.run(
            sessionId = "delegate_${context.sessionId}",
            userGoal = subGoal,
            conversationHistory = context.conversationHistory,
            modelId = arguments.stringArg("modelId", context.modelId)
        ).collect { event ->
            when (event) {
                is AgentEvent.RunStarted -> traceId = event.traceId
                is AgentEvent.Completed -> {
                    traceId = event.traceId
                    finalAnswer = event.finalAnswer
                }
                is AgentEvent.Error -> if (finalAnswer.isBlank()) finalAnswer = event.message
                else -> Unit
            }
        }

        return ToolResult(
            success = finalAnswer.isNotBlank(),
            output = jsonOutput(
                mapOf(
                    "finalAnswer" to finalAnswer,
                    "traceId" to traceId
                )
            ),
            error = if (finalAnswer.isBlank()) "delegate 未得到有效结果" else null
        )
    }
}
