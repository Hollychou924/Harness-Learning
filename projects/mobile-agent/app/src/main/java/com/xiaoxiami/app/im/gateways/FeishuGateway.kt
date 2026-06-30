package com.xiaoxiami.app.im.gateways

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.xiaoxiami.app.im.*
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * Feishu (Lark) gateway using REST API + Event Subscription (long polling).
 * Uses OkHttp directly (no Lark SDK to avoid dependency size on Android).
 * Ported from desktop-claw's feishuGateway.ts.
 *
 * For production use, consider adding the official Lark Java SDK:
 * implementation("com.larksuite.oapi:oapi-sdk:2.4.0")
 */
class FeishuGateway : IMGateway {
    override val platform = IMPlatform.FEISHU

    companion object {
        private const val TAG = "FeishuGateway"
        private const val BASE_URL = "https://open.feishu.cn/open-apis"
    }

    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private var appId = ""
    private var appSecret = ""
    private var tenantAccessToken = ""
    private var tokenExpiresAt = 0L
    private var callback: IMMessageCallback? = null
    private var pollingJob: Job? = null

    private var _status = GatewayStatus(platform = IMPlatform.FEISHU)
    private val processedMessages = mutableSetOf<String>()

    override suspend fun start(config: IMChannelConfig) {
        appId = config.getCredential("app_id")
        appSecret = config.getCredential("app_secret")
        require(appId.isNotBlank()) { "Feishu app_id is required" }
        require(appSecret.isNotBlank()) { "Feishu app_secret is required" }

        // Get tenant access token
        refreshToken()

        // Get bot info
        val botInfo = getBotInfo()
        val botName = botInfo?.get("app_name")?.asString ?: "Feishu Bot"

        _status = GatewayStatus(
            platform = IMPlatform.FEISHU,
            connected = true,
            botName = botName,
            botId = appId,
            connectedAt = System.currentTimeMillis()
        )

        // Note: In production, Feishu events come via webhook (HTTP callback).
        // On Android (no public IP), we use periodic message polling as fallback.
        // For real-time messaging, configure webhook to a cloud relay service.
        pollingJob = CoroutineScope(Dispatchers.IO).launch {
            while (isActive) {
                try {
                    // Feishu doesn't have a simple getUpdates API like Telegram.
                    // This is a placeholder for webhook-based or WebSocket event subscription.
                    // In practice, you'd set up a webhook endpoint on a server that
                    // forwards events to the Android device via Firebase Cloud Messaging
                    // or a WebSocket relay.
                    delay(30_000) // Check for new messages periodically
                } catch (e: CancellationException) {
                    break
                } catch (e: Exception) {
                    Log.e(TAG, "Polling error", e)
                    delay(10_000)
                }
            }
        }

        Log.i(TAG, "Feishu gateway started: $botName")
    }

    override suspend fun stop() {
        pollingJob?.cancel()
        pollingJob = null
        _status = _status.copy(connected = false)
        Log.i(TAG, "Feishu gateway stopped")
    }

    override fun isConnected(): Boolean = _status.connected

    override fun getStatus(): GatewayStatus = _status

    override fun setMessageCallback(callback: IMMessageCallback) {
        this.callback = callback
    }

    override suspend fun testConnection(config: IMChannelConfig): IMGateway.TestResult {
        return try {
            val id = config.getCredential("app_id")
            val secret = config.getCredential("app_secret")
            if (id.isBlank() || secret.isBlank()) {
                return IMGateway.TestResult(false, message = "App ID and Secret are required")
            }

            val token = fetchToken(id, secret)
            if (token != null) {
                val botInfo = fetchBotInfo(token)
                val name = botInfo?.get("app_name")?.asString ?: "Bot"
                IMGateway.TestResult(true, botName = name, message = "Connected as $name")
            } else {
                IMGateway.TestResult(false, message = "Invalid credentials")
            }
        } catch (e: Exception) {
            IMGateway.TestResult(false, message = "Connection failed: ${e.message}")
        }
    }

    /** Handle an incoming event from Feishu webhook (called by relay service). */
    suspend fun handleEvent(eventJson: String) {
        try {
            val event = gson.fromJson(eventJson, JsonObject::class.java)
            val header = event.getAsJsonObject("header") ?: return
            val eventType = header.get("event_type")?.asString ?: return

            if (eventType != "im.message.receive_v1") return

            val eventData = event.getAsJsonObject("event") ?: return
            val message = eventData.getAsJsonObject("message") ?: return
            val sender = eventData.getAsJsonObject("sender") ?: return

            val messageId = message.get("message_id")?.asString ?: return
            if (messageId in processedMessages) return
            processedMessages.add(messageId)
            if (processedMessages.size > 1000) {
                processedMessages.clear()
            }

            val senderId = sender.getAsJsonObject("sender_id")
                ?.get("open_id")?.asString ?: ""
            val chatId = message.get("chat_id")?.asString ?: ""
            val chatType = when (message.get("chat_type")?.asString) {
                "p2p" -> IMMessage.ChatType.PRIVATE
                else -> IMMessage.ChatType.GROUP
            }

            // Parse message content
            val contentStr = message.get("content")?.asString ?: ""
            val content = try {
                val contentJson = gson.fromJson(contentStr, JsonObject::class.java)
                contentJson.get("text")?.asString ?: contentStr
            } catch (_: Exception) {
                contentStr
            }

            val imMessage = IMMessage(
                id = messageId,
                platform = IMPlatform.FEISHU,
                senderId = senderId,
                senderName = "", // Would need user API to get name
                content = content,
                chatId = chatId,
                chatType = chatType,
                rawData = eventJson
            )

            _status = _status.copy(lastMessageAt = System.currentTimeMillis())

            val replyFn: ReplyFn = { replyText, _ ->
                sendReply(messageId, replyText)
            }

            callback?.invoke(imMessage, replyFn)
        } catch (e: Exception) {
            Log.e(TAG, "Error handling Feishu event", e)
        }
    }

    // --- Private helpers ---

    private suspend fun refreshToken() {
        if (System.currentTimeMillis() < tokenExpiresAt - 60_000) return
        tenantAccessToken = fetchToken(appId, appSecret) ?: ""
        tokenExpiresAt = System.currentTimeMillis() + 7000_000 // ~2 hours
    }

    private fun fetchToken(appId: String, appSecret: String): String? {
        val body = gson.toJson(mapOf("app_id" to appId, "app_secret" to appSecret))
            .toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("$BASE_URL/auth/v3/tenant_access_token/internal")
            .post(body)
            .build()
        val response = client.newCall(request).execute()
        val json = gson.fromJson(response.body?.string(), JsonObject::class.java)
        return if (json?.get("code")?.asInt == 0) {
            json.get("tenant_access_token")?.asString
        } else null
    }

    private fun getBotInfo(): JsonObject? = fetchBotInfo(tenantAccessToken)

    private fun fetchBotInfo(token: String): JsonObject? {
        val request = Request.Builder()
            .url("$BASE_URL/bot/v3/info")
            .addHeader("Authorization", "Bearer $token")
            .build()
        val response = client.newCall(request).execute()
        val json = gson.fromJson(response.body?.string(), JsonObject::class.java)
        return if (json?.get("code")?.asInt == 0) {
            json.getAsJsonObject("bot")
        } else null
    }

    private suspend fun sendReply(messageId: String, text: String): Boolean {
        return try {
            refreshToken()
            val body = gson.toJson(mapOf(
                "content" to gson.toJson(mapOf("text" to text)),
                "msg_type" to "text"
            )).toRequestBody(jsonMediaType)
            val request = Request.Builder()
                .url("$BASE_URL/im/v1/messages/$messageId/reply")
                .addHeader("Authorization", "Bearer $tenantAccessToken")
                .post(body)
                .build()
            val response = withContext(Dispatchers.IO) {
                client.newCall(request).execute()
            }
            response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send reply", e)
            false
        }
    }
}
