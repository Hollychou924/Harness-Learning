package com.xiaoxiami.app.agent

import com.xiaoxiami.app.agent.skills.SkillActivation

data class StructuredGoal(
    val rawGoal: String,
    val task: String,
    val successCriteria: String,
    val requiredInformation: List<String> = emptyList(),
    val constraints: List<String> = emptyList()
)

data class AgentDecision(
    val type: DecisionType,
    val reason: String,
    val toolName: String? = null,
    val targetHost: ToolRoutePreference? = null,
    val arguments: Map<String, Any?> = emptyMap(),
    val answer: String? = null
)

enum class DecisionType {
    TOOL,
    FINAL
}

enum class ReviewAction {
    FINAL,
    REASON,
    RETRY
}

data class ReviewDecision(
    val action: ReviewAction,
    val reason: String,
    val answer: String? = null
)

data class GoalContext(
    val userGoal: String,
    val sessionId: String,
    val conversationHistory: List<Pair<String, String>>,
    val imageCount: Int,
    val modelId: String
)

data class DecisionContext(
    val goal: StructuredGoal,
    val sessionId: String,
    val conversationHistory: List<Pair<String, String>>,
    val observations: List<ToolObservation>,
    val reviewHistory: List<String>,
    val availableTools: List<PlannerToolSchema>,
    val availableSkills: List<SkillActivation>,
    val imageCount: Int,
    val modelId: String,
    val summarizedPrefix: String? = null
)

data class ReviewContext(
    val goal: StructuredGoal,
    val sessionId: String,
    val conversationHistory: List<Pair<String, String>>,
    val observations: List<ToolObservation>,
    val latestObservation: ToolObservation?,
    val currentDecision: AgentDecision,
    val reviewHistory: List<String>,
    val imageCount: Int,
    val modelId: String
)

data class FinalAnswerContext(
    val goal: StructuredGoal,
    val sessionId: String,
    val conversationHistory: List<Pair<String, String>>,
    val observations: List<ToolObservation>,
    val imageCount: Int,
    val modelId: String,
    val reviewSummary: String? = null,
    val hint: String? = null,
    val summarizedPrefix: String? = null
)

interface LlmAdapter {
    suspend fun structureGoal(context: GoalContext): StructuredGoal

    suspend fun decideNextAction(context: DecisionContext): AgentDecision

    suspend fun review(context: ReviewContext): ReviewDecision

    suspend fun streamFinalAnswer(
        context: FinalAnswerContext,
        onChunk: (String) -> Unit
    ): String
}
