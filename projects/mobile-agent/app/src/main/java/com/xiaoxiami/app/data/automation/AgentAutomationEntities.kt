package com.xiaoxiami.app.data.automation

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "agent_schedules",
    indices = [
        Index(value = ["enabled"]),
        Index(value = ["nextRunAt"])
    ]
)
data class AgentScheduleEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String = "",
    val taskPrompt: String,
    val scheduleType: String,
    val runAt: Long? = null,
    val intervalMinutes: Int? = null,
    val daysOfWeek: String = "",
    val hourOfDay: Int? = null,
    val minuteOfHour: Int? = null,
    val timezoneId: String,
    val enabled: Boolean = true,
    val nextRunAt: Long? = null,
    val lastRunAt: Long? = null,
    val lastResultSummary: String = "",
    val createdAt: Long,
    val updatedAt: Long,
    // Enhanced fields (ported from desktop-claw)
    val consecutiveErrors: Int = 0,
    val maxConsecutiveErrors: Int = 5,
    val lastStatus: String = "",       // SUCCESS, FAILED, TIMEOUT
    val lastError: String = "",
    val lastDurationMs: Long = 0,
    val timeoutMs: Long = 90_000,      // 90s default timeout
    val expiresAt: Long? = null,       // Optional expiration timestamp
    val maxRuns: Int = 100             // Max run history to keep
)

@Entity(
    tableName = "agent_schedule_runs",
    indices = [
        Index(value = ["scheduleId"]),
        Index(value = ["startedAt"])
    ]
)
data class AgentScheduleRunEntity(
    @PrimaryKey val id: String,
    val scheduleId: String,
    val triggerSource: String,
    val startedAt: Long,
    val completedAt: Long? = null,
    val status: String,
    val summary: String = "",
    val traceId: String = "",
    val errorMessage: String = "",
    val durationMs: Long = 0          // Execution duration tracking
)

data class AgentScheduleRunWithName(
    val id: String,
    val scheduleId: String,
    val triggerSource: String,
    val startedAt: Long,
    val completedAt: Long? = null,
    val status: String,
    val summary: String = "",
    val traceId: String = "",
    val errorMessage: String = "",
    val durationMs: Long = 0,
    val scheduleName: String = ""
)

@Entity(
    tableName = "agent_rules",
    indices = [
        Index(value = ["enabled"]),
        Index(value = ["triggerType"])
    ]
)
data class AgentRuleEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String = "",
    val triggerType: String,
    val packageName: String = "",
    val titleContains: String = "",
    val textContains: String = "",
    val taskPrompt: String,
    val executionMode: String = "CONFIRM",
    val cooldownMinutes: Int = 0,
    val maxTriggersPerHour: Int = 3,
    val enabled: Boolean = true,
    val lastTriggeredAt: Long? = null,
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(
    tableName = "agent_rule_runs",
    indices = [
        Index(value = ["ruleId"]),
        Index(value = ["matchedAt"]),
        Index(value = ["status"])
    ]
)
data class AgentRuleRunEntity(
    @PrimaryKey val id: String,
    val ruleId: String,
    val triggerSource: String,
    val eventPackage: String = "",
    val eventTitle: String = "",
    val eventText: String = "",
    val previewSummary: String = "",
    val decision: String,
    val status: String,
    val matchedAt: Long,
    val startedAt: Long? = null,
    val completedAt: Long? = null,
    val traceId: String = "",
    val errorMessage: String = ""
)
