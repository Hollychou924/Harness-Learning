package com.xiaoxiami.app.agent.tools

import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolAvailability
import com.xiaoxiami.app.agent.ToolContentRisk
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolExecutionMode
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolScope
import com.xiaoxiami.app.remote.RemoteAndroidBridgeManager
import com.xiaoxiami.app.repository.RemoteAndroidBridgeRepository
import kotlinx.coroutines.delay

class RemoteAndroidForwardTool(
    private val baseSchema: ToolSchema,
    private val bridgeManager: RemoteAndroidBridgeManager,
    private val bridgeRepository: RemoteAndroidBridgeRepository
) : Tool {
    override val schema = baseSchema.copy(
        name = "remote_android__${baseSchema.plannerName}",
        plannerName = baseSchema.plannerName,
        plannerVisible = true,
        description = "${baseSchema.description} This route executes on a paired remote Android node.",
        hostKind = ToolHostKind.REMOTE_ANDROID,
        executionMode = ToolExecutionMode.REMOTE_BRIDGE,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = (baseSchema.allowlistTags + "remote_android" + "remote_bridge").distinct(),
        scopes = (baseSchema.scopes + ToolScope.REMOTE_BRIDGE).distinct(),
        contentRisks = (baseSchema.contentRisks + ToolContentRisk.REMOTE_DEVICE_PAYLOAD).distinct(),
        accessRequirements = (
            baseSchema.accessRequirements +
                ToolAccessRequirement(
                    kind = ToolAccessKind.REMOTE_BRIDGE,
                    identifier = "paired_remote_android",
                    description = "需要已有已连接的 remote_android_bridge 节点"
                )
            ).distinctBy { "${it.kind}:${it.identifier}" }
    )

    override fun isCurrentlyAvailable(): Boolean {
        val state = bridgeManager.state.value
        return state.connected && state.pairedPeerId.isNotBlank()
    }

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        if (!isCurrentlyAvailable()) {
            return ToolResult(
                success = false,
                output = "",
                error = "当前没有已连接的远端 Android 节点"
            )
        }

        val timeoutMs = 30_000L
        val queued = bridgeManager.sendToolRequest(
            deviceId = "",
            toolName = baseSchema.plannerName,
            arguments = arguments,
            timeoutMs = timeoutMs
        )
        val requestId = queued["requestId"]?.toString().orEmpty()
        if (!(queued["queued"] as? Boolean ?: false) || requestId.isBlank()) {
            return ToolResult(
                success = false,
                output = jsonOutput(queued),
                error = queued["error"]?.toString() ?: "远端桥接请求未能入队"
            )
        }

        val deadline = System.currentTimeMillis() + timeoutMs + 1_000L
        while (System.currentTimeMillis() < deadline) {
            val snapshot = bridgeRepository.getRequestSnapshot(requestId)
            if (snapshot != null) {
                when (snapshot.status.lowercase()) {
                    "completed" -> {
                        val response = snapshot.response
                        val attempts = (response["attempts"] as? Number)?.toInt() ?: 1
                        val output = response["output"]?.toString()
                            ?: jsonOutput(response.ifEmpty { mapOf("requestId" to requestId) })
                        return ToolResult(
                            success = true,
                            output = output,
                            attempts = attempts
                        )
                    }
                    "failed", "timed_out" -> {
                        val response = snapshot.response
                        val output = response["output"]?.toString()
                            ?: jsonOutput(response.ifEmpty { mapOf("requestId" to requestId) })
                        return ToolResult(
                            success = false,
                            output = output,
                            error = snapshot.errorMessage.ifBlank { "远端节点执行失败" }
                        )
                    }
                }
            }
            delay(400L)
        }

        return ToolResult(
            success = false,
            output = "",
            error = "等待远端节点响应超时"
        )
    }
}

fun buildRemoteAndroidForwardingTools(
    localTools: List<Tool>,
    bridgeManager: RemoteAndroidBridgeManager,
    bridgeRepository: RemoteAndroidBridgeRepository
): List<Tool> {
    return localTools
        .filter { tool ->
            val schema = tool.schema
            schema.hostKind == ToolHostKind.LOCAL_ANDROID &&
                schema.plannerVisible &&
                !schema.approvalRequired &&
                schema.executionMode != ToolExecutionMode.USER_INTERACTION &&
                ToolScope.AUTOMATION !in schema.scopes &&
                ToolScope.DELEGATION !in schema.scopes &&
                ToolScope.REMOTE_BRIDGE !in schema.scopes
        }
        .map { tool ->
            RemoteAndroidForwardTool(
                baseSchema = tool.schema,
                bridgeManager = bridgeManager,
                bridgeRepository = bridgeRepository
            )
        }
}
