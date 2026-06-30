package com.xiaoxiami.app.agent.tools

import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolValueType
import com.xiaoxiami.app.utils.UsageStatsHelper
import android.content.Context

class GetForegroundAppTool(
    private val context: Context
) : Tool {

    override val schema: ToolSchema = ToolSchema(
        name = "get_foreground_app",
        description = "Read the current foreground app on the phone and return its package name, app name, and last active time.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("device_context", "foreground_app", "phone_state"),
        outputSchema = listOf(
            ToolFieldSchema(
                name = "packageName",
                type = ToolValueType.STRING,
                description = "Foreground app package name."
            ),
            ToolFieldSchema(
                name = "appName",
                type = ToolValueType.STRING,
                description = "Foreground app display name."
            ),
            ToolFieldSchema(
                name = "lastActiveAt",
                type = ToolValueType.NUMBER,
                description = "Timestamp when the app was last active."
            )
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        if (!UsageStatsHelper.hasUsageStatsPermission(this.context)) {
            return ToolResult(
                success = false,
                output = "",
                error = "Usage Access 未开启，无法读取当前前台应用"
            )
        }

        val snapshot = UsageStatsHelper.getCurrentForegroundAppSnapshot(this.context)
            ?: return ToolResult(
                success = false,
                output = "",
                error = "暂时无法识别当前前台应用"
            )

        return ToolResult(
            success = true,
            output = """
                packageName: ${snapshot.packageName}
                appName: ${snapshot.appName}
                lastActiveAt: ${snapshot.lastActiveAt}
            """.trimIndent()
        )
    }
}
