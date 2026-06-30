package com.xiaoxiami.app.agent.middleware

import com.xiaoxiami.app.agent.ToolObservation

/**
 * Agent 中间件接口。
 * 所有回调返回值表示是否继续执行（true = 继续，false = 中断当前迭代）。
 */
interface AgentMiddleware {
    /** 每轮迭代开始前调用 */
    suspend fun beforeIteration(context: MiddlewareContext): Boolean = true

    /** 工具执行完成后调用 */
    suspend fun afterToolExecution(
        context: MiddlewareContext,
        toolName: String,
        observation: ToolObservation
    ): Boolean = true

    /** 生成最终答案前调用 */
    suspend fun beforeFinalAnswer(context: MiddlewareContext) {}

    /** 整个 Agent 运行结束后调用 */
    suspend fun afterRun(context: MiddlewareContext) {}
}

/**
 * 中间件可访问的上下文。
 */
data class MiddlewareContext(
    val sessionId: String,
    val userGoal: String,
    val observations: List<ToolObservation>,
    val iteration: Int,
    val conversationHistory: List<Pair<String, String>>
)
