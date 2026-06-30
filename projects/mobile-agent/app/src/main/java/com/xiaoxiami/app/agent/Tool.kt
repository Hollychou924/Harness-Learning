package com.xiaoxiami.app.agent

import android.net.Uri

data class ToolContext(
    val sessionId: String,
    val modelId: String,
    val userGoal: String,
    val conversationHistory: List<Pair<String, String>>,
    val imageUris: List<Uri> = emptyList(),
    val deviceId: String = "local_android",
    val interactionHandler: suspend (ToolInteractionRequest) -> ToolInteractionResult = {
        ToolInteractionResult(
            success = false,
            error = "当前环境未接入用户交互桥"
        )
    }
)

data class ToolResult(
    val success: Boolean,
    val output: String,
    val error: String? = null,
    val attempts: Int = 1
)

data class ToolObservation(
    val toolName: String,
    val arguments: Map<String, Any?> = emptyMap(),
    val rawOutput: String,
    val success: Boolean,
    val error: String? = null
)

enum class ToolHostKind {
    LOCAL_ANDROID,
    REMOTE_ANDROID,
    LOCAL_DESKTOP,
    REMOTE_DESKTOP,
    CLOUD_SERVICE
}

enum class ToolFamily {
    GENERAL,
    MEMORY,
    KNOWLEDGE,
    DOCUMENT,
    NOTIFICATION,
    PIM,
    COMMUNICATION,
    FILES,
    DEVICE,
    AUTOMATION,
    DELEGATION,
    REMOTE,
    BROWSER,
    MEDIA,
    SHELL
}

enum class ToolRiskLevel {
    LOW,
    SENSITIVE,
    HIGH
}

enum class ToolAvailability {
    CORE,
    OPTIONAL
}

enum class ToolExecutionMode {
    DIRECT,
    SETTINGS_REDIRECT,
    USER_INTERACTION,
    REMOTE_BRIDGE
}

enum class ToolRoutePreference {
    AUTO,
    LOCAL_ANDROID,
    REMOTE_ANDROID,
    LOCAL_DESKTOP,
    REMOTE_DESKTOP,
    CLOUD_SERVICE;

    fun toHostKind(): ToolHostKind? {
        return when (this) {
            AUTO -> null
            LOCAL_ANDROID -> ToolHostKind.LOCAL_ANDROID
            REMOTE_ANDROID -> ToolHostKind.REMOTE_ANDROID
            LOCAL_DESKTOP -> ToolHostKind.LOCAL_DESKTOP
            REMOTE_DESKTOP -> ToolHostKind.REMOTE_DESKTOP
            CLOUD_SERVICE -> ToolHostKind.CLOUD_SERVICE
        }
    }

    companion object {
        fun fromRaw(raw: String?): ToolRoutePreference? {
            if (raw.isNullOrBlank()) return null
            return entries.firstOrNull {
                it.name.equals(raw.trim(), ignoreCase = true)
            }
        }
    }
}

enum class ToolValueType {
    STRING,
    INTEGER,
    NUMBER,
    BOOLEAN,
    ARRAY,
    OBJECT
}

enum class ToolAccessKind {
    ANDROID_PERMISSION,
    SPECIAL_ACCESS,
    USER_MEDIATED_PICKER,
    MEDIA_PROJECTION,
    NETWORK,
    REMOTE_BRIDGE
}

enum class ToolCallerIdentity {
    USER_INTERACTIVE,
    AUTOMATION,
    DELEGATED_AGENT,
    REMOTE_OPERATOR
}

enum class ToolScope {
    MEMORY,
    KNOWLEDGE,
    NETWORK,
    BROWSER,
    SCREEN,
    NOTIFICATION,
    PERSONAL_DATA,
    COMMUNICATION,
    FILE_SYSTEM,
    DEVICE_CONTROL,
    AUTOMATION,
    DELEGATION,
    DOCUMENT,
    REMOTE_BRIDGE,
    DESKTOP_BRIDGE,
    SHELL
}

enum class ToolContentRisk {
    UNTRUSTED_USER_CONTENT,
    UNTRUSTED_NETWORK_CONTENT,
    SENSITIVE_PERSONAL_DATA,
    REMOTE_DEVICE_PAYLOAD
}

data class ToolAccessRequirement(
    val kind: ToolAccessKind,
    val identifier: String,
    val description: String,
    val required: Boolean = true
)

data class ToolParameterSchema(
    val name: String,
    val type: ToolValueType,
    val description: String,
    val required: Boolean = false,
    val enumValues: List<String> = emptyList(),
    val itemType: ToolValueType? = null
)

data class ToolFieldSchema(
    val name: String,
    val type: ToolValueType,
    val description: String,
    val required: Boolean = true
)

data class ToolSchema(
    val name: String,
    val plannerName: String = name,
    val plannerVisible: Boolean = true,
    val family: ToolFamily = ToolFamily.GENERAL,
    val description: String,
    val hostKind: ToolHostKind,
    val executionMode: ToolExecutionMode = ToolExecutionMode.DIRECT,
    val capabilities: List<String> = emptyList(),
    val riskLevel: ToolRiskLevel = ToolRiskLevel.LOW,
    val approvalRequired: Boolean = false,
    val approvalReason: String = "",
    val approvalSummary: String = "",
    val availability: ToolAvailability = ToolAvailability.CORE,
    val allowlistTags: List<String> = emptyList(),
    val allowedIdentities: List<ToolCallerIdentity> = DEFAULT_ALLOWED_IDENTITIES,
    val scopes: List<ToolScope> = emptyList(),
    val contentRisks: List<ToolContentRisk> = emptyList(),
    val accessRequirements: List<ToolAccessRequirement> = emptyList(),
    val inputSchema: List<ToolParameterSchema> = emptyList(),
    val outputSchema: List<ToolFieldSchema> = emptyList()
)

data class PlannerToolRoute(
    val hostKind: ToolHostKind,
    val executionMode: ToolExecutionMode,
    val riskLevel: ToolRiskLevel,
    val approvalRequired: Boolean,
    val allowlistTags: Set<String> = emptySet(),
    val accessRequirements: List<ToolAccessRequirement> = emptyList()
)

data class PlannerToolSchema(
    val name: String,
    val description: String,
    val family: ToolFamily,
    val defaultHostKind: ToolHostKind,
    val routes: List<PlannerToolRoute>,
    val capabilities: List<String> = emptyList(),
    val riskLevel: ToolRiskLevel = ToolRiskLevel.LOW,
    val availability: ToolAvailability = ToolAvailability.CORE,
    val inputSchema: List<ToolParameterSchema> = emptyList(),
    val outputSchema: List<ToolFieldSchema> = emptyList(),
    val identities: List<ToolCallerIdentity> = emptyList(),
    val scopes: List<ToolScope> = emptyList(),
    val contentRisks: List<ToolContentRisk> = emptyList()
)

data class ToolPolicy(
    val identity: ToolCallerIdentity,
    val allowedScopes: Set<ToolScope> = ToolScope.values().toSet(),
    val maxRiskLevel: ToolRiskLevel = ToolRiskLevel.HIGH,
    val allowedOptionalTags: Set<String> = emptySet(),
    val allowedOptionalTools: Set<String> = emptySet(),
    val enabledHostKinds: Set<ToolHostKind> = ToolHostKind.values().toSet(),
    val blockedContentRisks: Set<ToolContentRisk> = emptySet()
) {
    companion object {
        fun userInteractive(
            allowedOptionalTags: Set<String> = setOf("high_risk", "remote_android")
        ): ToolPolicy {
            return ToolPolicy(
                identity = ToolCallerIdentity.USER_INTERACTIVE,
                allowedOptionalTags = allowedOptionalTags
            )
        }

        fun automation(): ToolPolicy {
            return ToolPolicy(
                identity = ToolCallerIdentity.AUTOMATION,
                allowedScopes = setOf(
                    ToolScope.MEMORY,
                    ToolScope.KNOWLEDGE,
                    ToolScope.NETWORK,
                    ToolScope.NOTIFICATION,
                    ToolScope.PERSONAL_DATA,
                    ToolScope.DOCUMENT
                ),
                maxRiskLevel = ToolRiskLevel.SENSITIVE,
                enabledHostKinds = setOf(
                    ToolHostKind.LOCAL_ANDROID,
                    ToolHostKind.CLOUD_SERVICE
                ),
                blockedContentRisks = setOf(ToolContentRisk.REMOTE_DEVICE_PAYLOAD)
            )
        }

        fun delegated(): ToolPolicy {
            return ToolPolicy(
                identity = ToolCallerIdentity.DELEGATED_AGENT,
                allowedScopes = setOf(
                    ToolScope.MEMORY,
                    ToolScope.KNOWLEDGE,
                    ToolScope.NETWORK,
                    ToolScope.DOCUMENT,
                    ToolScope.NOTIFICATION,
                    ToolScope.PERSONAL_DATA
                ),
                maxRiskLevel = ToolRiskLevel.SENSITIVE,
                enabledHostKinds = setOf(
                    ToolHostKind.LOCAL_ANDROID,
                    ToolHostKind.CLOUD_SERVICE
                ),
                blockedContentRisks = setOf(ToolContentRisk.REMOTE_DEVICE_PAYLOAD)
            )
        }

        fun remoteOperator(
            allowedOptionalTags: Set<String> = setOf("remote_android")
        ): ToolPolicy {
            return ToolPolicy(
                identity = ToolCallerIdentity.REMOTE_OPERATOR,
                allowedOptionalTags = allowedOptionalTags,
                enabledHostKinds = setOf(
                    ToolHostKind.LOCAL_ANDROID,
                    ToolHostKind.CLOUD_SERVICE
                ),
                blockedContentRisks = setOf(ToolContentRisk.REMOTE_DEVICE_PAYLOAD)
            )
        }
    }
}

data class ToolApprovalRequirement(
    val required: Boolean = false,
    val riskLevel: ToolRiskLevel = ToolRiskLevel.LOW,
    val reason: String = "",
    val summary: String = ""
)

data class ToolApprovalRequest(
    val requestId: String,
    val toolName: String,
    val arguments: Map<String, Any?> = emptyMap(),
    val riskLevel: ToolRiskLevel,
    val reason: String,
    val summary: String
)

data class ToolApprovalDecision(
    val approved: Boolean,
    val message: String
)

enum class ToolInteractionKind {
    PICK_IMAGES,
    PICK_FILES,
    TAKE_PHOTO,
    CAPTURE_SCREEN,
    BROWSER_FILE_UPLOAD,
    REQUEST_PERMISSION
}

data class ToolInteractionRequest(
    val requestId: String,
    val toolName: String,
    val kind: ToolInteractionKind,
    val title: String,
    val description: String,
    val payload: Map<String, Any?> = emptyMap()
)

data class ToolInteractionResult(
    val success: Boolean,
    val data: Map<String, Any?> = emptyMap(),
    val error: String? = null
)

interface Tool {
    val schema: ToolSchema
    val name: String
        get() = schema.name
    val description: String
        get() = schema.description

    fun getApprovalRequirement(
        arguments: Map<String, Any?>,
        context: ToolContext
    ): ToolApprovalRequirement {
        return ToolApprovalRequirement(
            required = schema.approvalRequired,
            riskLevel = schema.riskLevel,
            reason = schema.approvalReason,
            summary = schema.approvalSummary
        )
    }

    suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult

    fun isCurrentlyAvailable(): Boolean = true
}

val DEFAULT_ALLOWED_IDENTITIES = listOf(
    ToolCallerIdentity.USER_INTERACTIVE,
    ToolCallerIdentity.AUTOMATION,
    ToolCallerIdentity.DELEGATED_AGENT,
    ToolCallerIdentity.REMOTE_OPERATOR
)

fun ToolSchema.effectiveAvailability(): ToolAvailability {
    return when {
        availability == ToolAvailability.OPTIONAL -> ToolAvailability.OPTIONAL
        riskLevel == ToolRiskLevel.HIGH -> ToolAvailability.OPTIONAL
        hostKind == ToolHostKind.REMOTE_ANDROID -> ToolAvailability.OPTIONAL
        hostKind == ToolHostKind.LOCAL_DESKTOP -> ToolAvailability.OPTIONAL
        hostKind == ToolHostKind.REMOTE_DESKTOP -> ToolAvailability.OPTIONAL
        else -> ToolAvailability.CORE
    }
}

fun ToolSchema.effectiveAllowlistTags(): Set<String> {
    val tags = allowlistTags.toMutableSet()
    if (riskLevel == ToolRiskLevel.HIGH) {
        tags += "high_risk"
    }
    when (hostKind) {
        ToolHostKind.REMOTE_ANDROID -> tags += "remote_android"
        ToolHostKind.LOCAL_DESKTOP,
        ToolHostKind.REMOTE_DESKTOP -> tags += "desktop"
        else -> Unit
    }
    if (executionMode == ToolExecutionMode.REMOTE_BRIDGE) {
        tags += "remote_bridge"
    }
    return tags
}

fun ToolSchema.toPlannerRoute(): PlannerToolRoute {
    return PlannerToolRoute(
        hostKind = hostKind,
        executionMode = executionMode,
        riskLevel = riskLevel,
        approvalRequired = approvalRequired,
        allowlistTags = effectiveAllowlistTags(),
        accessRequirements = accessRequirements
    )
}

fun ToolSchema.effectiveFamily(): ToolFamily {
    if (family != ToolFamily.GENERAL) return family
    return when {
        ToolScope.MEMORY in scopes -> ToolFamily.MEMORY
        ToolScope.KNOWLEDGE in scopes && ToolScope.DOCUMENT !in scopes -> ToolFamily.KNOWLEDGE
        ToolScope.DOCUMENT in scopes -> ToolFamily.DOCUMENT
        ToolScope.NOTIFICATION in scopes -> ToolFamily.NOTIFICATION
        ToolScope.PERSONAL_DATA in scopes -> ToolFamily.PIM
        ToolScope.COMMUNICATION in scopes -> ToolFamily.COMMUNICATION
        ToolScope.FILE_SYSTEM in scopes -> ToolFamily.FILES
        ToolScope.DEVICE_CONTROL in scopes || ToolScope.SCREEN in scopes -> ToolFamily.DEVICE
        ToolScope.AUTOMATION in scopes -> ToolFamily.AUTOMATION
        ToolScope.DELEGATION in scopes -> ToolFamily.DELEGATION
        ToolScope.REMOTE_BRIDGE in scopes || hostKind == ToolHostKind.REMOTE_ANDROID -> ToolFamily.REMOTE
        ToolScope.BROWSER in scopes -> ToolFamily.BROWSER
        ToolScope.SHELL in scopes -> ToolFamily.SHELL
        capabilities.any { it.contains("media", ignoreCase = true) } -> ToolFamily.MEDIA
        else -> ToolFamily.GENERAL
    }
}
