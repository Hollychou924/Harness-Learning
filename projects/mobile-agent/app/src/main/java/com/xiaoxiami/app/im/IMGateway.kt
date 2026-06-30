package com.xiaoxiami.app.im

/**
 * Unified IM message model.
 * Represents an inbound message from any IM platform.
 */
data class IMMessage(
    val id: String,
    val platform: IMPlatform,
    val senderId: String,
    val senderName: String,
    val content: String,
    val contentType: ContentType = ContentType.TEXT,
    val chatId: String = "",
    val chatType: ChatType = ChatType.PRIVATE,
    val timestamp: Long = System.currentTimeMillis(),
    val replyToMessageId: String? = null,
    val imageUrls: List<String> = emptyList(),
    val fileUrls: List<String> = emptyList(),
    val rawData: String = ""
) {
    enum class ContentType {
        TEXT, IMAGE, FILE, AUDIO, VIDEO, RICH_TEXT, MIXED
    }

    enum class ChatType {
        PRIVATE, GROUP
    }
}

/**
 * Supported IM platforms.
 * Ported from desktop-claw's 7-platform support.
 */
enum class IMPlatform(val displayName: String) {
    FEISHU("飞书"),
    WECOM("企业微信"),
    DINGTALK("钉钉"),
    TELEGRAM("Telegram"),
    DISCORD("Discord"),
    QQ("QQ"),
    WEIXIN("微信");

    companion object {
        fun fromName(name: String): IMPlatform? {
            return entries.find { it.name.equals(name, ignoreCase = true) }
        }
    }
}

/**
 * IM gateway configuration for a single platform.
 */
data class IMChannelConfig(
    val platform: IMPlatform,
    val enabled: Boolean = false,
    val credentials: Map<String, String> = emptyMap()
) {
    fun getCredential(key: String): String = credentials[key] ?: ""
    fun hasCredential(key: String): Boolean = credentials[key]?.isNotBlank() == true
}

/**
 * Gateway connection status.
 */
data class GatewayStatus(
    val platform: IMPlatform,
    val connected: Boolean = false,
    val botName: String = "",
    val botId: String = "",
    val connectedAt: Long? = null,
    val lastMessageAt: Long? = null,
    val errorMessage: String = ""
)

data class WeixinBindingStartResult(
    val qrcodeUrl: String,
    val sessionKey: String
)

data class WeixinBindingStatus(
    val status: String,
    val connected: Boolean,
    val message: String,
    val botToken: String = "",
    val botId: String = "",
    val baseUrl: String = "",
    val userId: String = ""
)

/**
 * Reply function type - used to send response back to the IM platform.
 */
typealias ReplyFn = suspend (text: String, imageUrls: List<String>) -> Boolean

/**
 * Message callback type - called when a message is received from any IM platform.
 */
typealias IMMessageCallback = suspend (message: IMMessage, reply: ReplyFn) -> Unit

/**
 * Abstract gateway interface that all IM platform implementations must follow.
 * Ported from desktop-claw's IIMGateway pattern.
 */
interface IMGateway {
    val platform: IMPlatform

    /** Start the gateway with given configuration. */
    suspend fun start(config: IMChannelConfig)

    /** Stop the gateway gracefully. */
    suspend fun stop()

    /** Check if the gateway is currently connected. */
    fun isConnected(): Boolean

    /** Get the current gateway status. */
    fun getStatus(): GatewayStatus

    /** Set the callback for incoming messages. */
    fun setMessageCallback(callback: IMMessageCallback)

    /** Test connectivity with current credentials. */
    suspend fun testConnection(config: IMChannelConfig): TestResult

    data class TestResult(
        val success: Boolean,
        val botName: String = "",
        val message: String = ""
    )
}
