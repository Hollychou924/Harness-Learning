package com.xiaoxiami.app.agent

sealed interface AgentEvent {
    data class RunStarted(val traceId: String) : AgentEvent
    data class GoalStructured(val goal: StructuredGoal) : AgentEvent
    data class Thinking(val iteration: Int, val message: String) : AgentEvent
    data class ToolCallPlanned(
        val iteration: Int,
        val toolName: String,
        val arguments: Map<String, Any?>,
        val reason: String
    ) : AgentEvent
    data class ToolCompleted(
        val iteration: Int,
        val toolName: String,
        val result: String
    ) : AgentEvent
    data class ToolRetryScheduled(
        val iteration: Int,
        val toolName: String,
        val nextAttempt: Int,
        val reason: String
    ) : AgentEvent
    data class ToolApprovalRequested(
        val iteration: Int,
        val request: ToolApprovalRequest
    ) : AgentEvent
    data class ToolApprovalResolved(
        val iteration: Int,
        val toolName: String,
        val approved: Boolean,
        val message: String
    ) : AgentEvent
    data class ObservationRecorded(
        val iteration: Int,
        val toolName: String,
        val observation: String
    ) : AgentEvent
    data class ReviewCompleted(
        val iteration: Int,
        val action: ReviewAction,
        val reason: String
    ) : AgentEvent
    data class FinalAnswerChunk(val text: String) : AgentEvent
    data class Completed(val traceId: String, val finalAnswer: String) : AgentEvent
    data class ClarificationRequested(
        val iteration: Int,
        val question: String,
        val options: List<String>
    ) : AgentEvent
    data class ClarificationResolved(
        val iteration: Int,
        val answer: String
    ) : AgentEvent
    data class LoopDetected(
        val iteration: Int,
        val toolName: String,
        val signal: LoopDetector.Signal,
        val detectorName: String,
        val message: String
    ) : AgentEvent
    data class Error(val traceId: String?, val message: String) : AgentEvent
}
