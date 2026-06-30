package com.xiaoxiami.app.hub

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.*
import java.io.File
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * WebSocket-based Hub client for cross-device collaboration.
 * Ported from desktop-claw's agent/src/hub/hubClient.ts.
 *
 * Coexists with the existing Remote Bridge system.
 * Hub enables smart routing between desktop and mobile agents.
 */
class HubClient(private val context: Context) {

    companion object {
        private const val TAG = "HubClient"
        private const val HEARTBEAT_INTERVAL_MS = 15_000L
        private const val RECONNECT_BASE_MS = 1_000L
        private const val RECONNECT_MAX_MS = 30_000L
    }

    private val gson = Gson()
    private val configFile = File(context.filesDir, "hub/hub_config.json")
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .pingInterval(10, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var heartbeatJob: Job? = null
    private var reconnectJob: Job? = null
    private var reconnectDelay = RECONNECT_BASE_MS
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // Observable state
    private val _status = MutableStateFlow(HubConnectionStatus.DISCONNECTED)
    val status: StateFlow<HubConnectionStatus> = _status.asStateFlow()

    private val _config = MutableStateFlow(HubConfig())
    val config: StateFlow<HubConfig> = _config.asStateFlow()

    private val _connectedDevices = MutableStateFlow<List<ConnectedDevice>>(emptyList())
    val connectedDevices: StateFlow<List<ConnectedDevice>> = _connectedDevices.asStateFlow()

    // Callbacks
    var onTaskDispatch: ((TaskDispatchPayload) -> Unit)? = null
    var onExecutionPlan: ((ExecutionPlanPayload) -> Unit)? = null
    var onSmartRouteResult: ((String) -> Unit)? = null

    private var capabilityDeclaration: DeviceCapabilityDeclaration? = null

    init {
        loadConfig()
    }

    /** Set the device capability declaration (call before connect). */
    fun setCapabilities(declaration: DeviceCapabilityDeclaration) {
        capabilityDeclaration = declaration
    }

    /** Connect to the Hub server. */
    fun connect(hubUrl: String? = null, pairingCode: String? = null) {
        val url = hubUrl ?: _config.value.hubUrl
        if (url.isBlank()) {
            Log.w(TAG, "No Hub URL configured")
            return
        }

        _status.value = HubConnectionStatus.CONNECTING

        val wsUrl = url.replace("http://", "ws://").replace("https://", "wss://")
            .trimEnd('/') + "/ws"

        val request = Request.Builder().url(wsUrl).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(TAG, "WebSocket connected to Hub")
                _status.value = HubConnectionStatus.CONNECTED
                reconnectDelay = RECONNECT_BASE_MS

                // Register with capabilities
                register(pairingCode ?: _config.value.pairingCode)
                startHeartbeat()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failure", t)
                _status.value = HubConnectionStatus.ERROR
                scheduleReconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "WebSocket closed: $reason")
                _status.value = HubConnectionStatus.DISCONNECTED
                if (code != 1000) scheduleReconnect()
            }
        })
    }

    /** Disconnect from the Hub. */
    fun disconnect() {
        heartbeatJob?.cancel()
        reconnectJob?.cancel()
        webSocket?.close(1000, "User disconnect")
        webSocket = null
        _status.value = HubConnectionStatus.DISCONNECTED
    }

    /** Send task progress update. */
    fun sendTaskProgress(taskId: String, step: Int, total: Int, summary: String) {
        send("task_progress", TaskProgressPayload(
            taskId = taskId,
            step = step,
            total = total,
            summary = summary
        ))
    }

    /** Send task result. */
    fun sendTaskResult(taskId: String, status: String, summary: String, totalSteps: Int = 0) {
        send("task_result", TaskResultPayload(
            taskId = taskId,
            status = status,
            summary = summary,
            totalSteps = totalSteps
        ))
    }

    /** Send sub-task result (V2 smart routing). */
    fun sendSubTaskResult(requestId: String, subTaskId: String, status: String, result: String) {
        send("sub_task_result", SubTaskResultPayload(
            requestId = requestId,
            subTaskId = subTaskId,
            deviceId = _config.value.deviceId,
            status = status,
            result = result
        ))
    }

    /** Request list of connected devices. */
    fun requestDeviceList() {
        send("list_devices_request", mapOf<String, Any>())
    }

    /** Save Hub configuration. */
    fun saveConfig(config: HubConfig) {
        _config.value = config
        persistConfig()
    }

    // --- Private helpers ---

    private fun register(pairingCode: String?) {
        val cap = capabilityDeclaration ?: return
        val config = _config.value
        val payload = RegisterPayloadV2(
            deviceType = "phone",
            deviceId = config.deviceId.ifBlank { UUID.randomUUID().toString() },
            deviceName = config.deviceName.ifBlank { android.os.Build.MODEL },
            pairingCode = pairingCode,
            capabilityDeclaration = cap
        )
        send("register", payload)
    }

    private fun handleMessage(text: String) {
        try {
            val envelope = gson.fromJson(text, JsonObject::class.java)
            val type = envelope.get("type")?.asString ?: return
            val payload = envelope.getAsJsonObject("payload") ?: envelope

            when (type) {
                "register_response" -> {
                    val response = gson.fromJson(payload, RegisterResponsePayload::class.java)
                    if (response.status == "registered") {
                        _status.value = HubConnectionStatus.CONNECTED
                        _config.value = _config.value.copy(paired = true)
                        persistConfig()
                        Log.i(TAG, "Registered with Hub successfully")
                    } else {
                        _status.value = HubConnectionStatus.REJECTED
                        Log.w(TAG, "Hub registration rejected: ${response.reason}")
                    }
                }

                "task_dispatch" -> {
                    val task = gson.fromJson(payload, TaskDispatchPayload::class.java)
                    Log.i(TAG, "Received task dispatch: ${task.taskId}")
                    onTaskDispatch?.invoke(task)
                }

                "execution_plan" -> {
                    val plan = gson.fromJson(payload, ExecutionPlanPayload::class.java)
                    Log.i(TAG, "Received execution plan: ${plan.planId}")
                    onExecutionPlan?.invoke(plan)
                }

                "list_devices_response" -> {
                    val response = gson.fromJson(payload, ListDevicesResponsePayload::class.java)
                    _connectedDevices.value = response.devices
                }

                "heartbeat_ack" -> {
                    // Heartbeat acknowledged
                }

                "smart_route_result" -> {
                    onSmartRouteResult?.invoke(payload.toString())
                }

                else -> {
                    Log.d(TAG, "Unhandled Hub message type: $type")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling Hub message", e)
        }
    }

    private fun send(type: String, payload: Any) {
        val config = _config.value
        val envelope = mapOf(
            "type" to type,
            "source" to mapOf(
                "device_type" to "phone",
                "device_id" to config.deviceId,
                "device_name" to config.deviceName
            ),
            "payload" to payload,
            "message_id" to UUID.randomUUID().toString(),
            "timestamp" to java.time.Instant.now().toString()
        )
        webSocket?.send(gson.toJson(envelope))
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive) {
                delay(HEARTBEAT_INTERVAL_MS)
                send("heartbeat", mapOf<String, Any>())
            }
        }
    }

    private fun scheduleReconnect() {
        if (_config.value.autoConnect) {
            reconnectJob?.cancel()
            reconnectJob = scope.launch {
                delay(reconnectDelay)
                reconnectDelay = (reconnectDelay * 2).coerceAtMost(RECONNECT_MAX_MS)
                connect()
            }
        }
    }

    private fun loadConfig() {
        try {
            if (configFile.exists()) {
                _config.value = gson.fromJson(configFile.readText(), HubConfig::class.java)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load Hub config", e)
        }
    }

    private fun persistConfig() {
        try {
            configFile.parentFile?.mkdirs()
            configFile.writeText(gson.toJson(_config.value))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save Hub config", e)
        }
    }
}
