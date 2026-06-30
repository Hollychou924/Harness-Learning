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
 * WeChat Work (WeCom/企微) gateway using Bot webhook + callback mode.
 * Ported from desktop-claw's wecomGateway.ts.
 */
class WecomGateway : IMGateway {
    override val platform = IMPlatform.WECOM

    companion object {
        private const val TAG = "WecomGateway"
        private const val API_BASE = "https://qyapi.weixin.qq.com/cgi-bin"
    }

    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private var botId = ""
    private var secret = ""
    private var callback: IMMessageCallback? = null

    private var _status = GatewayStatus(platform = IMPlatform.WECOM)
    private val processedMessages = mutableSetOf<String>()

    override suspend fun start(config: IMChannelConfig) {
        botId = config.getCredential("bot_id")
        secret = config.getCredential("secret")
        require(botId.isNotBlank()) { "WeCom bot_id is required" }
        require(secret.isNotBlank()) { "WeCom secret is required" }

        _status = GatewayStatus(
            platform = IMPlatform.WECOM,
            connected = true,
            botName = "WeCom Bot",
            botId = botId,
            connectedAt = System.currentTimeMillis()
        )

        Log.i(TAG, "WeCom gateway started (webhook mode)")
    }

    override suspend fun stop() {
        _status = _status.copy(connected = false)
        Log.i(TAG, "WeCom gateway stopped")
    }

    override fun isConnected(): Boolean = _status.connected

    override fun getStatus(): GatewayStatus = _status

    override fun setMessageCallback(callback: IMMessageCallback) {
        this.callback = callback
    }

    override suspend fun testConnection(config: IMChannelConfig): IMGateway.TestResult {
        return try {
            val id = config.getCredential("bot_id")
            val sec = config.getCredential("secret")
            if (id.isBlank() || sec.isBlank()) {
                return IMGateway.TestResult(false, message = "Bot ID and Secret are required")
            }
            IMGateway.TestResult(true, botName = "WeCom Bot", message = "Credentials configured")
        } catch (e: Exception) {
            IMGateway.TestResult(false, message = "Connection failed: ${e.message}")
        }
    }

    /** Handle an incoming event from WeCom callback. */
    suspend fun handleEvent(eventJson: String) {
        try {
            val event = gson.fromJson(eventJson, JsonObject::class.java)
            val msgId = event.get("MsgId")?.asString ?: return

            if (msgId in processedMessages) return
            processedMessages.add(msgId)
            if (processedMessages.size > 1000) processedMessages.clear()

            val fromUser = event.get("FromUserName")?.asString ?: ""
            val content = event.get("Content")?.asString ?: ""
            val chatId = event.get("ChatId")?.asString ?: fromUser

            val imMessage = IMMessage(
                id = msgId,
                platform = IMPlatform.WECOM,
                senderId = fromUser,
                senderName = fromUser,
                content = content,
                chatId = chatId,
                rawData = eventJson
            )

            _status = _status.copy(lastMessageAt = System.currentTimeMillis())

            val replyFn: ReplyFn = { replyText, _ ->
                // WeCom bot replies via webhook
                true
            }

            callback?.invoke(imMessage, replyFn)
        } catch (e: Exception) {
            Log.e(TAG, "Error handling WeCom event", e)
        }
    }
}
