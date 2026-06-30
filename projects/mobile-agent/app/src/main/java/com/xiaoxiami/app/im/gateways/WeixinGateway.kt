package com.xiaoxiami.app.im.gateways

import android.content.Context
import android.util.Base64
import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.xiaoxiami.app.im.GatewayStatus
import com.xiaoxiami.app.im.IMChannelConfig
import com.xiaoxiami.app.im.IMGateway
import com.xiaoxiami.app.im.IMMessage
import com.xiaoxiami.app.im.IMMessageCallback
import com.xiaoxiami.app.im.IMPlatform
import com.xiaoxiami.app.im.ReplyFn
import com.xiaoxiami.app.im.WeixinBindingStartResult
import com.xiaoxiami.app.im.WeixinBindingStatus
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.random.Random

/**
 * 微信渠道网关。
 *
 * 参考 desktop-claw 的扫码绑定和长轮询思路，Android 侧重新实现为：
 * 1. App 内发起扫码绑定
 * 2. 持久化 bot_token / bot_id 到 IM 配置
 * 3. 使用 getupdates 长轮询收消息，使用 sendmessage 回复
 */
class WeixinGateway(
    context: Context
) : IMGateway {
    override val platform = IMPlatform.WEIXIN

    companion object {
        private const val TAG = "WeixinGateway"
        private const val DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com"
        private const val DEFAULT_BOT_TYPE = "3"
        private const val SESSION_EXPIRED_ERRCODE = -14
        private const val MAX_CONSECUTIVE_FAILURES = 3
        private const val BACKOFF_DELAY_MS = 30_000L
        private const val RETRY_DELAY_MS = 2_000L
        private const val LOGIN_EXPIRE_MS = 5 * 60_000L
        private const val MAX_REPLY_CHARS = 4000
        private const val MESSAGE_TYPE_USER = 1
        private const val MESSAGE_TYPE_BOT = 2
        private const val MESSAGE_STATE_FINISH = 2
        private const val ITEM_TYPE_TEXT = 1
        private const val ITEM_TYPE_VOICE = 3
    }

    private val appContext = context.applicationContext
    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(40, TimeUnit.SECONDS)
        .build()
    private val gatewayScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val syncBufFile = File(appContext.filesDir, "im/weixin_sync_buf.txt")

    private data class ActiveLogin(
        val sessionKey: String,
        val qrcode: String,
        val qrcodeUrl: String,
        val startedAt: Long
    )

    private var callback: IMMessageCallback? = null
    private var pollingJob: Job? = null
    private var activeLogin: ActiveLogin? = null
    private var botToken = ""
    private var botId = ""
    private var baseUrl = DEFAULT_BASE_URL

    private val contextTokens = mutableMapOf<String, String>()
    private val processedMessages = linkedSetOf<String>()

    private var status = GatewayStatus(platform = IMPlatform.WEIXIN)

    override suspend fun start(config: IMChannelConfig) {
        val token = config.getCredential("bot_token").trim()
        val configBotId = config.getCredential("bot_id").trim()
        val configBaseUrl = config.getCredential("base_url").trim().ifBlank { DEFAULT_BASE_URL }

        if (token.isBlank()) {
            status = GatewayStatus(
                platform = IMPlatform.WEIXIN,
                connected = false,
                errorMessage = "未绑定微信，请先扫码绑定"
            )
            return
        }

        botToken = token
        botId = configBotId
        baseUrl = configBaseUrl
        contextTokens.clear()

        startPolling()
        Log.i(TAG, "微信渠道已启动: botId=$botId")
    }

    override suspend fun stop() {
        pollingJob?.cancel()
        pollingJob = null
        status = status.copy(connected = false)
        Log.i(TAG, "微信渠道已停止")
    }

    override fun isConnected(): Boolean = status.connected

    override fun getStatus(): GatewayStatus = status

    override fun setMessageCallback(callback: IMMessageCallback) {
        this.callback = callback
    }

    override suspend fun testConnection(config: IMChannelConfig): IMGateway.TestResult {
        val token = config.getCredential("bot_token").trim()
        return if (token.isBlank()) {
            IMGateway.TestResult(false, message = "请先扫码绑定微信")
        } else {
            IMGateway.TestResult(true, botName = "微信", message = "微信绑定凭证已存在")
        }
    }

    suspend fun startLogin(): WeixinBindingStartResult {
        val request = Request.Builder()
            .url("$DEFAULT_BASE_URL/ilink/bot/get_bot_qrcode?bot_type=$DEFAULT_BOT_TYPE")
            .build()
        val response = client.newCall(request).execute()
        val body = response.body?.string().orEmpty()
        if (!response.isSuccessful) {
            throw IllegalStateException("获取二维码失败：${response.code} ${response.message} $body")
        }
        val json = gson.fromJson(body, JsonObject::class.java)
        val qrcode = json.get("qrcode")?.asString.orEmpty()
        val qrcodeUrl = json.get("qrcode_img_content")?.asString.orEmpty()
        require(qrcode.isNotBlank() && qrcodeUrl.isNotBlank()) { "微信二维码返回为空" }

        val sessionKey = UUID.randomUUID().toString()
        activeLogin = ActiveLogin(
            sessionKey = sessionKey,
            qrcode = qrcode,
            qrcodeUrl = qrcodeUrl,
            startedAt = System.currentTimeMillis()
        )
        return WeixinBindingStartResult(
            qrcodeUrl = qrcodeUrl,
            sessionKey = sessionKey
        )
    }

    suspend fun pollLoginStatus(sessionKey: String): WeixinBindingStatus {
        val login = activeLogin
        if (login == null || login.sessionKey != sessionKey) {
            return WeixinBindingStatus(
                status = "error",
                connected = false,
                message = "无效的绑定会话"
            )
        }
        if (System.currentTimeMillis() - login.startedAt > LOGIN_EXPIRE_MS) {
            activeLogin = null
            return WeixinBindingStatus(
                status = "expired",
                connected = false,
                message = "二维码已过期，请重新获取"
            )
        }

        val request = Request.Builder()
            .url("$DEFAULT_BASE_URL/ilink/bot/get_qrcode_status?qrcode=${java.net.URLEncoder.encode(login.qrcode, "UTF-8")}")
            .addHeader("iLink-App-ClientVersion", "1")
            .build()
        val response = client.newCall(request).execute()
        val body = response.body?.string().orEmpty()
        if (!response.isSuccessful) {
            throw IllegalStateException("查询绑定状态失败：${response.code} ${response.message} $body")
        }
        val json = gson.fromJson(body, JsonObject::class.java)
        val statusValue = json.get("status")?.asString.orEmpty()

        return when (statusValue) {
            "wait" -> WeixinBindingStatus(
                status = "wait",
                connected = false,
                message = "等待扫码..."
            )
            "scaned" -> WeixinBindingStatus(
                status = "scaned",
                connected = false,
                message = "已扫码，请在微信里确认"
            )
            "expired" -> {
                activeLogin = null
                WeixinBindingStatus(
                    status = "expired",
                    connected = false,
                    message = "二维码已过期，请重新获取"
                )
            }
            "confirmed" -> {
                activeLogin = null
                WeixinBindingStatus(
                    status = "confirmed",
                    connected = true,
                    message = "绑定成功",
                    botToken = json.get("bot_token")?.asString.orEmpty(),
                    botId = json.get("ilink_bot_id")?.asString.orEmpty(),
                    baseUrl = json.get("baseurl")?.asString.orEmpty().ifBlank { DEFAULT_BASE_URL },
                    userId = json.get("ilink_user_id")?.asString.orEmpty()
                )
            }
            else -> WeixinBindingStatus(
                status = "error",
                connected = false,
                message = if (statusValue.isBlank()) "绑定状态未知" else "未知状态：$statusValue"
            )
        }
    }

    suspend fun unbind() {
        stop()
        activeLogin = null
        contextTokens.clear()
        processedMessages.clear()
        botToken = ""
        botId = ""
        baseUrl = DEFAULT_BASE_URL
        runCatching { syncBufFile.delete() }
        status = GatewayStatus(platform = IMPlatform.WEIXIN)
    }

    private fun startPolling() {
        if (pollingJob?.isActive == true) {
            return
        }
        pollingJob = gatewayScope.launch {
            pollLoop()
        }
        status = GatewayStatus(
            platform = IMPlatform.WEIXIN,
            connected = true,
            botName = "微信",
            botId = botId,
            connectedAt = System.currentTimeMillis()
        )
    }

    private suspend fun pollLoop() {
        var getUpdatesBuf = loadSyncBuf()
        var consecutiveFailures = 0
        var timeoutMs = 35_000

        while (currentCoroutineContext().isActive) {
            try {
                val response = requestJson(
                    endpoint = "ilink/bot/getupdates",
                    body = buildJsonObject {
                        addProperty("get_updates_buf", getUpdatesBuf)
                    }
                )

                val ret = response.get("ret")?.asInt
                val errcode = response.get("errcode")?.asInt
                val isApiError = (ret != null && ret != 0) || (errcode != null && errcode != 0)
                if (isApiError) {
                    val expired = ret == SESSION_EXPIRED_ERRCODE || errcode == SESSION_EXPIRED_ERRCODE
                    if (expired) {
                        status = status.copy(
                            connected = false,
                            errorMessage = "微信会话已过期，请重新绑定"
                        )
                        delay(BACKOFF_DELAY_MS)
                        continue
                    }
                    throw IllegalStateException(response.get("errmsg")?.asString ?: "微信更新接口错误")
                }

                response.get("longpolling_timeout_ms")?.asInt?.takeIf { it > 0 }?.let {
                    timeoutMs = it
                }

                response.get("get_updates_buf")?.asString?.takeIf { it.isNotBlank() }?.let {
                    getUpdatesBuf = it
                    saveSyncBuf(it)
                }

                status = status.copy(connected = true, errorMessage = "")
                consecutiveFailures = 0

                val messages = response.getAsJsonArray("msgs") ?: JsonArray()
                for (item in messages) {
                    val message = item.asJsonObject
                    if (message.get("message_type")?.asInt != MESSAGE_TYPE_USER) continue
                    handleInboundMessage(message)
                }

                if (timeoutMs > 0) {
                    delay(350)
                }
            } catch (cancelled: CancellationException) {
                break
            } catch (e: Exception) {
                consecutiveFailures += 1
                status = status.copy(
                    connected = false,
                    errorMessage = e.message ?: "微信渠道连接失败"
                )
                Log.e(TAG, "微信长轮询异常", e)
                if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    consecutiveFailures = 0
                    delay(BACKOFF_DELAY_MS)
                } else {
                    delay(RETRY_DELAY_MS)
                }
            }
        }
    }

    private suspend fun handleInboundMessage(message: JsonObject) {
        val fromUserId = message.get("from_user_id")?.asString.orEmpty()
        if (fromUserId.isBlank()) return

        val contextToken = message.get("context_token")?.asString.orEmpty()
        if (contextToken.isNotBlank()) {
            contextTokens[fromUserId] = contextToken
        }

        val messageId = message.get("message_id")?.asString
            ?: message.get("seq")?.asString
            ?: UUID.randomUUID().toString()
        if (!processedMessages.add(messageId)) {
            return
        }
        if (processedMessages.size > 1000) {
            repeat(500) {
                processedMessages.firstOrNull()?.let(processedMessages::remove)
            }
        }

        val content = extractTextContent(message.getAsJsonArray("item_list"))
        if (content.isBlank()) return

        val imMessage = IMMessage(
            id = messageId,
            platform = IMPlatform.WEIXIN,
            senderId = fromUserId,
            senderName = fromUserId,
            content = content,
            chatId = fromUserId,
            chatType = IMMessage.ChatType.PRIVATE,
            timestamp = message.get("create_time_ms")?.asLong ?: System.currentTimeMillis(),
            rawData = message.toString()
        )
        status = status.copy(lastMessageAt = System.currentTimeMillis())

        val replyFn: ReplyFn = { replyText, _ ->
            sendReply(toUserId = fromUserId, text = replyText, contextToken = contextToken.ifBlank { null })
        }
        callback?.invoke(imMessage, replyFn)
    }

    private fun extractTextContent(items: JsonArray?): String {
        items ?: return ""
        for (item in items) {
            val obj = item.asJsonObject
            when (obj.get("type")?.asInt) {
                ITEM_TYPE_TEXT -> {
                    val text = obj.getAsJsonObject("text_item")?.get("text")?.asString.orEmpty()
                    val refTitle = obj.getAsJsonObject("ref_msg")?.get("title")?.asString.orEmpty()
                    return if (refTitle.isNotBlank()) "[引用: $refTitle]\n$text" else text
                }
                ITEM_TYPE_VOICE -> {
                    val voiceText = obj.getAsJsonObject("voice_item")?.get("text")?.asString.orEmpty()
                    if (voiceText.isNotBlank()) return voiceText
                }
            }
        }
        return ""
    }

    private fun sendReply(toUserId: String, text: String, contextToken: String?): Boolean {
        val resolvedContextToken = contextToken ?: contextTokens[toUserId]
        if (resolvedContextToken.isNullOrBlank()) {
            Log.w(TAG, "微信回复失败，缺少 context_token: $toUserId")
            return false
        }

        return runCatching {
            splitReply(text).forEach { chunk ->
                val messageBody = buildJsonObject {
                    add("msg", buildJsonObject {
                        addProperty("from_user_id", "")
                        addProperty("to_user_id", toUserId)
                        addProperty("client_id", "xiaoxiami-${System.currentTimeMillis()}-${Random.nextInt(1000, 9999)}")
                        addProperty("message_type", MESSAGE_TYPE_BOT)
                        addProperty("message_state", MESSAGE_STATE_FINISH)
                        addProperty("context_token", resolvedContextToken)
                        add("item_list", JsonArray().apply {
                            add(buildJsonObject {
                                addProperty("type", ITEM_TYPE_TEXT)
                                add("text_item", buildJsonObject {
                                    addProperty("text", chunk)
                                })
                            })
                        })
                    })
                }
                requestJson(
                    endpoint = "ilink/bot/sendmessage",
                    body = messageBody
                )
            }
            true
        }.getOrElse {
            Log.e(TAG, "微信回复失败", it)
            false
        }
    }

    private fun splitReply(text: String): List<String> {
        val normalized = text.trim()
        if (normalized.isEmpty()) return emptyList()
        if (normalized.length <= MAX_REPLY_CHARS) return listOf(normalized)

        val result = mutableListOf<String>()
        var remaining = normalized
        while (remaining.length > MAX_REPLY_CHARS) {
            var splitAt = remaining.lastIndexOf("\n\n", MAX_REPLY_CHARS)
            if (splitAt < MAX_REPLY_CHARS / 2) {
                splitAt = remaining.lastIndexOf('\n', MAX_REPLY_CHARS)
            }
            if (splitAt < MAX_REPLY_CHARS / 2) {
                splitAt = remaining.lastIndexOf(' ', MAX_REPLY_CHARS)
            }
            if (splitAt < MAX_REPLY_CHARS / 2) {
                splitAt = MAX_REPLY_CHARS
            }
            result += remaining.substring(0, splitAt).trimEnd()
            remaining = remaining.substring(splitAt).trimStart()
        }
        if (remaining.isNotBlank()) {
            result += remaining
        }
        return result
    }

    private fun requestJson(
        endpoint: String,
        body: JsonObject
    ): JsonObject {
        val request = Request.Builder()
            .url("${ensureTrailingSlash(baseUrl)}$endpoint")
            .addHeader("AuthorizationType", "ilink_bot_token")
            .addHeader("X-WECHAT-UIN", randomWechatUin())
            .apply {
                if (botToken.isNotBlank()) {
                    addHeader("Authorization", "Bearer $botToken")
                }
            }
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()

        val response = client.newCall(request).execute()
        val raw = response.body?.string().orEmpty()
        if (!response.isSuccessful) {
            throw IllegalStateException("微信接口调用失败：${response.code} ${response.message} $raw")
        }
        return gson.fromJson(raw, JsonObject::class.java)
    }

    private fun randomWechatUin(): String {
        val bytes = Random.nextInt().toString().toByteArray(StandardCharsets.UTF_8)
        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    private fun ensureTrailingSlash(url: String): String = if (url.endsWith('/')) url else "$url/"

    private fun loadSyncBuf(): String {
        return runCatching { syncBufFile.takeIf { it.exists() }?.readText().orEmpty() }.getOrDefault("")
    }

    private fun saveSyncBuf(value: String) {
        runCatching {
            syncBufFile.parentFile?.mkdirs()
            syncBufFile.writeText(value)
        }
    }

    private fun buildJsonObject(block: JsonObject.() -> Unit): JsonObject {
        return JsonObject().apply(block)
    }

}
