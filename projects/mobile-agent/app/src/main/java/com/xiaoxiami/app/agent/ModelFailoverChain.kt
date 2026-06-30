package com.xiaoxiami.app.agent

import android.util.Log
import kotlinx.coroutines.delay

/**
 * 模型故障转移链。
 *
 * 当主模型调用失败时，自动尝试备选模型。
 * 支持错误分类、冷却追踪和指数退避。
 */
class ModelFailoverChain(
    private val candidates: List<ModelCandidate>,
    private val cooldownMs: Long = 60_000L,
    private val initialBackoffMs: Long = 500L,
    private val maxBackoffMs: Long = 3_000L,
    private val backoffFactor: Double = 2.0,
    private val jitterRatio: Double = 0.20
) {
    companion object {
        private const val TAG = "ModelFailover"
    }

    private val cooldownUntil = mutableMapOf<String, Long>()

    /**
     * 执行 LLM 调用，失败时自动转移到下一个可用模型。
     */
    suspend fun <T> execute(block: suspend (modelId: String) -> T): T {
        val now = System.currentTimeMillis()
        val available = candidates
            .sortedBy { it.priority }
            .filter { (cooldownUntil[it.modelId] ?: 0) <= now }

        if (available.isEmpty()) {
            // 所有模型都在冷却中，清除冷却并重试主模型
            Log.w(TAG, "All models in cooldown, resetting cooldowns")
            cooldownUntil.clear()
            return block(candidates.minByOrNull { it.priority }!!.modelId)
        }

        var lastException: Exception? = null
        var backoffMs = initialBackoffMs

        for ((index, candidate) in available.withIndex()) {
            try {
                val result = block(candidate.modelId)
                if (index > 0) {
                    Log.i(TAG, "Failover succeeded with ${candidate.modelId}")
                }
                return result
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e // 不拦截取消
            } catch (e: Exception) {
                lastException = e
                val errorKind = classifyError(e)
                Log.w(TAG, "Model ${candidate.modelId} failed (${errorKind.name}): ${e.message}")

                when (errorKind) {
                    FailoverErrorKind.AUTH_ERROR -> {
                        // 认证错误：冷却较长时间
                        cooldownUntil[candidate.modelId] = now + cooldownMs * 5
                    }
                    FailoverErrorKind.RATE_LIMIT -> {
                        cooldownUntil[candidate.modelId] = now + cooldownMs
                    }
                    FailoverErrorKind.SERVER_ERROR,
                    FailoverErrorKind.TIMEOUT -> {
                        cooldownUntil[candidate.modelId] = now + cooldownMs / 2
                    }
                    FailoverErrorKind.CONTEXT_OVERFLOW -> {
                        // 上下文溢出：该模型窗口不够，转移到下一个（可能窗口更大）
                        cooldownUntil[candidate.modelId] = now + cooldownMs * 2
                    }
                    FailoverErrorKind.UNKNOWN -> {
                        cooldownUntil[candidate.modelId] = now + cooldownMs / 4
                    }
                }

                // 指数退避 + 抖动（最后一个候选不需要等待）
                if (index < available.size - 1) {
                    val jitter = (backoffMs * jitterRatio * (Math.random() * 2 - 1)).toLong()
                    delay(backoffMs + jitter)
                    backoffMs = (backoffMs * backoffFactor).toLong().coerceAtMost(maxBackoffMs)
                }
            }
        }

        throw lastException ?: IllegalStateException("No model candidates available")
    }

    fun reset() {
        cooldownUntil.clear()
    }
}

data class ModelCandidate(
    val modelId: String,
    val priority: Int
)

enum class FailoverErrorKind {
    RATE_LIMIT,
    CONTEXT_OVERFLOW,
    TIMEOUT,
    AUTH_ERROR,
    SERVER_ERROR,
    UNKNOWN
}

/**
 * 根据异常消息分类错误类型。
 */
fun classifyError(e: Exception): FailoverErrorKind {
    val msg = (e.message ?: "").lowercase()
    return when {
        msg.contains("429") || msg.contains("rate_limit") || msg.contains("rate limit")
            || msg.contains("quota") || msg.contains("too many requests") ->
            FailoverErrorKind.RATE_LIMIT

        msg.contains("context length") || msg.contains("token limit")
            || msg.contains("context window") || msg.contains("max_tokens")
            || msg.contains("too long") ->
            FailoverErrorKind.CONTEXT_OVERFLOW

        msg.contains("timeout") || msg.contains("timed out")
            || msg.contains("deadline") ->
            FailoverErrorKind.TIMEOUT

        msg.contains("401") || msg.contains("403") || msg.contains("api_key")
            || msg.contains("unauthorized") || msg.contains("forbidden")
            || msg.contains("authentication") ->
            FailoverErrorKind.AUTH_ERROR

        msg.contains("500") || msg.contains("502") || msg.contains("503")
            || msg.contains("internal server") || msg.contains("service unavailable")
            || msg.contains("bad gateway") ->
            FailoverErrorKind.SERVER_ERROR

        else -> FailoverErrorKind.UNKNOWN
    }
}
