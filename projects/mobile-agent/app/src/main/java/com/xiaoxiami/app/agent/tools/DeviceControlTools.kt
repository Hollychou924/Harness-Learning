package com.xiaoxiami.app.agent.tools

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.os.Build
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
import kotlin.math.roundToInt

class SetStreamVolumeTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "set_stream_volume",
        description = "Adjust an Android audio stream volume directly.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        executionMode = ToolExecutionMode.DIRECT,
        capabilities = listOf("audio", "device_control", "direct_execution"),
        riskLevel = ToolRiskLevel.LOW,
        approvalRequired = false,
        approvalReason = "修改音量属于设备状态变更操作。",
        approvalSummary = "Agent 请求调整设备音量",
        inputSchema = listOf(
            ToolParameterSchema("stream", ToolValueType.STRING, "music, ring, alarm, notification, voice_call, system", required = true),
            ToolParameterSchema("level", ToolValueType.INTEGER, "Target volume level.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val audioManager = this.context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            ?: return ToolResult(false, "", "无法获取 AudioManager")
        val stream = when (arguments.stringArg("stream", "music").lowercase()) {
            "ring" -> AudioManager.STREAM_RING
            "alarm" -> AudioManager.STREAM_ALARM
            "notification" -> AudioManager.STREAM_NOTIFICATION
            "voice_call" -> AudioManager.STREAM_VOICE_CALL
            "system" -> AudioManager.STREAM_SYSTEM
            else -> AudioManager.STREAM_MUSIC
        }
        val max = audioManager.getStreamMaxVolume(stream)
        val level = arguments.intArg("level", max / 2).coerceIn(0, max)
        audioManager.setStreamVolume(stream, level, 0)
        return ToolResult(true, jsonOutput(mapOf("success" to true, "stream" to stream, "level" to level, "max" to max)))
    }
}

class SetFlashlightTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "set_flashlight",
        description = "Turn the device flashlight on or off if the hardware supports torch mode. 用于开关手机手电筒、闪光灯（补光）；参数 enabled=true 打开，false 关闭。",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        executionMode = ToolExecutionMode.DIRECT,
        capabilities = listOf("device_control", "flashlight", "direct_execution"),
        riskLevel = ToolRiskLevel.LOW,
        approvalRequired = false,
        approvalReason = "手电筒会改变设备当前硬件状态。",
        approvalSummary = "Agent 请求切换手电筒",
        inputSchema = listOf(
            ToolParameterSchema("enabled", ToolValueType.BOOLEAN, "Whether the flashlight should be on.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        if (!this.context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH)) {
            return ToolResult(false, "", "当前设备不支持手电筒")
        }
        val enabled = arguments.booleanArg("enabled", false)
        val cameraManager = this.context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
            ?: return ToolResult(false, "", "无法获取 CameraManager")
        val cameraId = cameraManager.cameraIdList.firstOrNull { id ->
            val characteristics = cameraManager.getCameraCharacteristics(id)
            val flashAvailable = characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
            val lensFacing = characteristics.get(CameraCharacteristics.LENS_FACING)
            flashAvailable && lensFacing == CameraCharacteristics.LENS_FACING_BACK
        } ?: cameraManager.cameraIdList.firstOrNull { id ->
            cameraManager.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
        } ?: return ToolResult(false, "", "没有可用的手电筒摄像头")

        return runCatching {
            cameraManager.setTorchMode(cameraId, enabled)
            ToolResult(true, jsonOutput(mapOf("success" to true, "enabled" to enabled, "cameraId" to cameraId)))
        }.getOrElse { error ->
            ToolResult(false, "", error.message ?: "切换手电筒失败")
        }
    }
}

class SetScreenBrightnessTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "set_screen_brightness",
        description = "Set the system screen brightness directly when write settings access is granted.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        executionMode = ToolExecutionMode.DIRECT,
        capabilities = listOf("device_control", "brightness", "direct_execution"),
        riskLevel = ToolRiskLevel.LOW,
        approvalRequired = false,
        approvalReason = "亮度会直接改变设备显示状态。",
        approvalSummary = "Agent 请求调整屏幕亮度",
        inputSchema = listOf(
            ToolParameterSchema("brightnessPercent", ToolValueType.INTEGER, "Target screen brightness percent from 0 to 100.", required = false),
            ToolParameterSchema("mode", ToolValueType.STRING, "manual or auto", required = false, enumValues = listOf("manual", "auto"))
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        if (!Settings.System.canWrite(this.context)) {
            return ToolResult(false, "", "当前未授予修改系统设置权限，无法直接调整亮度。请先在权限中心开启“修改系统设置”。")
        }

        val mode = arguments.stringArg("mode", "manual").lowercase()
        val brightnessPercent = arguments.intArg("brightnessPercent", 50).coerceIn(0, 100)
        val resolver = this.context.contentResolver

        return runCatching {
            when (mode) {
                "auto" -> {
                    Settings.System.putInt(
                        resolver,
                        Settings.System.SCREEN_BRIGHTNESS_MODE,
                        Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC
                    )
                }

                else -> {
                    Settings.System.putInt(
                        resolver,
                        Settings.System.SCREEN_BRIGHTNESS_MODE,
                        Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL
                    )
                    val brightnessValue = ((brightnessPercent / 100.0) * 255.0).roundToInt().coerceIn(0, 255)
                    Settings.System.putInt(
                        resolver,
                        Settings.System.SCREEN_BRIGHTNESS,
                        brightnessValue
                    )
                }
            }

            ToolResult(
                true,
                jsonOutput(
                    mapOf(
                        "success" to true,
                        "mode" to mode,
                        "brightnessPercent" to if (mode == "auto") null else brightnessPercent
                    )
                )
            )
        }.getOrElse { error ->
            ToolResult(false, "", error.message ?: "调整屏幕亮度失败")
        }
    }
}

class OpenWifiSettingsTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "open_wifi_settings",
        description = "Open Wi-Fi settings because third-party apps cannot silently toggle Wi-Fi on modern Android.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        executionMode = ToolExecutionMode.SETTINGS_REDIRECT,
        capabilities = listOf("device_control", "wifi", "settings_redirect"),
        inputSchema = emptyList(),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            Intent(Settings.Panel.ACTION_INTERNET_CONNECTIVITY)
        } else {
            Intent(Settings.ACTION_WIFI_SETTINGS)
        }
        val success = launchIntent(this.context, intent)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "page" to "wifi")))
    }
}

class OpenBluetoothSettingsTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "open_bluetooth_settings",
        description = "Open Bluetooth settings because third-party apps cannot silently toggle Bluetooth on modern Android.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        executionMode = ToolExecutionMode.SETTINGS_REDIRECT,
        capabilities = listOf("device_control", "bluetooth", "settings_redirect"),
        inputSchema = emptyList(),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val intent = Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
        val success = launchIntent(this.context, intent)
        return ToolResult(success, jsonOutput(mapOf("success" to success, "page" to "bluetooth")))
    }
}

class OpenNfcSettingsTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "open_nfc_settings",
        description = "Open NFC settings because third-party apps cannot silently toggle NFC.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        executionMode = ToolExecutionMode.SETTINGS_REDIRECT,
        capabilities = listOf("device_control", "nfc", "settings_redirect"),
        inputSchema = emptyList(),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val success = launchIntent(this.context, Intent(Settings.ACTION_NFC_SETTINGS))
        return ToolResult(success, jsonOutput(mapOf("success" to success, "page" to "nfc")))
    }
}

class OpenDisplaySettingsTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "open_display_settings",
        description = "Open display settings for manual brightness, auto-brightness and screen timeout adjustments.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        executionMode = ToolExecutionMode.SETTINGS_REDIRECT,
        capabilities = listOf("device_control", "brightness", "settings_redirect"),
        inputSchema = emptyList(),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val success = launchIntent(this.context, Intent(Settings.ACTION_DISPLAY_SETTINGS))
        return ToolResult(success, jsonOutput(mapOf("success" to success, "page" to "display")))
    }
}

// ─────────────────────────────────────────────────────────────
//  query_volume — 查询当前音量
// ─────────────────────────────────────────────────────────────

class QueryVolumeTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "query_volume",
        description = "Read the current volume levels for all audio streams (music, ring, alarm, notification, voice_call, system).",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("audio", "device_status"),
        outputSchema = listOf(
            ToolFieldSchema("volumes", ToolValueType.OBJECT, "Current volume levels and max for each stream.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val audioManager = this.context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            ?: return ToolResult(false, "", "无法获取 AudioManager")
        val streams = mapOf(
            "music" to AudioManager.STREAM_MUSIC,
            "ring" to AudioManager.STREAM_RING,
            "alarm" to AudioManager.STREAM_ALARM,
            "notification" to AudioManager.STREAM_NOTIFICATION,
            "voice_call" to AudioManager.STREAM_VOICE_CALL,
            "system" to AudioManager.STREAM_SYSTEM
        )
        val volumes = streams.map { (name, stream) ->
            name to mapOf(
                "current" to audioManager.getStreamVolume(stream),
                "max" to audioManager.getStreamMaxVolume(stream)
            )
        }.toMap()
        val ringerMode = when (audioManager.ringerMode) {
            AudioManager.RINGER_MODE_SILENT -> "silent"
            AudioManager.RINGER_MODE_VIBRATE -> "vibrate"
            AudioManager.RINGER_MODE_NORMAL -> "normal"
            else -> "unknown"
        }
        return ToolResult(true, jsonOutput(mapOf("volumes" to volumes, "ringerMode" to ringerMode)))
    }
}

// ─────────────────────────────────────────────────────────────
//  query_brightness — 查询当前屏幕亮度
// ─────────────────────────────────────────────────────────────

class QueryBrightnessTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "query_brightness",
        description = "Read the current screen brightness level and mode (manual/auto).",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("device_status", "brightness"),
        outputSchema = listOf(
            ToolFieldSchema("brightnessPercent", ToolValueType.INTEGER, "Current brightness as a percentage (0-100)."),
            ToolFieldSchema("mode", ToolValueType.STRING, "Brightness mode: manual or auto.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        return try {
            val resolver = this.context.contentResolver
            val mode = Settings.System.getInt(resolver, Settings.System.SCREEN_BRIGHTNESS_MODE, 0)
            val modeName = if (mode == Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC) "auto" else "manual"
            val brightness = Settings.System.getInt(resolver, Settings.System.SCREEN_BRIGHTNESS, 128)
            val percent = ((brightness / 255.0) * 100).roundToInt().coerceIn(0, 100)
            ToolResult(true, jsonOutput(mapOf(
                "brightnessPercent" to percent,
                "brightnessRaw" to brightness,
                "mode" to modeName
            )))
        } catch (e: Exception) {
            ToolResult(false, "", "读取亮度失败: ${e.message}")
        }
    }
}

