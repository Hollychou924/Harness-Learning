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
 * QQ Official Bot gateway using QQ Bot Open Platform API.
 * Ported from desktop-claw's qqGateway.ts.
 * Uses WebSocket for real-time events + REST API for sending messages.
 */
class QQGateway : IMGateway {
    override val platform = IMPlatform.QQ

    companion object {
        private const val TAG = "QQGateway"
        private const val API_BASE = "https://api.sgroup.qq.com"
        private const val SANDBOX_API_BASE = "https://sandbox.api.sgroup.qq.com"
    }

    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private var appId = ""
    private var appSecret = ""
    private var accessToken = ""
    private var tokenExpiresAt = 0L
    private var callback: IMMessageCallback? = null
    private var webSocket: WebSocket? = null
    private var heartbeatJob: Job? = null
    private var lastSequence: Int? = null

    private var _status = GatewayStatus(platform = IMPlatform.QQ)
    private val processedMessages = mutableSetOf<String>()

    override suspend fun start(config: IMChannelConfig) {
        appId = config.getCredential("app_id")
        appSecret = config.getCredential("app_secret")
        require(appId.isNotBlank()) { "QQ app_id is required" }
        require(appSecret.isNotBlank()) { "QQ app_secret is required" }

        refreshToken()

        _status = GatewayStatus(
            platform = IMPlatform.QQ,
            connected = true,
            botName = "QQ Bot",
            botId = appId,
            connectedAt = System.currentTimeMillis()
        )

        // Connect Gateway WebSocket
        connectGateway()

        Log.i(TAG, "QQ gateway started")
    }

    override suspend fun stop() {
        heartbeatJob?.cancel()
        webSocket?.close(1000, "Shutting down")
        webSocket = null
        _status = _status.copy(connected = false)
        Log.i(TAG, "QQ gateway stopped")
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
            val token = fetchAccessToken(id, secret)
            if (token != null) {
                IMGateway.TestResult(true, botName = "QQ Bot", message = "Credentials valid")
            } else {
                IMGateway.TestResult(false, message = "Invalid credentials")
            }
        } catch (e: Exception) {
            IMGateway.TestResult(false, message = "Connection failed: ${e.message}")
        }
    }

    private fun connectGateway() {
        // Get gateway URL
        val gatewayUrl = getGatewayUrl() ?: return

        val request = Request.Builder().url(gatewayUrl).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                val payload = gson.fromJson(text, JsonObject::class.java)
                val op = payload.get("op")?.asInt ?: return
                val s = payload.get("s")?.asInt
                if (s != null) lastSequence = s

                when (op) {
                    10 -> { // HELLO
                        val interval = payload.getAsJsonObject("d")
                            ?.get("heartbeat_interval")?.asLong ?: 41250
                        startHeartbeat(webSocket, interval)
                        identify(webSocket)
                    }
                    0 -> { // DISPATCH
                        val eventName = payload.get("t")?.asString
                        if (eventName == "AT_MESSAGE_CREATE" || eventName == "MESSAGE_CREATE") {
                            val data = payload.getAsJsonObject("d") ?: return
                            CoroutineScope(Dispatchers.IO).launch {
                                handleMessage(data)
                            }
                        }
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failure", t)
                _status = _status.copy(connected = false, errorMessage = t.message ?: "")
            }
        })
    }

    private fun identify(ws: WebSocket) {
        val identify = mapOf(
            "op" to 2,
            "d" to mapOf(
                "token" to "QQBot $accessToken",
                "intents" to (0 or (1 shl 30) or (1 shl 12)), // PUBLIC_GUILD_MESSAGES | AT_MESSAGES
                "shard" to listOf(0, 1)
            )
        )
        ws.send(gson.toJson(identify))
    }

    private fun startHeartbeat(ws: WebSocket, intervalMs: Long) {
        heartbeatJob?.cancel()
        heartbeatJob = CoroutineScope(Dispatchers.IO).launch {
            while (isActive) {
                delay(intervalMs)
                ws.send(gson.toJson(mapOf("op" to 1, "d" to lastSequence)))
            }
        }
    }

    private suspend fun handleMessage(data: JsonObject) {
        val author = data.getAsJsonObject("author") ?: return
        if (author.get("bot")?.asBoolean == true) return

        val messageId = data.get("id")?.asString ?: return
        if (messageId in processedMessages) return
        processedMessages.add(messageId)
        if (processedMessages.size > 1000) processedMessages.clear()

        val content = data.get("content")?.asString?.trim() ?: ""
        val channelId = data.get("channel_id")?.asString ?: ""
        val userId = author.get("id")?.asString ?: ""
        val username = author.get("username")?.asString ?: ""

        val imMessage = IMMessage(
            id = messageId,
            platform = IMPlatform.QQ,
            senderId = userId,
            senderName = username,
            content = content,
            chatId = channelId,
            chatType = IMMessage.ChatType.GROUP,
            rawData = data.toString()
        )

        _status = _status.copy(lastMessageAt = System.currentTimeMillis())

        val replyFn: ReplyFn = { replyText, _ ->
            sendChannelMessage(channelId, replyText, messageId)
        }

        callback?.invoke(imMessage, replyFn)
    }

    private fun sendChannelMessage(channelId: String, text: String, msgId: String): Boolean {
        return try {
            refreshTokenSync()
            val body = gson.toJson(mapOf(
                "content" to text,
                "msg_id" to msgId
            )).toRequestBody(jsonMediaType)
            val request = Request.Builder()
                .url("$API_BASE/channels/$channelId/messages")
                .addHeader("Authorization", "QQBot $accessToken")
                .post(body)
                .build()
            client.newCall(request).execute().isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send message", e)
            false
        }
    }

    private suspend fun refreshToken() {
        if (System.currentTimeMillis() < tokenExpiresAt - 60_000) return
        accessToken = fetchAccessToken(appId, appSecret) ?: ""
        tokenExpiresAt = System.currentTimeMillis() + 7000_000
    }

    private fun refreshTokenSync() {
        if (System.currentTimeMillis() < tokenExpiresAt - 60_000) return
        accessToken = fetchAccessToken(appId, appSecret) ?: ""
        tokenExpiresAt = System.currentTimeMillis() + 7000_000
    }

    private fun fetchAccessToken(appId: String, appSecret: String): String? {
        val body = gson.toJson(mapOf(
            "appId" to appId,
            "clientSecret" to appSecret
        )).toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("https://bots.qq.com/app/getAppAccessToken")
            .post(body)
            .build()
        return try {
            val response = client.newCall(request).execute()
            val json = gson.fromJson(response.body?.string(), JsonObject::class.java)
            json?.get("access_token")?.asString
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get access token", e)
            null
        }
    }

    private fun getGatewayUrl(): String? {
        return try {
            val request = Request.Builder()
                .url("$API_BASE/gateway")
                .addHeader("Authorization", "QQBot $accessToken")
                .build()
            val response = client.newCall(request).execute()
            val json = gson.fromJson(response.body?.string(), JsonObject::class.java)
            json?.get("url")?.asString
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get gateway URL", e)
            null
        }
    }
}
