package com.xiaoxiami.app.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.xiaoxiami.app.MyApplication
import com.xiaoxiami.app.agent.AgentEvent
import com.xiaoxiami.app.agent.AgentRuntime
import com.xiaoxiami.app.agent.AndroidToolRegistry
import com.xiaoxiami.app.agent.GeminiLlmAdapter
import com.xiaoxiami.app.agent.ToolApprovalDecision
import com.xiaoxiami.app.agent.ToolPolicy
import com.xiaoxiami.app.agent.ToolExecutor
import com.xiaoxiami.app.data.MemoryDatabase
import com.xiaoxiami.app.data.trace.TraceManager
import com.xiaoxiami.app.repository.AgentAutomationRepository
import com.xiaoxiami.app.repository.GeminiRepository
import com.xiaoxiami.app.repository.MemoryRepository
import com.xiaoxiami.app.utils.NotificationHelper
import kotlinx.coroutines.flow.collect

class AgentAutomationWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        const val KEY_SCHEDULE_ID = "schedule_id"
        const val KEY_RULE_ID = "rule_id"
        const val KEY_RULE_RUN_ID = "rule_run_id"
        const val KEY_TRIGGER_SOURCE = "trigger_source"
        const val KEY_EVENT_PACKAGE = "event_package"
        const val KEY_EVENT_TITLE = "event_title"
        const val KEY_EVENT_TEXT = "event_text"
    }

    override suspend fun doWork(): Result {
        val database = MemoryDatabase.getDatabase(applicationContext)
        val repository = AgentAutomationRepository(applicationContext, database.agentAutomationDao())
        val scheduleId = inputData.getString(KEY_SCHEDULE_ID)
        val ruleId = inputData.getString(KEY_RULE_ID)
        val ruleRunId = inputData.getString(KEY_RULE_RUN_ID)
        val triggerSource = inputData.getString(KEY_TRIGGER_SOURCE).orEmpty().ifBlank { "schedule" }

        val taskPrompt = when {
            !scheduleId.isNullOrBlank() -> repository.getSchedule(scheduleId)?.taskPrompt
            !ruleId.isNullOrBlank() -> repository.getRule(ruleId)?.taskPrompt
            else -> null
        } ?: return Result.failure()

        val scheduleRun = if (!scheduleId.isNullOrBlank()) {
            repository.recordRunStart(
                scheduleId = scheduleId,
                triggerSource = triggerSource
            )
        } else {
            null
        }
        if (!ruleRunId.isNullOrBlank()) {
            repository.recordRuleRunStart(ruleRunId)
        }

        var traceId = ""
        var finalAnswer = ""
        val automationRunId = scheduleId ?: ruleId ?: scheduleRun?.id ?: "adhoc"

        return runCatching {
            val app = applicationContext as MyApplication
            val memoryRepository = MemoryRepository(
                context = applicationContext,
                embeddingService = app.embeddingService,
                vectorStore = app.vectorStoreService
            )
            val geminiRepository = GeminiRepository(applicationContext)
            val traceManager = TraceManager(database.traceDao())
            val runtime = AgentRuntime(
                llmAdapter = GeminiLlmAdapter(geminiRepository),
                toolExecutor = ToolExecutor(
                    AndroidToolRegistry.build(
                        context = applicationContext,
                        geminiRepository = geminiRepository,
                        memoryRepository = memoryRepository
                    ),
                    androidContext = applicationContext,
                    policy = ToolPolicy.automation()
                ),
                traceManager = traceManager,
                approvalHandler = { request ->
                    ToolApprovalDecision(
                        approved = false,
                        message = "后台自动任务不允许执行需要审批的工具：${request.toolName}"
                    )
                },
                skillRegistry = app.skillRegistry
            )

            runtime.run(
                sessionId = "automation_$automationRunId",
                userGoal = buildAutomationGoal(taskPrompt),
                conversationHistory = buildAutomationHistory(),
                modelId = "gemini-3-flash"
            ).collect { event ->
                when (event) {
                    is AgentEvent.RunStarted -> traceId = event.traceId
                    is AgentEvent.Completed -> {
                        traceId = event.traceId
                        finalAnswer = event.finalAnswer
                    }
                    is AgentEvent.Error -> {
                        if (finalAnswer.isBlank()) {
                            finalAnswer = event.message
                        }
                    }
                    else -> Unit
                }
            }

            val summary = finalAnswer.ifBlank { "自动任务已执行，但未返回可展示文本。" }
            scheduleRun?.let { run ->
                repository.completeRun(
                    runId = run.id,
                    status = "SUCCESS",
                    summary = summary,
                    traceId = traceId
                )
            }
            if (!ruleRunId.isNullOrBlank()) {
                repository.completeRuleRun(
                    ruleRunId = ruleRunId,
                    status = AgentAutomationRepository.RuleRunStatus.SUCCESS,
                    summary = summary,
                    traceId = traceId
                )
            }
            if (!scheduleId.isNullOrBlank()) {
                repository.onScheduleFinished(scheduleId, summary)
            }
            notifyResult(summary, traceId)
            Result.success()
        }.getOrElse { error ->
            scheduleRun?.let { run ->
                repository.completeRun(
                    runId = run.id,
                    status = "FAILED",
                    summary = finalAnswer.ifBlank { "自动任务执行失败" },
                    traceId = traceId,
                    errorMessage = error.message ?: "unknown"
                )
            }
            if (!ruleRunId.isNullOrBlank()) {
                repository.completeRuleRun(
                    ruleRunId = ruleRunId,
                    status = AgentAutomationRepository.RuleRunStatus.FAILED,
                    summary = finalAnswer.ifBlank { "自动任务执行失败" },
                    traceId = traceId,
                    errorMessage = error.message ?: "unknown"
                )
            }
            if (!scheduleId.isNullOrBlank()) {
                repository.onScheduleFinished(scheduleId, "失败: ${error.message.orEmpty()}")
            }
            Result.failure()
        }
    }

    private fun buildAutomationGoal(taskPrompt: String): String {
        return buildString {
            append("这是一个后台自动任务。请在不依赖用户即时交互的前提下完成：\n")
            append(taskPrompt.trim())
            append("\n\n约束：")
            append("\n1. 不要选择需要用户审批的高风险工具。")
            append("\n2. 不要选择需要用户即时选择文件、拍照或截屏的交互型工具。")
            append("\n3. 如果信息不足，请明确说明不足并给出当前最有价值的结果。")
        }
    }

    private fun buildAutomationHistory(): List<Pair<String, String>> {
        val packageName = inputData.getString(KEY_EVENT_PACKAGE).orEmpty()
        val title = inputData.getString(KEY_EVENT_TITLE).orEmpty()
        val text = inputData.getString(KEY_EVENT_TEXT).orEmpty()
        if (packageName.isBlank() && title.isBlank() && text.isBlank()) {
            return emptyList()
        }
        return listOf(
            "system" to "自动化触发上下文：package=$packageName; title=$title; text=$text"
        )
    }

    private fun notifyResult(summary: String, traceId: String) {
        NotificationHelper.createNotificationChannel(applicationContext)
        NotificationHelper.sendNotification(
            context = applicationContext,
            title = "自动任务已完成",
            message = summary.take(80),
            targetScreen = "chat",
            traceId = traceId.ifBlank { null }
        )
    }
}
