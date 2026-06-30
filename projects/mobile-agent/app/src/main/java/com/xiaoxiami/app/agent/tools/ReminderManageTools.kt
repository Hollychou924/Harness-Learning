package com.xiaoxiami.app.agent.tools

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolValueType
import com.xiaoxiami.app.receiver.LocalReminderReceiver
import org.json.JSONArray
import org.json.JSONObject

/**
 * 提醒持久化存储 — 用 SharedPreferences 保存提醒元信息，
 * 使得 list / cancel 操作成为可能。
 */
private object ReminderStore {
    private const val PREF_NAME = "agent_reminders"
    private const val KEY_LIST = "reminder_list"

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    data class ReminderRecord(
        val id: Int,
        val title: String,
        val body: String,
        val triggerAt: Long,
        val createdAt: Long = System.currentTimeMillis()
    )

    fun save(context: Context, record: ReminderRecord) {
        val list = loadAll(context).toMutableList()
        list.removeAll { it.id == record.id }
        list += record
        persist(context, list)
    }

    fun remove(context: Context, id: Int) {
        val list = loadAll(context).toMutableList()
        list.removeAll { it.id == id }
        persist(context, list)
    }

    fun loadAll(context: Context): List<ReminderRecord> {
        val json = prefs(context).getString(KEY_LIST, "[]") ?: "[]"
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { i ->
                val obj = arr.getJSONObject(i)
                ReminderRecord(
                    id = obj.getInt("id"),
                    title = obj.getString("title"),
                    body = obj.optString("body", ""),
                    triggerAt = obj.getLong("triggerAt"),
                    createdAt = obj.optLong("createdAt", 0)
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun persist(context: Context, list: List<ReminderRecord>) {
        val arr = JSONArray()
        list.forEach { r ->
            arr.put(JSONObject().apply {
                put("id", r.id)
                put("title", r.title)
                put("body", r.body)
                put("triggerAt", r.triggerAt)
                put("createdAt", r.createdAt)
            })
        }
        prefs(context).edit().putString(KEY_LIST, arr.toString()).apply()
    }
}

// ─────────────────────────────────────────────────────────────
//  list_reminders — 查询已创建的提醒
// ─────────────────────────────────────────────────────────────

class ListRemindersTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "list_reminders",
        description = "List all pending local reminders created by this agent.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("reminder", "read"),
        outputSchema = listOf(
            ToolFieldSchema("reminders", ToolValueType.ARRAY, "List of pending reminders with id, title, body, triggerAt."),
            ToolFieldSchema("total", ToolValueType.INTEGER, "Total count of reminders.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val now = System.currentTimeMillis()
        val all = ReminderStore.loadAll(this.context)
        val reminders = all.map { r ->
            mapOf(
                "reminderId" to r.id,
                "title" to r.title,
                "body" to r.body,
                "triggerAt" to r.triggerAt,
                "isPast" to (r.triggerAt < now),
                "createdAt" to r.createdAt
            )
        }
        return ToolResult(true, jsonOutput(mapOf("reminders" to reminders, "total" to reminders.size)))
    }
}

// ─────────────────────────────────────────────────────────────
//  cancel_reminder — 取消/删除提醒
// ─────────────────────────────────────────────────────────────

class CancelReminderTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "cancel_reminder",
        description = """Cancel a pending local reminder by its reminderId.
Use list_reminders to find reminderId first.""",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("reminder", "delete"),
        riskLevel = ToolRiskLevel.HIGH,
        approvalRequired = true,
        approvalReason = "取消提醒将删除已设定的提醒通知。",
        approvalSummary = "Agent 请求取消提醒",
        inputSchema = listOf(
            ToolParameterSchema("reminderId", ToolValueType.INTEGER, "The reminder ID to cancel (from list_reminders or create_local_reminder).", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val reminderId = arguments.intArg("reminderId", -1)
        if (reminderId == -1) return ToolResult(false, "", "reminderId 不能为空")

        return try {
            // 取消 AlarmManager 闹钟
            val alarmManager = this.context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            val intent = Intent(this.context, LocalReminderReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                this.context, reminderId, intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pendingIntent != null) {
                alarmManager?.cancel(pendingIntent)
                pendingIntent.cancel()
            }
            // 从持久化中移除
            ReminderStore.remove(this.context, reminderId)
            ToolResult(true, jsonOutput(mapOf("success" to true, "cancelledId" to reminderId)))
        } catch (e: Exception) {
            ToolResult(false, "", "取消提醒失败: ${e.message}")
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  update_reminder — 修改提醒（取消旧的 + 创建新的）
// ─────────────────────────────────────────────────────────────

class UpdateReminderTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "update_reminder",
        description = """Update a pending reminder's title, body, or trigger time.
Internally cancels the old alarm and creates a new one with the same ID.
Use list_reminders to find reminderId first.""",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("reminder", "update"),
        riskLevel = ToolRiskLevel.HIGH,
        approvalRequired = true,
        approvalReason = "修改提醒会更新已设定的提醒通知。",
        approvalSummary = "Agent 请求修改提醒",
        inputSchema = listOf(
            ToolParameterSchema("reminderId", ToolValueType.INTEGER, "The reminder ID to update.", required = true),
            ToolParameterSchema("title", ToolValueType.STRING, "New reminder title.", required = false),
            ToolParameterSchema("body", ToolValueType.STRING, "New reminder body.", required = false),
            ToolParameterSchema("triggerAt", ToolValueType.NUMBER, "New trigger timestamp in epoch ms.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val reminderId = arguments.intArg("reminderId", -1)
        if (reminderId == -1) return ToolResult(false, "", "reminderId 不能为空")

        val existing = ReminderStore.loadAll(this.context).find { it.id == reminderId }
            ?: return ToolResult(false, "", "未找到提醒 #$reminderId，请先用 list_reminders 查询")

        val newTitle = arguments.stringArg("title").ifBlank { existing.title }
        val newBody = if (arguments.containsKey("body")) arguments.stringArg("body") else existing.body
        val newTrigger = arguments.longArg("triggerAt", existing.triggerAt)

        if (newTrigger <= System.currentTimeMillis()) {
            return ToolResult(false, "", "triggerAt 必须是将来的时间")
        }

        return try {
            // 先取消旧闹钟
            val alarmManager = this.context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                ?: return ToolResult(false, "", "无法获取 AlarmManager")
            val oldIntent = Intent(this.context, LocalReminderReceiver::class.java)
            val oldPending = PendingIntent.getBroadcast(
                this.context, reminderId, oldIntent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            oldPending?.let { alarmManager.cancel(it); it.cancel() }

            // 创建新闹钟
            val newIntent = Intent(this.context, LocalReminderReceiver::class.java).apply {
                putExtra(LocalReminderReceiver.EXTRA_TITLE, newTitle)
                putExtra(LocalReminderReceiver.EXTRA_BODY, newBody)
            }
            val newPending = PendingIntent.getBroadcast(
                this.context, reminderId, newIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && alarmManager.canScheduleExactAlarms()) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, newTrigger, newPending)
            } else {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, newTrigger, newPending)
            }

            // 更新持久化
            ReminderStore.save(this.context, ReminderStore.ReminderRecord(
                id = reminderId,
                title = newTitle,
                body = newBody,
                triggerAt = newTrigger,
                createdAt = existing.createdAt
            ))

            ToolResult(true, jsonOutput(mapOf(
                "success" to true,
                "reminderId" to reminderId,
                "title" to newTitle,
                "triggerAt" to newTrigger
            )))
        } catch (e: Exception) {
            ToolResult(false, "", "修改提醒失败: ${e.message}")
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  create_local_reminder — 创建提醒（已加入持久化）
// ─────────────────────────────────────────────────────────────

class CreateLocalReminderTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "create_local_reminder",
        description = "Schedule a local reminder notification inside this app.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("reminder", "notification"),
        riskLevel = ToolRiskLevel.HIGH,
        approvalRequired = true,
        approvalReason = "创建提醒会在未来触发本地通知。",
        approvalSummary = "Agent 请求创建本地提醒",
        inputSchema = listOf(
            ToolParameterSchema("title", ToolValueType.STRING, "Reminder title.", required = true),
            ToolParameterSchema("triggerAt", ToolValueType.NUMBER, "Trigger timestamp in epoch milliseconds.", required = true),
            ToolParameterSchema("body", ToolValueType.STRING, "Optional reminder body.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val title = arguments.stringArg("title")
        val triggerAt = arguments.longArg("triggerAt")
        if (title.isBlank() || triggerAt <= System.currentTimeMillis()) {
            return ToolResult(false, "", "title 不能为空，且 triggerAt 必须是将来的时间")
        }
        val body = arguments.stringArg("body")
        val alarmManager = this.context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            ?: return ToolResult(false, "", "无法获取 AlarmManager")
        val intent = Intent(this.context, LocalReminderReceiver::class.java).apply {
            putExtra(LocalReminderReceiver.EXTRA_TITLE, title)
            putExtra(LocalReminderReceiver.EXTRA_BODY, body)
        }
        val requestCode = (title + triggerAt).hashCode()
        val pendingIntent = PendingIntent.getBroadcast(
            this.context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && alarmManager.canScheduleExactAlarms()) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
        } else {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
        }

        // 保存到持久化存储
        ReminderStore.save(this.context, ReminderStore.ReminderRecord(
            id = requestCode,
            title = title,
            body = body,
            triggerAt = triggerAt
        ))

        return ToolResult(true, jsonOutput(mapOf("success" to true, "reminderId" to requestCode, "scheduledAt" to triggerAt)))
    }
}

