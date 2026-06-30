package com.xiaoxiami.app.im.gateways

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.xiaoxiami.app.im.*
import kotlinx.coroutines.*
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/**
 * Telegram Bot API gateway using long polling.
 * No external SDK needed - uses OkHttp directly against the Bot HTTP API.
 * Ported from desktop-claw's telegramGateway.ts.
 */
class TelegramGateway : IMGateway {
    override val platform = IMPlatform.TELEGRAM

    companion object {
        private const val TAG = "TelegramGateway"
        private const val BASE_URL = "https://api.telegram.org/bot"
        private const val POLL_TIMEOUT = 30 // seconds
    }

    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(35, TimeUnit.SECONDS) // > POLL_TIMEOUT
        .build()

    private var botToken = ""
    private var allowedUserIds = setOf<String>()
    private var callback: IMMessageCallback? = null
    private var pollingJob: Job? = null
    private var offset = 0L

    private var _status = GatewayStatus(platform = IMPlatform.TELEGRAM)
    private val processedMessages = mutableSetOf<Long>()

    override suspend fun start(config: IMChannelConfig) {
        botToken = config.getCredential("bot_token")
        require(botToken.isNotBlank()) { "Telegram bot_token is required" }

        val allowedRaw = config.getCredential("allowed_user_ids")
        allowedUserIds = if (allowedRaw.isNotBlank()) {
            allowedRaw.split(",").map { it.trim() }.filter { it.isNotBlank() }.toSet()
        } else emptySet()

        // Get bot info
        val me = apiCall("getMe")
        val botName = me?.get("first_name")?.asString ?: "Bot"
        val botId = me?.get("id")?.asString ?: ""

        _status = GatewayStatus(
            platform = IMPlatform.TELEGRAM,
            connected = true,
            botName = botName,
            botId = botId,
            connectedAt = System.currentTimeMillis()
        )

        // Start long polling
        pollingJob = CoroutineScope(Dispatchers.IO).launch {
            while (isActive) {
                try {
                    pollUpdates()
                } catch (e: CancellationException) {
                    break
                } catch (e: Exception) {
                    Log.e(TAG, "Polling error", e)
                    delay(5000) // Retry delay
                }
            }
        }

        Log.i(TAG, "Telegram gateway started: $botName")
    }

    override suspend fun stop() {
        pollingJob?.cancel()
        pollingJob = null
        _status = _status.copy(connected = false)
        Log.i(TAG, "Telegram gateway stopped")
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

            val tempClient = OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .build()
            val request = Request.Builder()
                .url("${BASE_URL}$token/getMe")
                .build()
            val response = tempClient.newCall(request).execute()
            val body = response.body?.string() ?: ""
            val json = gson.fromJson(body, JsonObject::class.java)

            if (json.get("ok")?.asBoolean == true) {
                val result = json.getAsJsonObject("result")
                val name = result?.get("first_name")?.asString ?: "Bot"
                IMGateway.TestResult(true, botName = name, message = "Connected to @${result?.get("username")?.asString}")
            } else {
                IMGateway.TestResult(false, message = json.get("description")?.asString ?: "Unknown error")
            }
        } catch (e: Exception) {
            IMGateway.TestResult(false, message = "Connection failed: ${e.message}")
        }
    }

    // --- Private helpers ---

    private suspend fun pollUpdates() {
        val params = buildString {
            append("offset=$offset")
            append("&timeout=$POLL_TIMEOUT")
            append("&allowed_updates=[\"message\"]")
        }
        val request = Request.Builder()
            .url("${BASE_URL}$botToken/getUpdates?$params")
            .build()

        val response = withContext(Dispatchers.IO) {
            client.newCall(request).execute()
        }
        val body = response.body?.string() ?: return
        val json = gson.fromJson(body, JsonObject::class.java)

        if (json.get("ok")?.asBoolean != true) return

        val updates = json.getAsJsonArray("result") ?: return
        for (update in updates) {
            val obj = update.asJsonObject
            val updateId = obj.get("update_id").asLong
            offset = updateId + 1

            if (updateId in processedMessages) continue
            processedMessages.add(updateId)
            // Keep set bounded
            if (processedMessages.size > 1000) {
                val toRemove = processedMessages.sorted().take(500)
                processedMessages.removeAll(toRemove.toSet())
            }

            val message = obj.getAsJsonObject("message") ?: continue
            handleMessage(message)
        }
    }

    private suspend fun handleMessage(message: JsonObject) {
        val chat = message.getAsJsonObject("chat") ?: return
        val from = message.getAsJsonObject("from") ?: return

        val userId = from.get("id")?.asString ?: return
        val chatId = chat.get("id")?.asString ?: return

        // Check allowed users
        if (allowedUserIds.isNotEmpty() && userId !in allowedUserIds) {
            Log.d(TAG, "Ignoring message from unauthorized user: $userId")
            return
        }

        val text = message.get("text")?.asString ?: ""
        val firstName = from.get("first_name")?.asString ?: ""
        val lastName = from.get("last_name")?.asString ?: ""
        val senderName = "$firstName $lastName".trim()
        val chatType = when (chat.get("type")?.asString) {
            "private" -> IMMessage.ChatType.PRIVATE
            else -> IMMessage.ChatType.GROUP
        }

        val imMessage = IMMessage(
            id = message.get("message_id")?.asString ?: "",
            platform = IMPlatform.TELEGRAM,
            senderId = userId,
            senderName = senderName,
            content = text,
            chatId = chatId,
            chatType = chatType,
            rawData = message.toString()
        )

        _status = _status.copy(lastMessageAt = System.currentTimeMillis())

        val replyFn: ReplyFn = { replyText, imageUrls ->
            sendMessage(chatId, replyText)
        }

        try {
            callback?.invoke(imMessage, replyFn)
        } catch (e: Exception) {
            Log.e(TAG, "Error in message callback", e)
        }
    }

    private fun sendMessage(chatId: String, text: String): Boolean {
        return try {
            // Split long messages (Telegram limit: 4096 chars)
            val chunks = text.chunked(4000)
            for (chunk in chunks) {
                val encoded = java.net.URLEncoder.encode(chunk, "UTF-8")
                val request = Request.Builder()
                    .url("${BASE_URL}$botToken/sendMessage?chat_id=$chatId&text=$encoded&parse_mode=Markdown")
                    .build()
                client.newCall(request).execute().close()
            }
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send message", e)
            false
        }
    }

    private fun apiCall(method: String): JsonObject? {
        return try {
            val request = Request.Builder()
                .url("${BASE_URL}$botToken/$method")
                .build()
            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: return null
            val json = gson.fromJson(body, JsonObject::class.java)
            if (json.get("ok")?.asBoolean == true) {
                json.getAsJsonObject("result")
            } else null
        } catch (e: Exception) {
            Log.e(TAG, "API call failed: $method", e)
            null
        }
    }
}
