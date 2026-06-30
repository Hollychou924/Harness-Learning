package com.xiaoxiami.app.hub

import android.os.Build

/**
 * Builds device capability declarations for Hub registration.
 * Ported from desktop-claw's capabilityBuilder.ts.
 * Adapted for Android device capabilities.
 */
object CapabilityBuilder {

    private val DOMAIN_KEYWORDS = mapOf(
        "notification" to "notification_management",
        "calendar" to "calendar_management",
        "contact" to "contact_management",
        "sms" to "messaging",
        "call" to "communication",
        "file" to "file_management",
        "screen" to "screen_capture",
        "media" to "media_control",
        "device" to "device_control",
        "web" to "web_access",
        "memory" to "memory",
        "schedule" to "scheduling",
        "cron" to "scheduling",
        "rule" to "automation",
        "bluetooth" to "device_control",
        "wifi" to "device_control",
        "volume" to "device_control",
        "brightness" to "device_control",
        "flashlight" to "device_control"
    )

    /**
     * Build a capability declaration from available tool names.
     */
    fun buildCapabilityDeclaration(
        toolNames: List<String>,
        deviceName: String = Build.MODEL
    ): DeviceCapabilityDeclaration {
        // Filter out cross-device tools (avoid circular declarations)
        val filteredTools = toolNames.filter { name ->
            !name.startsWith("remote_") && !name.startsWith("cross_device")
        }

        // Infer capability domains
        val domains = mutableSetOf<String>()
        for (toolName in filteredTools) {
            for ((keyword, domain) in DOMAIN_KEYWORDS) {
                if (toolName.contains(keyword, ignoreCase = true)) {
                    domains.add(domain)
                }
            }
        }

        // Build tool declarations
        val tools = filteredTools.map { name ->
            ToolDeclaration(
                name = name,
                description = inferToolDescription(name)
            )
        }

        return DeviceCapabilityDeclaration(
            deviceType = "phone",
            os = "android ${Build.VERSION.RELEASE}",
            deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
            capabilityDomains = domains.sorted(),
            tools = tools,
            description = buildDescription(domains),
            limitations = buildLimitations()
        )
    }

    private fun inferToolDescription(toolName: String): String {
        return toolName.replace("_", " ").replaceFirstChar { it.uppercase() }
    }

    private fun buildDescription(domains: Set<String>): String {
        val capabilities = domains.joinToString("、") { domain ->
            when (domain) {
                "notification_management" -> "通知管理"
                "calendar_management" -> "日历管理"
                "contact_management" -> "联系人管理"
                "messaging" -> "短信收发"
                "communication" -> "通话控制"
                "file_management" -> "文件管理"
                "screen_capture" -> "屏幕截图"
                "media_control" -> "媒体控制"
                "device_control" -> "设备控制"
                "web_access" -> "网页访问"
                "memory" -> "记忆管理"
                "scheduling" -> "定时任务"
                "automation" -> "自动化规则"
                else -> domain
            }
        }
        return "Android手机Agent，具备：$capabilities"
    }

    private fun buildLimitations(): List<String> {
        return listOf(
            "无法控制桌面应用",
            "无法直接操作浏览器页面元素",
            "不支持桌面截图（仅手机屏幕）",
            "不支持Shell命令执行",
            "不支持代码编辑和运行"
        )
    }
}
