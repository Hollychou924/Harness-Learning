package com.xiaoxiami.app.remote

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

data class RemoteBridgeConfig(
    val enabled: Boolean = false,
    val bridgeUrl: String = "",
    val pairingCode: String = "",
    val localDeviceId: String = "",
    val localDisplayName: String = "",
    val sessionToken: String = "",
    val pairedPeerId: String = "",
    val pairedPeerName: String = "",
    val lastStatus: String = "disconnected",
    val lastError: String = "",
    val lastConnectedAt: Long? = null
)

class RemoteBridgeConfigStore(
    context: Context
) {
    private val prefs = context.getSharedPreferences("remote_bridge_config", Context.MODE_PRIVATE)
    private val _state = MutableStateFlow(load())
    val state: StateFlow<RemoteBridgeConfig> = _state.asStateFlow()

    fun update(
        bridgeUrl: String = state.value.bridgeUrl,
        pairingCode: String = state.value.pairingCode,
        localDisplayName: String = state.value.localDisplayName,
        enabled: Boolean = state.value.enabled
    ) {
        val config = state.value.copy(
            bridgeUrl = bridgeUrl.trim(),
            pairingCode = pairingCode.trim(),
            localDisplayName = localDisplayName.trim(),
            enabled = enabled
        ).ensureIds()
        persist(config)
    }

    fun markConnected(
        sessionToken: String,
        pairedPeerId: String,
        pairedPeerName: String,
        status: String = "connected"
    ) {
        persist(
            state.value.copy(
                sessionToken = sessionToken,
                pairedPeerId = pairedPeerId,
                pairedPeerName = pairedPeerName,
                lastStatus = status,
                lastError = "",
                lastConnectedAt = System.currentTimeMillis()
            ).ensureIds()
        )
    }

    fun markStatus(status: String, error: String = state.value.lastError) {
        persist(
            state.value.copy(
                lastStatus = status,
                lastError = error
            ).ensureIds()
        )
    }

    fun disconnect(clearPeer: Boolean = false) {
        val current = state.value
        persist(
            current.copy(
                enabled = false,
                sessionToken = if (clearPeer) "" else current.sessionToken,
                pairedPeerId = if (clearPeer) "" else current.pairedPeerId,
                pairedPeerName = if (clearPeer) "" else current.pairedPeerName,
                lastStatus = "disconnected",
                lastError = ""
            ).ensureIds()
        )
    }

    fun generatePairingCode(): String {
        val generated = UUID.randomUUID().toString().replace("-", "").take(8).uppercase()
        persist(state.value.copy(pairingCode = generated).ensureIds())
        return generated
    }

    private fun load(): RemoteBridgeConfig {
        return RemoteBridgeConfig(
            enabled = prefs.getBoolean("enabled", false),
            bridgeUrl = prefs.getString("bridge_url", "").orEmpty(),
            pairingCode = prefs.getString("pairing_code", "").orEmpty(),
            localDeviceId = prefs.getString("local_device_id", "").orEmpty(),
            localDisplayName = prefs.getString("local_display_name", "").orEmpty(),
            sessionToken = prefs.getString("session_token", "").orEmpty(),
            pairedPeerId = prefs.getString("paired_peer_id", "").orEmpty(),
            pairedPeerName = prefs.getString("paired_peer_name", "").orEmpty(),
            lastStatus = prefs.getString("last_status", "disconnected").orEmpty(),
            lastError = prefs.getString("last_error", "").orEmpty(),
            lastConnectedAt = prefs.takeIf { it.contains("last_connected_at") }?.getLong("last_connected_at", 0L)
        ).ensureIds()
    }

    private fun persist(config: RemoteBridgeConfig) {
        val finalConfig = config.ensureIds()
        prefs.edit()
            .putBoolean("enabled", finalConfig.enabled)
            .putString("bridge_url", finalConfig.bridgeUrl)
            .putString("pairing_code", finalConfig.pairingCode)
            .putString("local_device_id", finalConfig.localDeviceId)
            .putString("local_display_name", finalConfig.localDisplayName)
            .putString("session_token", finalConfig.sessionToken)
            .putString("paired_peer_id", finalConfig.pairedPeerId)
            .putString("paired_peer_name", finalConfig.pairedPeerName)
            .putString("last_status", finalConfig.lastStatus)
            .putString("last_error", finalConfig.lastError)
            .apply {
                if (finalConfig.lastConnectedAt != null) {
                    putLong("last_connected_at", finalConfig.lastConnectedAt)
                } else {
                    remove("last_connected_at")
                }
            }
            .apply()
        _state.value = finalConfig
    }

    private fun RemoteBridgeConfig.ensureIds(): RemoteBridgeConfig {
        return copy(
            localDeviceId = localDeviceId.ifBlank { "android_${UUID.randomUUID()}" },
            localDisplayName = localDisplayName.ifBlank { android.os.Build.MODEL ?: "Xiaoxiami Android" }
        )
    }
}
