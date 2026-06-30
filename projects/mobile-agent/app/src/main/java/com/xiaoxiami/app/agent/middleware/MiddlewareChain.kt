package com.xiaoxiami.app.agent.middleware

import com.xiaoxiami.app.agent.ToolObservation

/**
 * 链式执行器，按顺序串联所有中间件。
 * 任何一个中间件返回 false 即中断链。
 */
class MiddlewareChain(
    private val middlewares: List<AgentMiddleware> = emptyList()
) {
    val isEmpty: Boolean get() = middlewares.isEmpty()

    suspend fun runBeforeIteration(context: MiddlewareContext): Boolean {
        for (mw in middlewares) {
            if (!mw.beforeIteration(context)) return false
        }
        return true
    }

    suspend fun runAfterToolExecution(
        context: MiddlewareContext,
        toolName: String,
        observation: ToolObservation
    ): Boolean {
        for (mw in middlewares) {
            if (!mw.afterToolExecution(context, toolName, observation)) return false
        }
        return true
    }

    suspend fun runBeforeFinalAnswer(context: MiddlewareContext) {
        for (mw in middlewares) {
            mw.beforeFinalAnswer(context)
        }
    }

    suspend fun runAfterRun(context: MiddlewareContext) {
        for (mw in middlewares) {
            mw.afterRun(context)
        }
    }
}
