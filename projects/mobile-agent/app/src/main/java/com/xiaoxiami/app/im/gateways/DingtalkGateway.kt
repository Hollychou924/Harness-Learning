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
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import android.util.Base64

/**
 * DingTalk gateway using Stream mode (WebSocket-based).
 * Ported from desktop-claw's dingtalkGateway.ts.
 * Uses OkHttp WebSocket for real-time message reception.
 */
class DingtalkGateway : IMGateway {
    override val platform = IMPlatform.DINGTALK

    companion object {
        private const val TAG = "DingtalkGateway"
        private const val API_BASE = "https://api.dingtalk.com"
        private const val OAPI_BASE = "https://oapi.dingtalk.com"
    }

    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private var clientId = ""
    private var clientSecret = ""
    private var accessToken = ""
    private var tokenExpiresAt = 0L
    private var callback: IMMessageCallback? = null
    private var webSocket: WebSocket? = null

    private var _status = GatewayStatus(platform = IMPlatform.DINGTALK)
    private val processedMessages = mutableSetOf<String>()

    override suspend fun start(config: IMChannelConfig) {
        clientId = config.getCredential("client_id")
        clientSecret = config.getCredential("client_secret")
        require(clientId.isNotBlank()) { "DingTalk client_id is required" }
        require(clientSecret.isNotBlank()) { "DingTalk client_secret is required" }

        // Get access token
        refreshToken()

        // Get bot info
        val botName = "DingTalk Bot" // DingTalk doesn't have a simple getMe API

        _status = GatewayStatus(
            platform = IMPlatform.DINGTALK,
            connected = true,
            botName = botName,
            botId = clientId,
            connectedAt = System.currentTimeMillis()
        )

        // Note: DingTalk Stream SDK requires Java SDK dependency.
        // For lightweight implementation, use HTTP callback mode.
        // The gateway accepts webhook-forwarded events via handleEvent().
        Log.i(TAG, "DingTalk gateway started (webhook mode)")
    }

    override suspend fun stop() {
        webSocket?.close(1000, "Shutting down")
        webSocket = null
        _status = _status.copy(connected = false)
        Log.i(TAG, "DingTalk gateway stopped")
    }

    override fun isConnected(): Boolean = _status.connected

    override fun getStatus(): GatewayStatus = _status

    override fun setMessageCallback(callback: IMMessageCallback) {
        this.callback = callback
    }

    override suspend fun testConnection(config: IMChannelConfig): IMGateway.TestResult {
        return try {
            val id = config.getCredential("client_id")
            val secret = config.getCredential("client_secret")
            if (id.isBlank() || secret.isBlank()) {
                return IMGateway.TestResult(false, message = "Client ID and Secret are required")
            }

            val token = fetchAccessToken(id, secret)
            if (token != null) {
                IMGateway.TestResult(true, botName = "DingTalk Bot", message = "Credentials valid")
            } else {
                IMGateway.TestResult(false, message = "Invalid credentials")
            }
        } catch (e: Exception) {
            IMGateway.TestResult(false, message = "Connection failed: ${e.message}")
        }
    }

    /** Handle an incoming event from DingTalk webhook. */
    suspend fun handleEvent(eventJson: String) {
        try {
            val event = gson.fromJson(eventJson, JsonObject::class.java)
            val msgId = event.get("msgId")?.asString
                ?: event.get("chatbotCorpId")?.asString
                ?: return

            if (msgId in processedMessages) return
            processedMessages.add(msgId)
            if (processedMessages.size > 1000) processedMessages.clear()

            val senderId = event.get("senderStaffId")?.asString
                ?: event.get("senderId")?.asString ?: ""
            val senderNick = event.get("senderNick")?.asString ?: ""
            val chatType = when (event.get("conversationType")?.asString) {
                "1" -> IMMessage.ChatType.PRIVATE
                else -> IMMessage.ChatType.GROUP
            }
            val chatId = event.get("conversationId")?.asString ?: ""

            // Parse content
            val msgType = event.get("msgtype")?.asString ?: "text"
            val content = when (msgType) {
                "text" -> event.getAsJsonObject("text")?.get("content")?.asString?.trim() ?: ""
                "richText" -> event.getAsJsonObject("content")?.get("richText")?.toString() ?: ""
                else -> event.get("text")?.asJsonObject?.get("content")?.asString ?: ""
            }

            val imMessage = IMMessage(
                id = msgId,
                platform = IMPlatform.DINGTALK,
                senderId = senderId,
                senderName = senderNick,
                content = content,
                chatId = chatId,
                chatType = chatType,
                rawData = eventJson
            )

            _status = _status.copy(lastMessageAt = System.currentTimeMillis())

            // Build reply using webhook URL from the event
            val sessionWebhook = event.get("sessionWebhook")?.asString
            val replyFn: ReplyFn = { replyText, _ ->
                if (sessionWebhook != null) {
                    sendWebhookReply(sessionWebhook, replyText)
                } else false
            }

            callback?.invoke(imMessage, replyFn)
        } catch (e: Exception) {
            Log.e(TAG, "Error handling DingTalk event", e)
        }
    }

    // --- Private helpers ---

    private suspend fun refreshToken() {
        if (System.currentTimeMillis() < tokenExpiresAt - 60_000) return
        accessToken = fetchAccessToken(clientId, clientSecret) ?: ""
        tokenExpiresAt = System.currentTimeMillis() + 7000_000
    }

    private fun fetchAccessToken(clientId: String, clientSecret: String): String? {
        val body = gson.toJson(mapOf(
            "appKey" to clientId,
            "appSecret" to clientSecret
        )).toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("$API_BASE/v1.0/oauth2/accessToken")
            .post(body)
            .build()
        return try {
            val response = client.newCall(request).execute()
            val json = gson.fromJson(response.body?.string(), JsonObject::class.java)
            json?.get("accessToken")?.asString
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get access token", e)
            null
        }
    }

    private fun sendWebhookReply(webhookUrl: String, text: String): Boolean {
        return try {
            val body = gson.toJson(mapOf(
                "msgtype" to "text",
                "text" to mapOf("content" to text)
            )).toRequestBody(jsonMediaType)
            val request = Request.Builder()
                .url(webhookUrl)
                .post(body)
                .build()
            client.newCall(request).execute().isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send webhook reply", e)
            false
        }
    }
}
