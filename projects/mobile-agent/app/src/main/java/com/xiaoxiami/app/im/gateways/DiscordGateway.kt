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
 * Discord gateway using Discord Bot API with Gateway WebSocket.
 * Ported from desktop-claw's discordGateway.ts.
 * Uses OkHttp WebSocket for real-time events.
 */
class DiscordGateway : IMGateway {
    override val platform = IMPlatform.DISCORD

    companion object {
        private const val TAG = "DiscordGateway"
        private const val API_BASE = "https://discord.com/api/v10"
        private const val GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json"
    }

    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private var botToken = ""
    private var callback: IMMessageCallback? = null
    private var webSocket: WebSocket? = null
    private var heartbeatJob: Job? = null
    private var lastSequence: Int? = null

    private var _status = GatewayStatus(platform = IMPlatform.DISCORD)
    private val processedMessages = mutableSetOf<String>()

    override suspend fun start(config: IMChannelConfig) {
        botToken = config.getCredential("bot_token")
        require(botToken.isNotBlank()) { "Discord bot_token is required" }

        // Get bot info
        val me = apiGet("/users/@me")
        val botName = me?.get("username")?.asString ?: "Discord Bot"
        val botId = me?.get("id")?.asString ?: ""

        _status = GatewayStatus(
            platform = IMPlatform.DISCORD,
            connected = true,
            botName = botName,
            botId = botId,
            connectedAt = System.currentTimeMillis()
        )

        // Connect to Gateway WebSocket
        connectGateway()

        Log.i(TAG, "Discord gateway started: $botName")
    }

    override suspend fun stop() {
        heartbeatJob?.cancel()
        heartbeatJob = null
        webSocket?.close(1000, "Shutting down")
        webSocket = null
        _status = _status.copy(connected = false)
        Log.i(TAG, "Discord gateway stopped")
    }

    override fun isConnected(): Boolean = _status.connected
    override fun getStatus(): GatewayStatus = _status

    override fun setMessageCallback(callback: IMMessageCallback) {
        this.callback = callback
    }

    override suspend fun testConnection(config: IMChannelConfig): IMGateway.TestResult {
        return try {
            val token = config.getCredential("bot_token")
            if (token.isBlank()) return IMGateway.TestResult(false, message = "Bot token is empty")

            val request = Request.Builder()
                .url("$API_BASE/users/@me")
                .addHeader("Authorization", "Bot $token")
                .build()
            val response = client.newCall(request).execute()
            val json = gson.fromJson(response.body?.string(), JsonObject::class.java)

            if (json?.has("id") == true) {
                val name = json.get("username")?.asString ?: "Bot"
                IMGateway.TestResult(true, botName = name, message = "Connected as $name")
            } else {
                IMGateway.TestResult(false, message = json?.get("message")?.asString ?: "Invalid token")
            }
        } catch (e: Exception) {
            IMGateway.TestResult(false, message = "Connection failed: ${e.message}")
        }
    }

    private fun connectGateway() {
        val request = Request.Builder().url(GATEWAY_URL).build()
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
                        if (eventName == "MESSAGE_CREATE") {
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

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _status = _status.copy(connected = false)
            }
        })
    }

    private fun identify(ws: WebSocket) {
        val identify = mapOf(
            "op" to 2,
            "d" to mapOf(
                "token" to botToken,
                "intents" to (1 shl 9 or (1 shl 15)), // GUILD_MESSAGES | MESSAGE_CONTENT
                "properties" to mapOf(
                    "os" to "android",
                    "browser" to "xiaoxiami",
                    "device" to "xiaoxiami"
                )
            )
        )
        ws.send(gson.toJson(identify))
    }

    private fun startHeartbeat(ws: WebSocket, intervalMs: Long) {
        heartbeatJob?.cancel()
        heartbeatJob = CoroutineScope(Dispatchers.IO).launch {
            while (isActive) {
                delay(intervalMs)
                val heartbeat = mapOf("op" to 1, "d" to lastSequence)
                ws.send(gson.toJson(heartbeat))
            }
        }
    }

    private suspend fun handleMessage(data: JsonObject) {
        val author = data.getAsJsonObject("author") ?: return
        if (author.get("bot")?.asBoolean == true) return // Ignore bot messages

        val messageId = data.get("id")?.asString ?: return
        if (messageId in processedMessages) return
        processedMessages.add(messageId)
        if (processedMessages.size > 1000) processedMessages.clear()

        val content = data.get("content")?.asString ?: ""
        val channelId = data.get("channel_id")?.asString ?: ""
        val userId = author.get("id")?.asString ?: ""
        val username = author.get("username")?.asString ?: ""

        val imMessage = IMMessage(
            id = messageId,
            platform = IMPlatform.DISCORD,
            senderId = userId,
            senderName = username,
            content = content,
            chatId = channelId,
            chatType = IMMessage.ChatType.GROUP,
            rawData = data.toString()
        )

        _status = _status.copy(lastMessageAt = System.currentTimeMillis())

        val replyFn: ReplyFn = { replyText, _ ->
            sendChannelMessage(channelId, replyText)
        }

        callback?.invoke(imMessage, replyFn)
    }

    private fun sendChannelMessage(channelId: String, text: String): Boolean {
        return try {
            val body = gson.toJson(mapOf("content" to text))
                .toRequestBody(jsonMediaType)
            val request = Request.Builder()
                .url("$API_BASE/channels/$channelId/messages")
                .addHeader("Authorization", "Bot $botToken")
                .post(body)
                .build()
            client.newCall(request).execute().isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send message", e)
            false
        }
    }

    private fun apiGet(path: String): JsonObject? {
        return try {
            val request = Request.Builder()
                .url("$API_BASE$path")
                .addHeader("Authorization", "Bot $botToken")
                .build()
            val response = client.newCall(request).execute()
            gson.fromJson(response.body?.string(), JsonObject::class.java)
        } catch (e: Exception) {
            Log.e(TAG, "API call failed: $path", e)
            null
        }
    }
}
