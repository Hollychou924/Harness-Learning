package com.xiaoxiami.app.agent.tools

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.CallLog
import android.provider.Telephony
import android.telephony.SmsManager
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

internal fun smsReadRequirement() = listOf(
    ToolAccessRequirement(
        kind = ToolAccessKind.ANDROID_PERMISSION,
        identifier = android.Manifest.permission.READ_SMS,
        description = "Read SMS history."
    )
)

internal fun smsSendRequirement() = listOf(
    ToolAccessRequirement(
        kind = ToolAccessKind.ANDROID_PERMISSION,
        identifier = android.Manifest.permission.SEND_SMS,
        description = "Send SMS messages."
    )
)

internal fun callReadRequirement() = listOf(
    ToolAccessRequirement(
        kind = ToolAccessKind.ANDROID_PERMISSION,
        identifier = android.Manifest.permission.READ_CALL_LOG,
        description = "Read phone call history."
    )
)

internal fun callWriteRequirement() = listOf(
    ToolAccessRequirement(
        kind = ToolAccessKind.ANDROID_PERMISSION,
        identifier = android.Manifest.permission.CALL_PHONE,
        description = "Place a phone call."
    )
)

class DraftSmsTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "draft_sms",
        description = "Open the SMS app with a drafted message.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("sms", "draft"),
        inputSchema = listOf(
            ToolParameterSchema("to", ToolValueType.STRING, "Recipient phone number.", required = true),
            ToolParameterSchema("body", ToolValueType.STRING, "SMS body.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val to = arguments.stringArg("to")
        val body = arguments.stringArg("body")
        if (to.isBlank() || body.isBlank()) return ToolResult(false, "", "to/body 不能为空")
        val intent = Intent(Intent.ACTION_SENDTO).apply {
            data = Uri.parse("smsto:$to")
            putExtra("sms_body", body)
        }
        val success = launchIntent(this.context, intent)
        return ToolResult(success, jsonOutput(mapOf("intentReady" to success, "to" to to)))
    }
}

class SendSmsConfirmedTool : Tool {
    override val schema = ToolSchema(
        name = "send_sms_confirmed",
        description = "Send an SMS directly after approval.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("sms", "send"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = smsSendRequirement(),
        approvalRequired = true,
        approvalReason = "发送短信会直接对外发送内容。",
        approvalSummary = "Agent 请求直接发送短信",
        inputSchema = listOf(
            ToolParameterSchema("to", ToolValueType.STRING, "Recipient phone number.", required = true),
            ToolParameterSchema("body", ToolValueType.STRING, "SMS body.", required = true),
            ToolParameterSchema("simSlot", ToolValueType.INTEGER, "Optional SIM slot index. Currently ignored on most devices.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("success", ToolValueType.BOOLEAN, "Whether sending was triggered."),
            ToolFieldSchema("sentAt", ToolValueType.NUMBER, "Local trigger timestamp.")
        )
    )

    @Suppress("DEPRECATION")
    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val to = arguments.stringArg("to")
        val body = arguments.stringArg("body")
        if (to.isBlank() || body.isBlank()) return ToolResult(false, "", "to/body 不能为空")
        val smsManager = SmsManager.getDefault()
        return runCatching {
            smsManager.sendTextMessage(to, null, body, null, null)
            ToolResult(true, jsonOutput(mapOf("success" to true, "to" to to, "sentAt" to System.currentTimeMillis())))
        }.getOrElse { error ->
            ToolResult(false, "", error.message ?: "发送短信失败")
        }
    }
}

class ReadSmsThreadsTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "read_sms_threads",
        description = "Read recent SMS threads aggregated by address or thread id.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("sms", "history", "read"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = smsReadRequirement(),
        inputSchema = listOf(
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum threads to return.", required = false),
            ToolParameterSchema("address", ToolValueType.STRING, "Optional address filter.", required = false),
            ToolParameterSchema("sinceMs", ToolValueType.NUMBER, "Optional lower time bound.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("threads", ToolValueType.ARRAY, "SMS thread summaries.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val limit = arguments.intArg("limit", 20).coerceIn(1, 100)
        val addressFilter = arguments.stringArg("address")
        val sinceMs = arguments.longArg("sinceMs")
        val threads = linkedMapOf<String, MutableMap<String, Any?>>()
        this.context.contentResolver.query(
            Telephony.Sms.CONTENT_URI,
            arrayOf(
                Telephony.Sms.THREAD_ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE
            ),
            null,
            null,
            "${Telephony.Sms.DATE} DESC"
        )?.use { cursor ->
            while (cursor.moveToNext() && threads.size < limit) {
                val threadId = cursor.getLong(0).toString()
                val address = cursor.getString(1).orEmpty()
                val body = cursor.getString(2).orEmpty()
                val date = cursor.getLong(3)
                if (sinceMs > 0 && date < sinceMs) continue
                if (addressFilter.isNotBlank() && !address.contains(addressFilter)) continue
                if (!threads.containsKey(threadId)) {
                    threads[threadId] = linkedMapOf(
                        "threadId" to threadId,
                        "address" to address,
                        "snippet" to body.take(80),
                        "lastTimestamp" to date
                    )
                }
            }
        }
        return ToolResult(true, jsonOutput(mapOf("threads" to threads.values.toList())))
    }
}

class ReadSmsMessagesTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "read_sms_messages",
        description = "Read SMS messages by thread id or address.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("sms", "history", "read"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = smsReadRequirement(),
        inputSchema = listOf(
            ToolParameterSchema("threadId", ToolValueType.STRING, "Optional SMS thread id.", required = false),
            ToolParameterSchema("address", ToolValueType.STRING, "Optional phone number.", required = false),
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum messages to return.", required = false),
            ToolParameterSchema("sinceMs", ToolValueType.NUMBER, "Optional lower time bound.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("messages", ToolValueType.ARRAY, "SMS messages.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val threadId = arguments.stringArg("threadId")
        val address = arguments.stringArg("address")
        val limit = arguments.intArg("limit", 50).coerceIn(1, 200)
        val sinceMs = arguments.longArg("sinceMs")
        if (threadId.isBlank() && address.isBlank() && sinceMs <= 0L) {
            return ToolResult(false, "", "需提供 threadId、address 或 sinceMs 中至少一个过滤条件")
        }
        val selectionParts = mutableListOf<String>()
        val selectionArgs = mutableListOf<String>()
        if (threadId.isNotBlank()) {
            selectionParts += "${Telephony.Sms.THREAD_ID} = ?"
            selectionArgs += threadId
        }
        if (address.isNotBlank()) {
            selectionParts += "${Telephony.Sms.ADDRESS} = ?"
            selectionArgs += address
        }
        if (sinceMs > 0L) {
            selectionParts += "${Telephony.Sms.DATE} >= ?"
            selectionArgs += sinceMs.toString()
        }
        val messages = mutableListOf<Map<String, Any?>>()
        this.context.contentResolver.query(
            Telephony.Sms.CONTENT_URI,
            arrayOf(
                Telephony.Sms._ID,
                Telephony.Sms.THREAD_ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.TYPE,
                Telephony.Sms.DATE
            ),
            selectionParts.joinToString(" AND ").ifBlank { null },
            selectionArgs.toTypedArray().takeIf { it.isNotEmpty() },
            "${Telephony.Sms.DATE} DESC"
        )?.use { cursor ->
            while (cursor.moveToNext() && messages.size < limit) {
                messages += mapOf(
                    "id" to cursor.getLong(0),
                    "threadId" to cursor.getLong(1),
                    "address" to cursor.getString(2).orEmpty(),
                    "body" to cursor.getString(3).orEmpty(),
                    "type" to cursor.getInt(4),
                    "timestamp" to cursor.getLong(5)
                )
            }
        }
        return ToolResult(true, jsonOutput(mapOf("messages" to messages)))
    }
}

class DialNumberTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "dial_number",
        description = "Open the phone dialer with a number filled in.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("phone", "dial"),
        inputSchema = listOf(
            ToolParameterSchema("number", ToolValueType.STRING, "Phone number to dial.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val number = arguments.stringArg("number")
        if (number.isBlank()) return ToolResult(false, "", "number 不能为空")
        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number"))
        val success = launchIntent(this.context, intent)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "number" to number)))
    }
}

class PlaceCallConfirmedTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "place_call_confirmed",
        description = "Place a phone call directly after approval.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("phone", "call"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = callWriteRequirement(),
        approvalRequired = true,
        approvalReason = "直接拨号会触发外呼。",
        approvalSummary = "Agent 请求直接拨打电话",
        inputSchema = listOf(
            ToolParameterSchema("number", ToolValueType.STRING, "Phone number to call.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val number = arguments.stringArg("number")
        if (number.isBlank()) return ToolResult(false, "", "number 不能为空")
        val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:$number"))
        val success = launchIntent(this.context, intent)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "number" to number, "startedAt" to System.currentTimeMillis())))
    }
}

class ReadCallLogTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "read_call_log",
        description = "Read recent phone call history.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("phone", "history", "read"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = callReadRequirement(),
        inputSchema = listOf(
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum calls to return.", required = false),
            ToolParameterSchema("number", ToolValueType.STRING, "Optional phone number filter.", required = false),
            ToolParameterSchema("sinceMs", ToolValueType.NUMBER, "Optional lower time bound.", required = false),
            ToolParameterSchema("type", ToolValueType.STRING, "Optional type filter: incoming/outgoing/missed.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("calls", ToolValueType.ARRAY, "Call history entries.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val limit = arguments.intArg("limit", 30).coerceIn(1, 200)
        val numberFilter = arguments.stringArg("number")
        val sinceMs = arguments.longArg("sinceMs")
        val typeFilter = arguments.stringArg("type").lowercase()
        val calls = mutableListOf<Map<String, Any?>>()
        this.context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            arrayOf(
                CallLog.Calls._ID,
                CallLog.Calls.NUMBER,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.TYPE,
                CallLog.Calls.DURATION,
                CallLog.Calls.DATE
            ),
            null,
            null,
            "${CallLog.Calls.DATE} DESC"
        )?.use { cursor ->
            while (cursor.moveToNext() && calls.size < limit) {
                val number = cursor.getString(1).orEmpty()
                val type = cursor.getInt(3)
                val date = cursor.getLong(5)
                if (numberFilter.isNotBlank() && !number.contains(numberFilter)) continue
                if (sinceMs > 0 && date < sinceMs) continue
                if (typeFilter.isNotBlank() && callTypeName(type) != typeFilter) continue
                calls += mapOf(
                    "id" to cursor.getLong(0),
                    "number" to number,
                    "name" to cursor.getString(2).orEmpty(),
                    "type" to callTypeName(type),
                    "duration" to cursor.getLong(4),
                    "date" to date
                )
            }
        }
        return ToolResult(true, jsonOutput(mapOf("calls" to calls)))
    }

    private fun callTypeName(type: Int): String {
        return when (type) {
            CallLog.Calls.INCOMING_TYPE -> "incoming"
            CallLog.Calls.OUTGOING_TYPE -> "outgoing"
            CallLog.Calls.MISSED_TYPE -> "missed"
            CallLog.Calls.REJECTED_TYPE -> "rejected"
            CallLog.Calls.BLOCKED_TYPE -> "blocked"
            else -> "other"
        }
    }
}

class BulkSmsSendConfirmedTool : Tool {
    override val schema = ToolSchema(
        name = "bulk_sms_send_confirmed",
        description = "Send multiple SMS messages after approval.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("sms", "bulk_send"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = smsSendRequirement(),
        approvalRequired = true,
        approvalReason = "批量短信会直接对外发送多条消息。",
        approvalSummary = "Agent 请求批量发送短信",
        inputSchema = listOf(
            ToolParameterSchema("messages", ToolValueType.ARRAY, "Message list with to/body.", required = true, itemType = ToolValueType.OBJECT)
        ),
        outputSchema = listOf(
            ToolFieldSchema("sentCount", ToolValueType.INTEGER, "Successfully triggered sends."),
            ToolFieldSchema("failedCount", ToolValueType.INTEGER, "Failed sends.")
        )
    )

    @Suppress("DEPRECATION")
    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val messages = arguments.mapListArg("messages")
        if (messages.isEmpty()) return ToolResult(false, "", "messages 不能为空")
        val smsManager = SmsManager.getDefault()
        var sent = 0
        var failed = 0
        messages.forEach { message ->
            val to = message["to"]?.toString().orEmpty()
            val body = message["body"]?.toString().orEmpty()
            if (to.isBlank() || body.isBlank()) {
                failed++
                return@forEach
            }
            runCatching {
                smsManager.sendTextMessage(to, null, body, null, null)
            }.onSuccess {
                sent++
            }.onFailure {
                failed++
            }
        }
        return ToolResult(true, jsonOutput(mapOf("sentCount" to sent, "failedCount" to failed)))
    }
}

class SmsHistoryAnalysisTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "sms_history_analysis",
        description = "Analyze SMS history over a time range.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("sms", "analysis"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = smsReadRequirement(),
        inputSchema = listOf(
            ToolParameterSchema("fromTime", ToolValueType.NUMBER, "Lower time bound in epoch milliseconds.", required = true),
            ToolParameterSchema("toTime", ToolValueType.NUMBER, "Upper time bound in epoch milliseconds.", required = true),
            ToolParameterSchema("address", ToolValueType.STRING, "Optional phone number filter.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("summary", ToolValueType.OBJECT, "Aggregated SMS history summary.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val fromTime = arguments.longArg("fromTime")
        val toTime = arguments.longArg("toTime")
        val addressFilter = arguments.stringArg("address")
        val byAddress = linkedMapOf<String, Int>()
        var inbound = 0
        var outbound = 0
        this.context.contentResolver.query(
            Telephony.Sms.CONTENT_URI,
            arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.TYPE, Telephony.Sms.DATE),
            "${Telephony.Sms.DATE} >= ? AND ${Telephony.Sms.DATE} <= ?",
            arrayOf(fromTime.toString(), toTime.toString()),
            "${Telephony.Sms.DATE} DESC"
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val address = cursor.getString(0).orEmpty()
                val type = cursor.getInt(1)
                if (addressFilter.isNotBlank() && address != addressFilter) continue
                byAddress[address] = (byAddress[address] ?: 0) + 1
                if (type == Telephony.Sms.MESSAGE_TYPE_INBOX) inbound++ else if (type == Telephony.Sms.MESSAGE_TYPE_SENT) outbound++
            }
        }
        val topThreads = byAddress.entries.sortedByDescending { it.value }.take(10).map {
            mapOf("address" to it.key, "count" to it.value)
        }
        return ToolResult(
            true,
            jsonOutput(
                mapOf(
                    "summary" to mapOf(
                        "totalMessages" to (inbound + outbound),
                        "inbound" to inbound,
                        "outbound" to outbound,
                        "topThreads" to topThreads
                    )
                )
            )
        )
    }
}

class CallHistoryAnalysisTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "call_history_analysis",
        description = "Analyze call history over a time range.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("phone", "analysis"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = callReadRequirement(),
        inputSchema = listOf(
            ToolParameterSchema("fromTime", ToolValueType.NUMBER, "Lower time bound in epoch milliseconds.", required = true),
            ToolParameterSchema("toTime", ToolValueType.NUMBER, "Upper time bound in epoch milliseconds.", required = true),
            ToolParameterSchema("number", ToolValueType.STRING, "Optional phone number filter.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("summary", ToolValueType.OBJECT, "Aggregated call history summary.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val fromTime = arguments.longArg("fromTime")
        val toTime = arguments.longArg("toTime")
        val numberFilter = arguments.stringArg("number")
        var totalDuration = 0L
        val byType = linkedMapOf<String, Int>()
        val topContacts = linkedMapOf<String, Int>()
        this.context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.CACHED_NAME, CallLog.Calls.TYPE, CallLog.Calls.DURATION, CallLog.Calls.DATE),
            "${CallLog.Calls.DATE} >= ? AND ${CallLog.Calls.DATE} <= ?",
            arrayOf(fromTime.toString(), toTime.toString()),
            "${CallLog.Calls.DATE} DESC"
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val number = cursor.getString(0).orEmpty()
                if (numberFilter.isNotBlank() && number != numberFilter) continue
                val name = cursor.getString(1).orEmpty().ifBlank { number }
                val typeName = when (cursor.getInt(2)) {
                    CallLog.Calls.INCOMING_TYPE -> "incoming"
                    CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                    CallLog.Calls.MISSED_TYPE -> "missed"
                    else -> "other"
                }
                totalDuration += cursor.getLong(3)
                byType[typeName] = (byType[typeName] ?: 0) + 1
                topContacts[name] = (topContacts[name] ?: 0) + 1
            }
        }
        return ToolResult(
            true,
            jsonOutput(
                mapOf(
                    "summary" to mapOf(
                        "totalCalls" to byType.values.sum(),
                        "totalDurationSec" to totalDuration,
                        "byType" to byType,
                        "topContacts" to topContacts.entries.sortedByDescending { it.value }.take(10).map {
                            mapOf("name" to it.key, "count" to it.value)
                        }
                    )
                )
            )
        )
    }
}

// ─────────────────────────────────────────────────────────────
//  delete_sms_confirmed — 删除短信
//  支持按 ID 列表删除，或按号码+时间范围批量删除
// ─────────────────────────────────────────────────────────────

class DeleteSmsConfirmedTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "delete_sms_confirmed",
        description = """Delete SMS messages after user approval.
Provide either messageIds (from read_sms_messages) or address+timeRange to select messages.
Use read_sms_messages first to find the messages you want to delete.""",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("sms", "delete"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = smsReadRequirement(),
        approvalRequired = true,
        approvalReason = "删除短信不可恢复。",
        approvalSummary = "Agent 请求删除短信",
        inputSchema = listOf(
            ToolParameterSchema("messageIds", ToolValueType.ARRAY, "List of message IDs to delete (from read_sms_messages).", required = false, itemType = ToolValueType.NUMBER),
            ToolParameterSchema("address", ToolValueType.STRING, "Delete all messages with this phone number.", required = false),
            ToolParameterSchema("beforeMs", ToolValueType.NUMBER, "Delete messages before this timestamp (epoch ms). Use with address.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("deletedCount", ToolValueType.INTEGER, "Number of messages deleted."),
            ToolFieldSchema("success", ToolValueType.BOOLEAN, "Whether the operation succeeded.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val messageIds = arguments.longListArg("messageIds")
        val address = arguments.stringArg("address")
        val beforeMs = arguments.longArg("beforeMs")

        if (messageIds.isEmpty() && address.isBlank()) {
            return ToolResult(false, "", "需提供 messageIds 或 address")
        }

        return try {
            var deleted = 0
            if (messageIds.isNotEmpty()) {
                // 按 ID 逐条删除
                messageIds.forEach { id ->
                    val rows = this.context.contentResolver.delete(
                        Telephony.Sms.CONTENT_URI,
                        "${Telephony.Sms._ID} = ?",
                        arrayOf(id.toString())
                    )
                    deleted += rows
                }
            } else {
                // 按号码（+可选时间范围）批量删除
                val selection = buildString {
                    append("${Telephony.Sms.ADDRESS} = ?")
                    if (beforeMs > 0) append(" AND ${Telephony.Sms.DATE} <= ?")
                }
                val args = mutableListOf(address)
                if (beforeMs > 0) args += beforeMs.toString()

                deleted = this.context.contentResolver.delete(
                    Telephony.Sms.CONTENT_URI,
                    selection,
                    args.toTypedArray()
                )
            }
            ToolResult(true, jsonOutput(mapOf("success" to true, "deletedCount" to deleted)))
        } catch (e: Exception) {
            ToolResult(false, "", "删除短信失败: ${e.message}")
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  delete_call_log_confirmed — 删除通话记录
//  支持按 ID 列表，或按号码+时间范围批量删除
// ─────────────────────────────────────────────────────────────

class DeleteCallLogConfirmedTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "delete_call_log_confirmed",
        description = """Delete call log entries after user approval.
Provide either callIds (from read_call_log) or number+timeRange to select entries.
Use read_call_log first to find the entries you want to delete.""",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("phone", "delete"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = callReadRequirement() + listOf(
            ToolAccessRequirement(ToolAccessKind.ANDROID_PERMISSION, android.Manifest.permission.WRITE_CALL_LOG, "Delete call log entries.")
        ),
        approvalRequired = true,
        approvalReason = "删除通话记录不可恢复。",
        approvalSummary = "Agent 请求删除通话记录",
        inputSchema = listOf(
            ToolParameterSchema("callIds", ToolValueType.ARRAY, "List of call log entry IDs to delete (from read_call_log).", required = false, itemType = ToolValueType.NUMBER),
            ToolParameterSchema("number", ToolValueType.STRING, "Delete all entries with this phone number.", required = false),
            ToolParameterSchema("beforeMs", ToolValueType.NUMBER, "Delete entries before this timestamp (epoch ms). Use with number.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("deletedCount", ToolValueType.INTEGER, "Number of entries deleted."),
            ToolFieldSchema("success", ToolValueType.BOOLEAN, "Whether the operation succeeded.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val callIds = arguments.longListArg("callIds")
        val number = arguments.stringArg("number")
        val beforeMs = arguments.longArg("beforeMs")

        if (callIds.isEmpty() && number.isBlank()) {
            return ToolResult(false, "", "需提供 callIds 或 number")
        }

        return try {
            var deleted = 0
            if (callIds.isNotEmpty()) {
                callIds.forEach { id ->
                    val rows = this.context.contentResolver.delete(
                        CallLog.Calls.CONTENT_URI,
                        "${CallLog.Calls._ID} = ?",
                        arrayOf(id.toString())
                    )
                    deleted += rows
                }
            } else {
                val selection = buildString {
                    append("${CallLog.Calls.NUMBER} = ?")
                    if (beforeMs > 0) append(" AND ${CallLog.Calls.DATE} <= ?")
                }
                val args = mutableListOf(number)
                if (beforeMs > 0) args += beforeMs.toString()

                deleted = this.context.contentResolver.delete(
                    CallLog.Calls.CONTENT_URI,
                    selection,
                    args.toTypedArray()
                )
            }
            ToolResult(true, jsonOutput(mapOf("success" to true, "deletedCount" to deleted)))
        } catch (e: Exception) {
            ToolResult(false, "", "删除通话记录失败: ${e.message}")
        }
    }
}

