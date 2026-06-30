package com.xiaoxiami.app.ui.iot

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * 根据设备 model 前缀匹配设备类型图标和分类名称。
 */
object DeviceTypeMapper {

    data class DeviceType(
        val icon: ImageVector,
        val label: String
    )

    private val defaultType = DeviceType(Icons.Outlined.DevicesOther, "其他")

    /**
     * model 前缀 → 设备类型。按匹配优先级排序，越具体的前缀越靠前。
     */
    private val mappings: List<Pair<String, DeviceType>> = listOf(
        // 灯具
        "yeelink.light" to DeviceType(Icons.Outlined.Lightbulb, "灯"),
        "yeelink.strip" to DeviceType(Icons.Outlined.Lightbulb, "灯带"),
        "philips.light" to DeviceType(Icons.Outlined.Lightbulb, "灯"),
        "leshi.light" to DeviceType(Icons.Outlined.Lightbulb, "灯"),
        "opple.light" to DeviceType(Icons.Outlined.Lightbulb, "灯"),

        // 插座/开关
        "chuangmi.plug" to DeviceType(Icons.Outlined.Power, "插座"),
        "qmi.plug" to DeviceType(Icons.Outlined.Power, "插座"),
        "zimi.powerstrip" to DeviceType(Icons.Outlined.Power, "排插"),
        "dreame.switch" to DeviceType(Icons.Outlined.ToggleOn, "开关"),

        // 空调/暖通
        "lumi.aircondition" to DeviceType(Icons.Outlined.AcUnit, "空调"),
        "midea.aircondition" to DeviceType(Icons.Outlined.AcUnit, "空调"),
        "xiaomi.aircondition" to DeviceType(Icons.Outlined.AcUnit, "空调"),

        // 风扇
        "dmaker.fan" to DeviceType(Icons.Outlined.Air, "风扇"),
        "zhimi.fan" to DeviceType(Icons.Outlined.Air, "风扇"),
        "leshow.fan" to DeviceType(Icons.Outlined.Air, "风扇"),

        // 扫地机器人
        "roborock.vacuum" to DeviceType(Icons.Outlined.CleaningServices, "扫地机"),
        "dreame.vacuum" to DeviceType(Icons.Outlined.CleaningServices, "扫地机"),
        "viomi.vacuum" to DeviceType(Icons.Outlined.CleaningServices, "扫地机"),
        "roidmi.vacuum" to DeviceType(Icons.Outlined.CleaningServices, "扫地机"),
        "ijai.vacuum" to DeviceType(Icons.Outlined.CleaningServices, "扫地机"),

        // 空气净化器
        "zhimi.airpurifier" to DeviceType(Icons.Outlined.FilterAlt, "净化器"),
        "zhimi.airp" to DeviceType(Icons.Outlined.FilterAlt, "净化器"),

        // 加湿器
        "deerma.humidifier" to DeviceType(Icons.Outlined.WaterDrop, "加湿器"),
        "zhimi.humidifier" to DeviceType(Icons.Outlined.WaterDrop, "加湿器"),

        // 传感器
        "lumi.sensor" to DeviceType(Icons.Outlined.Sensors, "传感器"),
        "lumi.weather" to DeviceType(Icons.Outlined.Thermostat, "温湿度计"),

        // 门锁
        "lumi.lock" to DeviceType(Icons.Outlined.Lock, "门锁"),
        "loock.lock" to DeviceType(Icons.Outlined.Lock, "门锁"),
        "aqara.lock" to DeviceType(Icons.Outlined.Lock, "门锁"),

        // 窗帘
        "lumi.curtain" to DeviceType(Icons.Outlined.Blinds, "窗帘"),
        "dooya.curtain" to DeviceType(Icons.Outlined.Blinds, "窗帘"),

        // 摄像头
        "chuangmi.camera" to DeviceType(Icons.Outlined.Videocam, "摄像头"),
        "isa.camera" to DeviceType(Icons.Outlined.Videocam, "摄像头"),
        "xiaomi.camera" to DeviceType(Icons.Outlined.Videocam, "摄像头"),

        // 网关
        "lumi.gateway" to DeviceType(Icons.Outlined.Router, "网关"),
        "xiaomi.gateway" to DeviceType(Icons.Outlined.Router, "网关"),

        // 电视/音箱
        "xiaomi.tv" to DeviceType(Icons.Outlined.Tv, "电视"),
        "xiaomi.wifispeaker" to DeviceType(Icons.Outlined.Speaker, "音箱"),
        "yeelink.wifispeaker" to DeviceType(Icons.Outlined.Speaker, "音箱"),
        "xiaomi.speaker" to DeviceType(Icons.Outlined.Speaker, "音箱"),

        // 热水器
        "viomi.waterheater" to DeviceType(Icons.Outlined.HotTub, "热水器"),

        // 洗衣机
        "viomi.washer" to DeviceType(Icons.Outlined.LocalLaundryService, "洗衣机"),
    )

    fun getDeviceType(model: String): DeviceType {
        val lowerModel = model.lowercase()
        return mappings.firstOrNull { (prefix, _) -> lowerModel.startsWith(prefix) }?.second
            ?: defaultType
    }
}
