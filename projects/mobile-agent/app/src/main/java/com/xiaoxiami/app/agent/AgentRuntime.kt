package com.xiaoxiami.app.agent

import android.net.Uri
import com.xiaoxiami.app.agent.middleware.MiddlewareChain
import com.xiaoxiami.app.agent.middleware.MiddlewareContext
import com.xiaoxiami.app.agent.skills.SkillRegistry
import com.xiaoxiami.app.data.trace.TraceManager
import com.xiaoxiami.app.data.trace.TraceStatus
import com.google.gson.Gson
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.channelFlow

class AgentRuntime(
    private val llmAdapter: LlmAdapter,
    private val toolExecutor: ToolExecutor,
    private val traceManager: TraceManager,
    private val approvalHandler: suspend (ToolApprovalRequest) -> ToolApprovalDecision,
    private val interactionHandler: suspend (ToolInteractionRequest) -> ToolInteractionResult = {
        ToolInteractionResult(success = false, error = "用户交互桥未接入")
    },
    private val skillRegistry: SkillRegistry = SkillRegistry(),
    private val clarificationHandler: (suspend (question: String, options: List<String>) -> String)? = null,
    private val deferredToolRegistry: DeferredToolRegistry? = null,
    private val contextSummarizer: ContextSummarizer? = null,
    private val middlewareChain: MiddlewareChain = MiddlewareChain(),
    private val maxIterations: Int = 4
) {

    companion object {
        /** ask_clarification 虚拟工具的 PlannerToolSchema，注入到决策 prompt 中 */
        val ASK_CLARIFICATION_SCHEMA = PlannerToolSchema(
            name = "ask_clarification",
            description = "当用户指令不明确、缺少必要信息时，向用户提出澄清问题。参数：question(问题文本)、options(可选的候选答案列表)。",
            family = ToolFamily.GENERAL,
            defaultHostKind = ToolHostKind.LOCAL_ANDROID,
            routes = emptyList(),
            capabilities = listOf("clarification", "user_interaction"),
            riskLevel = ToolRiskLevel.LOW,
            availability = ToolAvailability.CORE,
            inputSchema = listOf(
                ToolParameterSchema(
                    name = "question",
                    type = ToolValueType.STRING,
                    description = "要问用户的问题",
                    required = true
                ),
                ToolParameterSchema(
                    name = "options",
                    type = ToolValueType.ARRAY,
                    description = "可选的候选答案列表，如果有的话",
                    required = false,
                    itemType = ToolValueType.STRING
                )
            )
        )
    }

    private val gson = Gson()
    private val loopDetector = LoopDetector()

    fun run(
        sessionId: String,
        userGoal: String,
        conversationHistory: List<Pair<String, String>>,
        imageUris: List<Uri> = emptyList(),
        modelId: String
    ): Flow<AgentEvent> = channelFlow {
        val traceId = "agent_${sessionId.take(8)}_${System.currentTimeMillis()}"
        val observations = mutableListOf<ToolObservation>()
        val reviewHistory = mutableListOf<String>()

        send(AgentEvent.RunStarted(traceId))
        traceManager.startTrace(
            traceId = traceId,
            traceType = "agent_chat",
            trigger = "user_trigger"
        )

        try {
            val goalSpanId = traceManager.startSpan(
                traceId = traceId,
                stage = "goal",
                stepNo = 0
            )
            val structuredGoal = llmAdapter.structureGoal(
                GoalContext(
                    userGoal = userGoal,
                    sessionId = sessionId,
                    conversationHistory = conversationHistory,
                    imageCount = imageUris.size,
                    modelId = modelId
                )
            )
            traceManager.endSpan(
                traceId = traceId,
                spanId = goalSpanId,
                status = TraceStatus.SUCCESS,
                details = TraceManager.SpanDetails(
                    message = structuredGoal.task,
                    decision = mapOf(
                        "success_criteria" to structuredGoal.successCriteria,
                        "required_information" to gson.toJson(structuredGoal.requiredInformation),
                        "constraints" to gson.toJson(structuredGoal.constraints),
                        "image_count" to imageUris.size
                    )
                )
            )
            send(AgentEvent.GoalStructured(structuredGoal))

            suspend fun completeRun(
                stepNo: Int,
                stage: String,
                traceStatus: TraceStatus,
                hint: String?,
                reviewSummary: String?
            ) {
                val finalSpanId = traceManager.startSpan(
                    traceId = traceId,
                    stage = stage,
                    stepNo = stepNo
                )
                val finalAnswer = llmAdapter.streamFinalAnswer(
                    FinalAnswerContext(
                        goal = structuredGoal,
                        sessionId = sessionId,
                        conversationHistory = conversationHistory,
                        observations = observations.toList(),
                        imageCount = imageUris.size,
                        modelId = modelId,
                        reviewSummary = reviewSummary,
                        hint = hint
                    )
                ) { chunk ->
                    trySend(AgentEvent.FinalAnswerChunk(chunk))
                }
                traceManager.endSpan(
                    traceId = traceId,
                    spanId = finalSpanId,
                    status = traceStatus,
                    details = TraceManager.SpanDetails(
                        message = "Final answer generated",
                        outputRefs = listOf(
                            mapOf("answer" to finalAnswer.take(2000))
                        )
                    )
                )
                traceManager.endTrace(
                    traceId = traceId,
                    status = traceStatus,
                    stats = mapOf(
                        "observation_count" to observations.size,
                        "review_count" to reviewHistory.size,
                        "image_count" to imageUris.size
                    )
                )
                send(AgentEvent.Completed(traceId, finalAnswer))

                // ── 中间件: afterRun ──
                val afterRunCtx = MiddlewareContext(
                    sessionId = sessionId,
                    userGoal = userGoal,
                    observations = observations.toList(),
                    iteration = stepNo,
                    conversationHistory = conversationHistory
                )
                middlewareChain.runAfterRun(afterRunCtx)

                close()
            }

            var finalHint: String? = null
            var finalReviewSummary: String? = null

            for (iteration in 1..maxIterations) {
                currentCoroutineContext().ensureActive()

                // ── 中间件: beforeIteration ──
                val mwCtx = MiddlewareContext(
                    sessionId = sessionId,
                    userGoal = userGoal,
                    observations = observations.toList(),
                    iteration = iteration,
                    conversationHistory = conversationHistory
                )
                if (!middlewareChain.runBeforeIteration(mwCtx)) {
                    break // 中间件要求终止迭代
                }

                send(AgentEvent.Thinking(iteration, "正在分析下一步动作"))
                val allPlannerTools = toolExecutor.getPlannerToolSchemas()
                // ── 延迟工具注册 ──
                val basePlannerTools = if (deferredToolRegistry != null &&
                    deferredToolRegistry.shouldDefer(allPlannerTools.size)
                ) {
                    val activated = deferredToolRegistry.getActivatedTools()
                    allPlannerTools.filter { it.availability == ToolAvailability.CORE || it.name in activated } +
                        DeferredToolRegistry.TOOL_SEARCH_SCHEMA
                } else {
                    allPlannerTools
                }
                val plannerTools = if (clarificationHandler != null)
                    basePlannerTools + ASK_CLARIFICATION_SCHEMA else basePlannerTools
                val matchedSkills = skillRegistry.matchingSkills(
                    goal = structuredGoal,
                    conversationHistory = conversationHistory,
                    availableTools = plannerTools,
                    toolPolicy = toolExecutor.getPolicy()
                )

                val reasonSpanId = traceManager.startSpan(
                    traceId = traceId,
                    stage = "reason",
                    stepNo = iteration
                )
                // ── 上下文压缩 ──
                val summarizedPrefix = contextSummarizer?.summarizeIfNeeded(
                    conversationHistory, observations.toList()
                )

                val decision = llmAdapter.decideNextAction(
                    DecisionContext(
                        goal = structuredGoal,
                        sessionId = sessionId,
                        conversationHistory = conversationHistory,
                        observations = observations.toList(),
                        reviewHistory = reviewHistory.toList(),
                        availableTools = plannerTools,
                        availableSkills = matchedSkills,
                        imageCount = imageUris.size,
                        modelId = modelId,
                        summarizedPrefix = summarizedPrefix
                    )
                )
                traceManager.endSpan(
                    traceId = traceId,
                    spanId = reasonSpanId,
                    status = TraceStatus.SUCCESS,
                    details = TraceManager.SpanDetails(
                        message = decision.reason,
                        decision = mapOf(
                            "type" to decision.type.name,
                            "tool" to (decision.toolName ?: ""),
                            "arguments" to gson.toJson(decision.arguments),
                            "answer_preview" to (decision.answer ?: "").take(160)
                        )
                    )
                )

                var latestObservation: ToolObservation? = null

                when (decision.type) {
                    DecisionType.TOOL -> {
                        val toolName = decision.toolName
                        if (toolName.isNullOrBlank()) {
                            throw IllegalStateException("Planner returned TOOL without tool name")
                        }

                        // ── 延迟工具：拦截 tool_search 虚拟工具 ──
                        if (toolName == "tool_search" && deferredToolRegistry != null) {
                            val query = decision.arguments["query"]?.toString() ?: ""
                            val results = deferredToolRegistry.search(query, allPlannerTools)
                            deferredToolRegistry.activate(results.map { it.first })
                            val resultText = if (results.isEmpty()) {
                                "未找到匹配「$query」的工具。"
                            } else {
                                results.joinToString("\n") { (name, desc) -> "- $name: $desc" }
                            }
                            latestObservation = ToolObservation(
                                toolName = "tool_search",
                                arguments = decision.arguments,
                                rawOutput = "找到以下工具：\n$resultText\n这些工具现在可以使用了。",
                                success = true,
                                error = null
                            )
                            observations += latestObservation
                            send(AgentEvent.ToolCompleted(iteration, "tool_search", latestObservation.rawOutput))
                            send(AgentEvent.ObservationRecorded(iteration, "tool_search", latestObservation.rawOutput))
                        } else
                        // ── 澄清中断：拦截 ask_clarification 虚拟工具 ──
                        if (toolName == "ask_clarification" && clarificationHandler != null) {
                            val question = decision.arguments["question"]?.toString() ?: "请提供更多信息"
                            val options = (decision.arguments["options"] as? List<*>)
                                ?.mapNotNull { it?.toString() } ?: emptyList()

                            send(AgentEvent.ClarificationRequested(iteration, question, options))
                            val userAnswer = clarificationHandler.invoke(question, options)
                            send(AgentEvent.ClarificationResolved(iteration, userAnswer))

                            // 将用户回复注入为 observation，让 Agent 继续
                            latestObservation = ToolObservation(
                                toolName = "ask_clarification",
                                arguments = decision.arguments,
                                rawOutput = "用户回复：$userAnswer",
                                success = true,
                                error = null
                            )
                            observations += latestObservation
                            send(AgentEvent.ObservationRecorded(
                                iteration = iteration,
                                toolName = "ask_clarification",
                                observation = latestObservation.rawOutput
                            ))
                            // 跳过后续的工具执行逻辑，直接进入 review
                        } else {

                        val tool = toolExecutor.resolveTool(
                            plannerName = toolName,
                            routePreference = decision.targetHost
                        ) ?: throw IllegalStateException(
                            "Unknown tool requested by planner: $toolName @ ${decision.targetHost?.name ?: "auto"}"
                        )
                        val toolContext = ToolContext(
                            sessionId = sessionId,
                            modelId = modelId,
                            userGoal = userGoal,
                            conversationHistory = conversationHistory,
                            imageUris = imageUris,
                            deviceId = "local_android",
                            interactionHandler = interactionHandler
                        )
                        val approvalRequirement = tool.getApprovalRequirement(
                            arguments = decision.arguments,
                            context = toolContext
                        )

                        send(
                            AgentEvent.ToolCallPlanned(
                                iteration = iteration,
                                toolName = toolName,
                                arguments = decision.arguments,
                                reason = decision.reason
                            )
                        )

                        var approvalDenied = false
                        if (approvalRequirement.required) {
                            val approvalRequest = ToolApprovalRequest(
                                requestId = "${traceId}_${toolName}_$iteration",
                                toolName = toolName,
                                arguments = decision.arguments,
                                riskLevel = approvalRequirement.riskLevel,
                                reason = approvalRequirement.reason.ifBlank { decision.reason },
                                summary = approvalRequirement.summary.ifBlank { "Agent 请求执行 $toolName" }
                            )
                            val approvalSpanId = traceManager.startSpan(
                                traceId = traceId,
                                stage = "approval_$toolName",
                                stepNo = iteration
                            )
                            send(
                                AgentEvent.ToolApprovalRequested(
                                    iteration = iteration,
                                    request = approvalRequest
                                )
                            )
                            val approvalDecision = approvalHandler(approvalRequest)
                            traceManager.endSpan(
                                traceId = traceId,
                                spanId = approvalSpanId,
                                status = if (approvalDecision.approved) TraceStatus.SUCCESS else TraceStatus.PARTIAL,
                                details = TraceManager.SpanDetails(
                                    message = approvalDecision.message,
                                    decision = mapOf(
                                        "approved" to approvalDecision.approved,
                                        "risk_level" to approvalRequirement.riskLevel.name
                                    )
                                )
                            )
                            send(
                                AgentEvent.ToolApprovalResolved(
                                    iteration = iteration,
                                    toolName = toolName,
                                    approved = approvalDecision.approved,
                                    message = approvalDecision.message
                                )
                            )
                            if (!approvalDecision.approved) {
                                latestObservation = ToolObservation(
                                    toolName = toolName,
                                    arguments = decision.arguments,
                                    rawOutput = approvalDecision.message,
                                    success = false,
                                    error = "approval_denied"
                                )
                                observations += latestObservation
                                send(
                                    AgentEvent.ObservationRecorded(
                                        iteration = iteration,
                                        toolName = toolName,
                                        observation = latestObservation.rawOutput
                                    )
                                )
                                approvalDenied = true
                            }
                        }

                        if (!approvalDenied) {
                            val toolSpanId = traceManager.startSpan(
                                traceId = traceId,
                                stage = "tool_$toolName",
                                stepNo = iteration
                            )
                            val toolResult = toolExecutor.execute(
                                toolName = toolName,
                                arguments = decision.arguments,
                                context = toolContext,
                                onRetry = { nextAttempt, error ->
                                    trySend(
                                        AgentEvent.ToolRetryScheduled(
                                            iteration = iteration,
                                            toolName = toolName,
                                            nextAttempt = nextAttempt,
                                            reason = error
                                        )
                                    )
                                }
                            )
                            latestObservation = ToolObservation(
                                toolName = toolName,
                                arguments = decision.arguments,
                                rawOutput = toolResult.output.ifBlank {
                                    toolResult.error ?: "工具未返回内容"
                                },
                                success = toolResult.success,
                                error = toolResult.error
                            )
                            observations += latestObservation
                            finalHint = decision.reason

                            traceManager.endSpan(
                                traceId = traceId,
                                spanId = toolSpanId,
                                status = if (toolResult.success) TraceStatus.SUCCESS else TraceStatus.FAILED,
                                details = TraceManager.SpanDetails(
                                    message = latestObservation.rawOutput.take(500),
                                    outputRefs = listOf(
                                        mapOf(
                                    "tool" to toolName,
                                    "planner_host" to (decision.targetHost?.name ?: "AUTO"),
                                    "resolved_host" to tool.schema.hostKind.name,
                                    "resolved_tool" to tool.name,
                                    "result" to latestObservation.rawOutput.take(1000),
                                    "error" to (toolResult.error ?: ""),
                                    "attempts" to toolResult.attempts
                                        )
                                    ),
                                    error = toolResult.error
                                )
                            )
                            send(
                                AgentEvent.ToolCompleted(
                                    iteration = iteration,
                                    toolName = toolName,
                                    result = latestObservation.rawOutput
                                )
                            )
                            send(
                                AgentEvent.ObservationRecorded(
                                    iteration = iteration,
                                    toolName = toolName,
                                    observation = latestObservation.rawOutput
                                )
                            )

                            // ── 循环检测（多级） ──
                            val detection = loopDetector.record(toolName, decision.arguments)
                            if (detection.signal != LoopDetector.Signal.OK) {
                                send(AgentEvent.LoopDetected(
                                    iteration, toolName, detection.signal,
                                    detection.detectorName, detection.message
                                ))
                                if (detection.signal == LoopDetector.Signal.EXIT) {
                                    completeRun(
                                        stepNo = iteration,
                                        stage = "loop_exit",
                                        traceStatus = TraceStatus.FAILED,
                                        hint = "检测到死循环（${detection.detectorName}），已强制终止。请基于已有观察给出回答。",
                                        reviewSummary = detection.message
                                    )
                                    return@channelFlow
                                }
                                // WARN: 注入提醒到 observations
                                observations += ToolObservation(
                                    toolName = "system",
                                    arguments = emptyMap(),
                                    rawOutput = detection.message,
                                    success = true,
                                    error = null
                                )
                            }
                        }
                    } // else (normal tool execution)
                    } // DecisionType.TOOL

                    DecisionType.FINAL -> {
                        finalHint = decision.answer?.takeIf { it.isNotBlank() } ?: decision.reason
                    }
                }

                val reviewSpanId = traceManager.startSpan(
                    traceId = traceId,
                    stage = "review",
                    stepNo = iteration
                )
                val reviewDecision = llmAdapter.review(
                    ReviewContext(
                        goal = structuredGoal,
                        sessionId = sessionId,
                        conversationHistory = conversationHistory,
                        observations = observations.toList(),
                        latestObservation = latestObservation,
                        currentDecision = decision,
                        reviewHistory = reviewHistory.toList(),
                        imageCount = imageUris.size,
                        modelId = modelId
                    )
                )
                traceManager.endSpan(
                    traceId = traceId,
                    spanId = reviewSpanId,
                    status = TraceStatus.SUCCESS,
                    details = TraceManager.SpanDetails(
                        message = reviewDecision.reason,
                        decision = mapOf(
                            "action" to reviewDecision.action.name,
                            "answer_preview" to (reviewDecision.answer ?: "").take(160)
                        )
                    )
                )
                send(
                    AgentEvent.ReviewCompleted(
                        iteration = iteration,
                        action = reviewDecision.action,
                        reason = reviewDecision.reason
                    )
                )

                val reviewNote = "第${iteration}步反思(${reviewDecision.action.name}): ${reviewDecision.reason}"
                reviewHistory += reviewNote
                finalReviewSummary = reviewDecision.reason
                finalHint = reviewDecision.answer?.takeIf { it.isNotBlank() } ?: finalHint

                if (reviewDecision.action == ReviewAction.FINAL) {
                    completeRun(
                        stepNo = iteration,
                        stage = "final_answer",
                        traceStatus = TraceStatus.SUCCESS,
                        hint = finalHint,
                        reviewSummary = finalReviewSummary
                    )
                    return@channelFlow
                }
            }

            completeRun(
                stepNo = maxIterations + 1,
                stage = "final_answer_fallback",
                traceStatus = TraceStatus.PARTIAL,
                hint = finalHint ?: "已达到最大迭代次数，请基于现有观察给出最稳妥回答。",
                reviewSummary = finalReviewSummary ?: "Review 未能在最大迭代次数内收敛。"
            )
        } catch (e: CancellationException) {
            traceManager.endTrace(
                traceId = traceId,
                status = TraceStatus.MANUAL_STOPPED,
                stats = mapOf("reason" to "cancelled")
            )
            throw e
        } catch (e: Exception) {
            traceManager.endTrace(
                traceId = traceId,
                status = TraceStatus.FAILED,
                stats = mapOf("error" to (e.message ?: "unknown"))
            )
            send(AgentEvent.Error(traceId, e.message ?: "Agent runtime failed"))
        }
    }
}
