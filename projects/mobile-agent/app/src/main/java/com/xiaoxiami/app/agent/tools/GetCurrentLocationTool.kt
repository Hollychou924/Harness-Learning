package com.xiaoxiami.app.agent.tools

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import androidx.core.content.ContextCompat
import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolValueType
import java.util.Locale

class GetCurrentLocationTool(
    private val context: Context
) : Tool {

    override val schema: ToolSchema = ToolSchema(
        name = "get_current_location",
        description = "Read the device's current coarse/fine location and return a human-readable address.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("location", "device_context", "privacy_sensitive"),
        riskLevel = ToolRiskLevel.LOW,
        approvalRequired = false,
        approvalReason = "读取设备当前位置属于敏感隐私操作",
        approvalSummary = "Agent 想读取你的当前位置，用于回答与地理位置相关的问题。",
        accessRequirements = listOf(
            ToolAccessRequirement(
                kind = ToolAccessKind.ANDROID_PERMISSION,
                identifier = Manifest.permission.ACCESS_FINE_LOCATION,
                description = "Precise location permission."
            )
        ),
        outputSchema = listOf(
            ToolFieldSchema(
                name = "address",
                type = ToolValueType.STRING,
                description = "Human-readable address or a latitude/longitude fallback."
            ),
            ToolFieldSchema(
                name = "latitude",
                type = ToolValueType.NUMBER,
                description = "Latitude when available.",
                required = false
            ),
            ToolFieldSchema(
                name = "longitude",
                type = ToolValueType.NUMBER,
                description = "Longitude when available.",
                required = false
            )
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val hasCoarsePermission = ContextCompat.checkSelfPermission(
            this.context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasFinePermission = ContextCompat.checkSelfPermission(
            this.context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasCoarsePermission && !hasFinePermission) {
            return ToolResult(
                success = false,
                output = "",
                error = "位置权限未授予"
            )
        }

        val locationManager =
            this.context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
                ?: return ToolResult(false, "", "无法获取 LocationManager")

        val location = sequenceOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        ).mapNotNull { provider ->
            runCatching { locationManager.getLastKnownLocation(provider) }.getOrNull()
        }.firstOrNull()

        if (location == null) {
            return ToolResult(
                success = false,
                output = "",
                error = "暂无可用定位"
            )
        }

        val address = resolveAddress(location)
        return ToolResult(
            success = true,
            output = address ?: "${location.latitude}, ${location.longitude}"
        )
    }

    private fun resolveAddress(location: Location): String? {
        return runCatching {
            val geocoder = Geocoder(context, Locale.getDefault())
            val addresses = geocoder.getFromLocation(location.latitude, location.longitude, 1)
            val first = addresses?.firstOrNull() ?: return null
            buildList {
                first.countryName?.takeIf { it.isNotBlank() }?.let(::add)
                first.adminArea?.takeIf { it.isNotBlank() }?.let(::add)
                first.locality?.takeIf { it.isNotBlank() }?.let(::add)
                first.subLocality?.takeIf { it.isNotBlank() }?.let(::add)
                first.thoroughfare?.takeIf { it.isNotBlank() }?.let(::add)
            }.joinToString(" ")
        }.getOrNull()
    }
}
