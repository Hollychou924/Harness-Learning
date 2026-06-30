package com.xiaoxiami.app.agent

import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import kotlinx.coroutines.withTimeoutOrNull

class ToolExecutor(
    tools: List<Tool>,
    private val androidContext: Context? = null,
    private val policy: ToolPolicy = ToolPolicy.userInteractive(),
    private val timeoutMs: Long = 20_000L,
    private val maxRetries: Int = 1
) {
    private val tools = tools
    private val toolMap = tools.associateBy { it.name }

    fun getToolSchemas(): List<ToolSchema> = toolMap.values
        .filter { isToolAllowed(it) }
        .map { it.schema }

    fun getPlannerToolSchemas(): List<PlannerToolSchema> {
        val visibleTools = tools.filter { tool ->
            tool.schema.plannerVisible && isToolAllowed(tool)
        }
        return visibleTools
            .groupBy { it.schema.plannerName }
            .map { (plannerName, candidates) ->
                val sortedCandidates = candidates.sortedWith(toolRouteComparator())
                val primary = sortedCandidates.first().schema
                PlannerToolSchema(
                    name = plannerName,
                    description = primary.description,
                    family = primary.effectiveFamily(),
                    defaultHostKind = primary.hostKind,
                    routes = sortedCandidates.map { it.schema.toPlannerRoute() },
                    capabilities = sortedCandidates.flatMap { it.schema.capabilities }.distinct(),
                    riskLevel = sortedCandidates.maxByOrNull { riskScore(it.schema.riskLevel) }?.schema?.riskLevel
                        ?: primary.riskLevel,
                    availability = if (sortedCandidates.any {
                            it.schema.effectiveAvailability() == ToolAvailability.OPTIONAL
                        }
                    ) {
                        ToolAvailability.OPTIONAL
                    } else {
                        ToolAvailability.CORE
                    },
                    inputSchema = primary.inputSchema,
                    outputSchema = primary.outputSchema,
                    identities = sortedCandidates.flatMap { it.schema.allowedIdentities }.distinct(),
                    scopes = sortedCandidates.flatMap { it.schema.scopes }.distinct(),
                    contentRisks = sortedCandidates.flatMap { it.schema.contentRisks }.distinct()
                )
            }
            .sortedBy { it.name }
    }

    fun getTool(toolName: String): Tool? {
        val exactTool = toolMap[toolName]
        if (exactTool != null) {
            return exactTool.takeIf { isToolAllowed(it) }
        }
        return resolveTool(plannerName = toolName)
    }

    fun resolveTool(
        plannerName: String,
        routePreference: ToolRoutePreference? = null
    ): Tool? {
        val preferredHost = routePreference?.toHostKind()
        val candidates = tools
            .filter { it.schema.plannerName == plannerName }
            .filter { isToolAllowed(it) }
            .sortedWith(toolRouteComparator(preferredHost))
        return candidates.firstOrNull()
    }

    fun getPolicy(): ToolPolicy = policy

    suspend fun execute(
        toolName: String,
        arguments: Map<String, Any?>,
        context: ToolContext,
        onRetry: ((attempt: Int, error: String) -> Unit)? = null
    ): ToolResult {
        val tool = toolMap[toolName]
            ?: return ToolResult(
                success = false,
                output = "",
                error = "Unknown tool: $toolName"
            )
        val denialReason = getBlockedReason(tool)
        if (denialReason != null) {
            return ToolResult(
                success = false,
                output = "",
                error = denialReason
            )
        }

        // Auto-request missing Android permissions before execution
        val permissionResult = ensurePermissions(tool, context)
        if (permissionResult != null) {
            return permissionResult
        }

        var lastFailure = ToolResult(
            success = false,
            output = "",
            error = "$toolName 执行失败"
        )

        repeat(maxRetries + 1) { attemptIndex ->
            val result = withTimeoutOrNull(timeoutMs) {
                runCatching {
                    tool.execute(arguments, context)
                }.getOrElse { error ->
                    ToolResult(
                        success = false,
                        output = "",
                        error = error.message ?: "$toolName 执行异常"
                    )
                }
            } ?: ToolResult(
                success = false,
                output = "",
                error = "$toolName 执行超时（${timeoutMs}ms）"
            )

            if (result.success) {
                return result.copy(attempts = attemptIndex + 1)
            }
            lastFailure = result.copy(attempts = attemptIndex + 1)
            if (attemptIndex < maxRetries) {
                onRetry?.invoke(
                    attemptIndex + 2,
                    lastFailure.error ?: "$toolName 执行失败"
                )
            }
        }

        return lastFailure
    }

    private fun isSchemaAllowed(schema: ToolSchema): Boolean {
        return getBlockedReason(schema) == null
    }

    private fun isToolAllowed(tool: Tool): Boolean {
        return getBlockedReason(tool) == null
    }

    private fun getBlockedReason(tool: Tool): String? {
        if (!tool.isCurrentlyAvailable()) {
            return "工具 ${tool.name} 当前不可用"
        }
        return getBlockedReason(tool.schema)
    }

    private fun getBlockedReason(schema: ToolSchema): String? {
        if (!schema.allowedIdentities.contains(policy.identity)) {
            return "${policy.identity.name.lowercase()} 不允许使用工具 ${schema.name}"
        }
        if (!policy.enabledHostKinds.contains(schema.hostKind)) {
            return "当前执行身份未启用 ${schema.hostKind.name.lowercase()} 工具"
        }
        val scopes = schema.scopes.toSet()
        if (scopes.isNotEmpty() && !policy.allowedScopes.containsAll(scopes)) {
            return "当前执行身份缺少工具范围授权：${scopes.joinToString(",") { it.name.lowercase() }}"
        }
        if (riskScore(schema.riskLevel) > riskScore(policy.maxRiskLevel)) {
            return "当前执行身份不允许使用 ${schema.riskLevel.name.lowercase()} 风险工具"
        }
        val blockedContentRisks = schema.contentRisks.toSet().intersect(policy.blockedContentRisks)
        if (blockedContentRisks.isNotEmpty()) {
            return "当前执行身份禁止处理内容风险：${blockedContentRisks.joinToString(",") { it.name.lowercase() }}"
        }
        if (schema.effectiveAvailability() == ToolAvailability.OPTIONAL) {
            val tags = schema.effectiveAllowlistTags()
            val allowlisted = policy.allowedOptionalTools.contains(schema.name) ||
                tags.any { policy.allowedOptionalTags.contains(it) }
            if (!allowlisted) {
                return "工具 ${schema.name} 为可选能力，当前未加入 allowlist"
            }
        }
        return null
    }

    private fun toolRouteComparator(preferredHost: ToolHostKind? = null): Comparator<Tool> {
        return compareBy<Tool> {
            routePriority(it.schema.hostKind, preferredHost)
        }.thenBy {
            riskScore(it.schema.riskLevel)
        }.thenBy {
            it.name
        }
    }

    private fun routePriority(hostKind: ToolHostKind, preferredHost: ToolHostKind?): Int {
        if (preferredHost != null) {
            return if (hostKind == preferredHost) 0 else 100 + defaultHostPriority(hostKind)
        }
        return defaultHostPriority(hostKind)
    }

    private fun defaultHostPriority(hostKind: ToolHostKind): Int {
        return when (hostKind) {
            ToolHostKind.LOCAL_ANDROID -> 0
            ToolHostKind.CLOUD_SERVICE -> 1
            ToolHostKind.REMOTE_ANDROID -> 2
            ToolHostKind.LOCAL_DESKTOP -> 3
            ToolHostKind.REMOTE_DESKTOP -> 4
        }
    }

    private fun riskScore(level: ToolRiskLevel): Int {
        return when (level) {
            ToolRiskLevel.LOW -> 0
            ToolRiskLevel.SENSITIVE -> 1
            ToolRiskLevel.HIGH -> 2
        }
    }

    private suspend fun ensurePermissions(tool: Tool, context: ToolContext): ToolResult? {
        val ctx = androidContext ?: return null
        val requiredPermissions = tool.schema.accessRequirements
            .filter { it.kind == ToolAccessKind.ANDROID_PERMISSION && it.required }
            .map { it.identifier }
        if (requiredPermissions.isEmpty()) return null

        val missingPermissions = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(ctx, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missingPermissions.isEmpty()) return null

        val result = context.interactionHandler(
            ToolInteractionRequest(
                requestId = "request_permission_${tool.name}_${System.currentTimeMillis()}",
                toolName = tool.name,
                kind = ToolInteractionKind.REQUEST_PERMISSION,
                title = "权限申请",
                description = "「${tool.schema.description}」需要以下权限才能执行，是否授权？",
                payload = mapOf("permissions" to missingPermissions)
            )
        )
        if (!result.success) {
            return ToolResult(
                success = false,
                output = "",
                error = result.error ?: "用户拒绝了权限请求"
            )
        }

        // Verify permissions were actually granted
        val stillMissing = missingPermissions.filter {
            ContextCompat.checkSelfPermission(ctx, it) != PackageManager.PERMISSION_GRANTED
        }
        if (stillMissing.isNotEmpty()) {
            return ToolResult(
                success = false,
                output = "",
                error = "以下权限未被授予：${stillMissing.joinToString(", ")}"
            )
        }

        return null
    }
}
