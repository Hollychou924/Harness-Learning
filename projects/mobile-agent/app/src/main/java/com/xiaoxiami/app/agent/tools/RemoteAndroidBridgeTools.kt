package com.xiaoxiami.app.agent.tools

import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAvailability
import com.xiaoxiami.app.agent.ToolCallerIdentity
import com.xiaoxiami.app.agent.ToolContentRisk
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolExecutionMode
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolScope
import com.xiaoxiami.app.agent.ToolValueType
import com.xiaoxiami.app.remote.RemoteAndroidBridgeManager
import com.xiaoxiami.app.repository.RemoteAndroidBridgeRepository

class RemoteAndroidBridgeStatusTool(
    private val bridgeManager: RemoteAndroidBridgeManager
) : Tool {
    override val schema = ToolSchema(
        name = "remote_android_bridge_status",
        description = "Inspect the local phone's remote bridge connection and pairing status.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        executionMode = ToolExecutionMode.DIRECT,
        capabilities = listOf("remote_bridge", "pairing"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("remote_android"),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        scopes = listOf(ToolScope.REMOTE_BRIDGE),
        inputSchema = emptyList(),
        outputSchema = listOf(
            ToolFieldSchema("status", ToolValueType.STRING, "Current bridge connection status."),
            ToolFieldSchema("connected", ToolValueType.BOOLEAN, "Whether the socket is connected.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val state = bridgeManager.state.value
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "status" to state.status,
                    "connected" to state.connected,
                    "bridgeUrl" to state.bridgeUrl,
                    "pairedPeerId" to state.pairedPeerId,
                    "pairedPeerName" to state.pairedPeerName,
                    "lastError" to state.lastError,
                    "lastHeartbeatAt" to state.lastHeartbeatAt
                )
            )
        )
    }
}

class RemoteAndroidPairTool(
    private val bridgeManager: RemoteAndroidBridgeManager
) : Tool {
    override val schema = ToolSchema(
        name = "remote_android_pair",
        description = "Configure bridge URL and pairing code, then connect this phone as a remote Android node.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        executionMode = ToolExecutionMode.DIRECT,
        capabilities = listOf("remote_bridge", "pairing"),
        riskLevel = ToolRiskLevel.HIGH,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("remote_android"),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        scopes = listOf(ToolScope.REMOTE_BRIDGE),
        approvalRequired = true,
        approvalReason = "接入远端桥会让这台手机接受外部节点的远程调用请求。",
        approvalSummary = "Agent 请求把当前手机接入 remote_android_bridge",
        inputSchema = listOf(
            ToolParameterSchema("bridgeUrl", ToolValueType.STRING, "WebSocket bridge URL such as wss://host/ws.", required = true),
            ToolParameterSchema("pairingCode", ToolValueType.STRING, "Pairing code issued by the other side or bridge.", required = true),
            ToolParameterSchema("localDisplayName", ToolValueType.STRING, "Optional display name for this phone node.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("status", ToolValueType.STRING, "Current connection status."),
            ToolFieldSchema("bridgeUrl", ToolValueType.STRING, "Configured bridge URL.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val bridgeUrl = arguments.stringArg("bridgeUrl")
        val pairingCode = arguments.stringArg("pairingCode")
        if (bridgeUrl.isBlank() || pairingCode.isBlank()) {
            return ToolResult(false, "", "bridgeUrl 和 pairingCode 必填")
        }
        bridgeManager.pairAndConnect(
            bridgeUrl = bridgeUrl,
            pairingCode = pairingCode,
            localDisplayName = arguments.stringArg("localDisplayName")
        )
        val state = bridgeManager.state.value
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "status" to state.status,
                    "connected" to state.connected,
                    "bridgeUrl" to bridgeUrl
                )
            )
        )
    }
}

class RemoteAndroidDisconnectTool(
    private val bridgeManager: RemoteAndroidBridgeManager
) : Tool {
    override val schema = ToolSchema(
        name = "remote_android_disconnect",
        description = "Disconnect the phone from remote bridge transport and stop accepting remote requests.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        executionMode = ToolExecutionMode.DIRECT,
        capabilities = listOf("remote_bridge", "pairing"),
        riskLevel = ToolRiskLevel.HIGH,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("remote_android"),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        scopes = listOf(ToolScope.REMOTE_BRIDGE),
        approvalRequired = true,
        approvalReason = "断开远端桥会停止当前手机节点的跨端联动。",
        approvalSummary = "Agent 请求断开 remote_android_bridge",
        inputSchema = listOf(
            ToolParameterSchema("clearPairing", ToolValueType.BOOLEAN, "Whether to clear saved pairing peer info.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        bridgeManager.disconnect(clearPairing = arguments.booleanArg("clearPairing", false))
        return ToolResult(
            success = true,
            output = jsonOutput(mapOf("success" to true))
        )
    }
}

class RemoteAndroidCallPeerTool(
    private val bridgeManager: RemoteAndroidBridgeManager
) : Tool {
    override val schema = ToolSchema(
        name = "remote_android_call_peer_tool",
        plannerVisible = false,
        description = "Send a structured tool request to a paired remote bridge peer and return the queued request metadata.",
        hostKind = ToolHostKind.REMOTE_ANDROID,
        executionMode = ToolExecutionMode.REMOTE_BRIDGE,
        capabilities = listOf("remote_bridge", "request_response"),
        riskLevel = ToolRiskLevel.HIGH,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("remote_android"),
        allowedIdentities = listOf(ToolCallerIdentity.USER_INTERACTIVE),
        scopes = listOf(ToolScope.REMOTE_BRIDGE),
        approvalRequired = true,
        approvalReason = "向远端节点发送 tool request 可能触发对端执行实际动作。",
        approvalSummary = "Agent 请求向已配对节点发送远端工具调用",
        inputSchema = listOf(
            ToolParameterSchema("toolName", ToolValueType.STRING, "Tool name to invoke on the paired peer.", required = true),
            ToolParameterSchema("arguments", ToolValueType.OBJECT, "Structured arguments for the peer tool.", required = false),
            ToolParameterSchema("deviceId", ToolValueType.STRING, "Optional explicit peer device ID.", required = false),
            ToolParameterSchema("timeoutSeconds", ToolValueType.INTEGER, "Optional timeout in seconds.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("queued", ToolValueType.BOOLEAN, "Whether the request was queued for transport."),
            ToolFieldSchema("requestId", ToolValueType.STRING, "Bridge request ID.", required = false)
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val toolName = arguments.stringArg("toolName")
        if (toolName.isBlank()) {
            return ToolResult(false, "", "toolName 不能为空")
        }
        val result = bridgeManager.sendToolRequest(
            deviceId = arguments.stringArg("deviceId"),
            toolName = toolName,
            arguments = arguments.mapArg("arguments"),
            timeoutMs = arguments.intArg("timeoutSeconds", 30).coerceIn(5, 300) * 1000L
        )
        val queued = result["queued"] as? Boolean ?: false
        return ToolResult(
            success = queued,
            output = jsonOutput(result),
            error = if (queued) null else result["error"]?.toString()
        )
    }
}

class RemoteAndroidDevicesTool(
    private val bridgeRepository: RemoteAndroidBridgeRepository
) : Tool {
    override val schema = ToolSchema(
        name = "remote_android_devices",
        description = "List paired remote Android devices that can serve as bridge execution nodes.",
        hostKind = ToolHostKind.REMOTE_ANDROID,
        executionMode = ToolExecutionMode.REMOTE_BRIDGE,
        capabilities = listOf("remote_bridge", "device_registry"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("remote_android"),
        allowedIdentities = listOf(
            ToolCallerIdentity.USER_INTERACTIVE,
            ToolCallerIdentity.REMOTE_OPERATOR
        ),
        scopes = listOf(ToolScope.REMOTE_BRIDGE),
        contentRisks = listOf(ToolContentRisk.REMOTE_DEVICE_PAYLOAD),
        inputSchema = listOf(
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum number of devices to return.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("items", ToolValueType.ARRAY, "Known remote Android devices.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val devices = bridgeRepository.listDevices(arguments.intArg("limit", 20))
        return ToolResult(
            success = true,
            output = jsonOutput(
                mapOf(
                    "items" to devices.map { device ->
                        mapOf(
                            "id" to device.id,
                            "displayName" to device.displayName,
                            "platform" to device.platform,
                            "status" to device.status,
                            "transport" to device.transport,
                            "authScope" to device.authScope,
                            "trustLevel" to device.trustLevel,
                            "capabilities" to device.capabilities,
                            "scopes" to device.scopes,
                            "lastSeenAt" to device.lastSeenAt,
                            "pairedAt" to device.pairedAt
                        )
                    }
                )
            )
        )
    }
}

class RemoteAndroidRequestStatusTool(
    private val bridgeRepository: RemoteAndroidBridgeRepository
) : Tool {
    override val schema = ToolSchema(
        name = "remote_android_request_status",
        description = "Inspect remote Android bridge requests, including timeout state.",
        hostKind = ToolHostKind.REMOTE_ANDROID,
        executionMode = ToolExecutionMode.REMOTE_BRIDGE,
        capabilities = listOf("remote_bridge", "audit"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("remote_android"),
        allowedIdentities = listOf(
            ToolCallerIdentity.USER_INTERACTIVE,
            ToolCallerIdentity.REMOTE_OPERATOR
        ),
        scopes = listOf(ToolScope.REMOTE_BRIDGE),
        contentRisks = listOf(ToolContentRisk.REMOTE_DEVICE_PAYLOAD),
        inputSchema = listOf(
            ToolParameterSchema("deviceId", ToolValueType.STRING, "Optional device ID filter.", required = false),
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum rows to return.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("items", ToolValueType.ARRAY, "Remote bridge requests.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val items = bridgeRepository.listRequests(
            deviceId = arguments.stringArg("deviceId"),
            limit = arguments.intArg("limit", 20)
        )
        return ToolResult(
            success = true,
            output = jsonOutput(mapOf("items" to items))
        )
    }
}
