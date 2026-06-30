package com.xiaoxiami.app.remote

data class RemoteBridgeEnvelope(
    val version: String = "bridge_v1",
    val requestId: String,
    val deviceId: String,
    val type: RemoteBridgeMessageType,
    val payload: Map<String, Any?> = emptyMap(),
    val sentAt: Long = System.currentTimeMillis()
)

enum class RemoteBridgeMessageType {
    HELLO,
    HEARTBEAT,
    TOOL_REQUEST,
    TOOL_RESPONSE,
    EVENT
}

data class RemoteBridgeDeviceHello(
    val deviceId: String,
    val displayName: String,
    val platform: String = "android",
    val capabilities: List<String> = emptyList(),
    val scopes: List<String> = emptyList()
)

data class RemoteBridgeHeartbeat(
    val deviceId: String,
    val status: String,
    val activeRequestIds: List<String> = emptyList(),
    val capabilities: List<String> = emptyList()
)

data class RemoteToolRequest(
    val requestId: String,
    val deviceId: String,
    val toolName: String,
    val arguments: Map<String, Any?> = emptyMap(),
    val timeoutMs: Long = 30_000L
)

data class RemoteToolResponse(
    val requestId: String,
    val deviceId: String,
    val success: Boolean,
    val payload: Map<String, Any?> = emptyMap(),
    val error: String? = null
)
