package com.xiaoxiami.app.agent.tools

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.provider.Settings
import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolExecutionMode
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolValueType
import com.xiaoxiami.app.receiver.LocalReminderReceiver
import com.xiaoxiami.app.service.AgentNotificationListenerService
import com.xiaoxiami.app.utils.UsageStatsHelper

class OpenAppTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "open_app",
        description = "Open an installed Android app by package name.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("intent", "app_launch"),
        inputSchema = listOf(
            ToolParameterSchema("packageName", ToolValueType.STRING, "Installed app package name.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val packageName = arguments.stringArg("packageName")
        if (packageName.isBlank()) return ToolResult(false, "", "packageName 不能为空")
        val appLaunchIntent = this.context.packageManager.getLaunchIntentForPackage(packageName)
            ?: return ToolResult(false, "", "未找到可启动的应用：$packageName")
        val success = launchIntent(this.context, appLaunchIntent)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "launchedPackage" to packageName)))
    }
}

class OpenDeeplinkTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "open_deeplink",
        description = "Open a deeplink or web URL with the appropriate app.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("intent", "deeplink"),
        inputSchema = listOf(
            ToolParameterSchema("uri", ToolValueType.STRING, "Deeplink or URL to open.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val uri = arguments.stringArg("uri")
        if (uri.isBlank()) return ToolResult(false, "", "uri 不能为空")
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
        val success = launchIntent(this.context, intent)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "uri" to uri)))
    }
}

class OpenSystemSettingsPageTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "open_system_settings_page",
        description = "Open an Android system settings page.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        executionMode = ToolExecutionMode.SETTINGS_REDIRECT,
        capabilities = listOf("intent", "settings", "settings_redirect"),
        inputSchema = listOf(
            ToolParameterSchema("page", ToolValueType.STRING, "Settings page identifier like general, location, notification_access, usage_access, app_details.", required = true),
            ToolParameterSchema("packageName", ToolValueType.STRING, "Optional package name when page is app_details.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val page = arguments.stringArg("page", "general").lowercase()
        val packageName = arguments.stringArg("packageName")
        val intent = when (page) {
            "location" -> Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
            "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, this@OpenSystemSettingsPageTool.context.packageName)
            }
            "notification_access" -> AgentNotificationListenerService.getSettingsIntent()
            "usage_access" -> UsageStatsHelper.getSettingsIntent()
            "wireless" -> Intent(Settings.ACTION_WIRELESS_SETTINGS)
            "wifi" -> Intent(Settings.ACTION_WIFI_SETTINGS)
            "bluetooth" -> Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
            "app_details" -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${packageName.ifBlank { this@OpenSystemSettingsPageTool.context.packageName }}")
            }
            else -> Intent(Settings.ACTION_SETTINGS)
        }
        val success = launchIntent(this.context, intent)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "page" to page)))
    }
}

class ShareTextTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "share_text",
        description = "Share plain text to another app.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("intent", "share"),
        inputSchema = listOf(
            ToolParameterSchema("text", ToolValueType.STRING, "Text content to share.", required = true),
            ToolParameterSchema("title", ToolValueType.STRING, "Optional chooser title.", required = false),
            ToolParameterSchema("targetPackage", ToolValueType.STRING, "Optional target package.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val text = arguments.stringArg("text")
        if (text.isBlank()) return ToolResult(false, "", "text 不能为空")
        val title = arguments.stringArg("title", "分享文本")
        val targetPackage = arguments.stringArg("targetPackage")
        val sendIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
            if (targetPackage.isNotBlank()) setPackage(targetPackage)
        }
        val intent = if (targetPackage.isBlank()) Intent.createChooser(sendIntent, title) else sendIntent
        val success = launchIntent(this.context, intent)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "targetPackage" to targetPackage)))
    }
}

class ShareFilesTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "share_files",
        description = "Share one or more files to another app.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("intent", "share", "file"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        inputSchema = listOf(
            ToolParameterSchema("uris", ToolValueType.ARRAY, "File URI list to share.", required = true, itemType = ToolValueType.STRING),
            ToolParameterSchema("text", ToolValueType.STRING, "Optional accompanying text.", required = false),
            ToolParameterSchema("targetPackage", ToolValueType.STRING, "Optional target app package.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val uris = parseUriList(arguments["uris"])
        if (uris.isEmpty()) return ToolResult(false, "", "uris 不能为空")
        val targetPackage = arguments.stringArg("targetPackage")
        val text = arguments.stringArg("text")
        val mimeType = if (uris.size == 1) resolveMimeType(this.context, uris.first()) else "*/*"
        val intent = Intent(
            if (uris.size == 1) Intent.ACTION_SEND else Intent.ACTION_SEND_MULTIPLE
        ).apply {
            type = mimeType
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            clipData = buildClipData("shared_files", uris)
            if (uris.size == 1) {
                putExtra(Intent.EXTRA_STREAM, uris.first())
            } else {
                putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
            }
            if (text.isNotBlank()) putExtra(Intent.EXTRA_TEXT, text)
            if (targetPackage.isNotBlank()) setPackage(targetPackage)
        }
        val success = launchIntent(this.context, intent)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "count" to uris.size)))
    }
}

class OpenFileWithAppTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "open_file_with_app",
        description = "Open a local file with an external app.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("intent", "file_open"),
        inputSchema = listOf(
            ToolParameterSchema("uri", ToolValueType.STRING, "File URI to open.", required = true),
            ToolParameterSchema("mimeType", ToolValueType.STRING, "Optional MIME type override.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val uri = arguments.stringArg("uri")
        if (uri.isBlank()) return ToolResult(false, "", "uri 不能为空")
        val parsedUri = Uri.parse(uri)
        val mimeType = arguments.stringArg("mimeType").ifBlank { resolveMimeType(this.context, parsedUri) }
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(parsedUri, mimeType)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val success = launchIntent(this.context, intent)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "uri" to uri, "mimeType" to mimeType)))
    }
}

class LaunchMapNavigationTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "launch_map_navigation",
        description = "Launch map navigation to a destination.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("navigation", "intent"),
        inputSchema = listOf(
            ToolParameterSchema("destination", ToolValueType.STRING, "Destination address or place.", required = true),
            ToolParameterSchema("mode", ToolValueType.STRING, "Optional travel mode like driving or walking.", required = false)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val destination = arguments.stringArg("destination")
        if (destination.isBlank()) return ToolResult(false, "", "destination 不能为空")
        val mode = arguments.stringArg("mode", "driving")
        val modeChar = when (mode.lowercase()) {
            "driving", "d" -> 'd'
            "walking", "walk", "w" -> 'w'
            "bicycling", "cycling", "bike", "b" -> 'b'
            "transit", "public", "r" -> 'r'
            else -> mode.firstOrNull() ?: 'd'
        }
        val uri = Uri.parse("google.navigation:q=${Uri.encode(destination)}&mode=$modeChar")
        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            setPackage("com.google.android.apps.maps")
        }
        val success = launchIntent(this.context, intent) || launchIntent(
            this.context,
            Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=${Uri.encode(destination)}"))
        )
        return ToolResult(success, jsonOutput(mapOf("success" to success, "destination" to destination, "mode" to mode)))
    }
}

class QueryBatteryStatusTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "query_battery_status",
        description = "Read current battery and charging state.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("device_status", "battery"),
        outputSchema = listOf(
            ToolFieldSchema("level", ToolValueType.INTEGER, "Battery level percentage."),
            ToolFieldSchema("charging", ToolValueType.BOOLEAN, "Whether the device is charging.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val intent = this.context.registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            ?: return ToolResult(false, "", "无法读取电池状态")
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL
        val percent = if (level >= 0 && scale > 0) (level * 100) / scale else -1
        return ToolResult(true, jsonOutput(mapOf("level" to percent, "charging" to charging)))
    }
}

class QueryStorageStatusTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "query_storage_status",
        description = "Read device storage usage.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("device_status", "storage"),
        outputSchema = listOf(
            ToolFieldSchema("freeBytes", ToolValueType.NUMBER, "Available bytes."),
            ToolFieldSchema("totalBytes", ToolValueType.NUMBER, "Total bytes."),
            ToolFieldSchema("usedBytes", ToolValueType.NUMBER, "Used bytes.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val stats = storageStats(Environment.getDataDirectory())
        return ToolResult(true, jsonOutput(stats))
    }
}

class QueryNetworkStatusTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "query_network_status",
        description = "Read current network connectivity status.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("device_status", "network"),
        outputSchema = listOf(
            ToolFieldSchema("connected", ToolValueType.BOOLEAN, "Whether there is an active network."),
            ToolFieldSchema("transport", ToolValueType.STRING, "Network transport name.", required = false)
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val manager = this.context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return ToolResult(false, "", "无法获取 ConnectivityManager")
        val network = manager.activeNetwork
        val capabilities = manager.getNetworkCapabilities(network)
        val transport = when {
            capabilities == null -> "offline"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH) -> "bluetooth"
            else -> "other"
        }
        return ToolResult(
            true,
            jsonOutput(
                mapOf(
                    "connected" to (capabilities != null),
                    "transport" to transport,
                    "metered" to manager.isActiveNetworkMetered
                )
            )
        )
    }
}

class GetAudioOutputDevicesTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "get_audio_output_devices",
        description = "List current audio output devices.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("audio", "device_status"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        outputSchema = listOf(
            ToolFieldSchema("devices", ToolValueType.ARRAY, "Active and available output devices.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val audioManager = this.context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            ?: return ToolResult(false, "", "无法获取 AudioManager")
        val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS).map { device ->
            mapOf(
                "id" to device.id,
                "name" to device.productName.toString(),
                "type" to audioDeviceTypeName(device.type),
                "isSink" to device.isSink
            )
        }
        return ToolResult(true, jsonOutput(mapOf("devices" to devices)))
    }

    private fun audioDeviceTypeName(type: Int): String {
        return when (type) {
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "bluetooth_a2dp"
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "bluetooth_sco"
            AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "speaker"
            AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "earpiece"
            AudioDeviceInfo.TYPE_USB_DEVICE -> "usb"
            AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "wired_headphones"
            AudioDeviceInfo.TYPE_WIRED_HEADSET -> "wired_headset"
            else -> "type_$type"
        }
    }
}

class InstallApkPromptedTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "install_apk_prompted",
        description = "Launch the Android package installer for an APK URI.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("package_management"),
        riskLevel = ToolRiskLevel.HIGH,
        approvalRequired = true,
        approvalReason = "安装 APK 会修改设备应用状态。",
        approvalSummary = "Agent 请求发起 APK 安装",
        inputSchema = listOf(
            ToolParameterSchema("apkUri", ToolValueType.STRING, "APK content URI.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val apkUri = arguments.stringArg("apkUri")
        if (apkUri.isBlank()) return ToolResult(false, "", "apkUri 不能为空")
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(Uri.parse(apkUri), "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val success = launchIntent(this.context, intent)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "promptLaunched" to success)))
    }
}

class UninstallAppPromptedTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "uninstall_app_prompted",
        description = "Launch the Android uninstall prompt for a package.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("package_management"),
        riskLevel = ToolRiskLevel.HIGH,
        approvalRequired = true,
        approvalReason = "卸载应用会修改设备应用状态。",
        approvalSummary = "Agent 请求发起应用卸载",
        inputSchema = listOf(
            ToolParameterSchema("packageName", ToolValueType.STRING, "Package to uninstall.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val packageName = arguments.stringArg("packageName")
        if (packageName.isBlank()) return ToolResult(false, "", "packageName 不能为空")
        val intent = Intent(Intent.ACTION_DELETE).apply {
            data = Uri.parse("package:$packageName")
        }
        val success = launchIntent(this.context, intent)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "promptLaunched" to success, "packageName" to packageName)))
    }
}

