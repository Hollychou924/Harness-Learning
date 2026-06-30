package com.xiaoxiami.app.remote

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolExecutionMode
import com.xiaoxiami.app.agent.ToolExecutor
import com.xiaoxiami.app.repository.RemoteAndroidBridgeRepository
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

data class RemoteBridgeConnectionState(
    val status: String = "disconnected",
    val connected: Boolean = false,
    val bridgeUrl: String = "",
    val pairedPeerId: String = "",
    val pairedPeerName: String = "",
    val lastError: String = "",
    val lastHeartbeatAt: Long? = null
)

class RemoteAndroidBridgeManager(
    private val appContext: Context,
    private val configStore: RemoteBridgeConfigStore,
    private val repository: RemoteAndroidBridgeRepository,
    private val toolExecutorFactory: () -> ToolExecutor
) {
    companion object {
        private const val TAG = "RemoteBridgeManager"
        private const val HEARTBEAT_INTERVAL_MS = 30_000L
    }

    private val gson = Gson()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(20, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val _state = MutableStateFlow(
        RemoteBridgeConnectionState(
            status = configStore.state.value.lastStatus,
            connected = configStore.state.value.lastStatus == "connected",
            bridgeUrl = configStore.state.value.bridgeUrl,
            pairedPeerId = configStore.state.value.pairedPeerId,
            pairedPeerName = configStore.state.value.pairedPeerName,
            lastError = configStore.state.value.lastError,
            lastHeartbeatAt = configStore.state.value.lastConnectedAt
        )
    )
    val state: StateFlow<RemoteBridgeConnectionState> = _state.asStateFlow()

    @Volatile
    private var webSocket: WebSocket? = null
    private var heartbeatJob: Job? = null
    private var reconnectJob: Job? = null
    private var reconnectAttempt = 0

    fun connectIfConfigured() {
        val config = configStore.state.value
        if (!config.enabled || config.bridgeUrl.isBlank() || config.pairingCode.isBlank()) {
            return
        }
        connect(config)
    }

    fun pairAndConnect(
        bridgeUrl: String,
        pairingCode: String,
        localDisplayName: String
    ) {
        configStore.update(
            bridgeUrl = bridgeUrl,
            pairingCode = pairingCode,
            localDisplayName = localDisplayName,
            enabled = true
        )
        connect(configStore.state.value)
    }

    suspend fun sendToolRequest(
        deviceId: String,
        toolName: String,
        arguments: Map<String, Any?>,
        timeoutMs: Long = 30_000L
    ): Map<String, Any?> {
        val socket = webSocket ?: return mapOf(
            "queued" to false,
            "error" to "bridge 未连接"
        )
        val targetDeviceId = deviceId.ifBlank {
            configStore.state.value.pairedPeerId
        }
        if (targetDeviceId.isBlank()) {
            return mapOf(
                "queued" to false,
                "error" to "没有已配对的远端设备"
            )
        }
        val request = repository.createPendingRequest(
            deviceId = targetDeviceId,
            toolName = toolName,
            payload = arguments,
            timeoutMs = timeoutMs
        )
        val envelope = RemoteBridgeEnvelope(
            requestId = request.id,
            deviceId = configStore.state.value.localDeviceId,
            type = RemoteBridgeMessageType.TOOL_REQUEST,
            payload = mapOf(
                "targetDeviceId" to targetDeviceId,
                "toolName" to toolName,
                "arguments" to arguments,
                "timeoutMs" to timeoutMs
            )
        )
        val queued = socket.send(gson.toJson(envelope))
        return mapOf(
            "queued" to queued,
            "requestId" to request.id,
            "deviceId" to targetDeviceId,
            "timeoutAt" to request.timeoutAt
        )
    }

    fun disconnect(clearPairing: Boolean = false) {
        heartbeatJob?.cancel()
        reconnectJob?.cancel()
        webSocket?.close(1000, "disconnect")
        webSocket = null
        reconnectAttempt = 0
        if (clearPairing) {
            configStore.disconnect(clearPeer = true)
        } else {
            configStore.markStatus("disconnected", "")
        }
        publishState(
            status = "disconnected",
            connected = false,
            lastError = "",
            heartbeatAt = _state.value.lastHeartbeatAt
        )
    }

    private fun connect(config: RemoteBridgeConfig) {
        if (config.bridgeUrl.isBlank() || config.pairingCode.isBlank()) {
            configStore.markStatus("error", "bridgeUrl 或 pairingCode 为空")
            publishState(status = "error", connected = false, lastError = "bridgeUrl 或 pairingCode 为空")
            return
        }
        reconnectJob?.cancel()
        heartbeatJob?.cancel()
        webSocket?.cancel()
        publishState(status = "connecting", connected = false, bridgeUrl = config.bridgeUrl, lastError = "")
        configStore.markStatus("connecting", "")

        val request = Request.Builder()
            .url(config.bridgeUrl)
            .build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                reconnectAttempt = 0
                sendHello(webSocket, configStore.state.value)
                startHeartbeat()
                publishState(
                    status = "pairing",
                    connected = true,
                    bridgeUrl = configStore.state.value.bridgeUrl,
                    pairedPeerId = configStore.state.value.pairedPeerId,
                    pairedPeerName = configStore.state.value.pairedPeerName,
                    lastError = ""
                )
                configStore.markStatus("pairing", "")
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                scope.launch {
                    handleMessage(text)
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                heartbeatJob?.cancel()
                publishState(status = "disconnected", connected = false, lastError = reason)
                if (configStore.state.value.enabled) {
                    scheduleReconnect("closed:$code")
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(code, reason)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                heartbeatJob?.cancel()
                val error = t.message ?: "bridge websocket failure"
                Log.e(TAG, "bridge failure", t)
                configStore.markStatus("error", error)
                publishState(status = "error", connected = false, lastError = error)
                if (configStore.state.value.enabled) {
                    scheduleReconnect(error)
                }
            }
        })
    }

    private fun sendHello(webSocket: WebSocket, config: RemoteBridgeConfig) {
        val payload = mapOf(
            "deviceId" to config.localDeviceId,
            "displayName" to config.localDisplayName,
            "platform" to "android",
            "pairingCode" to config.pairingCode,
            "sessionToken" to config.sessionToken,
            "capabilities" to localCapabilities(),
            "scopes" to localScopes()
        )
        val envelope = RemoteBridgeEnvelope(
            requestId = "hello_${System.currentTimeMillis()}",
            deviceId = config.localDeviceId,
            type = RemoteBridgeMessageType.HELLO,
            payload = payload
        )
        webSocket.send(gson.toJson(envelope))
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (true) {
                delay(HEARTBEAT_INTERVAL_MS)
                val config = configStore.state.value
                val socket = webSocket ?: break
                val envelope = RemoteBridgeEnvelope(
                    requestId = "heartbeat_${System.currentTimeMillis()}",
                    deviceId = config.localDeviceId,
                    type = RemoteBridgeMessageType.HEARTBEAT,
                    payload = mapOf(
                        "status" to "online",
                        "capabilities" to localCapabilities(),
                        "scopes" to localScopes()
                    )
                )
                socket.send(gson.toJson(envelope))
                publishState(
                    status = _state.value.status,
                    connected = true,
                    heartbeatAt = System.currentTimeMillis()
                )
            }
        }
    }

    private suspend fun handleMessage(raw: String) {
        val envelope = runCatching {
            gson.fromJson(raw, RemoteBridgeEnvelope::class.java)
        }.getOrElse {
            Log.e(TAG, "invalid bridge message: $raw", it)
            return
        }
        when (envelope.type) {
            RemoteBridgeMessageType.HELLO -> handleHelloAck(envelope)
            RemoteBridgeMessageType.HEARTBEAT -> handleHeartbeat(envelope)
            RemoteBridgeMessageType.TOOL_RESPONSE -> handleToolResponse(envelope)
            RemoteBridgeMessageType.TOOL_REQUEST -> handleToolRequest(envelope)
            RemoteBridgeMessageType.EVENT -> handleEvent(envelope)
        }
    }

    private suspend fun handleHelloAck(envelope: RemoteBridgeEnvelope) {
        val payload = envelope.payload
        val accepted = payload["accepted"]?.toString()?.toBooleanStrictOrNull() ?: true
        if (!accepted) {
            val reason = payload["reason"]?.toString().orEmpty().ifBlank { "pairing rejected" }
            configStore.markStatus("error", reason)
            publishState(status = "error", connected = false, lastError = reason)
            return
        }
        val sessionToken = payload["sessionToken"]?.toString().orEmpty()
        val peerId = payload["peerDeviceId"]?.toString().orEmpty()
        val peerName = payload["peerDisplayName"]?.toString().orEmpty()
        val peerPlatform = payload["peerPlatform"]?.toString().orEmpty().ifBlank { "desktop" }
        val peerCapabilities = payload.stringList("peerCapabilities")
        val peerScopes = payload.stringList("peerScopes")

        configStore.markConnected(
            sessionToken = sessionToken,
            pairedPeerId = peerId,
            pairedPeerName = peerName,
            status = "connected"
        )
        if (peerId.isNotBlank()) {
            repository.upsertPairedPeer(
                deviceId = peerId,
                displayName = peerName.ifBlank { peerId },
                platform = peerPlatform,
                bridgeUrl = configStore.state.value.bridgeUrl,
                sessionToken = sessionToken,
                capabilities = peerCapabilities,
                scopes = peerScopes,
                status = "ONLINE"
            )
        }
        publishState(
            status = "connected",
            connected = true,
            bridgeUrl = configStore.state.value.bridgeUrl,
            pairedPeerId = peerId,
            pairedPeerName = peerName,
            lastError = "",
            heartbeatAt = System.currentTimeMillis()
        )
    }

    private suspend fun handleHeartbeat(envelope: RemoteBridgeEnvelope) {
        val payload = envelope.payload
        val deviceId = payload["deviceId"]?.toString().orEmpty().ifBlank { envelope.deviceId }
        if (deviceId.isNotBlank()) {
            repository.updateHeartbeat(
                RemoteBridgeHeartbeat(
                    deviceId = deviceId,
                    status = payload["status"]?.toString().orEmpty().ifBlank { "ONLINE" },
                    activeRequestIds = payload.stringList("activeRequestIds"),
                    capabilities = payload.stringList("capabilities")
                )
            )
        }
        publishState(
            status = _state.value.status.ifBlank { "connected" },
            connected = true,
            heartbeatAt = System.currentTimeMillis()
        )
    }

    private suspend fun handleToolResponse(envelope: RemoteBridgeEnvelope) {
        val payload = envelope.payload
        val success = payload["success"]?.toString()?.toBooleanStrictOrNull() ?: true
        val responsePayload = payload.mapArg("payload")
        val error = payload["error"]?.toString().orEmpty()
        repository.completeRequest(
            requestId = envelope.requestId,
            success = success,
            payload = responsePayload,
            errorMessage = error
        )
    }

    private suspend fun handleToolRequest(envelope: RemoteBridgeEnvelope) {
        val payload = envelope.payload
        val toolName = payload["toolName"]?.toString().orEmpty()
        val arguments = payload.mapArg("arguments")
        if (toolName.isBlank()) {
            sendToolResponse(
                requestId = envelope.requestId,
                success = false,
                payload = emptyMap(),
                error = "missing toolName"
            )
            return
        }

        val toolExecutor = toolExecutorFactory()
        val tool = toolExecutor.getTool(toolName)
        if (tool == null) {
            sendToolResponse(
                requestId = envelope.requestId,
                success = false,
                payload = emptyMap(),
                error = "tool not available for remote operator: $toolName"
            )
            return
        }

        if (tool.schema.executionMode == ToolExecutionMode.USER_INTERACTION) {
            sendToolResponse(
                requestId = envelope.requestId,
                success = false,
                payload = emptyMap(),
                error = "remote bridge does not support interactive tools: $toolName"
            )
            return
        }

        val context = ToolContext(
            sessionId = "remote_bridge_${envelope.requestId}",
            modelId = "remote_bridge",
            userGoal = "远端桥接工具执行",
            conversationHistory = emptyList(),
            deviceId = configStore.state.value.localDeviceId
        )
        val approvalRequirement = tool.getApprovalRequirement(arguments, context)
        if (approvalRequirement.required) {
            sendToolResponse(
                requestId = envelope.requestId,
                success = false,
                payload = emptyMap(),
                error = "tool requires local approval: $toolName"
            )
            return
        }

        val result = toolExecutor.execute(
            toolName = toolName,
            arguments = arguments,
            context = context
        )
        sendToolResponse(
            requestId = envelope.requestId,
            success = result.success,
            payload = mapOf(
                "output" to result.output,
                "attempts" to result.attempts
            ),
            error = result.error
        )
    }

    private fun handleEvent(envelope: RemoteBridgeEnvelope) {
        val payload = envelope.payload
        val status = payload["status"]?.toString().orEmpty()
        val error = payload["error"]?.toString().orEmpty()
        if (status.isNotBlank()) {
            configStore.markStatus(status, error)
            publishState(
                status = status.lowercase(),
                connected = status.equals("connected", ignoreCase = true) || _state.value.connected,
                lastError = error
            )
        }
    }

    private fun sendToolResponse(
        requestId: String,
        success: Boolean,
        payload: Map<String, Any?>,
        error: String?
    ) {
        val config = configStore.state.value
        val envelope = RemoteBridgeEnvelope(
            requestId = requestId,
            deviceId = config.localDeviceId,
            type = RemoteBridgeMessageType.TOOL_RESPONSE,
            payload = mapOf(
                "success" to success,
                "payload" to payload,
                "error" to error
            )
        )
        webSocket?.send(gson.toJson(envelope))
    }

    private fun scheduleReconnect(reason: String) {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            reconnectAttempt += 1
            val delayMs = when (reconnectAttempt) {
                1 -> 3_000L
                2 -> 8_000L
                else -> 15_000L
            }
            publishState(status = "reconnecting", connected = false, lastError = reason)
            delay(delayMs)
            connectIfConfigured()
        }
    }

    private fun publishState(
        status: String = _state.value.status,
        connected: Boolean = _state.value.connected,
        bridgeUrl: String = configStore.state.value.bridgeUrl,
        pairedPeerId: String = configStore.state.value.pairedPeerId,
        pairedPeerName: String = configStore.state.value.pairedPeerName,
        lastError: String = configStore.state.value.lastError,
        heartbeatAt: Long? = _state.value.lastHeartbeatAt
    ) {
        _state.value = RemoteBridgeConnectionState(
            status = status,
            connected = connected,
            bridgeUrl = bridgeUrl,
            pairedPeerId = pairedPeerId,
            pairedPeerName = pairedPeerName,
            lastError = lastError,
            lastHeartbeatAt = heartbeatAt
        )
    }

    private fun localCapabilities(): List<String> {
        return listOf(
            "notifications",
            "foreground_app",
            "calendar",
            "contacts",
            "location",
            "device_control",
            "memory"
        )
    }

    private fun localScopes(): List<String> {
        return listOf(
            "notification",
            "personal_data",
            "device_control",
            "memory"
        )
    }
}

private fun Map<String, Any?>.stringList(key: String): List<String> {
    val raw = this[key] ?: return emptyList()
    return when (raw) {
        is List<*> -> raw.mapNotNull { it?.toString() }
        else -> emptyList()
    }
}

private fun Map<String, Any?>.mapArg(key: String): Map<String, Any?> {
    val raw = this[key] ?: return emptyMap()
    return when (raw) {
        is Map<*, *> -> raw.entries.associateNotNull { entry ->
            val name = entry.key?.toString()?.takeIf { it.isNotBlank() } ?: return@associateNotNull null
            name to entry.value
        }
        is JsonObject -> Gson().fromJson(raw, Map::class.java) as? Map<String, Any?> ?: emptyMap()
        else -> emptyMap()
    }
}

private inline fun <K, V, R> Iterable<Map.Entry<K, V>>.associateNotNull(
    transform: (Map.Entry<K, V>) -> Pair<R, V>?
): Map<R, V> {
    val result = linkedMapOf<R, V>()
    for (entry in this) {
        val transformed = transform(entry) ?: continue
        result[transformed.first] = transformed.second
    }
    return result
}
