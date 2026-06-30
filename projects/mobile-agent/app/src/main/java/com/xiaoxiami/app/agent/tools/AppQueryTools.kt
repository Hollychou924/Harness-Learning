package com.xiaoxiami.app.agent.tools

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolValueType

class ListInstalledAppsTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "list_installed_apps",
        description = "List installed applications on the device. Useful for finding package names to use with open_app or uninstall_app.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("package_management", "read"),
        inputSchema = listOf(
            ToolParameterSchema("includeSystem", ToolValueType.BOOLEAN, "Whether to include system apps. Default is false.", required = false),
            ToolParameterSchema("query", ToolValueType.STRING, "Optional keyword to filter app names or package names.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("apps", ToolValueType.ARRAY, "List of installed applications with packageName, name, and version."),
            ToolFieldSchema("total", ToolValueType.INTEGER, "Total count of matched apps.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val includeSystem = arguments.booleanArg("includeSystem", false)
        val query = arguments.stringArg("query").lowercase()

        val pm = this.context.packageManager
        val packages = pm.getInstalledPackages(0)

        val apps = mutableListOf<Map<String, Any>>()

        packages.forEach { pkgInfo ->
            val isSystem = ((pkgInfo.applicationInfo?.flags ?: 0) and ApplicationInfo.FLAG_SYSTEM) != 0
            if (!includeSystem && isSystem) return@forEach

            val appName = pkgInfo.applicationInfo?.loadLabel(pm)?.toString() ?: pkgInfo.packageName
            val packageName = pkgInfo.packageName
            val versionName = pkgInfo.versionName ?: "unknown"

            if (query.isNotBlank() && !appName.lowercase().contains(query) && !packageName.lowercase().contains(query)) {
                return@forEach
            }

            apps.add(mapOf(
                "packageName" to packageName,
                "name" to appName,
                "version" to versionName,
                "isSystem" to isSystem
            ))
        }

        apps.sortBy { it["name"] as String }

        return ToolResult(true, jsonOutput(mapOf("apps" to apps, "total" to apps.size)))
    }
}
