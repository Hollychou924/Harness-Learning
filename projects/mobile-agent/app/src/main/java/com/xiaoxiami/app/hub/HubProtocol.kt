package com.xiaoxiami.app.hub

import com.google.gson.annotations.SerializedName

/**
 * Hub protocol message types.
 * Ported from desktop-claw's agent/src/hub/protocol.ts.
 * Supports both V1 (basic) and V2 (smart routing) protocols.
 */

// --- Envelope ---

data class HubMessageEnvelope(
    val type: String,
    val source: DeviceEndpoint? = null,
    val target: DeviceEndpoint? = null,
    val payload: Any? = null,
    @SerializedName("message_id") val messageId: String? = null,
    val timestamp: String? = null
)

data class DeviceEndpoint(
    @SerializedName("device_type") val deviceType: String,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("device_name") val deviceName: String = ""
)

// --- Registration ---

data class RegisterPayloadV2(
    @SerializedName("device_type") val deviceType: String = "phone",
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("device_name") val deviceName: String,
    @SerializedName("pairing_code") val pairingCode: String? = null,
    @SerializedName("capability_declaration") val capabilityDeclaration: DeviceCapabilityDeclaration,
    @SerializedName("protocol_version") val protocolVersion: String = "2.0"
)

data class RegisterResponsePayload(
    val status: String, // "registered" | "rejected"
    val reason: String? = null
)

// --- Capabilities ---

data class DeviceCapabilityDeclaration(
    @SerializedName("device_type") val deviceType: String = "phone",
    val os: String = "android",
    @SerializedName("device_model") val deviceModel: String = "",
    @SerializedName("capability_domains") val capabilityDomains: List<String> = emptyList(),
    val tools: List<ToolDeclaration> = emptyList(),
    val description: String = "",
    val limitations: List<String> = emptyList()
)

data class ToolDeclaration(
    val name: String,
    val description: String,
    @SerializedName("use_cases") val useCases: List<String> = emptyList()
)

// --- Task Dispatch ---

data class TaskDispatchPayload(
    @SerializedName("task_id") val taskId: String,
    val query: String,
    @SerializedName("exec_mode") val execMode: String = "auto",
    @SerializedName("max_steps") val maxSteps: Int = 10,
    @SerializedName("conversation_id") val conversationId: String? = null,
    @SerializedName("source_device_type") val sourceDeviceType: String? = null,
    @SerializedName("source_device_id") val sourceDeviceId: String? = null,
    @SerializedName("source_device_name") val sourceDeviceName: String? = null
)

data class TaskProgressPayload(
    @SerializedName("task_id") val taskId: String,
    val step: Int = 0,
    val total: Int = 0,
    @SerializedName("action_type") val actionType: String = "",
    val summary: String = ""
)

data class TaskResultPayload(
    @SerializedName("task_id") val taskId: String,
    val status: String, // "completed" | "failed" | "cancelled"
    val summary: String = "",
    @SerializedName("stop_reason") val stopReason: String = "",
    @SerializedName("total_steps") val totalSteps: Int = 0
)

// --- Smart Routing (V2) ---

data class SmartRouteRequestPayload(
    @SerializedName("request_id") val requestId: String,
    val query: String,
    @SerializedName("max_steps_per_device") val maxStepsPerDevice: Int = 10
)

data class ExecutionPlanPayload(
    @SerializedName("plan_id") val planId: String,
    @SerializedName("sub_tasks") val subTasks: List<SubTaskPlan> = emptyList(),
    val strategy: String = "sequential" // "parallel" | "sequential" | "dag"
)

data class SubTaskPlan(
    @SerializedName("sub_task_id") val subTaskId: String,
    val query: String,
    @SerializedName("target_device_id") val targetDeviceId: String? = null,
    @SerializedName("target_device_type") val targetDeviceType: String? = null,
    val order: Int = 0,
    @SerializedName("depends_on") val dependsOn: List<String> = emptyList()
)

data class SubTaskResultPayload(
    @SerializedName("request_id") val requestId: String,
    @SerializedName("sub_task_id") val subTaskId: String,
    @SerializedName("device_id") val deviceId: String,
    val status: String,
    val result: String = "",
    val error: String? = null
)

// --- Device Discovery ---

data class ConnectedDevice(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("device_type") val deviceType: String,
    @SerializedName("device_name") val deviceName: String,
    val model: String = "",
    @SerializedName("capability_domains") val capabilityDomains: List<String> = emptyList(),
    val status: String = "online" // "online" | "busy" | "idle"
)

data class ListDevicesResponsePayload(
    val devices: List<ConnectedDevice> = emptyList()
)

// --- Connection Status ---

enum class HubConnectionStatus {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    REJECTED,
    ERROR
}

data class HubConfig(
    val hubUrl: String = "",
    val deviceId: String = "",
    val deviceName: String = "",
    val paired: Boolean = false,
    val autoConnect: Boolean = false,
    val pairingCode: String? = null
)
