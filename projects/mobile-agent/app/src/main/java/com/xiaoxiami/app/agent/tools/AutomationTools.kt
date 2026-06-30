package com.xiaoxiami.app.agent.tools

import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolCallerIdentity
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolScope
import com.xiaoxiami.app.agent.ToolValueType
import com.xiaoxiami.app.repository.AgentAutomationRepository
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class ScheduleTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "schedule",
        description = "Create a one-time autonomous agent task that will run in the future.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "schedule", "background_task"),
        riskLevel = ToolRiskLevel.HIGH,
        scopes = listOf(ToolScope.AUTOMATION),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        approvalRequired = true,
        approvalReason = "创建后台自动任务会让 Agent 在未来自动运行。",
        approvalSummary = "Agent 请求创建一次性自动任务",
        inputSchema = listOf(
            ToolParameterSchema("name", ToolValueType.STRING, "Task name.", required = true),
            ToolParameterSchema("task", ToolValueType.STRING, "Goal for the future agent run.", required = true),
            ToolParameterSchema("runAt", ToolValueType.NUMBER, "Unix timestamp in milliseconds.", required = true),
            ToolParameterSchema("description", ToolValueType.STRING, "Optional description.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("scheduleId", ToolValueType.STRING, "Created schedule ID."),
            ToolFieldSchema("nextRunAt", ToolValueType.NUMBER, "Scheduled execution time.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val name = arguments.stringArg("name")
        val task = arguments.stringArg("task")
        val runAt = arguments.longArg("runAt", 0L)
        if (name.isBlank() || task.isBlank() || runAt <= 0L) {
            return ToolResult(false, "", "name、task、runAt 必填")
        }

        val schedule = automationRepository.createOneTimeSchedule(
            name = name,
            taskPrompt = task,
            runAt = runAt,
            description = arguments.stringArg("description")
        )
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "scheduleId" to schedule.id,
                    "name" to schedule.name,
                    "nextRunAt" to schedule.nextRunAt,
                    "scheduleType" to schedule.scheduleType
                )
            )
        )
    }
}

class CronAddTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "cron_add",
        description = "Create a recurring autonomous agent task with interval, daily, or weekly cadence.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "cron", "background_task"),
        riskLevel = ToolRiskLevel.HIGH,
        scopes = listOf(ToolScope.AUTOMATION),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        approvalRequired = true,
        approvalReason = "创建循环自动任务会让 Agent 持续自动运行。",
        approvalSummary = "Agent 请求创建循环自动任务",
        inputSchema = listOf(
            ToolParameterSchema("name", ToolValueType.STRING, "Schedule name.", required = true),
            ToolParameterSchema("task", ToolValueType.STRING, "Goal for each run.", required = true),
            ToolParameterSchema("scheduleType", ToolValueType.STRING, "interval, daily, or weekly.", required = true, enumValues = listOf("interval", "daily", "weekly")),
            ToolParameterSchema("intervalMinutes", ToolValueType.INTEGER, "Required for interval schedules.", required = false),
            ToolParameterSchema("hour", ToolValueType.INTEGER, "Required for daily/weekly schedules.", required = false),
            ToolParameterSchema("minute", ToolValueType.INTEGER, "Required for daily/weekly schedules.", required = false),
            ToolParameterSchema("daysOfWeek", ToolValueType.ARRAY, "Required for weekly schedules.", required = false, itemType = ToolValueType.STRING),
            ToolParameterSchema("description", ToolValueType.STRING, "Optional description.", required = false),
            ToolParameterSchema("enabled", ToolValueType.BOOLEAN, "Whether the schedule starts enabled.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("scheduleId", ToolValueType.STRING, "Created schedule ID."),
            ToolFieldSchema("nextRunAt", ToolValueType.NUMBER, "Next scheduled run time.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val scheduleType = parseScheduleType(arguments.stringArg("scheduleType"))
            ?: return ToolResult(false, "", "scheduleType 仅支持 interval/daily/weekly")
        val schedule = automationRepository.createCronSchedule(
            name = arguments.stringArg("name"),
            taskPrompt = arguments.stringArg("task"),
            scheduleType = scheduleType,
            description = arguments.stringArg("description"),
            intervalMinutes = arguments["intervalMinutes"]?.let { arguments.intArg("intervalMinutes") },
            hourOfDay = arguments["hour"]?.let { arguments.intArg("hour") },
            minuteOfHour = arguments["minute"]?.let { arguments.intArg("minute") },
            daysOfWeek = arguments.stringListArg("daysOfWeek"),
            enabled = arguments.booleanArg("enabled", true)
        )
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "scheduleId" to schedule.id,
                    "name" to schedule.name,
                    "scheduleType" to schedule.scheduleType,
                    "nextRunAt" to schedule.nextRunAt,
                    "enabled" to schedule.enabled
                )
            )
        )
    }
}

class CronListTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "cron_list",
        description = "List existing scheduled autonomous agent tasks.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "cron"),
        scopes = listOf(ToolScope.AUTOMATION),
        inputSchema = listOf(
            ToolParameterSchema("enabledOnly", ToolValueType.BOOLEAN, "Only return enabled schedules.", required = false),
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum number of items.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("items", ToolValueType.ARRAY, "List of schedules.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val items = automationRepository.listSchedules(
            enabledOnly = arguments.booleanArg("enabledOnly", false),
            limit = arguments.intArg("limit", 20)
        )
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "items" to items.map { schedule ->
                        mapOf(
                            "id" to schedule.id,
                            "name" to schedule.name,
                            "description" to schedule.description,
                            "task" to schedule.taskPrompt,
                            "scheduleType" to schedule.scheduleType.lowercase(),
                            "enabled" to schedule.enabled,
                            "nextRunAt" to schedule.nextRunAt,
                            "lastRunAt" to schedule.lastRunAt,
                            "lastResultSummary" to schedule.lastResultSummary
                        )
                    }
                )
            )
        )
    }
}

class CronUpdateTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "cron_update",
        description = "Update an existing recurring or one-time autonomous task.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "cron"),
        riskLevel = ToolRiskLevel.HIGH,
        scopes = listOf(ToolScope.AUTOMATION),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        approvalRequired = true,
        approvalReason = "修改自动任务会改变未来的自动执行行为。",
        approvalSummary = "Agent 请求修改自动任务",
        inputSchema = listOf(
            ToolParameterSchema("scheduleId", ToolValueType.STRING, "Target schedule ID.", required = true),
            ToolParameterSchema("name", ToolValueType.STRING, "Optional new name.", required = false),
            ToolParameterSchema("task", ToolValueType.STRING, "Optional new task prompt.", required = false),
            ToolParameterSchema("description", ToolValueType.STRING, "Optional description.", required = false),
            ToolParameterSchema("enabled", ToolValueType.BOOLEAN, "Optional enabled flag.", required = false),
            ToolParameterSchema("scheduleType", ToolValueType.STRING, "Optional schedule type.", required = false, enumValues = listOf("once", "interval", "daily", "weekly")),
            ToolParameterSchema("runAt", ToolValueType.NUMBER, "Optional runAt for one-time schedules.", required = false),
            ToolParameterSchema("intervalMinutes", ToolValueType.INTEGER, "Optional interval.", required = false),
            ToolParameterSchema("hour", ToolValueType.INTEGER, "Optional hour.", required = false),
            ToolParameterSchema("minute", ToolValueType.INTEGER, "Optional minute.", required = false),
            ToolParameterSchema("daysOfWeek", ToolValueType.ARRAY, "Optional weekly days.", required = false, itemType = ToolValueType.STRING)
        ),
        outputSchema = listOf(
            ToolFieldSchema("scheduleId", ToolValueType.STRING, "Updated schedule ID.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val scheduleType = arguments["scheduleType"]?.let { parseScheduleType(arguments.stringArg("scheduleType")) }
        val schedule = automationRepository.updateSchedule(
            scheduleId = arguments.stringArg("scheduleId"),
            name = arguments["name"]?.toString(),
            taskPrompt = arguments["task"]?.toString(),
            description = arguments["description"]?.toString(),
            enabled = arguments["enabled"]?.let { arguments.booleanArg("enabled") },
            scheduleType = scheduleType,
            runAt = arguments["runAt"]?.let { arguments.longArg("runAt") },
            intervalMinutes = arguments["intervalMinutes"]?.let { arguments.intArg("intervalMinutes") },
            hourOfDay = arguments["hour"]?.let { arguments.intArg("hour") },
            minuteOfHour = arguments["minute"]?.let { arguments.intArg("minute") },
            daysOfWeek = if (arguments.containsKey("daysOfWeek")) arguments.stringListArg("daysOfWeek") else null
        )
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "scheduleId" to schedule.id,
                    "enabled" to schedule.enabled,
                    "scheduleType" to schedule.scheduleType.lowercase(),
                    "nextRunAt" to schedule.nextRunAt
                )
            )
        )
    }
}

class CronDeleteTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "cron_delete",
        description = "Delete a scheduled autonomous agent task.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "cron"),
        riskLevel = ToolRiskLevel.HIGH,
        scopes = listOf(ToolScope.AUTOMATION),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        approvalRequired = true,
        approvalReason = "删除自动任务会永久取消未来执行。",
        approvalSummary = "Agent 请求删除自动任务",
        inputSchema = listOf(
            ToolParameterSchema("scheduleId", ToolValueType.STRING, "Target schedule ID.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val deleted = automationRepository.deleteSchedule(arguments.stringArg("scheduleId"))
        return ToolResult(
            success = deleted,
            output = jsonOutput(mapOf("success" to deleted))
        )
    }
}

class CronRunTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "cron_run",
        description = "Trigger a scheduled autonomous task immediately.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "cron"),
        riskLevel = ToolRiskLevel.HIGH,
        scopes = listOf(ToolScope.AUTOMATION),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        approvalRequired = true,
        approvalReason = "立即触发自动任务会让 Agent 立刻后台执行。",
        approvalSummary = "Agent 请求立即执行自动任务",
        inputSchema = listOf(
            ToolParameterSchema("scheduleId", ToolValueType.STRING, "Target schedule ID.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val success = automationRepository.runScheduleNow(arguments.stringArg("scheduleId"))
        return ToolResult(
            success = success,
            output = jsonOutput(mapOf("success" to success))
        )
    }
}

class CronRunsTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "cron_runs",
        description = "Inspect recent run history for a scheduled autonomous task.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "cron", "audit"),
        scopes = listOf(ToolScope.AUTOMATION),
        inputSchema = listOf(
            ToolParameterSchema("scheduleId", ToolValueType.STRING, "Target schedule ID.", required = true),
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum rows to return.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("items", ToolValueType.ARRAY, "Recent execution runs.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val runs = automationRepository.listRuns(
            scheduleId = arguments.stringArg("scheduleId"),
            limit = arguments.intArg("limit", 10)
        )
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "items" to runs.map { run ->
                        mapOf(
                            "id" to run.id,
                            "status" to run.status,
                            "triggerSource" to run.triggerSource,
                            "startedAt" to run.startedAt,
                            "completedAt" to run.completedAt,
                            "summary" to run.summary,
                            "traceId" to run.traceId,
                            "errorMessage" to run.errorMessage
                        )
                    }
                )
            )
        )
    }
}

class CreateScheduledTaskTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "create_scheduled_task",
        description = "Create a scheduled task using desktop-claw compatible schema: schedule.type=at|cron.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "schedule", "cron"),
        riskLevel = ToolRiskLevel.HIGH,
        scopes = listOf(ToolScope.AUTOMATION),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        approvalRequired = true,
        approvalReason = "创建定时任务会让 Agent 在未来自动执行。",
        approvalSummary = "Agent 请求创建定时任务",
        inputSchema = listOf(
            ToolParameterSchema("name", ToolValueType.STRING, "Task name.", required = true),
            ToolParameterSchema("description", ToolValueType.STRING, "Optional description.", required = false),
            ToolParameterSchema("schedule", ToolValueType.OBJECT, "Schedule object: {type:'at',datetime} or {type:'cron',expression}.", required = true),
            ToolParameterSchema("prompt", ToolValueType.STRING, "Task prompt to run.", required = true),
            ToolParameterSchema("expires_at", ToolValueType.STRING, "Optional expiry date YYYY-MM-DD.", required = false),
            ToolParameterSchema("enabled", ToolValueType.BOOLEAN, "Whether task starts enabled.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("task", ToolValueType.OBJECT, "Created task."),
            ToolFieldSchema("warning", ToolValueType.STRING, "Compatibility warning if schedule was adapted.", required = false)
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val name = arguments.stringArg("name")
        val prompt = arguments.stringArg("prompt")
        if (name.isBlank() || prompt.isBlank()) {
            return ToolResult(false, "", "name 和 prompt 必填")
        }
        val scheduleRaw = arguments.mapArg("schedule")
        if (scheduleRaw.isEmpty()) {
            return ToolResult(false, "", "schedule 必填，且需为对象")
        }
        val parsed = parseLegacySchedule(scheduleRaw) ?: return ToolResult(false, "", "schedule 格式不合法或当前不支持")
        val expiresAtParse = parseExpiresAt(arguments["expires_at"]?.toString())
        if (expiresAtParse.error != null) {
            return ToolResult(false, "", expiresAtParse.error)
        }
        val enabled = arguments.booleanArg("enabled", true)
        val created = when (parsed.scheduleType) {
            AgentAutomationRepository.ScheduleType.ONCE -> automationRepository.createOneTimeSchedule(
                name = name,
                taskPrompt = prompt,
                runAt = parsed.runAt ?: 0L,
                description = arguments.stringArg("description"),
                enabled = enabled,
                expiresAt = expiresAtParse.value
            )
            AgentAutomationRepository.ScheduleType.INTERVAL,
            AgentAutomationRepository.ScheduleType.DAILY,
            AgentAutomationRepository.ScheduleType.WEEKLY -> automationRepository.createCronSchedule(
                name = name,
                taskPrompt = prompt,
                scheduleType = parsed.scheduleType,
                description = arguments.stringArg("description"),
                intervalMinutes = parsed.intervalMinutes,
                hourOfDay = parsed.hourOfDay,
                minuteOfHour = parsed.minuteOfHour,
                daysOfWeek = parsed.daysOfWeek,
                enabled = enabled,
                expiresAt = expiresAtParse.value
            )
        }
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "task" to scheduleEntityToLegacyTask(created),
                    "warning" to parsed.warning
                )
            )
        )
    }
}

class ListScheduledTasksTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "list_scheduled_tasks",
        description = "List scheduled tasks in desktop-claw compatible format.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "schedule", "cron"),
        scopes = listOf(ToolScope.AUTOMATION),
        inputSchema = listOf(
            ToolParameterSchema("enabled_only", ToolValueType.BOOLEAN, "Only return enabled tasks.", required = false),
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum rows.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("tasks", ToolValueType.ARRAY, "Task list.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val tasks = automationRepository.listSchedules(
            enabledOnly = arguments.booleanArg("enabled_only", false),
            limit = arguments.intArg("limit", 50)
        )
        return ToolResult(
            success = true,
            output = jsonOutput(mapOf("tasks" to tasks.map { scheduleEntityToLegacyTask(it) }))
        )
    }
}

class GetScheduledTaskTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "get_scheduled_task",
        description = "Get one scheduled task by task_id.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "schedule", "cron"),
        scopes = listOf(ToolScope.AUTOMATION),
        inputSchema = listOf(
            ToolParameterSchema("task_id", ToolValueType.STRING, "Target task ID.", required = true)
        ),
        outputSchema = listOf(
            ToolFieldSchema("task", ToolValueType.OBJECT, "Task detail.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val taskId = arguments.stringArg("task_id")
        if (taskId.isBlank()) {
            return ToolResult(false, "", "task_id 必填")
        }
        val task = automationRepository.getSchedule(taskId)
            ?: return ToolResult(false, "", "未找到 task_id=$taskId")
        return ToolResult(
            success = true,
            output = jsonOutput(mapOf("task" to scheduleEntityToLegacyTask(task)))
        )
    }
}

class UpdateScheduledTaskTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "update_scheduled_task",
        description = "Update an existing scheduled task by task_id with partial fields.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "schedule", "cron"),
        riskLevel = ToolRiskLevel.HIGH,
        scopes = listOf(ToolScope.AUTOMATION),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        approvalRequired = true,
        approvalReason = "修改定时任务会改变未来自动执行行为。",
        approvalSummary = "Agent 请求修改定时任务",
        inputSchema = listOf(
            ToolParameterSchema("task_id", ToolValueType.STRING, "Target task ID.", required = true),
            ToolParameterSchema("name", ToolValueType.STRING, "New name.", required = false),
            ToolParameterSchema("description", ToolValueType.STRING, "New description.", required = false),
            ToolParameterSchema("schedule", ToolValueType.OBJECT, "New schedule object.", required = false),
            ToolParameterSchema("prompt", ToolValueType.STRING, "New task prompt.", required = false),
            ToolParameterSchema("expires_at", ToolValueType.STRING, "New expiry date YYYY-MM-DD; empty to clear.", required = false),
            ToolParameterSchema("enabled", ToolValueType.BOOLEAN, "Enable/disable task.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("task", ToolValueType.OBJECT, "Updated task."),
            ToolFieldSchema("warning", ToolValueType.STRING, "Compatibility warning if schedule was adapted.", required = false)
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val taskId = arguments.stringArg("task_id")
        if (taskId.isBlank()) {
            return ToolResult(false, "", "task_id 必填")
        }
        val existing = automationRepository.getSchedule(taskId)
            ?: return ToolResult(false, "", "未找到 task_id=$taskId")

        val parsedSchedule = if (arguments.containsKey("schedule")) {
            val scheduleMap = arguments.mapArg("schedule")
            if (scheduleMap.isEmpty()) {
                return ToolResult(false, "", "schedule 必须是对象")
            }
            parseLegacySchedule(scheduleMap) ?: return ToolResult(false, "", "schedule 格式不合法或当前不支持")
        } else {
            null
        }

        val expiresAtParse = if (arguments.containsKey("expires_at")) {
            parseExpiresAt(arguments["expires_at"]?.toString())
        } else {
            ParsedExpiresAt(value = null, error = null, provided = false)
        }
        if (expiresAtParse.error != null) {
            return ToolResult(false, "", expiresAtParse.error)
        }

        val updated = automationRepository.updateSchedule(
            scheduleId = taskId,
            name = if (arguments.containsKey("name")) arguments.stringArg("name").ifBlank { existing.name } else null,
            taskPrompt = if (arguments.containsKey("prompt")) arguments.stringArg("prompt").ifBlank { existing.taskPrompt } else null,
            description = if (arguments.containsKey("description")) arguments["description"]?.toString()?.trim().orEmpty() else null,
            enabled = if (arguments.containsKey("enabled")) arguments.booleanArg("enabled") else null,
            scheduleType = parsedSchedule?.scheduleType,
            runAt = parsedSchedule?.runAt,
            expiresAt = if (expiresAtParse.provided && expiresAtParse.value != null) expiresAtParse.value else null,
            clearExpiresAt = expiresAtParse.provided && expiresAtParse.value == null,
            intervalMinutes = parsedSchedule?.intervalMinutes,
            hourOfDay = parsedSchedule?.hourOfDay,
            minuteOfHour = parsedSchedule?.minuteOfHour,
            daysOfWeek = parsedSchedule?.daysOfWeek
        )
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "task" to scheduleEntityToLegacyTask(updated),
                    "warning" to parsedSchedule?.warning
                )
            )
        )
    }
}

class DeleteScheduledTaskTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "delete_scheduled_task",
        description = "Delete a scheduled task by task_id.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "schedule", "cron"),
        riskLevel = ToolRiskLevel.HIGH,
        scopes = listOf(ToolScope.AUTOMATION),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        approvalRequired = true,
        approvalReason = "删除定时任务会永久取消未来执行。",
        approvalSummary = "Agent 请求删除定时任务",
        inputSchema = listOf(
            ToolParameterSchema("task_id", ToolValueType.STRING, "Target task ID.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val taskId = arguments.stringArg("task_id")
        if (taskId.isBlank()) {
            return ToolResult(false, "", "task_id 必填")
        }
        val deleted = automationRepository.deleteSchedule(taskId)
        return ToolResult(
            success = deleted,
            output = jsonOutput(mapOf("success" to deleted))
        )
    }
}

class RulesAddTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "rules_add",
        description = "Create a notification-driven automation rule.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "rules", "notification"),
        riskLevel = ToolRiskLevel.HIGH,
        scopes = listOf(ToolScope.AUTOMATION, ToolScope.NOTIFICATION),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        approvalRequired = true,
        approvalReason = "创建规则会让 Agent 在匹配事件发生时自动运行。",
        approvalSummary = "Agent 请求创建自动化规则",
        inputSchema = listOf(
            ToolParameterSchema("name", ToolValueType.STRING, "Rule name.", required = true),
            ToolParameterSchema("task", ToolValueType.STRING, "Goal to run when the rule matches.", required = true),
            ToolParameterSchema("packageName", ToolValueType.STRING, "Optional package filter.", required = false),
            ToolParameterSchema("titleContains", ToolValueType.STRING, "Optional notification title substring.", required = false),
            ToolParameterSchema("textContains", ToolValueType.STRING, "Optional notification text substring.", required = false),
            ToolParameterSchema("executionMode", ToolValueType.STRING, "confirm, auto, or disabled.", required = false, enumValues = listOf("confirm", "auto", "disabled")),
            ToolParameterSchema("cooldownMinutes", ToolValueType.INTEGER, "Optional cooldown between triggers.", required = false),
            ToolParameterSchema("maxTriggersPerHour", ToolValueType.INTEGER, "Optional per-hour trigger limit. 0 means unlimited.", required = false),
            ToolParameterSchema("description", ToolValueType.STRING, "Optional description.", required = false),
            ToolParameterSchema("enabled", ToolValueType.BOOLEAN, "Whether the rule starts enabled.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("ruleId", ToolValueType.STRING, "Created rule ID.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val rule = automationRepository.addRule(
            name = arguments.stringArg("name"),
            taskPrompt = arguments.stringArg("task"),
            description = arguments.stringArg("description"),
            packageName = arguments.stringArg("packageName"),
            titleContains = arguments.stringArg("titleContains"),
            textContains = arguments.stringArg("textContains"),
            executionMode = arguments.stringArg("executionMode", "confirm"),
            cooldownMinutes = arguments.intArg("cooldownMinutes", 0),
            maxTriggersPerHour = arguments.intArg("maxTriggersPerHour", 3),
            enabled = arguments.booleanArg("enabled", true)
        )
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "ruleId" to rule.id,
                    "name" to rule.name,
                    "enabled" to rule.enabled,
                    "triggerType" to rule.triggerType,
                    "executionMode" to rule.executionMode.lowercase(),
                    "maxTriggersPerHour" to rule.maxTriggersPerHour
                )
            )
        )
    }
}

class RulesListTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "rules_list",
        description = "List existing automation rules.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "rules"),
        scopes = listOf(ToolScope.AUTOMATION, ToolScope.NOTIFICATION),
        inputSchema = listOf(
            ToolParameterSchema("enabledOnly", ToolValueType.BOOLEAN, "Only list enabled rules.", required = false),
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum rows to return.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("items", ToolValueType.ARRAY, "Rule list.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val rules = automationRepository.listRules(
            enabledOnly = arguments.booleanArg("enabledOnly", false),
            limit = arguments.intArg("limit", 20)
        )
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "items" to rules.map { rule ->
                        mapOf(
                            "id" to rule.id,
                            "name" to rule.name,
                            "description" to rule.description,
                            "triggerType" to rule.triggerType,
                            "packageName" to rule.packageName,
                            "titleContains" to rule.titleContains,
                            "textContains" to rule.textContains,
                            "executionMode" to rule.executionMode.lowercase(),
                            "cooldownMinutes" to rule.cooldownMinutes,
                            "maxTriggersPerHour" to rule.maxTriggersPerHour,
                            "enabled" to rule.enabled,
                            "lastTriggeredAt" to rule.lastTriggeredAt
                        )
                    }
                )
            )
        )
    }
}

class RulesUpdateTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "rules_update",
        description = "Update an existing automation rule.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "rules"),
        riskLevel = ToolRiskLevel.HIGH,
        scopes = listOf(ToolScope.AUTOMATION, ToolScope.NOTIFICATION),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        approvalRequired = true,
        approvalReason = "修改自动化规则会改变未来自动触发行为。",
        approvalSummary = "Agent 请求修改自动化规则",
        inputSchema = listOf(
            ToolParameterSchema("ruleId", ToolValueType.STRING, "Target rule ID.", required = true),
            ToolParameterSchema("name", ToolValueType.STRING, "Optional new name.", required = false),
            ToolParameterSchema("task", ToolValueType.STRING, "Optional new task prompt.", required = false),
            ToolParameterSchema("description", ToolValueType.STRING, "Optional description.", required = false),
            ToolParameterSchema("packageName", ToolValueType.STRING, "Optional package filter.", required = false),
            ToolParameterSchema("titleContains", ToolValueType.STRING, "Optional title substring.", required = false),
            ToolParameterSchema("textContains", ToolValueType.STRING, "Optional text substring.", required = false),
            ToolParameterSchema("executionMode", ToolValueType.STRING, "Optional mode: confirm/auto/disabled.", required = false, enumValues = listOf("confirm", "auto", "disabled")),
            ToolParameterSchema("cooldownMinutes", ToolValueType.INTEGER, "Optional cooldown.", required = false),
            ToolParameterSchema("maxTriggersPerHour", ToolValueType.INTEGER, "Optional per-hour trigger limit.", required = false),
            ToolParameterSchema("enabled", ToolValueType.BOOLEAN, "Optional enabled flag.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("ruleId", ToolValueType.STRING, "Updated rule ID.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val rule = automationRepository.updateRule(
            ruleId = arguments.stringArg("ruleId"),
            name = arguments["name"]?.toString(),
            taskPrompt = arguments["task"]?.toString(),
            description = arguments["description"]?.toString(),
            packageName = arguments["packageName"]?.toString(),
            titleContains = arguments["titleContains"]?.toString(),
            textContains = arguments["textContains"]?.toString(),
            executionMode = arguments["executionMode"]?.toString(),
            cooldownMinutes = arguments["cooldownMinutes"]?.let { arguments.intArg("cooldownMinutes") },
            maxTriggersPerHour = arguments["maxTriggersPerHour"]?.let { arguments.intArg("maxTriggersPerHour") },
            enabled = arguments["enabled"]?.let { arguments.booleanArg("enabled") }
        )
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "ruleId" to rule.id,
                    "enabled" to rule.enabled,
                    "executionMode" to rule.executionMode.lowercase(),
                    "maxTriggersPerHour" to rule.maxTriggersPerHour,
                    "updatedAt" to rule.updatedAt
                )
            )
        )
    }
}

class RulesDeleteTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "rules_delete",
        description = "Delete an automation rule.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "rules"),
        riskLevel = ToolRiskLevel.HIGH,
        scopes = listOf(ToolScope.AUTOMATION, ToolScope.NOTIFICATION),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        approvalRequired = true,
        approvalReason = "删除自动化规则会永久取消未来自动触发。",
        approvalSummary = "Agent 请求删除自动化规则",
        inputSchema = listOf(
            ToolParameterSchema("ruleId", ToolValueType.STRING, "Target rule ID.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val deleted = automationRepository.deleteRule(arguments.stringArg("ruleId"))
        return ToolResult(
            success = deleted,
            output = jsonOutput(mapOf("success" to deleted))
        )
    }
}

class RulesPreviewTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "rules_preview",
        description = "Preview whether a notification event would match a rule, including cooldown and rate-limit outcome.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "rules", "preview"),
        scopes = listOf(ToolScope.AUTOMATION, ToolScope.NOTIFICATION),
        inputSchema = listOf(
            ToolParameterSchema("ruleId", ToolValueType.STRING, "Existing rule ID. If absent, uses fallback preview parameters.", required = false),
            ToolParameterSchema("packageName", ToolValueType.STRING, "Notification package name.", required = true),
            ToolParameterSchema("title", ToolValueType.STRING, "Notification title.", required = false),
            ToolParameterSchema("text", ToolValueType.STRING, "Notification text.", required = false),
            ToolParameterSchema("executionMode", ToolValueType.STRING, "Fallback preview mode when ruleId is absent.", required = false, enumValues = listOf("confirm", "auto", "disabled")),
            ToolParameterSchema("cooldownMinutes", ToolValueType.INTEGER, "Fallback cooldown when ruleId is absent.", required = false),
            ToolParameterSchema("maxTriggersPerHour", ToolValueType.INTEGER, "Fallback hourly limit when ruleId is absent.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("matches", ToolValueType.BOOLEAN, "Whether the rule would match."),
            ToolFieldSchema("wouldExecute", ToolValueType.BOOLEAN, "Whether the rule would proceed to execution."),
            ToolFieldSchema("decision", ToolValueType.STRING, "Preview decision."),
            ToolFieldSchema("reason", ToolValueType.STRING, "Reason for the preview outcome."),
            ToolFieldSchema("previewSummary", ToolValueType.STRING, "Human-readable preview summary.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val preview = automationRepository.previewRuleMatch(
            ruleId = arguments["ruleId"]?.toString(),
            packageName = arguments.stringArg("packageName"),
            title = arguments.stringArg("title"),
            text = arguments.stringArg("text"),
            fallbackExecutionMode = arguments.stringArg("executionMode", "confirm"),
            fallbackCooldownMinutes = arguments.intArg("cooldownMinutes", 0),
            fallbackMaxTriggersPerHour = arguments.intArg("maxTriggersPerHour", 3)
        )
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "matches" to preview.matches,
                    "wouldExecute" to preview.wouldExecute,
                    "decision" to preview.decision.lowercase(),
                    "reason" to preview.reason,
                    "previewSummary" to preview.previewSummary
                )
            )
        )
    }
}

class RulesRunsTool(
    private val automationRepository: AgentAutomationRepository
) : Tool {
    override val schema = ToolSchema(
        name = "rules_runs",
        description = "Inspect recent execution log for an automation rule.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("automation", "rules", "audit"),
        scopes = listOf(ToolScope.AUTOMATION, ToolScope.NOTIFICATION),
        inputSchema = listOf(
            ToolParameterSchema("ruleId", ToolValueType.STRING, "Target rule ID.", required = true),
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum rows to return.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("items", ToolValueType.ARRAY, "Recent rule runs.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val items = automationRepository.listRuleRuns(
            ruleId = arguments.stringArg("ruleId"),
            limit = arguments.intArg("limit", 10)
        )
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "items" to items.map { run ->
                        mapOf(
                            "id" to run.id,
                            "ruleId" to run.ruleId,
                            "decision" to run.decision.lowercase(),
                            "status" to run.status.lowercase(),
                            "matchedAt" to run.matchedAt,
                            "startedAt" to run.startedAt,
                            "completedAt" to run.completedAt,
                            "eventPackage" to run.eventPackage,
                            "eventTitle" to run.eventTitle,
                            "previewSummary" to run.previewSummary,
                            "traceId" to run.traceId,
                            "errorMessage" to run.errorMessage
                        )
                    }
                )
            )
        )
    }
}

private data class ParsedLegacySchedule(
    val scheduleType: AgentAutomationRepository.ScheduleType,
    val runAt: Long? = null,
    val intervalMinutes: Int? = null,
    val hourOfDay: Int? = null,
    val minuteOfHour: Int? = null,
    val daysOfWeek: List<String> = emptyList(),
    val warning: String? = null
)

private data class ParsedExpiresAt(
    val value: Long?,
    val error: String? = null,
    val provided: Boolean = true
)

private fun parseScheduleType(value: String): AgentAutomationRepository.ScheduleType? {
    return when (value.trim().lowercase()) {
        "once" -> AgentAutomationRepository.ScheduleType.ONCE
        "interval" -> AgentAutomationRepository.ScheduleType.INTERVAL
        "daily" -> AgentAutomationRepository.ScheduleType.DAILY
        "weekly" -> AgentAutomationRepository.ScheduleType.WEEKLY
        else -> null
    }
}

private fun parseLegacySchedule(schedule: Map<String, Any?>): ParsedLegacySchedule? {
    val type = schedule["type"]?.toString()?.trim()?.lowercase().orEmpty()
    return when (type) {
        "at" -> {
            val datetime = schedule["datetime"]?.toString()?.trim().orEmpty()
            val runAt = parseDateTimeMillis(datetime) ?: return null
            ParsedLegacySchedule(
                scheduleType = AgentAutomationRepository.ScheduleType.ONCE,
                runAt = runAt
            )
        }
        "cron" -> parseLegacyCron(schedule["expression"]?.toString()?.trim().orEmpty())
        else -> null
    }
}

private fun parseLegacyCron(expression: String): ParsedLegacySchedule? {
    if (expression.isBlank()) return null
    val isBiweekly = expression.startsWith("BW ", ignoreCase = true)
    val rawExpr = if (isBiweekly) expression.substring(3).trim() else expression.trim()
    val parts = rawExpr.split(Regex("\\s+"))
    if (parts.size != 5) return null

    val minute = parts[0].toIntOrNull()
    val hour = parts[1].toIntOrNull()
    val dayOfMonth = parts[2]
    val month = parts[3]
    val dayOfWeek = parts[4]

    if (parts[1] == "*" && dayOfMonth == "*" && month == "*" && dayOfWeek == "*") {
        val min = minute ?: return null
        val warning = if (min != 0) {
            "当前平台不支持“每小时第 N 分钟”锚点，已按每 60 分钟间隔执行。"
        } else {
            null
        }
        return ParsedLegacySchedule(
            scheduleType = AgentAutomationRepository.ScheduleType.INTERVAL,
            intervalMinutes = 60,
            warning = warning
        )
    }

    if (dayOfMonth == "*" && month == "*" && dayOfWeek == "*") {
        return ParsedLegacySchedule(
            scheduleType = AgentAutomationRepository.ScheduleType.DAILY,
            hourOfDay = hour ?: return null,
            minuteOfHour = minute ?: return null
        )
    }

    if (dayOfMonth == "*" && month == "*" && dayOfWeek != "*") {
        val days = parseCronDays(dayOfWeek) ?: return null
        return ParsedLegacySchedule(
            scheduleType = AgentAutomationRepository.ScheduleType.WEEKLY,
            hourOfDay = hour ?: return null,
            minuteOfHour = minute ?: return null,
            daysOfWeek = days,
            warning = if (isBiweekly) "当前平台暂不支持双周频率，已降级为每周执行。" else null
        )
    }

    // Monthly / yearly cron patterns are intentionally not mapped on Android for now.
    return null
}

private fun parseCronDays(token: String): List<String>? {
    if (token.isBlank()) return null
    return token.split(",")
        .mapNotNull { part ->
            when (part.trim()) {
                "0" -> "SUNDAY"
                "1" -> "MONDAY"
                "2" -> "TUESDAY"
                "3" -> "WEDNESDAY"
                "4" -> "THURSDAY"
                "5" -> "FRIDAY"
                "6" -> "SATURDAY"
                else -> null
            }
        }
        .distinct()
        .takeIf { it.isNotEmpty() }
}

private fun parseExpiresAt(raw: String?): ParsedExpiresAt {
    if (raw == null) return ParsedExpiresAt(value = null, provided = false)
    val value = raw.trim()
    if (value.isEmpty()) return ParsedExpiresAt(value = null)
    val localDate = runCatching { LocalDate.parse(value) }.getOrNull()
        ?: return ParsedExpiresAt(value = null, error = "expires_at 必须是 YYYY-MM-DD")
    val zone = ZoneId.systemDefault()
    return ParsedExpiresAt(value = localDate.atStartOfDay(zone).toInstant().toEpochMilli())
}

private fun parseDateTimeMillis(raw: String): Long? {
    if (raw.isBlank()) return null
    return runCatching { OffsetDateTime.parse(raw).toInstant().toEpochMilli() }.getOrNull()
        ?: runCatching {
            LocalDateTime.parse(raw, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                .atZone(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli()
        }.getOrNull()
}

private fun toIsoDatetime(epochMs: Long?): String? {
    if (epochMs == null) return null
    val local = Instant.ofEpochMilli(epochMs).atZone(ZoneId.systemDefault()).toLocalDateTime()
    return local.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
}

private fun dayNameToCronNumber(day: String): Int? {
    return when (day.trim().uppercase()) {
        "SUNDAY" -> 0
        "MONDAY" -> 1
        "TUESDAY" -> 2
        "WEDNESDAY" -> 3
        "THURSDAY" -> 4
        "FRIDAY" -> 5
        "SATURDAY" -> 6
        else -> null
    }
}

private fun scheduleEntityToLegacyTask(schedule: com.xiaoxiami.app.data.automation.AgentScheduleEntity): Map<String, Any?> {
    val scheduleMap: Map<String, Any?> = when (schedule.scheduleType) {
        AgentAutomationRepository.ScheduleType.ONCE.name -> mapOf(
            "type" to "at",
            "datetime" to (toIsoDatetime(schedule.runAt) ?: "")
        )
        AgentAutomationRepository.ScheduleType.INTERVAL.name -> {
            val interval = schedule.intervalMinutes ?: 60
            val expression = if (interval == 60) "0 * * * *" else "*/$interval * * * *"
            mapOf("type" to "cron", "expression" to expression)
        }
        AgentAutomationRepository.ScheduleType.DAILY.name -> mapOf(
            "type" to "cron",
            "expression" to "${schedule.minuteOfHour ?: 0} ${schedule.hourOfDay ?: 0} * * *"
        )
        AgentAutomationRepository.ScheduleType.WEEKLY.name -> {
            val dayExpr = schedule.daysOfWeek
                .split(",")
                .mapNotNull { dayNameToCronNumber(it) }
                .distinct()
                .joinToString(",")
                .ifBlank { "1" }
            mapOf(
                "type" to "cron",
                "expression" to "${schedule.minuteOfHour ?: 0} ${schedule.hourOfDay ?: 0} * * $dayExpr"
            )
        }
        else -> mapOf("type" to "cron", "expression" to "")
    }
    val expiresAt = schedule.expiresAt?.let {
        Instant.ofEpochMilli(it)
            .atZone(ZoneId.systemDefault())
            .toLocalDate()
            .toString()
    }
    val createdAt = Instant.ofEpochMilli(schedule.createdAt)
        .atZone(ZoneId.systemDefault())
        .toOffsetDateTime()
        .toString()
    val updatedAt = Instant.ofEpochMilli(schedule.updatedAt)
        .atZone(ZoneId.systemDefault())
        .toOffsetDateTime()
        .toString()
    return mapOf(
        "id" to schedule.id,
        "name" to schedule.name,
        "description" to schedule.description,
        "enabled" to schedule.enabled,
        "schedule" to scheduleMap,
        "prompt" to schedule.taskPrompt,
        "expires_at" to expiresAt,
        "state" to mapOf(
            "next_run_at_ms" to schedule.nextRunAt,
            "last_run_at_ms" to schedule.lastRunAt,
            "last_status" to schedule.lastStatus.ifBlank { null },
            "last_error" to schedule.lastError.ifBlank { null },
            "last_duration_ms" to schedule.lastDurationMs,
            "running_at_ms" to null,
            "consecutive_errors" to schedule.consecutiveErrors
        ),
        "created_at" to createdAt,
        "updated_at" to updatedAt
    )
}
