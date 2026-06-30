package com.xiaoxiami.app.agent.middleware

import com.xiaoxiami.app.agent.LoopDetector
import com.xiaoxiami.app.agent.ToolObservation

/**
 * 循环检测中间件 — 包装 LoopDetector。
 * 目前仅做日志记录，实际循环退出逻辑仍在 AgentRuntime 中处理，
 * 未来可迁移至此中间件中。
 */
class LoopDetectionMiddleware(
    private val loopDetector: LoopDetector = LoopDetector()
) : AgentMiddleware {

    override suspend fun afterToolExecution(
        context: MiddlewareContext,
        toolName: String,
        observation: ToolObservation
    ): Boolean {
        // 仅记录，不做拦截（拦截逻辑在 AgentRuntime 内）
        loopDetector.record(toolName, observation.arguments)
        return true
    }
}
