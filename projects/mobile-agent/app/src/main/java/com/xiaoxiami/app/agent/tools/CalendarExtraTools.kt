package com.xiaoxiami.app.agent.tools

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.provider.CalendarContract
import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolApprovalRequirement
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolValueType
import java.util.TimeZone

// ─────────────────────────────────────────────────────────────
//  update_calendar_event — 更新已有日历事件
//  增强：支持部分字段更新（只更新传了的字段）
// ─────────────────────────────────────────────────────────────

class UpdateCalendarEventTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "update_calendar_event",
        description = """Update an existing calendar event by eventId. Only provided fields are updated (partial patch).
Use read_calendar to get the eventId first.""",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("calendar", "pim", "write"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = calendarWriteRequirement() + calendarReadRequirement(),
        approvalRequired = true,
        approvalReason = "修改日程会更改用户日历数据。",
        approvalSummary = "Agent 请求修改日程",
        inputSchema = listOf(
            ToolParameterSchema("eventId", ToolValueType.NUMBER, "ID of the event to update (from read_calendar).", required = true),
            ToolParameterSchema("title", ToolValueType.STRING, "New event title.", required = false),
            ToolParameterSchema("startAt", ToolValueType.NUMBER, "New start timestamp in epoch ms.", required = false),
            ToolParameterSchema("endAt", ToolValueType.NUMBER, "New end timestamp in epoch ms.", required = false),
            ToolParameterSchema("location", ToolValueType.STRING, "New location.", required = false),
            ToolParameterSchema("notes", ToolValueType.STRING, "New description/notes.", required = false),
            ToolParameterSchema("reminderMinutes", ToolValueType.INTEGER, "New reminder minutes before event. Use -1 to remove.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("success", ToolValueType.BOOLEAN, "Whether the update succeeded."),
            ToolFieldSchema("updatedFields", ToolValueType.ARRAY, "List of field names that were updated.")
        )
    )

    override fun getApprovalRequirement(arguments: Map<String, Any?>, context: ToolContext) =
        ToolApprovalRequirement(
            required = true,
            riskLevel = ToolRiskLevel.HIGH,
            reason = "修改日历事件 #${arguments.longArg("eventId")}",
            summary = "更新日程: ${arguments.stringArg("title").ifBlank { "eventId=${arguments.longArg("eventId")}" }}"
        )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val eventId = arguments.longArg("eventId")
        if (eventId <= 0L) return ToolResult(false, "", "eventId 不合法")

        val values = ContentValues()
        val updated = mutableListOf<String>()

        arguments["title"]?.toString()?.takeIf { it.isNotBlank() }?.let {
            values.put(CalendarContract.Events.TITLE, it)
            updated += "title"
        }
        val startAt = arguments.longArg("startAt", -1)
        if (startAt > 0) {
            values.put(CalendarContract.Events.DTSTART, startAt)
            updated += "startAt"
        }
        val endAt = arguments.longArg("endAt", -1)
        if (endAt > 0) {
            values.put(CalendarContract.Events.DTEND, endAt)
            updated += "endAt"
        }
        if (arguments.containsKey("location")) {
            values.put(CalendarContract.Events.EVENT_LOCATION, arguments.stringArg("location"))
            updated += "location"
        }
        if (arguments.containsKey("notes")) {
            values.put(CalendarContract.Events.DESCRIPTION, arguments.stringArg("notes"))
            updated += "notes"
        }

        if (values.size() == 0 && !arguments.containsKey("reminderMinutes")) {
            return ToolResult(false, "", "至少提供一个要更新的字段")
        }

        return try {
            if (values.size() > 0) {
                values.put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
                val uri = Uri.withAppendedPath(CalendarContract.Events.CONTENT_URI, eventId.toString())
                val rows = this.context.contentResolver.update(uri, values, null, null)
                if (rows == 0) return ToolResult(false, "", "未找到事件 #$eventId 或无权限修改")
            }

            // 处理提醒
            val reminderMinutes = arguments.intArg("reminderMinutes", Int.MIN_VALUE)
            if (reminderMinutes != Int.MIN_VALUE) {
                // 先删除旧提醒
                this.context.contentResolver.delete(
                    CalendarContract.Reminders.CONTENT_URI,
                    "${CalendarContract.Reminders.EVENT_ID} = ?",
                    arrayOf(eventId.toString())
                )
                // 重新设置（-1 表示不设提醒）
                if (reminderMinutes >= 0) {
                    val reminderValues = ContentValues().apply {
                        put(CalendarContract.Reminders.EVENT_ID, eventId)
                        put(CalendarContract.Reminders.MINUTES, reminderMinutes)
                        put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT)
                    }
                    this.context.contentResolver.insert(CalendarContract.Reminders.CONTENT_URI, reminderValues)
                }
                updated += "reminder"
            }

            ToolResult(true, jsonOutput(mapOf(
                "success" to true,
                "eventId" to eventId,
                "updatedFields" to updated
            )))
        } catch (e: Exception) {
            ToolResult(false, "", "更新日程失败: ${e.message}")
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  delete_calendar_event — 删除日历事件
//  增强：支持单个和批量删除、需用户确认
// ─────────────────────────────────────────────────────────────

class DeleteCalendarEventTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "delete_calendar_event",
        description = """Delete one or more calendar events by eventId. Requires user approval.
Use read_calendar to get eventIds first.""",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("calendar", "pim", "delete"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = calendarWriteRequirement(),
        approvalRequired = true,
        approvalReason = "删除日程操作不可恢复。",
        approvalSummary = "Agent 请求删除日程",
        inputSchema = listOf(
            ToolParameterSchema("eventIds", ToolValueType.ARRAY, "List of event IDs to delete.", required = true, itemType = ToolValueType.NUMBER)
        ),
        outputSchema = listOf(
            ToolFieldSchema("deletedCount", ToolValueType.INTEGER, "Number of events successfully deleted."),
            ToolFieldSchema("failedCount", ToolValueType.INTEGER, "Number that failed.")
        )
    )

    override fun getApprovalRequirement(arguments: Map<String, Any?>, context: ToolContext): ToolApprovalRequirement {
        val ids = arguments.longListArg("eventIds")
        return ToolApprovalRequirement(
            required = true,
            riskLevel = ToolRiskLevel.HIGH,
            reason = "删除 ${ids.size} 个日历事件",
            summary = "永久删除 ${ids.size} 个日程"
        )
    }

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val eventIds = arguments.longListArg("eventIds")
        if (eventIds.isEmpty()) return ToolResult(false, "", "eventIds 不能为空")

        var deleted = 0
        var failed = 0
        eventIds.forEach { eventId ->
            try {
                val uri = Uri.withAppendedPath(CalendarContract.Events.CONTENT_URI, eventId.toString())
                val rows = this.context.contentResolver.delete(uri, null, null)
                if (rows > 0) deleted++ else failed++
            } catch (_: Exception) {
                failed++
            }
        }
        return ToolResult(true, jsonOutput(mapOf(
            "deletedCount" to deleted,
            "failedCount" to failed,
            "totalRequested" to eventIds.size
        )))
    }
}
