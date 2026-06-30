package com.xiaoxiami.app.im

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.xiaoxiami.app.im.gateways.WeixinGateway
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File

/**
 * Unified IM gateway manager that orchestrates all platform gateways.
 * Ported from desktop-claw's gatewayManager.ts (EventEmitter → Kotlin Flow).
 *
 * Responsibilities:
 * - Manages lifecycle of all registered gateways
 * - Provides unified message callback routing
 * - Persists channel configurations
 * - Exposes observable status for UI
 */
class IMGatewayManager(private val context: Context) {

    companion object {
        private const val TAG = "IMGatewayManager"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val gson = Gson()
    private val configFile = File(context.filesDir, "im/im_config.json")

    // Registered gateways
    private val gateways = mutableMapOf<IMPlatform, IMGateway>()

    // Observable statuses
    private val _statuses = MutableStateFlow<Map<IMPlatform, GatewayStatus>>(emptyMap())
    val statuses: StateFlow<Map<IMPlatform, GatewayStatus>> = _statuses.asStateFlow()

    // Channel configs
    private val _configs = MutableStateFlow<Map<IMPlatform, IMChannelConfig>>(emptyMap())
    val configs: StateFlow<Map<IMPlatform, IMChannelConfig>> = _configs.asStateFlow()

    // Unified message callback
    private var messageCallback: IMMessageCallback? = null

    init {
        loadConfigs()
    }

    /** Register a gateway implementation for a platform. */
    fun registerGateway(gateway: IMGateway) {
        gateways[gateway.platform] = gateway
        gateway.setMessageCallback { message, reply ->
            messageCallback?.invoke(message, reply)
        }
        updateStatus(gateway.platform)
    }

    /** Set the unified message callback for all gateways. */
    fun setMessageCallback(callback: IMMessageCallback) {
        messageCallback = callback
        // Propagate to all registered gateways
        for (gateway in gateways.values) {
            gateway.setMessageCallback { message, reply ->
                callback(message, reply)
            }
        }
    }

    /** Start all enabled gateways. */
    fun startAllEnabled() {
        scope.launch {
            for ((platform, config) in _configs.value) {
                if (config.enabled) {
                    startGateway(platform)
                }
            }
        }
    }

    /** Start a specific gateway. */
    suspend fun startGateway(platform: IMPlatform) {
        val gateway = gateways[platform]
        val config = _configs.value[platform]
        if (gateway == null) {
            Log.w(TAG, "No gateway registered for $platform")
            return
        }
        if (config == null || !config.enabled) {
            Log.w(TAG, "Gateway $platform is not configured or disabled")
            return
        }
        try {
            Log.i(TAG, "Starting gateway: $platform")
            gateway.start(config)
            updateStatus(platform)
            Log.i(TAG, "Gateway started: $platform")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start gateway $platform", e)
            updateStatus(platform, errorMessage = e.message ?: "Unknown error")
        }
    }

    /** Stop a specific gateway. */
    suspend fun stopGateway(platform: IMPlatform) {
        val gateway = gateways[platform] ?: return
        try {
            gateway.stop()
            updateStatus(platform)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop gateway $platform", e)
        }
    }

    /** Stop all gateways. */
    suspend fun stopAll() {
        for (gateway in gateways.values) {
            try {
                gateway.stop()
            } catch (e: Exception) {
                Log.e(TAG, "Error stopping ${gateway.platform}", e)
            }
        }
        refreshAllStatuses()
    }

    /** Test a gateway's connection/credentials. */
    suspend fun testGateway(platform: IMPlatform, config: IMChannelConfig): IMGateway.TestResult {
        val gateway = gateways[platform]
            ?: return IMGateway.TestResult(false, message = "No gateway for $platform")
        return gateway.testConnection(config)
    }

    /** Save channel configuration. */
    fun saveConfig(platform: IMPlatform, config: IMChannelConfig) {
        val updated = _configs.value.toMutableMap()
        updated[platform] = config
        _configs.value = updated
        persistConfigs()
    }

    /** Get config for a specific platform. */
    fun getConfig(platform: IMPlatform): IMChannelConfig? = _configs.value[platform]

    /** Get status for a specific platform. */
    fun getGatewayStatus(platform: IMPlatform): GatewayStatus {
        return gateways[platform]?.getStatus()
            ?: GatewayStatus(platform = platform)
    }

    /** Check required credentials for a platform. */
    fun getRequiredCredentials(platform: IMPlatform): List<CredentialField> {
        return when (platform) {
            IMPlatform.FEISHU -> listOf(
                CredentialField("app_id", "应用 ID", "飞书开放平台应用的 App ID"),
                CredentialField("app_secret", "应用密钥", "飞书开放平台应用的 App Secret")
            )
            IMPlatform.WECOM -> listOf(
                CredentialField("bot_id", "机器人 ID", "企业微信机器人的 Bot ID"),
                CredentialField("secret", "机器人密钥", "企业微信机器人的 Secret")
            )
            IMPlatform.DINGTALK -> listOf(
                CredentialField("client_id", "客户端 ID", "钉钉应用的 Client ID"),
                CredentialField("client_secret", "客户端密钥", "钉钉应用的 Client Secret")
            )
            IMPlatform.TELEGRAM -> listOf(
                CredentialField("bot_token", "机器人 Token", "从 @BotFather 获取的 Telegram Bot Token"),
                CredentialField("allowed_user_ids", "允许的用户 ID", "多个用户 ID 用逗号分隔，可不填", required = false)
            )
            IMPlatform.DISCORD -> listOf(
                CredentialField("bot_token", "机器人 Token", "Discord Developer Portal 中的 Bot Token")
            )
            IMPlatform.QQ -> listOf(
                CredentialField("app_id", "应用 ID", "QQ 官方机器人 App ID"),
                CredentialField("app_secret", "应用密钥", "QQ 官方机器人 App Secret")
            )
            IMPlatform.WEIXIN -> emptyList()
        }
    }

    suspend fun startWeixinBinding(): WeixinBindingStartResult {
        val gateway = gateways[IMPlatform.WEIXIN] as? WeixinGateway
            ?: error("微信渠道未注册")
        return gateway.startLogin()
    }

    suspend fun pollWeixinBindingStatus(sessionKey: String): WeixinBindingStatus {
        val gateway = gateways[IMPlatform.WEIXIN] as? WeixinGateway
            ?: error("微信渠道未注册")
        val result = gateway.pollLoginStatus(sessionKey)
        if (result.connected && result.botToken.isNotBlank()) {
            val existing = _configs.value[IMPlatform.WEIXIN]
            val credentials = buildMap {
                put("bot_token", result.botToken)
                put("bot_id", result.botId)
                put("base_url", result.baseUrl)
                if (result.userId.isNotBlank()) {
                    put("user_id", result.userId)
                }
            }
            saveConfig(
                IMPlatform.WEIXIN,
                IMChannelConfig(
                    platform = IMPlatform.WEIXIN,
                    enabled = existing?.enabled != false,
                    credentials = credentials
                )
            )
            startGateway(IMPlatform.WEIXIN)
        }
        return result
    }

    suspend fun unbindWeixin() {
        val gateway = gateways[IMPlatform.WEIXIN] as? WeixinGateway
            ?: error("微信渠道未注册")
        gateway.unbind()
        saveConfig(IMPlatform.WEIXIN, IMChannelConfig(IMPlatform.WEIXIN, enabled = false))
        updateStatus(IMPlatform.WEIXIN)
    }

    // --- Private helpers ---

    private fun updateStatus(platform: IMPlatform, errorMessage: String = "") {
        val gateway = gateways[platform]
        val status = if (gateway != null) {
            val gw = gateway.getStatus()
            if (errorMessage.isNotBlank()) gw.copy(errorMessage = errorMessage) else gw
        } else {
            GatewayStatus(platform = platform, errorMessage = errorMessage)
        }
        val updated = _statuses.value.toMutableMap()
        updated[platform] = status
        _statuses.value = updated
    }

    private fun refreshAllStatuses() {
        val updated = mutableMapOf<IMPlatform, GatewayStatus>()
        for ((platform, gateway) in gateways) {
            updated[platform] = gateway.getStatus()
        }
        _statuses.value = updated
    }

    private fun loadConfigs() {
        try {
            if (configFile.exists()) {
                val type = object : TypeToken<Map<String, IMChannelConfig>>() {}.type
                val raw: Map<String, IMChannelConfig> = gson.fromJson(configFile.readText(), type)
                _configs.value = raw.mapKeys { IMPlatform.valueOf(it.key) }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load IM configs", e)
        }
    }

    private fun persistConfigs() {
        try {
            configFile.parentFile?.mkdirs()
            val data = _configs.value.mapKeys { it.key.name }
            configFile.writeText(gson.toJson(data))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save IM configs", e)
        }
    }
}

data class CredentialField(
    val key: String,
    val label: String,
    val description: String,
    val required: Boolean = true
)
