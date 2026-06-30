package com.xiaoxiami.app.agent.runtime

data class ShellExecutionResult(
    val success: Boolean,
    val stdout: String = "",
    val stderr: String = "",
    val exitCode: Int = 0
)

interface ShellRuntime {
    val runtimeName: String
    val available: Boolean

    suspend fun execute(
        command: String,
        workingDirectory: String = "",
        timeoutMs: Long = 20_000L
    ): ShellExecutionResult
}

class NoopShellRuntime : ShellRuntime {
    override val runtimeName: String = "disabled"
    override val available: Boolean = false

    override suspend fun execute(
        command: String,
        workingDirectory: String,
        timeoutMs: Long
    ): ShellExecutionResult {
        return ShellExecutionResult(
            success = false,
            stderr = "Shell runtime 未配置"
        )
    }
}
