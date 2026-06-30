package com.xiaoxiami.app.agent

/**
 * 多级循环检测器。
 *
 * 包含 3 种检测器：
 * 1. generic_repeat — 相同 hash 在滑动窗口中重复出现
 * 2. ping_pong — 两个工具交替调用 (A→B→A→B)
 * 3. global_circuit_breaker — 同一工具名累计调用超限
 */
class LoopDetector(
    private val windowSize: Int = 10,
    private val repeatWarn: Int = 3,
    private val repeatExit: Int = 5,
    private val pingPongWarn: Int = 3,
    private val pingPongExit: Int = 5,
    private val globalCircuitBreaker: Int = 15
) {
    enum class Signal { OK, WARN, EXIT }

    data class Detection(
        val signal: Signal,
        val detectorName: String,
        val message: String
    ) {
        companion object {
            val OK = Detection(Signal.OK, "", "")
        }
    }

    private val hashWindow = ArrayDeque<Int>(windowSize)
    private val nameWindow = ArrayDeque<String>(windowSize)
    private val globalCounts = mutableMapOf<String, Int>()

    /**
     * 记录一次工具调用，返回最严重的检测结果。
     */
    fun record(toolName: String, arguments: Map<String, Any?>): Detection {
        val hash = computeHash(toolName, arguments)

        // 更新窗口
        if (hashWindow.size >= windowSize) hashWindow.removeFirst()
        hashWindow.addLast(hash)
        if (nameWindow.size >= windowSize) nameWindow.removeFirst()
        nameWindow.addLast(toolName)

        // 更新全局计数
        globalCounts[toolName] = (globalCounts[toolName] ?: 0) + 1

        // 按严重度执行检测
        val results = listOf(
            checkGlobalCircuitBreaker(toolName),
            checkGenericRepeat(hash, toolName),
            checkPingPong(toolName)
        )

        // 返回最严重的（EXIT > WARN > OK）
        return results
            .maxByOrNull { it.signal.ordinal }
            ?.takeIf { it.signal != Signal.OK }
            ?: Detection.OK
    }

    fun reset() {
        hashWindow.clear()
        nameWindow.clear()
        globalCounts.clear()
    }

    // ── 检测器 1: 相同调用重复 ──

    private fun checkGenericRepeat(hash: Int, toolName: String): Detection {
        val count = hashWindow.count { it == hash }
        return when {
            count >= repeatExit -> Detection(
                Signal.EXIT,
                "generic_repeat",
                "多次重复调用 $toolName（相同参数），强制终止。"
            )
            count >= repeatWarn -> Detection(
                Signal.WARN,
                "generic_repeat",
                "检测到重复调用 $toolName，请尝试不同的方法或参数。"
            )
            else -> Detection.OK
        }
    }

    // ── 检测器 2: Ping-Pong 交替调用 ──

    private fun checkPingPong(toolName: String): Detection {
        if (nameWindow.size < 4) return Detection.OK

        val list = nameWindow.toList()
        val last = list.last()
        val secondLast = if (list.size >= 2) list[list.size - 2] else return Detection.OK

        if (last == secondLast) return Detection.OK // 不是交替模式

        // 从尾部往前计算交替 cycles
        var cycles = 0
        var i = list.size - 1
        while (i >= 1) {
            if (list[i] == last && list[i - 1] == secondLast) {
                cycles++
                i -= 2
            } else if (list[i] == secondLast && list[i - 1] == last) {
                cycles++
                i -= 2
            } else {
                break
            }
        }

        return when {
            cycles >= pingPongExit -> Detection(
                Signal.EXIT,
                "ping_pong",
                "检测到 $secondLast 和 $last 交替调用 ${cycles} 轮，强制终止。"
            )
            cycles >= pingPongWarn -> Detection(
                Signal.WARN,
                "ping_pong",
                "检测到 $secondLast 和 $last 交替调用，请换一种策略。"
            )
            else -> Detection.OK
        }
    }

    // ── 检测器 3: 全局断路器 ──

    private fun checkGlobalCircuitBreaker(toolName: String): Detection {
        val count = globalCounts[toolName] ?: 0
        return if (count >= globalCircuitBreaker) {
            Detection(
                Signal.EXIT,
                "global_circuit_breaker",
                "工具 $toolName 累计调用 $count 次，触发全局断路器强制终止。"
            )
        } else {
            Detection.OK
        }
    }

    private fun computeHash(toolName: String, arguments: Map<String, Any?>): Int {
        val key = buildString {
            append(toolName)
            append('|')
            arguments.entries.sortedBy { it.key }.forEach { (k, v) ->
                append(k).append('=').append(v?.toString().orEmpty()).append('&')
            }
        }
        return key.hashCode()
    }
}
