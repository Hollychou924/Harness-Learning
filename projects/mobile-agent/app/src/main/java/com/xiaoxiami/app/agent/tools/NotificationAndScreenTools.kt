package com.xiaoxiami.app.agent.tools

import android.app.usage.UsageStatsManager
import android.content.Context
import android.net.Uri
import android.provider.CallLog
import android.provider.CalendarContract
import android.provider.ContactsContract
import android.provider.MediaStore
import android.provider.Telephony
import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolInteractionKind
import com.xiaoxiami.app.agent.ToolInteractionRequest
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolValueType
import com.xiaoxiami.app.repository.GeminiRepository
import com.xiaoxiami.app.service.AgentNotificationListenerService

class ReadNotificationsTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "read_notifications",
        description = "Read recent active notifications.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("notifications", "read"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        inputSchema = listOf(
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum notifications to return.", required = false),
            ToolParameterSchema("packageNames", ToolValueType.ARRAY, "Optional package name filter.", required = false, itemType = ToolValueType.STRING),
            ToolParameterSchema("sinceMs", ToolValueType.NUMBER, "Optional lower time bound in epoch milliseconds.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("items", ToolValueType.ARRAY, "Recent notification snapshots.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        if (!AgentNotificationListenerService.hasAccess(this.context)) {
            return ToolResult(false, "", "通知访问权限未开启")
        }
        val limit = arguments.intArg("limit", 20).coerceIn(1, 100)
        val packageNames = arguments.stringListArg("packageNames").toSet()
        val sinceMs = arguments.longArg("sinceMs")
        val items = AgentNotificationListenerService.getCachedNotifications(limit, packageNames, sinceMs).map { item ->
            mapOf(
                "key" to item.key,
                "packageName" to item.packageName,
                "title" to item.title,
                "text" to item.text,
                "postTime" to item.postTime,
                "actionsCount" to item.actions.size,
                "actions" to item.actions.map { action ->
                    mapOf(
                        "title" to action.title,
                        "hasRemoteInput" to action.hasRemoteInput
                    )
                }
            )
        }
        return ToolResult(true, jsonOutput(mapOf("items" to items)))
    }
}

class DismissNotificationTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "dismiss_notification",
        description = "Dismiss an active notification by key.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("notifications", "write"),
        riskLevel = ToolRiskLevel.HIGH,
        approvalRequired = true,
        approvalReason = "清除通知会改变系统通知状态。",
        approvalSummary = "Agent 请求清除通知",
        inputSchema = listOf(
            ToolParameterSchema("notificationKey", ToolValueType.STRING, "Notification key returned by read_notifications.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val key = arguments.stringArg("notificationKey")
        if (key.isBlank()) return ToolResult(false, "", "notificationKey 不能为空")
        val success = AgentNotificationListenerService.dismissNotification(key)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "notificationKey" to key)))
    }
}

class ReplyToNotificationTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "reply_to_notification",
        description = "Reply to a notification action that supports remote input.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("notifications", "reply"),
        riskLevel = ToolRiskLevel.HIGH,
        approvalRequired = true,
        approvalReason = "回复通知会直接向外部应用发送内容。",
        approvalSummary = "Agent 请求回复通知",
        inputSchema = listOf(
            ToolParameterSchema("notificationKey", ToolValueType.STRING, "Notification key.", required = true),
            ToolParameterSchema("text", ToolValueType.STRING, "Reply text.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val key = arguments.stringArg("notificationKey")
        val text = arguments.stringArg("text")
        if (key.isBlank() || text.isBlank()) return ToolResult(false, "", "notificationKey/text 不能为空")
        val success = AgentNotificationListenerService.replyToNotification(key, text)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "notificationKey" to key)))
    }
}

class TriggerNotificationActionTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "trigger_notification_action",
        description = "Trigger a notification action button by index.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("notifications", "action"),
        riskLevel = ToolRiskLevel.HIGH,
        approvalRequired = true,
        approvalReason = "触发通知按钮会对外部应用产生动作。",
        approvalSummary = "Agent 请求触发通知动作",
        inputSchema = listOf(
            ToolParameterSchema("notificationKey", ToolValueType.STRING, "Notification key.", required = true),
            ToolParameterSchema("actionIndex", ToolValueType.INTEGER, "Action button index.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val key = arguments.stringArg("notificationKey")
        val actionIndex = arguments.intArg("actionIndex", -1)
        if (key.isBlank() || actionIndex < 0) return ToolResult(false, "", "notificationKey/actionIndex 不合法")
        val success = AgentNotificationListenerService.triggerAction(key, actionIndex)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "notificationKey" to key, "actionIndex" to actionIndex)))
    }
}

class SnoozeNotificationTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "snooze_notification",
        description = "Temporarily snooze an active notification.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("notifications", "snooze"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        inputSchema = listOf(
            ToolParameterSchema("notificationKey", ToolValueType.STRING, "Notification key.", required = true),
            ToolParameterSchema("durationMs", ToolValueType.NUMBER, "Snooze duration in milliseconds.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val key = arguments.stringArg("notificationKey")
        val durationMs = arguments.longArg("durationMs", 60_000L)
        if (key.isBlank()) return ToolResult(false, "", "notificationKey 不能为空")
        val success = AgentNotificationListenerService.snooze(key, durationMs)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "notificationKey" to key, "durationMs" to durationMs)))
    }
}

class MediaSessionListTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "media_session_list",
        description = "List active media sessions exposed through notification access.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("media", "session", "read"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        outputSchema = listOf(
            ToolFieldSchema("sessions", ToolValueType.ARRAY, "Active media sessions.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val sessions = AgentNotificationListenerService.mediaSessions(this.context)
        return ToolResult(true, jsonOutput(mapOf("sessions" to sessions)))
    }
}

class MediaPlayPauseTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "media_play_pause",
        description = "Toggle play/pause on an active media session.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("media", "control"),
        riskLevel = ToolRiskLevel.HIGH,
        approvalRequired = true,
        approvalReason = "媒体控制会改变外部应用播放状态。",
        approvalSummary = "Agent 请求切换媒体播放状态",
        inputSchema = listOf(
            ToolParameterSchema("packageName", ToolValueType.STRING, "Optional target media package.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val success = AgentNotificationListenerService.mediaCommand(this.context, arguments.stringArg("packageName"), "play_pause")
        return ToolResult(success, jsonOutput(mapOf("success" to success)))
    }
}

class MediaNextPreviousTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "media_next_previous",
        description = "Skip to next or previous media item.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("media", "control"),
        riskLevel = ToolRiskLevel.HIGH,
        approvalRequired = true,
        approvalReason = "媒体控制会改变外部应用播放状态。",
        approvalSummary = "Agent 请求切换媒体内容",
        inputSchema = listOf(
            ToolParameterSchema("packageName", ToolValueType.STRING, "Optional target media package.", required = false),
            ToolParameterSchema("action", ToolValueType.STRING, "Either next or previous.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val action = arguments.stringArg("action")
        if (action !in listOf("next", "previous")) return ToolResult(false, "", "action 只能是 next 或 previous")
        val success = AgentNotificationListenerService.mediaCommand(this.context, arguments.stringArg("packageName"), action)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "action" to action)))
    }
}

class CaptureCurrentScreenTool : Tool {
    override val schema = ToolSchema(
        name = "capture_current_screen",
        description = "Ask the user to authorize a one-time screen capture and return the screenshot URI.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("screen_capture", "user_mediated"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        inputSchema = listOf(
            ToolParameterSchema("reason", ToolValueType.STRING, "Reason shown to the user.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("imageUri", ToolValueType.STRING, "Captured screenshot URI."),
            ToolFieldSchema("capturedAt", ToolValueType.NUMBER, "Capture timestamp.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val reason = arguments.stringArg("reason", "请授权截取当前屏幕供 Agent 分析。")
        val result = context.interactionHandler(
            ToolInteractionRequest(
                requestId = "capture_screen_${System.currentTimeMillis()}",
                toolName = name,
                kind = ToolInteractionKind.CAPTURE_SCREEN,
                title = "截取当前屏幕",
                description = reason
            )
        )
        if (!result.success) return ToolResult(false, "", result.error ?: "截屏失败")
        return ToolResult(true, jsonOutput(result.data))
    }
}

class AnalyzeCurrentScreenTool(
    private val geminiRepository: GeminiRepository
) : Tool {
    override val schema = ToolSchema(
        name = "analyze_current_screen",
        description = "Capture the current screen if needed and analyze it for the current goal.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("screen_capture", "vision", "analysis"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        inputSchema = listOf(
            ToolParameterSchema("goal", ToolValueType.STRING, "Specific visual question for the screen.", required = true),
            ToolParameterSchema("focusHint", ToolValueType.STRING, "Optional region or focus hint.", required = false),
            ToolParameterSchema("imageUri", ToolValueType.STRING, "Optional existing screenshot URI.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("summary", ToolValueType.STRING, "Screen analysis summary."),
            ToolFieldSchema("imageUri", ToolValueType.STRING, "Screenshot URI used for analysis.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val goal = arguments.stringArg("goal").ifBlank { context.userGoal }
        val focusHint = arguments.stringArg("focusHint")
        val imageUri = arguments.stringArg("imageUri").takeIf { it.isNotBlank() } ?: run {
            val capture = context.interactionHandler(
                ToolInteractionRequest(
                    requestId = "analyze_screen_${System.currentTimeMillis()}",
                    toolName = name,
                    kind = ToolInteractionKind.CAPTURE_SCREEN,
                    title = "截取当前屏幕",
                    description = "Agent 需要先截屏再分析当前界面。"
                )
            )
            if (!capture.success) {
                return ToolResult(false, "", capture.error ?: "截屏失败")
            }
            capture.data["imageUri"]?.toString().orEmpty()
        }

        if (imageUri.isBlank()) return ToolResult(false, "", "没有可用的截图 URI")

        val prompt = buildString {
            appendLine("请分析当前屏幕截图，并只输出与当前任务直接相关的客观观察。")
            appendLine("当前目标：$goal")
            if (focusHint.isNotBlank()) appendLine("关注重点：$focusHint")
            appendLine("要求：")
            appendLine("1. 不要编造看不到的信息。")
            appendLine("2. 先描述明确可见的文字、状态、页面意图。")
            appendLine("3. 如果信息不足，指出缺失点。")
        }
        return try {
            val result = geminiRepository.generateContentWithImages(
                prompt = prompt,
                imageUris = listOf(Uri.parse(imageUri)),
                conversationHistory = context.conversationHistory,
                modelName = context.modelId,
                enableSearch = false,
                enableThinking = false,
                isConversation = false
            )
            ToolResult(true, jsonOutput(mapOf("summary" to result.trim(), "imageUri" to imageUri)))
        } catch (e: Exception) {
            ToolResult(false, "", e.message ?: "屏幕分析失败")
        }
    }
}

class AppUsageReportTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "app_usage_report",
        description = "Generate app usage statistics for a time range.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("usage_stats", "analysis"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        inputSchema = listOf(
            ToolParameterSchema("fromTime", ToolValueType.NUMBER, "Lower time bound in epoch milliseconds.", required = true),
            ToolParameterSchema("toTime", ToolValueType.NUMBER, "Upper time bound in epoch milliseconds.", required = true),
            ToolParameterSchema("packageNames", ToolValueType.ARRAY, "Optional package filter.", required = false, itemType = ToolValueType.STRING)
        ),
        outputSchema = listOf(
            ToolFieldSchema("apps", ToolValueType.ARRAY, "Usage rows.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val fromTime = arguments.longArg("fromTime")
        val toTime = arguments.longArg("toTime")
        val packageNames = arguments.stringListArg("packageNames").toSet()
        if (fromTime <= 0L || toTime <= 0L || toTime < fromTime) {
            return ToolResult(false, "", "fromTime/toTime 不合法")
        }
        val manager = this.context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            ?: return ToolResult(false, "", "无法获取 UsageStatsManager")
        val stats = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, fromTime, toTime)
            .orEmpty()
            .filter { it.totalTimeInForeground > 0L }
            .filter { packageNames.isEmpty() || packageNames.contains(it.packageName) }
            .sortedByDescending { it.totalTimeInForeground }
            .map { stat ->
                mapOf(
                    "packageName" to stat.packageName,
                    "totalForegroundMs" to stat.totalTimeInForeground,
                    "lastTimeUsed" to stat.lastTimeUsed,
                    "lastTimeVisible" to stat.lastTimeVisible
                )
            }
        return ToolResult(true, jsonOutput(mapOf("apps" to stats)))
    }
}

class SearchGlobalDeviceIndexTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "search_global_device_index",
        description = "Search across contacts, calendar, media, SMS, and call logs with a simple keyword index.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("global_search", "index"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = listOf(
            ToolAccessRequirement(ToolAccessKind.ANDROID_PERMISSION, android.Manifest.permission.READ_CONTACTS, "Read contacts for search.", required = false),
            ToolAccessRequirement(ToolAccessKind.ANDROID_PERMISSION, android.Manifest.permission.READ_CALENDAR, "Read calendar for search.", required = false),
            ToolAccessRequirement(ToolAccessKind.ANDROID_PERMISSION, android.Manifest.permission.READ_SMS, "Read SMS for search.", required = false),
            ToolAccessRequirement(ToolAccessKind.ANDROID_PERMISSION, android.Manifest.permission.READ_CALL_LOG, "Read call log for search.", required = false)
        ),
        inputSchema = listOf(
            ToolParameterSchema("query", ToolValueType.STRING, "Search query.", required = true),
            ToolParameterSchema("scopes", ToolValueType.ARRAY, "Optional scopes: contacts, calendar, media, sms, calls.", required = false, itemType = ToolValueType.STRING)
        ),
        outputSchema = listOf(
            ToolFieldSchema("hits", ToolValueType.ARRAY, "Matched device content hits.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val query = arguments.stringArg("query").trim()
        if (query.isBlank()) return ToolResult(false, "", "query 不能为空")
        val scopes = arguments.stringListArg("scopes").ifEmpty {
            listOf("contacts", "calendar", "media", "sms", "calls")
        }.toSet()
        val hits = mutableListOf<Map<String, Any?>>()

        if ("contacts" in scopes) {
            this.context.contentResolver.query(
                ContactsContract.Data.CONTENT_URI,
                arrayOf(ContactsContract.Data.CONTACT_ID, ContactsContract.Data.DISPLAY_NAME, ContactsContract.Data.DATA1),
                "${ContactsContract.Data.DISPLAY_NAME} LIKE ? OR ${ContactsContract.Data.DATA1} LIKE ?",
                arrayOf("%$query%", "%$query%"),
                "${ContactsContract.Data.DISPLAY_NAME} ASC"
            )?.use { cursor ->
                while (cursor.moveToNext() && hits.size < 10) {
                    hits += mapOf(
                        "scope" to "contacts",
                        "title" to cursor.getString(1).orEmpty(),
                        "snippet" to cursor.getString(2).orEmpty(),
                        "id" to cursor.getLong(0)
                    )
                }
            }
        }

        if ("calendar" in scopes) {
            val now = System.currentTimeMillis()
            val builder = CalendarContract.Instances.CONTENT_URI.buildUpon().apply {
                android.content.ContentUris.appendId(this, now - 30L * 24 * 60 * 60 * 1000)
                android.content.ContentUris.appendId(this, now + 365L * 24 * 60 * 60 * 1000)
            }
            this.context.contentResolver.query(
                builder.build(),
                arrayOf(CalendarContract.Instances.EVENT_ID, CalendarContract.Instances.TITLE, CalendarContract.Instances.DESCRIPTION),
                null,
                null,
                "${CalendarContract.Instances.BEGIN} ASC"
            )?.use { cursor ->
                while (cursor.moveToNext() && hits.size < 20) {
                    val title = cursor.getString(1).orEmpty()
                    val description = cursor.getString(2).orEmpty()
                    if ((title + " " + description).contains(query, ignoreCase = true)) {
                        hits += mapOf(
                            "scope" to "calendar",
                            "title" to title,
                            "snippet" to description.take(120),
                            "id" to cursor.getLong(0)
                        )
                    }
                }
            }
        }

        if ("media" in scopes) {
            listOf(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
            ).forEach { uri ->
                this.context.contentResolver.query(
                    uri,
                    arrayOf(MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.MIME_TYPE),
                    "${MediaStore.MediaColumns.DISPLAY_NAME} LIKE ?",
                    arrayOf("%$query%"),
                    "${MediaStore.MediaColumns.DATE_ADDED} DESC"
                )?.use { cursor ->
                    while (cursor.moveToNext() && hits.size < 30) {
                        hits += mapOf(
                            "scope" to "media",
                            "title" to cursor.getString(1).orEmpty(),
                            "snippet" to cursor.getString(2).orEmpty(),
                            "id" to cursor.getLong(0)
                        )
                    }
                }
            }
        }

        if ("sms" in scopes) {
            this.context.contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                arrayOf(Telephony.Sms.THREAD_ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY),
                "${Telephony.Sms.BODY} LIKE ?",
                arrayOf("%$query%"),
                "${Telephony.Sms.DATE} DESC"
            )?.use { cursor ->
                while (cursor.moveToNext() && hits.size < 40) {
                    hits += mapOf(
                        "scope" to "sms",
                        "title" to cursor.getString(1).orEmpty(),
                        "snippet" to cursor.getString(2).orEmpty().take(120),
                        "id" to cursor.getLong(0)
                    )
                }
            }
        }

        if ("calls" in scopes) {
            this.context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls._ID, CallLog.Calls.NUMBER, CallLog.Calls.CACHED_NAME),
                "${CallLog.Calls.NUMBER} LIKE ? OR ${CallLog.Calls.CACHED_NAME} LIKE ?",
                arrayOf("%$query%", "%$query%"),
                "${CallLog.Calls.DATE} DESC"
            )?.use { cursor ->
                while (cursor.moveToNext() && hits.size < 50) {
                    hits += mapOf(
                        "scope" to "calls",
                        "title" to cursor.getString(2).orEmpty().ifBlank { cursor.getString(1).orEmpty() },
                        "snippet" to cursor.getString(1).orEmpty(),
                        "id" to cursor.getLong(0)
                    )
                }
            }
        }

        return ToolResult(true, jsonOutput(mapOf("hits" to hits.take(50))))
    }
}
