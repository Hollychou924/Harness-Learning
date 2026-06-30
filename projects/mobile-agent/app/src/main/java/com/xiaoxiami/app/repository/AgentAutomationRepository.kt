package com.xiaoxiami.app.repository

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.xiaoxiami.app.MainActivity
import com.xiaoxiami.app.R
import com.xiaoxiami.app.data.automation.AgentAutomationDao
import com.xiaoxiami.app.data.automation.AgentRuleEntity
import com.xiaoxiami.app.data.automation.AgentRuleRunEntity
import com.xiaoxiami.app.data.automation.AgentScheduleEntity
import com.xiaoxiami.app.data.automation.AgentScheduleRunEntity
import com.xiaoxiami.app.data.automation.AgentScheduleRunWithName
import com.xiaoxiami.app.receiver.AgentRuleActionReceiver
import com.xiaoxiami.app.utils.NotificationHelper
import com.xiaoxiami.app.worker.AgentAutomationWorker
import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AgentAutomationRepository(
    private val context: Context,
    private val dao: AgentAutomationDao
) {

    companion object {
        private const val TAG = "AgentAutomationRepo"
        private const val RULE_CONFIRM_NOTIFICATION_ID_OFFSET = 24_000
    }

    enum class ScheduleType {
        ONCE,
        INTERVAL,
        DAILY,
        WEEKLY
    }

    enum class RuleExecutionMode {
        CONFIRM,
        AUTO,
        DISABLED
    }

    enum class RuleRunDecision {
        AUTO,
        CONFIRM,
        RATE_LIMITED,
        COOLDOWN_SKIPPED
    }

    enum class RuleRunStatus {
        PENDING_CONFIRM,
        QUEUED,
        RUNNING,
        SUCCESS,
        FAILED,
        RATE_LIMITED,
        COOLDOWN_SKIPPED
    }

    data class RulePreview(
        val matches: Boolean,
        val wouldExecute: Boolean,
        val decision: String,
        val reason: String,
        val previewSummary: String
    )

    suspend fun createOneTimeSchedule(
        name: String,
        taskPrompt: String,
        runAt: Long,
        description: String = "",
        enabled: Boolean = true,
        expiresAt: Long? = null,
        timezoneId: String = ZoneId.systemDefault().id
    ): AgentScheduleEntity = withContext(Dispatchers.IO) {
        require(name.isNotBlank()) { "name 不能为空" }
        require(taskPrompt.isNotBlank()) { "taskPrompt 不能为空" }
        require(runAt > System.currentTimeMillis()) { "runAt 必须是未来时间" }

        val now = System.currentTimeMillis()
        val schedule = AgentScheduleEntity(
            id = UUID.randomUUID().toString(),
            name = name.trim(),
            description = description.trim(),
            taskPrompt = taskPrompt.trim(),
            scheduleType = ScheduleType.ONCE.name,
            runAt = runAt,
            enabled = enabled,
            expiresAt = expiresAt,
            timezoneId = timezoneId,
            nextRunAt = if (enabled) runAt else null,
            createdAt = now,
            updatedAt = now
        )
        dao.upsertSchedule(schedule)
        enqueueSchedule(schedule)
        schedule
    }

    suspend fun createCronSchedule(
        name: String,
        taskPrompt: String,
        scheduleType: ScheduleType,
        description: String = "",
        intervalMinutes: Int? = null,
        hourOfDay: Int? = null,
        minuteOfHour: Int? = null,
        daysOfWeek: List<String> = emptyList(),
        enabled: Boolean = true,
        expiresAt: Long? = null,
        timezoneId: String = ZoneId.systemDefault().id
    ): AgentScheduleEntity = withContext(Dispatchers.IO) {
        require(name.isNotBlank()) { "name 不能为空" }
        require(taskPrompt.isNotBlank()) { "taskPrompt 不能为空" }
        validateScheduleSpec(
            scheduleType = scheduleType,
            intervalMinutes = intervalMinutes,
            hourOfDay = hourOfDay,
            minuteOfHour = minuteOfHour,
            daysOfWeek = daysOfWeek
        )

        val now = System.currentTimeMillis()
        val normalizedDays = normalizeDays(daysOfWeek)
        val base = AgentScheduleEntity(
            id = UUID.randomUUID().toString(),
            name = name.trim(),
            description = description.trim(),
            taskPrompt = taskPrompt.trim(),
            scheduleType = scheduleType.name,
            intervalMinutes = intervalMinutes,
            daysOfWeek = normalizedDays.joinToString(","),
            hourOfDay = hourOfDay,
            minuteOfHour = minuteOfHour,
            timezoneId = timezoneId,
            enabled = enabled,
            expiresAt = expiresAt,
            createdAt = now,
            updatedAt = now
        )
        val nextRunAt = if (enabled) computeNextRunAt(base, now) else null
        val saved = base.copy(nextRunAt = nextRunAt)
        dao.upsertSchedule(saved)
        enqueueSchedule(saved)
        saved
    }

    suspend fun listSchedules(enabledOnly: Boolean = false, limit: Int = 50): List<AgentScheduleEntity> =
        withContext(Dispatchers.IO) {
            dao.listSchedules()
                .asSequence()
                .filter { !enabledOnly || it.enabled }
                .take(limit.coerceIn(1, 200))
                .toList()
        }

    suspend fun updateSchedule(
        scheduleId: String,
        name: String? = null,
        taskPrompt: String? = null,
        description: String? = null,
        enabled: Boolean? = null,
        scheduleType: ScheduleType? = null,
        runAt: Long? = null,
        expiresAt: Long? = null,
        clearExpiresAt: Boolean = false,
        intervalMinutes: Int? = null,
        hourOfDay: Int? = null,
        minuteOfHour: Int? = null,
        daysOfWeek: List<String>? = null
    ): AgentScheduleEntity = withContext(Dispatchers.IO) {
        val existing = dao.getSchedule(scheduleId) ?: error("未找到 schedule: $scheduleId")
        val resolvedType = scheduleType ?: ScheduleType.valueOf(existing.scheduleType)
        val resolvedRunAt = runAt ?: existing.runAt
        val resolvedInterval = intervalMinutes ?: existing.intervalMinutes
        val resolvedHour = hourOfDay ?: existing.hourOfDay
        val resolvedMinute = minuteOfHour ?: existing.minuteOfHour
        val resolvedDays = daysOfWeek ?: existing.daysOfWeek.split(",").filter { it.isNotBlank() }

        validateScheduleSpec(
            scheduleType = resolvedType,
            intervalMinutes = resolvedInterval,
            hourOfDay = resolvedHour,
            minuteOfHour = resolvedMinute,
            daysOfWeek = resolvedDays
        )

        val now = System.currentTimeMillis()
        val updated = existing.copy(
            name = name?.trim()?.ifBlank { existing.name } ?: existing.name,
            description = description?.trim() ?: existing.description,
            taskPrompt = taskPrompt?.trim()?.ifBlank { existing.taskPrompt } ?: existing.taskPrompt,
            scheduleType = resolvedType.name,
            runAt = resolvedRunAt,
            intervalMinutes = resolvedInterval,
            hourOfDay = resolvedHour,
            minuteOfHour = resolvedMinute,
            daysOfWeek = normalizeDays(resolvedDays).joinToString(","),
            enabled = enabled ?: existing.enabled,
            expiresAt = when {
                clearExpiresAt -> null
                expiresAt != null -> expiresAt
                else -> existing.expiresAt
            },
            updatedAt = now
        )
        val finalSchedule = updated.copy(
            nextRunAt = if (updated.enabled) computeNextRunAt(updated, now) else null
        )
        dao.upsertSchedule(finalSchedule)
        enqueueSchedule(finalSchedule)
        finalSchedule
    }

    suspend fun deleteSchedule(scheduleId: String): Boolean = withContext(Dispatchers.IO) {
        val existing = dao.getSchedule(scheduleId) ?: return@withContext false
        cancelSchedule(scheduleId)
        dao.deleteRunsForSchedule(scheduleId)
        dao.deleteScheduleById(existing.id)
        true
    }

    suspend fun runScheduleNow(scheduleId: String): Boolean = withContext(Dispatchers.IO) {
        val schedule = dao.getSchedule(scheduleId) ?: return@withContext false
        enqueueScheduleWork(
            scheduleId = schedule.id,
            triggerAt = System.currentTimeMillis(),
            triggerSource = "manual"
        )
        true
    }

    suspend fun listRuns(scheduleId: String, limit: Int = 20): List<AgentScheduleRunEntity> =
        withContext(Dispatchers.IO) {
            dao.listRunsForSchedule(scheduleId, limit.coerceIn(1, 100))
        }

    suspend fun listAllRuns(
        limit: Int = 50,
        offset: Int = 0
    ): List<AgentScheduleRunWithName> = withContext(Dispatchers.IO) {
        dao.listAllRuns(limit.coerceIn(1, 200), offset.coerceAtLeast(0))
    }

    suspend fun addRule(
        name: String,
        taskPrompt: String,
        description: String = "",
        packageName: String = "",
        titleContains: String = "",
        textContains: String = "",
        executionMode: String = RuleExecutionMode.CONFIRM.name,
        cooldownMinutes: Int = 0,
        maxTriggersPerHour: Int = 3,
        enabled: Boolean = true
    ): AgentRuleEntity = withContext(Dispatchers.IO) {
        require(name.isNotBlank()) { "name 不能为空" }
        require(taskPrompt.isNotBlank()) { "taskPrompt 不能为空" }
        require(packageName.isNotBlank() || titleContains.isNotBlank() || textContains.isNotBlank()) {
            "规则至少要有一个触发条件"
        }
        val resolvedExecutionMode = normalizeRuleExecutionMode(
            requested = executionMode,
            enabled = enabled
        )
        val now = System.currentTimeMillis()
        val rule = AgentRuleEntity(
            id = UUID.randomUUID().toString(),
            name = name.trim(),
            description = description.trim(),
            triggerType = "notification_posted",
            packageName = packageName.trim(),
            titleContains = titleContains.trim(),
            textContains = textContains.trim(),
            taskPrompt = taskPrompt.trim(),
            executionMode = resolvedExecutionMode.name,
            cooldownMinutes = cooldownMinutes.coerceIn(0, 24 * 60),
            maxTriggersPerHour = maxTriggersPerHour.coerceIn(0, 120),
            enabled = resolvedExecutionMode != RuleExecutionMode.DISABLED,
            createdAt = now,
            updatedAt = now
        )
        dao.upsertRule(rule)
        rule
    }

    suspend fun listRules(enabledOnly: Boolean = false, limit: Int = 50): List<AgentRuleEntity> =
        withContext(Dispatchers.IO) {
            dao.listRules()
                .asSequence()
                .filter { !enabledOnly || it.enabled }
                .take(limit.coerceIn(1, 200))
                .toList()
        }

    suspend fun updateRule(
        ruleId: String,
        name: String? = null,
        taskPrompt: String? = null,
        description: String? = null,
        packageName: String? = null,
        titleContains: String? = null,
        textContains: String? = null,
        executionMode: String? = null,
        cooldownMinutes: Int? = null,
        maxTriggersPerHour: Int? = null,
        enabled: Boolean? = null
    ): AgentRuleEntity = withContext(Dispatchers.IO) {
        val existing = dao.getRule(ruleId) ?: error("未找到 rule: $ruleId")
        val resolvedExecutionMode = when {
            executionMode != null -> normalizeRuleExecutionMode(executionMode, enabled)
            enabled == false -> RuleExecutionMode.DISABLED
            enabled == true && existing.executionMode == RuleExecutionMode.DISABLED.name -> RuleExecutionMode.CONFIRM
            else -> RuleExecutionMode.valueOf(existing.executionMode)
        }
        val updated = existing.copy(
            name = name?.trim()?.ifBlank { existing.name } ?: existing.name,
            description = description?.trim() ?: existing.description,
            taskPrompt = taskPrompt?.trim()?.ifBlank { existing.taskPrompt } ?: existing.taskPrompt,
            packageName = packageName?.trim() ?: existing.packageName,
            titleContains = titleContains?.trim() ?: existing.titleContains,
            textContains = textContains?.trim() ?: existing.textContains,
            executionMode = resolvedExecutionMode.name,
            cooldownMinutes = cooldownMinutes?.coerceIn(0, 24 * 60) ?: existing.cooldownMinutes,
            maxTriggersPerHour = maxTriggersPerHour?.coerceIn(0, 120) ?: existing.maxTriggersPerHour,
            enabled = resolvedExecutionMode != RuleExecutionMode.DISABLED,
            updatedAt = System.currentTimeMillis()
        )
        require(
            updated.packageName.isNotBlank() ||
                updated.titleContains.isNotBlank() ||
                updated.textContains.isNotBlank()
        ) { "规则至少要保留一个触发条件" }
        dao.upsertRule(updated)
        updated
    }

    suspend fun deleteRule(ruleId: String): Boolean = withContext(Dispatchers.IO) {
        val existing = dao.getRule(ruleId) ?: return@withContext false
        dao.deleteRuleRunsForRule(ruleId)
        dao.deleteRuleById(existing.id)
        true
    }

    suspend fun listRuleRuns(ruleId: String, limit: Int = 20): List<AgentRuleRunEntity> =
        withContext(Dispatchers.IO) {
            dao.listRuleRuns(ruleId, limit.coerceIn(1, 100))
        }

    suspend fun previewRuleMatch(
        ruleId: String? = null,
        packageName: String,
        title: String,
        text: String,
        fallbackExecutionMode: String = RuleExecutionMode.CONFIRM.name,
        fallbackCooldownMinutes: Int = 0,
        fallbackMaxTriggersPerHour: Int = 3
    ): RulePreview = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val rule = if (!ruleId.isNullOrBlank()) {
            dao.getRule(ruleId) ?: error("未找到 rule: $ruleId")
        } else {
            AgentRuleEntity(
                id = "preview",
                name = "preview",
                description = "",
                triggerType = "notification_posted",
                packageName = packageName,
                titleContains = title,
                textContains = text,
                taskPrompt = "",
                executionMode = normalizeRuleExecutionMode(fallbackExecutionMode).name,
                cooldownMinutes = fallbackCooldownMinutes.coerceIn(0, 24 * 60),
                maxTriggersPerHour = fallbackMaxTriggersPerHour.coerceIn(0, 120),
                enabled = normalizeRuleExecutionMode(fallbackExecutionMode) != RuleExecutionMode.DISABLED,
                createdAt = now,
                updatedAt = now
            )
        }
        evaluateRule(rule, packageName, title, text, now)
    }

    suspend fun handleNotificationPosted(
        packageName: String,
        title: String,
        text: String
    ) = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val rules = dao.listEnabledRulesByTrigger("notification_posted")
        rules.forEach { rule ->
            val preview = evaluateRule(rule, packageName, title, text, now)
            if (!preview.matches) {
                return@forEach
            }
            when (preview.decision) {
                RuleRunDecision.COOLDOWN_SKIPPED.name -> {
                    insertRuleRun(
                        rule = rule,
                        packageName = packageName,
                        title = title,
                        text = text,
                        matchedAt = now,
                        decision = RuleRunDecision.COOLDOWN_SKIPPED,
                        status = RuleRunStatus.COOLDOWN_SKIPPED,
                        previewSummary = preview.previewSummary
                    )
                }
                RuleRunDecision.RATE_LIMITED.name -> {
                    insertRuleRun(
                        rule = rule,
                        packageName = packageName,
                        title = title,
                        text = text,
                        matchedAt = now,
                        decision = RuleRunDecision.RATE_LIMITED,
                        status = RuleRunStatus.RATE_LIMITED,
                        previewSummary = preview.previewSummary
                    )
                }
                RuleRunDecision.CONFIRM.name -> {
                    val run = insertRuleRun(
                        rule = rule,
                        packageName = packageName,
                        title = title,
                        text = text,
                        matchedAt = now,
                        decision = RuleRunDecision.CONFIRM,
                        status = RuleRunStatus.PENDING_CONFIRM,
                        previewSummary = preview.previewSummary
                    )
                    dao.upsertRule(rule.copy(lastTriggeredAt = now, updatedAt = now))
                    sendRuleConfirmationNotification(rule, run)
                }
                else -> {
                    val run = insertRuleRun(
                        rule = rule,
                        packageName = packageName,
                        title = title,
                        text = text,
                        matchedAt = now,
                        decision = RuleRunDecision.AUTO,
                        status = RuleRunStatus.QUEUED,
                        previewSummary = preview.previewSummary
                    )
                    dao.upsertRule(rule.copy(lastTriggeredAt = now, updatedAt = now))
                    enqueueRuleExecution(rule, run, packageName, title, text)
                }
            }
        }
    }

    suspend fun confirmRuleRun(ruleRunId: String): Boolean = withContext(Dispatchers.IO) {
        val ruleRun = dao.getRuleRun(ruleRunId) ?: return@withContext false
        if (ruleRun.status != RuleRunStatus.PENDING_CONFIRM.name) {
            return@withContext false
        }
        val rule = dao.getRule(ruleRun.ruleId) ?: return@withContext false
        val queued = ruleRun.copy(
            status = RuleRunStatus.QUEUED.name,
            errorMessage = ""
        )
        dao.insertRuleRun(queued)
        enqueueRuleExecution(
            rule = rule,
            ruleRun = queued,
            packageName = queued.eventPackage,
            title = queued.eventTitle,
            text = queued.eventText
        )
        true
    }

    suspend fun recordRunStart(
        scheduleId: String,
        triggerSource: String
    ): AgentScheduleRunEntity = withContext(Dispatchers.IO) {
        val run = AgentScheduleRunEntity(
            id = UUID.randomUUID().toString(),
            scheduleId = scheduleId,
            triggerSource = triggerSource,
            startedAt = System.currentTimeMillis(),
            status = "RUNNING"
        )
        dao.insertRun(run)
        run
    }

    suspend fun recordRuleRunStart(ruleRunId: String): AgentRuleRunEntity? = withContext(Dispatchers.IO) {
        val existing = dao.getRuleRun(ruleRunId) ?: return@withContext null
        val updated = existing.copy(
            startedAt = System.currentTimeMillis(),
            status = RuleRunStatus.RUNNING.name
        )
        dao.insertRuleRun(updated)
        updated
    }

    suspend fun completeRun(
        runId: String,
        status: String,
        summary: String,
        traceId: String = "",
        errorMessage: String = ""
    ) = withContext(Dispatchers.IO) {
        val existing = dao.getRun(runId) ?: return@withContext
        val now = System.currentTimeMillis()
        val durationMs = now - existing.startedAt
        dao.insertRun(
            existing.copy(
                completedAt = now,
                status = status,
                summary = summary.take(2000),
                traceId = traceId,
                errorMessage = errorMessage.take(1000),
                durationMs = durationMs
            )
        )

        // Enhanced: Update schedule error tracking and prune old runs
        val scheduleId = existing.scheduleId
        val schedule = dao.getSchedule(scheduleId)
        if (schedule != null) {
            val isFailed = status == "FAILED" || status == "TIMEOUT"
            val newErrorCount = if (isFailed) schedule.consecutiveErrors + 1 else 0
            dao.updateScheduleRunState(
                scheduleId = scheduleId,
                count = newErrorCount,
                status = status,
                error = if (isFailed) errorMessage.take(500) else "",
                durationMs = durationMs
            )
            // Auto-disable after too many consecutive errors
            if (newErrorCount >= schedule.maxConsecutiveErrors) {
                dao.disableSchedule(scheduleId)
                Log.w(TAG, "Schedule $scheduleId auto-disabled after $newErrorCount consecutive errors")
            }
            // Prune old runs beyond maxRuns limit
            val runCount = dao.countRunsForSchedule(scheduleId)
            if (runCount > schedule.maxRuns) {
                dao.pruneOldRuns(scheduleId, schedule.maxRuns)
            }
        }
    }

    suspend fun completeRuleRun(
        ruleRunId: String,
        status: RuleRunStatus,
        summary: String,
        traceId: String = "",
        errorMessage: String = ""
    ) = withContext(Dispatchers.IO) {
        val existing = dao.getRuleRun(ruleRunId) ?: return@withContext
        dao.insertRuleRun(
            existing.copy(
                completedAt = System.currentTimeMillis(),
                status = status.name,
                previewSummary = if (summary.isBlank()) existing.previewSummary else summary.take(2000),
                traceId = traceId,
                errorMessage = errorMessage.take(1000)
            )
        )
    }

    suspend fun onScheduleFinished(
        scheduleId: String,
        resultSummary: String
    ) = withContext(Dispatchers.IO) {
        val existing = dao.getSchedule(scheduleId) ?: return@withContext
        val now = System.currentTimeMillis()

        // Check expiration
        val isExpired = existing.expiresAt != null && existing.expiresAt <= now
        val isOnce = existing.scheduleType == ScheduleType.ONCE.name

        val nextRunAt = when {
            isOnce || isExpired -> null
            else -> computeNextRunAt(existing.copy(lastRunAt = now), now)
        }
        val updated = existing.copy(
            enabled = if (isOnce || isExpired) false else existing.enabled,
            nextRunAt = nextRunAt,
            lastRunAt = now,
            lastResultSummary = resultSummary.take(500),
            updatedAt = now
        )
        dao.upsertSchedule(updated)
        if (isExpired) {
            Log.i(TAG, "Schedule $scheduleId expired, disabled")
        } else {
            enqueueSchedule(updated)
        }
    }

    /** Disable all expired schedules. Called periodically or on app startup. */
    suspend fun disableExpiredSchedules() = withContext(Dispatchers.IO) {
        val expired = dao.listExpiredSchedules(System.currentTimeMillis())
        for (schedule in expired) {
            dao.upsertSchedule(schedule.copy(enabled = false, updatedAt = System.currentTimeMillis()))
            Log.i(TAG, "Auto-disabled expired schedule: ${schedule.id} (${schedule.name})")
        }
    }

    suspend fun rescheduleAllEnabledSchedules() = withContext(Dispatchers.IO) {
        dao.listEnabledSchedulesForReschedule().forEach { schedule ->
            enqueueSchedule(schedule)
        }
    }

    suspend fun getSchedule(scheduleId: String): AgentScheduleEntity? = withContext(Dispatchers.IO) {
        dao.getSchedule(scheduleId)
    }

    suspend fun getRule(ruleId: String): AgentRuleEntity? = withContext(Dispatchers.IO) {
        dao.getRule(ruleId)
    }

    private fun enqueueSchedule(schedule: AgentScheduleEntity) {
        if (!schedule.enabled || schedule.nextRunAt == null) {
            cancelSchedule(schedule.id)
            return
        }
        enqueueScheduleWork(
            scheduleId = schedule.id,
            triggerAt = schedule.nextRunAt,
            triggerSource = "schedule"
        )
    }

    private fun enqueueScheduleWork(
        scheduleId: String,
        triggerAt: Long,
        triggerSource: String
    ) {
        val delayMs = (triggerAt - System.currentTimeMillis()).coerceAtLeast(0L)
        val work = OneTimeWorkRequestBuilder<AgentAutomationWorker>()
            .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
            .setInputData(
                workDataOf(
                    AgentAutomationWorker.KEY_SCHEDULE_ID to scheduleId,
                    AgentAutomationWorker.KEY_TRIGGER_SOURCE to triggerSource
                )
            )
            .addTag("agent_schedule")
            .addTag("agent_schedule_$scheduleId")
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            uniqueScheduleWorkName(scheduleId),
            ExistingWorkPolicy.REPLACE,
            work
        )
    }

    private fun cancelSchedule(scheduleId: String) {
        WorkManager.getInstance(context).cancelUniqueWork(uniqueScheduleWorkName(scheduleId))
    }

    private fun enqueueRuleExecution(
        rule: AgentRuleEntity,
        ruleRun: AgentRuleRunEntity,
        packageName: String,
        title: String,
        text: String
    ) {
        val work = OneTimeWorkRequestBuilder<AgentAutomationWorker>()
            .setInputData(
                Data.Builder()
                    .putString(AgentAutomationWorker.KEY_RULE_ID, rule.id)
                    .putString(AgentAutomationWorker.KEY_RULE_RUN_ID, ruleRun.id)
                    .putString(AgentAutomationWorker.KEY_TRIGGER_SOURCE, "rule")
                    .putString(AgentAutomationWorker.KEY_EVENT_PACKAGE, packageName)
                    .putString(AgentAutomationWorker.KEY_EVENT_TITLE, title.take(500))
                    .putString(AgentAutomationWorker.KEY_EVENT_TEXT, text.take(1000))
                    .build()
            )
            .addTag("agent_rule")
            .addTag("agent_rule_${rule.id}")
            .build()
        WorkManager.getInstance(context).enqueue(work)
    }

    private suspend fun insertRuleRun(
        rule: AgentRuleEntity,
        packageName: String,
        title: String,
        text: String,
        matchedAt: Long,
        decision: RuleRunDecision,
        status: RuleRunStatus,
        previewSummary: String
    ): AgentRuleRunEntity {
        val run = AgentRuleRunEntity(
            id = UUID.randomUUID().toString(),
            ruleId = rule.id,
            triggerSource = rule.triggerType,
            eventPackage = packageName.take(300),
            eventTitle = title.take(500),
            eventText = text.take(1000),
            previewSummary = previewSummary.take(2000),
            decision = decision.name,
            status = status.name,
            matchedAt = matchedAt
        )
        dao.insertRuleRun(run)
        return run
    }

    private suspend fun evaluateRule(
        rule: AgentRuleEntity,
        packageName: String,
        title: String,
        text: String,
        now: Long
    ): RulePreview {
        if (rule.executionMode == RuleExecutionMode.DISABLED.name || !rule.enabled) {
            return RulePreview(
                matches = false,
                wouldExecute = false,
                decision = RuleExecutionMode.DISABLED.name,
                reason = "规则已禁用",
                previewSummary = "规则已禁用，不会执行。"
            )
        }
        if (rule.packageName.isNotBlank() && rule.packageName != packageName) {
            return RulePreview(
                matches = false,
                wouldExecute = false,
                decision = rule.executionMode,
                reason = "packageName 不匹配",
                previewSummary = "通知来源 $packageName 与规则要求 ${rule.packageName} 不匹配。"
            )
        }
        if (rule.titleContains.isNotBlank() && !title.contains(rule.titleContains, ignoreCase = true)) {
            return RulePreview(
                matches = false,
                wouldExecute = false,
                decision = rule.executionMode,
                reason = "titleContains 不匹配",
                previewSummary = "通知标题未命中关键字 ${rule.titleContains}。"
            )
        }
        if (rule.textContains.isNotBlank() && !text.contains(rule.textContains, ignoreCase = true)) {
            return RulePreview(
                matches = false,
                wouldExecute = false,
                decision = rule.executionMode,
                reason = "textContains 不匹配",
                previewSummary = "通知正文未命中关键字 ${rule.textContains}。"
            )
        }
        val cooldownMs = rule.cooldownMinutes * 60_000L
        if (cooldownMs > 0 && rule.lastTriggeredAt != null && now - rule.lastTriggeredAt < cooldownMs) {
            return RulePreview(
                matches = true,
                wouldExecute = false,
                decision = RuleRunDecision.COOLDOWN_SKIPPED.name,
                reason = "命中 cooldown",
                previewSummary = "规则已命中，但仍在冷却期内，本次不会执行。"
            )
        }
        if (rule.maxTriggersPerHour > 0) {
            val recentCount = dao.countRuleTriggersSince(rule.id, now - 60 * 60_000L)
            if (recentCount >= rule.maxTriggersPerHour) {
                return RulePreview(
                    matches = true,
                    wouldExecute = false,
                    decision = RuleRunDecision.RATE_LIMITED.name,
                    reason = "超过每小时触发上限",
                    previewSummary = "规则已命中，但过去一小时已触发 $recentCount 次，超过上限 ${rule.maxTriggersPerHour}。"
                )
            }
        }
        val executionMode = RuleExecutionMode.valueOf(rule.executionMode)
        val modeSummary = when (executionMode) {
            RuleExecutionMode.CONFIRM -> "需要人工确认后执行"
            RuleExecutionMode.AUTO -> "将自动执行"
            RuleExecutionMode.DISABLED -> "当前禁用"
        }
        return RulePreview(
            matches = true,
            wouldExecute = executionMode != RuleExecutionMode.DISABLED,
            decision = when (executionMode) {
                RuleExecutionMode.CONFIRM -> RuleRunDecision.CONFIRM.name
                RuleExecutionMode.AUTO -> RuleRunDecision.AUTO.name
                RuleExecutionMode.DISABLED -> RuleExecutionMode.DISABLED.name
            },
            reason = "规则命中",
            previewSummary = "规则命中通知条件，$modeSummary。冷却 ${rule.cooldownMinutes} 分钟，每小时上限 ${rule.maxTriggersPerHour} 次。"
        )
    }

    private fun sendRuleConfirmationNotification(
        rule: AgentRuleEntity,
        ruleRun: AgentRuleRunEntity
    ) {
        NotificationHelper.createNotificationChannel(context)
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("target_screen", "chat")
        }
        val openPendingIntent = PendingIntent.getActivity(
            context,
            ruleRun.id.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val confirmIntent = Intent(context, AgentRuleActionReceiver::class.java).apply {
            action = AgentRuleActionReceiver.ACTION_CONFIRM_RULE_RUN
            putExtra(AgentRuleActionReceiver.EXTRA_RULE_RUN_ID, ruleRun.id)
        }
        val confirmPendingIntent = PendingIntent.getBroadcast(
            context,
            ruleRun.id.hashCode(),
            confirmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, NotificationHelper.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("规则待确认：${rule.name}")
            .setContentText(ruleRun.previewSummary.take(80))
            .setStyle(NotificationCompat.BigTextStyle().bigText(ruleRun.previewSummary))
            .setAutoCancel(true)
            .setContentIntent(openPendingIntent)
            .addAction(0, "立即执行", confirmPendingIntent)
            .build()

        manager.notify(RULE_CONFIRM_NOTIFICATION_ID_OFFSET + ruleRun.id.hashCode(), notification)
    }

    private fun uniqueScheduleWorkName(scheduleId: String): String = "agent_schedule_$scheduleId"

    private fun validateScheduleSpec(
        scheduleType: ScheduleType,
        intervalMinutes: Int?,
        hourOfDay: Int?,
        minuteOfHour: Int?,
        daysOfWeek: List<String>
    ) {
        when (scheduleType) {
            ScheduleType.ONCE -> Unit
            ScheduleType.INTERVAL -> require((intervalMinutes ?: 0) >= 5) { "intervalMinutes 不能小于 5" }
            ScheduleType.DAILY -> {
                require(hourOfDay != null && hourOfDay in 0..23) { "hour 必须在 0..23" }
                require(minuteOfHour != null && minuteOfHour in 0..59) { "minute 必须在 0..59" }
            }
            ScheduleType.WEEKLY -> {
                require(hourOfDay != null && hourOfDay in 0..23) { "hour 必须在 0..23" }
                require(minuteOfHour != null && minuteOfHour in 0..59) { "minute 必须在 0..59" }
                require(normalizeDays(daysOfWeek).isNotEmpty()) { "weekly 至少需要一个 daysOfWeek" }
            }
        }
    }

    private fun computeNextRunAt(
        schedule: AgentScheduleEntity,
        fromTime: Long
    ): Long? {
        val zoneId = runCatching { ZoneId.of(schedule.timezoneId) }
            .getOrDefault(ZoneId.systemDefault())
        return when (ScheduleType.valueOf(schedule.scheduleType)) {
            ScheduleType.ONCE -> schedule.runAt?.takeIf { it > fromTime }
            ScheduleType.INTERVAL -> {
                val intervalMinutes = schedule.intervalMinutes ?: return null
                fromTime + intervalMinutes * 60_000L
            }
            ScheduleType.DAILY -> {
                val hour = schedule.hourOfDay ?: return null
                val minute = schedule.minuteOfHour ?: return null
                var next = ZonedDateTime.ofInstant(Instant.ofEpochMilli(fromTime), zoneId)
                    .withHour(hour)
                    .withMinute(minute)
                    .withSecond(0)
                    .withNano(0)
                if (!next.toInstant().isAfter(Instant.ofEpochMilli(fromTime))) {
                    next = next.plusDays(1)
                }
                next.toInstant().toEpochMilli()
            }
            ScheduleType.WEEKLY -> {
                val hour = schedule.hourOfDay ?: return null
                val minute = schedule.minuteOfHour ?: return null
                val days = normalizeDays(schedule.daysOfWeek.split(","))
                    .mapNotNull { runCatching { DayOfWeek.valueOf(it) }.getOrNull() }
                    .toSet()
                if (days.isEmpty()) return null
                val now = ZonedDateTime.ofInstant(Instant.ofEpochMilli(fromTime), zoneId)
                var cursor = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0)
                repeat(8) {
                    if (days.contains(cursor.dayOfWeek) && cursor.toInstant().toEpochMilli() > fromTime) {
                        return cursor.toInstant().toEpochMilli()
                    }
                    cursor = cursor.plusDays(1).withHour(hour).withMinute(minute).withSecond(0).withNano(0)
                }
                null
            }
        }
    }

    private fun normalizeDays(days: List<String>): List<String> {
        return days.mapNotNull { raw ->
            val normalized = raw.trim().uppercase(Locale.getDefault())
            when (normalized) {
                "MON", "MONDAY", "周一", "星期一" -> "MONDAY"
                "TUE", "TUESDAY", "周二", "星期二" -> "TUESDAY"
                "WED", "WEDNESDAY", "周三", "星期三" -> "WEDNESDAY"
                "THU", "THURSDAY", "周四", "星期四" -> "THURSDAY"
                "FRI", "FRIDAY", "周五", "星期五" -> "FRIDAY"
                "SAT", "SATURDAY", "周六", "星期六" -> "SATURDAY"
                "SUN", "SUNDAY", "周日", "星期日", "周天", "星期天" -> "SUNDAY"
                else -> null
            }
        }.distinct()
    }

    private fun normalizeRuleExecutionMode(
        requested: String,
        enabled: Boolean? = null
    ): RuleExecutionMode {
        if (enabled == false) {
            return RuleExecutionMode.DISABLED
        }
        return when (requested.trim().uppercase(Locale.getDefault())) {
            RuleExecutionMode.AUTO.name -> RuleExecutionMode.AUTO
            RuleExecutionMode.DISABLED.name -> RuleExecutionMode.DISABLED
            else -> RuleExecutionMode.CONFIRM
        }
    }
}
