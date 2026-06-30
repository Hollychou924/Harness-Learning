package com.xiaoxiami.app.agent.runtime

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File

/**
 * 基于 proot + Alpine Linux rootfs 的 Shell 运行时。
 *
 * 通过 Android ProcessBuilder 启动 proot 进程，在 Alpine rootfs 中执行命令。
 * 特性：
 *   - 超时控制（默认 20 秒，最大 120 秒）
 *   - 输出上限 64KB 防 OOM
 *   - Mutex 串行化命令执行，避免移动端资源耗尽
 *   - stdout / stderr 分离捕获
 */
class AlpineShellRuntime(
    private val bootstrapper: AlpineBootstrapper
) : ShellRuntime {

    companion object {
        private const val TAG = "AlpineShellRuntime"
        private const val MAX_OUTPUT_BYTES = 65536
    }

    override val runtimeName: String = "alpine-linux"

    override val available: Boolean
        get() = bootstrapper.isBootstrapped()

    /** 引导器引用，供外部查看状态 */
    val bootstrap: AlpineBootstrapper get() = bootstrapper

    // 串行化执行，防止并发 proot 进程争抢资源
    private val executionMutex = Mutex()

    // 追踪当前进程，支持外部取消
    @Volatile
    private var currentProcess: Process? = null

    override suspend fun execute(
        command: String,
        workingDirectory: String,
        timeoutMs: Long
    ): ShellExecutionResult = executionMutex.withLock {
        if (!available) {
            val stateMsg = when (val s = bootstrapper.state.value) {
                is BootstrapState.NotStarted -> "Alpine 环境未初始化，请先在设置中启用"
                is BootstrapState.InProgress -> "Alpine 环境正在初始化: ${s.step} (${(s.progress * 100).toInt()}%)"
                is BootstrapState.Failed -> "Alpine 环境初始化失败: ${s.error}"
                is BootstrapState.Ready -> "内部错误：状态为 Ready 但 isBootstrapped 返回 false"
            }
            return ShellExecutionResult(
                success = false,
                stderr = stateMsg
            )
        }

        try {
            executeInProot(command, workingDirectory, timeoutMs)
        } catch (e: Exception) {
            Log.e(TAG, "命令执行异常: $command", e)
            ShellExecutionResult(
                success = false,
                stderr = "执行异常: ${e.message}"
            )
        }
    }

    /**
     * 终止当前正在执行的进程（如果有）。
     */
    fun cancelCurrentProcess() {
        currentProcess?.destroyForcibly()
        currentProcess = null
    }

    // ── 内部实现 ──

    private suspend fun executeInProot(
        command: String,
        workingDirectory: String,
        timeoutMs: Long
    ): ShellExecutionResult = withContext(Dispatchers.IO) {

        val cwd = workingDirectory.ifBlank { "/root" }

        val cmd = buildList {
            add(bootstrapper.prootBinary.absolutePath)
            add("-0")                                       // fake root
            add("-r"); add(bootstrapper.rootfsDir.absolutePath)  // rootfs

            // 绑定系统目录
            add("-b"); add("/dev")
            add("-b"); add("/proc")
            add("-b"); add("/sys")

            // 绑定持久化目录
            add("-b"); add("${bootstrapper.homeDir.absolutePath}:/root")
            add("-b"); add("${bootstrapper.tmpDir.absolutePath}:/tmp")
            add("-b"); add("${bootstrapper.scriptsDir.absolutePath}:/scripts")

            // 工作目录
            add("-w"); add(cwd)

            // 执行命令
            add("/bin/sh")
            add("-c")
            add(command)
        }

        Log.d(TAG, "执行: proot ... /bin/sh -c \"$command\"")

        val processBuilder = ProcessBuilder(cmd).apply {
            environment()["HOME"] = "/root"
            environment()["PATH"] = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
            environment()["TERM"] = "dumb"
            environment()["LANG"] = "C.UTF-8"
            // proot-portable-android 需要指定临时目录（Android 上 /tmp 不存在）
            environment()["PROOT_TMP_DIR"] = bootstrapper.tmpDir.absolutePath
        }

        val process = processBuilder.start()
        currentProcess = process

        try {
            // 带超时的输出捕获
            val result = withTimeoutOrNull(timeoutMs) {
                captureOutput(process)
            }

            if (result != null) {
                result
            } else {
                // 超时
                process.destroyForcibly()
                val partial = try {
                    readLimited(process.inputStream, MAX_OUTPUT_BYTES)
                } catch (_: Exception) { "" }

                ShellExecutionResult(
                    success = false,
                    stdout = partial,
                    stderr = "命令执行超时（${timeoutMs / 1000}秒）",
                    exitCode = -1
                )
            }
        } finally {
            currentProcess = null
            // 确保进程被清理
            if (process.isAlive) {
                process.destroyForcibly()
            }
        }
    }

    private fun captureOutput(process: Process): ShellExecutionResult {
        // 分别读取 stdout 和 stderr（需要在不同线程中读取以防死锁）
        val stderrBuilder = StringBuilder()
        val stderrThread = Thread {
            try {
                val content = readLimited(process.errorStream, MAX_OUTPUT_BYTES)
                stderrBuilder.append(content)
            } catch (_: Exception) {}
        }.apply { isDaemon = true; start() }

        val stdout = readLimited(process.inputStream, MAX_OUTPUT_BYTES)

        stderrThread.join(5000) // 最多等 stderr 线程 5 秒
        val stderr = stderrBuilder.toString()

        val exitCode = process.waitFor()

        Log.d(TAG, "命令完成: exitCode=$exitCode, stdout=${stdout.length}B, stderr=${stderr.length}B")

        return ShellExecutionResult(
            success = exitCode == 0,
            stdout = stdout,
            stderr = stderr,
            exitCode = exitCode
        )
    }

    private fun readLimited(stream: java.io.InputStream, maxBytes: Int): String {
        val buffer = ByteArray(4096)
        val result = StringBuilder()
        var totalRead = 0

        while (totalRead < maxBytes) {
            val read = stream.read(buffer, 0, buffer.size.coerceAtMost(maxBytes - totalRead))
            if (read <= 0) break
            result.append(String(buffer, 0, read, Charsets.UTF_8))
            totalRead += read
        }

        // 如果还有剩余数据，丢弃但记录
        if (totalRead >= maxBytes) {
            var discarded = 0L
            while (true) {
                val read = stream.read(buffer)
                if (read <= 0) break
                discarded += read
            }
            if (discarded > 0) {
                result.append("\n[... 输出截断，丢弃 ${discarded} 字节 ...]")
            }
        }

        return result.toString()
    }
}
