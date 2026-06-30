package com.xiaoxiami.app.agent.tools

import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolAvailability
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolFamily
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolScope
import com.xiaoxiami.app.agent.ToolValueType
import com.xiaoxiami.app.agent.runtime.AlpineShellRuntime
import com.xiaoxiami.app.agent.runtime.ShellRuntime
import java.io.File

class ShellExecTool(
    private val shellRuntime: ShellRuntime
) : Tool {
    override val schema = ToolSchema(
        name = "shell_exec",
        family = ToolFamily.SHELL,
        description = "Execute a command in the optional local shell runtime when it is explicitly enabled.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("shell", "command_execution"),
        riskLevel = ToolRiskLevel.HIGH,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("shell_runtime"),
        scopes = listOf(ToolScope.SHELL, ToolScope.FILE_SYSTEM),
        accessRequirements = listOf(
            ToolAccessRequirement(
                kind = ToolAccessKind.SPECIAL_ACCESS,
                identifier = "shell_runtime",
                description = "需要显式启用 shell runtime 才可执行"
            )
        ),
        inputSchema = listOf(
            ToolParameterSchema("command", ToolValueType.STRING, "Command to execute.", required = true),
            ToolParameterSchema("workingDirectory", ToolValueType.STRING, "Optional working directory.", required = false),
            ToolParameterSchema("timeoutSeconds", ToolValueType.INTEGER, "Optional timeout in seconds.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("success", ToolValueType.BOOLEAN, "Whether execution succeeded."),
            ToolFieldSchema("stdout", ToolValueType.STRING, "Captured stdout.", required = false),
            ToolFieldSchema("stderr", ToolValueType.STRING, "Captured stderr.", required = false),
            ToolFieldSchema("exitCode", ToolValueType.INTEGER, "Process exit code.", required = false),
            ToolFieldSchema("runtime", ToolValueType.STRING, "Resolved shell runtime name.")
        )
    )

    override fun isCurrentlyAvailable(): Boolean = shellRuntime.available

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val command = arguments.stringArg("command")
        if (command.isBlank()) {
            return ToolResult(false, "", "command 不能为空")
        }
        val result = shellRuntime.execute(
            command = command,
            workingDirectory = arguments.stringArg("workingDirectory"),
            timeoutMs = arguments.intArg("timeoutSeconds", 20).coerceIn(1, 120) * 1000L
        )
        return ToolResult(
            success = result.success,
            output = jsonOutput(
                mapOf(
                    "success" to result.success,
                    "stdout" to result.stdout,
                    "stderr" to result.stderr,
                    "exitCode" to result.exitCode,
                    "runtime" to shellRuntime.runtimeName
                )
            ),
            error = if (result.success) null else result.stderr.ifBlank { "shell 执行失败" }
        )
    }
}

/**
 * 将脚本文件写入 Alpine 环境的 /scripts 目录，自动添加 shebang 并设置可执行权限。
 * 解决多行脚本在 shell_exec 中转义困难的问题。
 */
class ShellWriteScriptTool(
    private val shellRuntime: ShellRuntime
) : Tool {
    override val schema = ToolSchema(
        name = "shell_write_script",
        family = ToolFamily.SHELL,
        description = "Write a script file to the Alpine Linux environment's /scripts directory, " +
                "automatically adding a shebang line and making it executable. " +
                "Use this to create Python/Node.js/shell scripts before executing them with shell_exec.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("shell", "script_writing"),
        riskLevel = ToolRiskLevel.HIGH,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("shell_runtime"),
        scopes = listOf(ToolScope.SHELL, ToolScope.FILE_SYSTEM),
        accessRequirements = listOf(
            ToolAccessRequirement(
                kind = ToolAccessKind.SPECIAL_ACCESS,
                identifier = "shell_runtime",
                description = "需要启用 Alpine Linux 环境"
            )
        ),
        inputSchema = listOf(
            ToolParameterSchema("filename", ToolValueType.STRING,
                "Script filename (e.g. 'analyze.py', 'process.js', 'run.sh').", required = true),
            ToolParameterSchema("content", ToolValueType.STRING,
                "Script content (without shebang line, it will be added automatically).", required = true),
            ToolParameterSchema("interpreter", ToolValueType.STRING,
                "Interpreter path for shebang. Default: auto-detected from file extension " +
                        "(py→/usr/bin/env python3, js→/usr/bin/env node, sh→/bin/sh).",
                required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("success", ToolValueType.BOOLEAN, "Whether the script was written."),
            ToolFieldSchema("path", ToolValueType.STRING, "Full path to the script inside Alpine."),
            ToolFieldSchema("message", ToolValueType.STRING, "Status message.")
        )
    )

    override fun isCurrentlyAvailable(): Boolean = shellRuntime.available

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val alpine = shellRuntime as? AlpineShellRuntime
            ?: return ToolResult(false, "", "shell_write_script 需要 Alpine Linux 环境")

        val filename = arguments.stringArg("filename")
        if (filename.isBlank()) {
            return ToolResult(false, "", "filename 不能为空")
        }

        // 安全检查：禁止路径穿越
        if (filename.contains("..") || filename.contains("/")) {
            return ToolResult(false, "", "filename 不能包含路径分隔符或 '..'")
        }

        val content = arguments.stringArg("content")
        if (content.isBlank()) {
            return ToolResult(false, "", "content 不能为空")
        }

        val interpreter = arguments.stringArg("interpreter").ifBlank {
            guessInterpreter(filename)
        }

        val scriptsDir = alpine.bootstrap.scriptsDir
        scriptsDir.mkdirs()
        val scriptFile = File(scriptsDir, filename)

        // 写入脚本：shebang + 内容
        val shebang = "#!$interpreter"
        val fullContent = if (content.startsWith("#!")) {
            content // 用户已提供 shebang，不重复添加
        } else {
            "$shebang\n$content"
        }
        scriptFile.writeText(fullContent, Charsets.UTF_8)
        scriptFile.setExecutable(true, false)
        scriptFile.setReadable(true, false)

        val alpinePath = "/scripts/$filename"

        return ToolResult(
            success = true,
            output = jsonOutput(mapOf(
                "success" to true,
                "path" to alpinePath,
                "message" to "脚本已写入 $alpinePath，可通过 shell_exec 执行: $interpreter $alpinePath"
            ))
        )
    }

    private fun guessInterpreter(filename: String): String {
        return when {
            filename.endsWith(".py") -> "/usr/bin/env python3"
            filename.endsWith(".js") -> "/usr/bin/env node"
            filename.endsWith(".sh") -> "/bin/sh"
            filename.endsWith(".rb") -> "/usr/bin/env ruby"
            filename.endsWith(".pl") -> "/usr/bin/env perl"
            else -> "/bin/sh"
        }
    }
}

/**
 * 在 Alpine 环境中安装 apk 包。
 */
class ShellInstallPackageTool(
    private val shellRuntime: ShellRuntime
) : Tool {
    override val schema = ToolSchema(
        name = "shell_install_package",
        family = ToolFamily.SHELL,
        description = "Install packages in the Alpine Linux environment using apk package manager. " +
                "Commonly used packages: python3, py3-pip, nodejs, npm, git, curl, jq, sqlite, etc.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("shell", "package_management"),
        riskLevel = ToolRiskLevel.HIGH,
        availability = ToolAvailability.OPTIONAL,
        allowlistTags = listOf("shell_runtime"),
        scopes = listOf(ToolScope.SHELL, ToolScope.NETWORK),
        accessRequirements = listOf(
            ToolAccessRequirement(
                kind = ToolAccessKind.SPECIAL_ACCESS,
                identifier = "shell_runtime",
                description = "需要启用 Alpine Linux 环境"
            ),
            ToolAccessRequirement(
                kind = ToolAccessKind.NETWORK,
                identifier = "internet",
                description = "安装包需要网络连接"
            )
        ),
        inputSchema = listOf(
            ToolParameterSchema("packages", ToolValueType.STRING,
                "Space-separated package names to install (e.g. 'pandas numpy matplotlib').",
                required = true)
        ),
        outputSchema = listOf(
            ToolFieldSchema("success", ToolValueType.BOOLEAN, "Whether installation succeeded."),
            ToolFieldSchema("stdout", ToolValueType.STRING, "Installation output."),
            ToolFieldSchema("stderr", ToolValueType.STRING, "Error output.", required = false),
            ToolFieldSchema("installedPackages", ToolValueType.STRING, "List of packages requested.")
        )
    )

    override fun isCurrentlyAvailable(): Boolean = shellRuntime.available

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val packages = arguments.stringArg("packages")
        if (packages.isBlank()) {
            return ToolResult(false, "", "packages 不能为空")
        }

        // 过滤掉危险字符，只保留合法的包名字符
        val sanitized = packages.split(Regex("\\s+"))
            .filter { it.matches(Regex("^[a-zA-Z0-9._+-]+$")) }
            .joinToString(" ")

        if (sanitized.isBlank()) {
            return ToolResult(false, "", "无有效包名")
        }

        val command = "apk add --no-cache $sanitized"
        val result = shellRuntime.execute(
            command = command,
            timeoutMs = 120_000L // 包安装给 2 分钟超时
        )

        return ToolResult(
            success = result.success,
            output = jsonOutput(mapOf(
                "success" to result.success,
                "stdout" to result.stdout,
                "stderr" to result.stderr,
                "installedPackages" to sanitized
            )),
            error = if (result.success) null else result.stderr.ifBlank { "包安装失败" }
        )
    }
}
