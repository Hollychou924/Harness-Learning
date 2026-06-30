package com.xiaoxiami.app.agent.runtime

import android.content.Context
import android.os.Build
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

/**
 * Alpine Linux 环境引导器。
 *
 * 负责首次启动时：
 *   1. 解压 proot 静态二进制（从 assets）
 *   2. 解压 Alpine minirootfs（从 assets）
 *   3. 配置 DNS
 *   4. 安装 Python3 / Node.js（需要网络）
 *
 * 全程异步执行，不阻塞 App 启动。
 */
class AlpineBootstrapper(
    private val context: Context,
    private val scope: CoroutineScope
) {
    companion object {
        private const val TAG = "AlpineBootstrapper"

        // Asset 文件名
        private const val ASSET_DIR = "alpine"
        private const val PROOT_ASSET = "proot-aarch64"
        private const val ROOTFS_ASSET = "alpine-minirootfs-aarch64.tar.gz"
        private const val SETUP_SCRIPT_ASSET = "setup.sh"

        // 版本标记，更新此值会触发重新引导
        private const val BOOTSTRAP_VERSION = "1"
    }

    // ── 目录结构 ──

    val alpineDir: File = File(context.filesDir, "alpine")
    val rootfsDir: File = File(alpineDir, "rootfs")
    val homeDir: File = File(alpineDir, "home")
    val tmpDir: File = File(alpineDir, "tmp")
    val scriptsDir: File = File(alpineDir, "scripts")
    val prootBinary: File = File(alpineDir, "proot")

    private val versionFile = File(alpineDir, ".bootstrap_version")
    private val packagesInstalledFile = File(alpineDir, ".packages_installed")

    // ── 状态 ──

    private val _state = MutableStateFlow<BootstrapState>(BootstrapState.NotStarted)
    val state: StateFlow<BootstrapState> = _state.asStateFlow()

    /**
     * rootfs 是否已解压就绪（基本 shell 可用）。
     */
    fun isBootstrapped(): Boolean {
        return versionFile.exists()
                && versionFile.readText().trim() == BOOTSTRAP_VERSION
                && prootBinary.canExecute()
                && File(rootfsDir, "bin/sh").exists()
    }

    /**
     * 包（Python/Node）是否已安装。
     */
    fun arePackagesInstalled(): Boolean {
        return packagesInstalledFile.exists()
    }

    /**
     * 检查设备架构是否支持。
     */
    fun isSupportedArchitecture(): Boolean {
        val primaryAbi = Build.SUPPORTED_ABIS.firstOrNull() ?: return false
        return primaryAbi == "arm64-v8a" || primaryAbi == "x86_64"
    }

    /**
     * 启动完整引导流程（异步）。
     * 可安全重复调用——如果已完成或正在进行中则直接返回。
     */
    fun launchBootstrap() {
        if (_state.value is BootstrapState.InProgress) return
        if (isBootstrapped()) {
            _state.value = BootstrapState.Ready
            return
        }

        scope.launch {
            bootstrap()
        }
    }

    /**
     * 执行引导（挂起函数，在调用者协程上下文中运行）。
     */
    suspend fun bootstrap() {
        if (!isSupportedArchitecture()) {
            val abi = Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown"
            _state.value = BootstrapState.Failed(
                error = "不支持的设备架构: $abi（需要 arm64-v8a 或 x86_64）",
                retryable = false
            )
            return
        }

        try {
            // Step 1: 安装 proot 二进制
            updateState("正在安装 proot...", 0.1f)
            installProot()

            // Step 2: 解压 rootfs
            updateState("正在解压 Alpine rootfs...", 0.2f)
            extractRootfs()

            // Step 3: 创建必要目录
            updateState("正在配置环境...", 0.6f)
            setupDirectories()

            // Step 4: 配置 DNS
            configureDns()

            // Step 5: 写入版本标记
            versionFile.writeText(BOOTSTRAP_VERSION)

            updateState("基本环境就绪", 0.7f)

            // Step 6: 安装包（可选，需网络）
            if (!arePackagesInstalled()) {
                updateState("正在安装 Python/Node.js（需要网络）...", 0.75f)
                val packagesOk = installPackages()
                if (packagesOk) {
                    packagesInstalledFile.writeText("installed")
                } else {
                    Log.w(TAG, "包安装失败，基本 shell 仍可用")
                }
            }

            _state.value = BootstrapState.Ready
            Log.i(TAG, "Alpine 环境引导完成")

        } catch (e: Exception) {
            Log.e(TAG, "引导失败", e)
            _state.value = BootstrapState.Failed(
                error = e.message ?: "未知错误",
                retryable = true
            )
        }
    }

    /**
     * 删除整个 Alpine 环境（用于重置）。
     */
    suspend fun reset() = withContext(Dispatchers.IO) {
        _state.value = BootstrapState.NotStarted
        alpineDir.deleteRecursively()
        Log.i(TAG, "Alpine 环境已重置")
    }

    /**
     * 获取 Alpine 环境磁盘占用（字节）。
     */
    fun getDiskUsageBytes(): Long {
        if (!alpineDir.exists()) return 0
        return alpineDir.walkTopDown().sumOf { it.length() }
    }

    // ── 内部实现 ──

    private suspend fun installProot() = withContext(Dispatchers.IO) {
        if (prootBinary.exists() && prootBinary.canExecute()) return@withContext

        alpineDir.mkdirs()
        context.assets.open("$ASSET_DIR/$PROOT_ASSET").use { input ->
            FileOutputStream(prootBinary).use { output ->
                input.copyTo(output)
            }
        }
        prootBinary.setExecutable(true, false)
        prootBinary.setReadable(true, false)
        Log.d(TAG, "proot 已安装: ${prootBinary.absolutePath}")
    }

    private suspend fun extractRootfs() = withContext(Dispatchers.IO) {
        if (rootfsDir.exists()) {
            rootfsDir.deleteRecursively()
        }
        rootfsDir.mkdirs()

        context.assets.open("$ASSET_DIR/$ROOTFS_ASSET").use { input ->
            TarExtractor.extractTarGz(input, rootfsDir) { entryName ->
                // 可选：更新进度
                Log.v(TAG, "解压: $entryName")
            }
        }
        Log.d(TAG, "rootfs 已解压: ${rootfsDir.absolutePath}")
    }

    private fun setupDirectories() {
        homeDir.mkdirs()
        tmpDir.mkdirs()
        scriptsDir.mkdirs()

        // 确保 rootfs 内的关键目录存在
        File(rootfsDir, "tmp").mkdirs()
        File(rootfsDir, "root").mkdirs()
        File(rootfsDir, "proc").mkdirs()
        File(rootfsDir, "dev").mkdirs()
        File(rootfsDir, "sys").mkdirs()
    }

    private fun configureDns() {
        val resolvConf = File(rootfsDir, "etc/resolv.conf")
        resolvConf.parentFile?.mkdirs()
        resolvConf.writeText(
            """
            nameserver 8.8.8.8
            nameserver 8.8.4.4
            nameserver 223.5.5.5
            """.trimIndent()
        )
    }

    /**
     * 通过 proot 在 rootfs 内执行 apk 安装包。
     * 返回 true 表示成功，false 表示失败（但不影响基本 shell 可用性）。
     */
    private suspend fun installPackages(): Boolean = withContext(Dispatchers.IO) {
        try {
            // 读取 setup.sh 脚本
            val setupScript = try {
                context.assets.open("$ASSET_DIR/$SETUP_SCRIPT_ASSET")
                    .bufferedReader().use { it.readText() }
            } catch (_: Exception) {
                // 如果没有 setup.sh，使用默认安装命令
                """
                #!/bin/sh
                echo "nameserver 8.8.8.8" > /etc/resolv.conf
                echo "nameserver 223.5.5.5" >> /etc/resolv.conf
                apk update
                apk add --no-cache python3 py3-pip nodejs npm
                """.trimIndent()
            }

            // 写入临时脚本
            val tempScript = File(tmpDir, "setup.sh")
            tempScript.writeText(setupScript)
            tempScript.setExecutable(true)

            // 通过 proot 执行
            val cmd = listOf(
                prootBinary.absolutePath,
                "-0",
                "-r", rootfsDir.absolutePath,
                "-b", "/dev",
                "-b", "/proc",
                "-b", "/sys",
                "-b", "${tmpDir.absolutePath}:/tmp",
                "-w", "/root",
                "/bin/sh", "/tmp/setup.sh"
            )

            val process = ProcessBuilder(cmd)
                .apply {
                    environment()["HOME"] = "/root"
                    environment()["PATH"] = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
                    environment()["TERM"] = "dumb"
                    environment()["PROOT_TMP_DIR"] = tmpDir.absolutePath
                    redirectErrorStream(true)
                }
                .start()

            // 读取输出（限制 64KB）
            val output = StringBuilder()
            val maxOutput = 65536
            process.inputStream.bufferedReader().use { reader ->
                var line = reader.readLine()
                while (line != null) {
                    if (output.length < maxOutput) {
                        output.appendLine(line)
                    }
                    Log.d(TAG, "setup: $line")
                    line = reader.readLine()
                }
            }

            val exitCode = process.waitFor()
            Log.i(TAG, "包安装完成，exitCode=$exitCode")

            tempScript.delete()
            exitCode == 0

        } catch (e: Exception) {
            Log.e(TAG, "包安装失败", e)
            false
        }
    }

    private fun updateState(step: String, progress: Float) {
        _state.value = BootstrapState.InProgress(step, progress)
        Log.d(TAG, "引导进度: $step (${"%.0f".format(progress * 100)}%)")
    }
}

/**
 * Alpine 环境引导状态。
 */
sealed class BootstrapState {
    /** 未开始 */
    object NotStarted : BootstrapState()

    /** 进行中 */
    data class InProgress(val step: String, val progress: Float) : BootstrapState()

    /** 就绪 */
    object Ready : BootstrapState()

    /** 失败 */
    data class Failed(val error: String, val retryable: Boolean) : BootstrapState()
}
