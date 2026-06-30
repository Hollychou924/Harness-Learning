package com.xiaoxiami.app.agent.tools

import android.content.Context
import com.xiaoxiami.app.MyApplication
import com.xiaoxiami.app.agent.*
import com.xiaoxiami.app.data.iot.IotDeviceEntity
import com.xiaoxiami.app.repository.IotLoginState
import com.xiaoxiami.app.repository.IotRepository

private fun findDevice(
    repo: IotRepository,
    did: String,
    deviceName: String
): Pair<IotDeviceEntity?, String?> {
    if (did.isNotBlank()) {
        val d = repo.devices.value.find { it.did == did }
        return d to if (d == null) "未找到设备(did=$did)" else null
    }
    if (deviceName.isNotBlank()) {
        val devices = repo.devices.value
        // 1. 精确匹配
        devices.find { it.name.equals(deviceName, ignoreCase = true) }
            ?.let { return it to null }
        // 2. 包含匹配
        devices.find { it.name.contains(deviceName, ignoreCase = true) }
            ?.let { return it to null }
        // 3. 反向包含（用户说"灯"匹配"客厅吸顶灯"）
        devices.find { deviceName.contains(it.name, ignoreCase = true) }
            ?.let { return it to null }
        // 4. 房间+类型组合匹配（如"客厅的灯" → roomName=客厅 + name 含灯）
        val parts = deviceName.replace("的", " ").replace("里", " ").split(" ").filter { it.isNotBlank() }
        if (parts.size >= 2) {
            devices.find { d ->
                parts.all { part ->
                    d.name.contains(part, ignoreCase = true)
                        || d.roomName.contains(part, ignoreCase = true)
                        || d.homeName.contains(part, ignoreCase = true)
                }
            }?.let { return it to null }
        }
        // 5. 任一关键词匹配（宽松兜底）
        if (parts.isNotEmpty()) {
            devices.find { d ->
                parts.any { part ->
                    d.name.contains(part, ignoreCase = true)
                }
            }?.let { return it to null }
        }

        val availableDevices = devices.take(10).joinToString("、") { it.name }
        return null to "未找到设备: $deviceName。可用设备: $availableDevices"
    }
    return null to "请提供 did 或 device_name"
}

// ─── List IoT Devices ───

class IotListDevicesTool(private val context: Context) : Tool {
    override val schema = ToolSchema(
        name = "iot_list_devices",
        description = "列出用户小米智能家居的所有IoT设备及其状态。可按家庭或房间过滤。",
        hostKind = ToolHostKind.CLOUD_SERVICE,
        family = ToolFamily.DEVICE,
        executionMode = ToolExecutionMode.DIRECT,
        capabilities = listOf("iot", "device_control", "xiaomi"),
        riskLevel = ToolRiskLevel.LOW,
        scopes = listOf(ToolScope.DEVICE_CONTROL),
        inputSchema = listOf(
            ToolParameterSchema("home_name", ToolValueType.STRING, "按家庭名称过滤（可选）"),
            ToolParameterSchema("room_name", ToolValueType.STRING, "按房间名称过滤（可选）")
        ),
        outputSchema = listOf(
            ToolFieldSchema("success", ToolValueType.BOOLEAN, "是否成功"),
            ToolFieldSchema("devices", ToolValueType.ARRAY, "设备列表", required = false)
        )
    )

    override fun isCurrentlyAvailable(): Boolean {
        val app = context.applicationContext as MyApplication
        return app.iotRepository.loginState.value is IotLoginState.LoggedIn
    }

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val app = this.context.applicationContext as MyApplication
        val repo = app.iotRepository

        if (repo.loginState.value !is IotLoginState.LoggedIn) {
            return ToolResult(false, "", "IoT未登录，请先在智能家居页面登录小米账号")
        }

        val homeName = arguments.stringArg("home_name")
        val roomName = arguments.stringArg("room_name")

        var devices = repo.devices.value
        if (homeName.isNotBlank()) {
            devices = devices.filter { it.homeName.contains(homeName, ignoreCase = true) }
        }
        if (roomName.isNotBlank()) {
            devices = devices.filter { it.roomName.contains(roomName, ignoreCase = true) }
        }

        val list = devices.map { d ->
            mapOf(
                "did" to d.did,
                "name" to d.name,
                "model" to d.model,
                "home" to d.homeName,
                "room" to d.roomName,
                "online" to d.isOnline
            )
        }
        return ToolResult(true, jsonOutput(mapOf("success" to true, "count" to list.size, "devices" to list)))
    }
}

// ─── Get Device Status ───

class IotGetDeviceStatusTool(private val context: Context) : Tool {
    override val schema = ToolSchema(
        name = "iot_get_device_status",
        description = "获取指定小米IoT设备的属性状态（如开关状态、亮度、温度等）。通过设备名称或did指定设备。",
        hostKind = ToolHostKind.CLOUD_SERVICE,
        family = ToolFamily.DEVICE,
        executionMode = ToolExecutionMode.DIRECT,
        capabilities = listOf("iot", "device_control", "xiaomi"),
        riskLevel = ToolRiskLevel.LOW,
        scopes = listOf(ToolScope.DEVICE_CONTROL),
        inputSchema = listOf(
            ToolParameterSchema("device_name", ToolValueType.STRING, "设备名称（模糊匹配）"),
            ToolParameterSchema("did", ToolValueType.STRING, "设备ID（精确匹配，优先于device_name）"),
            ToolParameterSchema("property_names", ToolValueType.ARRAY, "要查询的属性名称列表（可选，默认查全部可读属性）", itemType = ToolValueType.STRING)
        ),
        outputSchema = listOf(
            ToolFieldSchema("success", ToolValueType.BOOLEAN, "是否成功"),
            ToolFieldSchema("properties", ToolValueType.ARRAY, "属性值列表", required = false)
        )
    )

    override fun isCurrentlyAvailable(): Boolean {
        val app = context.applicationContext as MyApplication
        return app.iotRepository.loginState.value is IotLoginState.LoggedIn
    }

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val app = this.context.applicationContext as MyApplication
        val repo = app.iotRepository

        if (repo.loginState.value !is IotLoginState.LoggedIn) {
            return ToolResult(false, "", "IoT未登录")
        }

        val (device, error) = findDevice(repo, arguments.stringArg("did"), arguments.stringArg("device_name"))
        if (device == null) return ToolResult(false, "", error ?: "未找到设备")
        if (!device.isOnline) return ToolResult(false, "", "设备 ${device.name} 当前离线，无法获取状态")

        val spec = repo.getDeviceSpec(device.model)
            ?: return ToolResult(false, "", "无法获取设备规格: ${device.model}")

        val filterNames = arguments.stringListArg("property_names")
        val readableProps = spec.properties.filter { "r" in it.rw }.let { props ->
            if (filterNames.isNotEmpty()) {
                props.filter { p -> filterNames.any { it.equals(p.name, ignoreCase = true) || it.equals(p.description, ignoreCase = true) } }
            } else props
        }

        if (readableProps.isEmpty()) {
            return ToolResult(true, jsonOutput(mapOf("success" to true, "device" to device.name, "properties" to emptyList<Any>())))
        }

        val pairs = readableProps.map { it.siid to it.piid }
        val values = repo.getDeviceProperties(device.did, pairs)

        val result = readableProps.map { prop ->
            val pv = values.find { it.siid == prop.siid && it.piid == prop.piid }
            mapOf(
                "name" to prop.name,
                "description" to prop.description,
                "value" to pv?.value,
                "type" to prop.type,
                "unit" to prop.unit,
                "siid" to prop.siid,
                "piid" to prop.piid
            )
        }
        val output = mutableMapOf<String, Any>(
            "success" to true, "device" to device.name, "did" to device.did, "properties" to result
        )
        // 附带可用 actions 信息，方便 Agent 知道能执行哪些操作
        if (spec.actions.isNotEmpty()) {
            output["available_actions"] = spec.actions.map { mapOf("name" to it.name, "description" to it.description, "siid" to it.siid, "aiid" to it.aiid) }
        }
        return ToolResult(true, jsonOutput(output))
    }
}

// ─── Control Device ───

class IotControlDeviceTool(private val context: Context) : Tool {
    override val schema = ToolSchema(
        name = "iot_control_device",
        description = "控制小米IoT设备的属性（如开关、亮度、模式等）。通过设备名称或did指定设备，通过属性名称和值进行控制。",
        hostKind = ToolHostKind.CLOUD_SERVICE,
        family = ToolFamily.DEVICE,
        executionMode = ToolExecutionMode.DIRECT,
        capabilities = listOf("iot", "device_control", "xiaomi"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        approvalRequired = true,
        approvalReason = "控制智能家居设备需要用户确认",
        approvalSummary = "Agent 请求控制IoT设备",
        scopes = listOf(ToolScope.DEVICE_CONTROL),
        inputSchema = listOf(
            ToolParameterSchema("device_name", ToolValueType.STRING, "设备名称（模糊匹配）"),
            ToolParameterSchema("did", ToolValueType.STRING, "设备ID（精确匹配，优先于device_name）"),
            ToolParameterSchema("property_name", ToolValueType.STRING, "属性名称（如on、brightness、mode）", required = true),
            ToolParameterSchema("value", ToolValueType.STRING, "要设置的值（会自动转换类型）", required = true)
        ),
        outputSchema = successSchema()
    )

    override fun isCurrentlyAvailable(): Boolean {
        val app = context.applicationContext as MyApplication
        return app.iotRepository.loginState.value is IotLoginState.LoggedIn
    }

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val app = this.context.applicationContext as MyApplication
        val repo = app.iotRepository

        if (repo.loginState.value !is IotLoginState.LoggedIn) {
            return ToolResult(false, "", "IoT未登录")
        }

        val propertyName = arguments.stringArg("property_name")
        val rawValue = arguments["value"]?.toString() ?: return ToolResult(false, "", "缺少 value 参数")

        val (device, error) = findDevice(repo, arguments.stringArg("did"), arguments.stringArg("device_name"))
        if (device == null) return ToolResult(false, "", error ?: "未找到设备")
        if (!device.isOnline) return ToolResult(false, "", "设备 ${device.name} 当前离线，无法控制")

        val spec = repo.getDeviceSpec(device.model)
            ?: return ToolResult(false, "", "无法获取设备规格: ${device.model}")

        val prop = repo.miotSpecService.findProperty(spec, propertyName)
            ?: spec.properties.filter { "w" in it.rw }.find {
                it.name.equals(propertyName, ignoreCase = true) || it.description.contains(propertyName, ignoreCase = true)
            }
            ?: return ToolResult(false, "", "未找到可写属性: $propertyName")

        // Convert value to appropriate type
        val convertedValue: Any = when (prop.type) {
            "bool" -> rawValue.toBooleanStrictOrNull() ?: (rawValue == "1" || rawValue.equals("true", ignoreCase = true))
            "uint8", "uint16", "uint32", "int8", "int16", "int32" -> {
                rawValue.toIntOrNull() ?: return ToolResult(false, "", "值必须是整数: $rawValue")
            }
            "float" -> {
                rawValue.toFloatOrNull() ?: return ToolResult(false, "", "值必须是数字: $rawValue")
            }
            else -> rawValue
        }

        // Range validation
        if (prop.range != null && prop.range.size >= 2 && convertedValue is Number) {
            val min = prop.range[0].toDouble()
            val max = prop.range[1].toDouble()
            if (convertedValue.toDouble() < min || convertedValue.toDouble() > max) {
                return ToolResult(false, "", "值 $convertedValue 超出范围 [$min, $max]")
            }
        }

        val success = repo.setDeviceProperty(device.did, prop.siid, prop.piid, convertedValue)
        return if (success) {
            ToolResult(true, jsonOutput(mapOf(
                "success" to true,
                "device" to device.name,
                "property" to prop.name,
                "value" to convertedValue
            )))
        } else {
            ToolResult(false, "", "设置属性失败")
        }
    }
}

// ─── Run Action ───

class IotRunActionTool(private val context: Context) : Tool {
    override val schema = ToolSchema(
        name = "iot_run_action",
        description = "执行小米IoT设备的操作指令（如扫地机器人开始清扫/回充、空气净化器切换模式等）。" +
            "与iot_control_device不同，action是一次性指令而非属性设置。需要先用iot_get_device_status查看设备支持的actions。",
        hostKind = ToolHostKind.CLOUD_SERVICE,
        family = ToolFamily.DEVICE,
        executionMode = ToolExecutionMode.DIRECT,
        capabilities = listOf("iot", "device_control", "xiaomi", "action"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        approvalRequired = true,
        approvalReason = "执行设备操作需要用户确认",
        approvalSummary = "Agent 请求执行IoT设备操作",
        scopes = listOf(ToolScope.DEVICE_CONTROL),
        inputSchema = listOf(
            ToolParameterSchema("device_name", ToolValueType.STRING, "设备名称（模糊匹配）"),
            ToolParameterSchema("did", ToolValueType.STRING, "设备ID（精确匹配，优先于device_name）"),
            ToolParameterSchema("action_name", ToolValueType.STRING, "操作名称（如 start-sweep、stop-sweeping、start-charge）", required = true)
        ),
        outputSchema = successSchema()
    )

    override fun isCurrentlyAvailable(): Boolean {
        val app = context.applicationContext as MyApplication
        return app.iotRepository.loginState.value is IotLoginState.LoggedIn
    }

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val app = this.context.applicationContext as MyApplication
        val repo = app.iotRepository

        if (repo.loginState.value !is IotLoginState.LoggedIn) {
            return ToolResult(false, "", "IoT未登录")
        }

        val actionName = arguments.stringArg("action_name")
        if (actionName.isBlank()) return ToolResult(false, "", "请提供 action_name")

        val (device, error) = findDevice(repo, arguments.stringArg("did"), arguments.stringArg("device_name"))
        if (device == null) return ToolResult(false, "", error ?: "未找到设备")
        if (!device.isOnline) return ToolResult(false, "", "设备 ${device.name} 当前离线，无法执行操作")

        val spec = repo.getDeviceSpec(device.model)
            ?: return ToolResult(false, "", "无法获取设备规格: ${device.model}")

        val action = spec.actions.find {
            it.name.equals(actionName, ignoreCase = true)
                || it.description.contains(actionName, ignoreCase = true)
        } ?: return ToolResult(
            false, "", "未找到操作: $actionName。可用操作: ${
                spec.actions.joinToString("、") { "${it.name}(${it.description})" }.ifEmpty { "无" }
            }"
        )

        val success = repo.runAction(device.did, action.siid, action.aiid)
        return if (success) {
            ToolResult(true, jsonOutput(mapOf(
                "success" to true,
                "device" to device.name,
                "action" to action.name,
                "description" to action.description
            )))
        } else {
            ToolResult(false, "", "执行操作失败: ${action.name}")
        }
    }
}

// ─── Run Scene ───

class IotRunSceneTool(private val context: Context) : Tool {
    override val schema = ToolSchema(
        name = "iot_run_scene",
        description = "执行小米智能家居的场景（如回家模式、离家模式等自动化场景）。",
        hostKind = ToolHostKind.CLOUD_SERVICE,
        family = ToolFamily.DEVICE,
        executionMode = ToolExecutionMode.DIRECT,
        capabilities = listOf("iot", "device_control", "xiaomi", "scene"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        approvalRequired = true,
        approvalReason = "执行智能场景可能同时控制多个设备",
        approvalSummary = "Agent 请求执行智能家居场景",
        scopes = listOf(ToolScope.DEVICE_CONTROL),
        inputSchema = listOf(
            ToolParameterSchema("scene_name", ToolValueType.STRING, "场景名称（模糊匹配）", required = true)
        ),
        outputSchema = successSchema()
    )

    override fun isCurrentlyAvailable(): Boolean {
        val app = context.applicationContext as MyApplication
        return app.iotRepository.loginState.value is IotLoginState.LoggedIn
    }

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val app = this.context.applicationContext as MyApplication
        val repo = app.iotRepository

        if (repo.loginState.value !is IotLoginState.LoggedIn) {
            return ToolResult(false, "", "IoT未登录")
        }

        val sceneName = arguments.stringArg("scene_name")
        if (sceneName.isBlank()) return ToolResult(false, "", "请提供场景名称")

        val scenes = try {
            repo.getAllScenes()
        } catch (e: Exception) {
            return ToolResult(false, "", "获取场景列表失败: ${e.message}")
        }

        val scene = scenes.find { it.name.contains(sceneName, ignoreCase = true) }
            ?: return ToolResult(false, "", "未找到场景: $sceneName。可用场景: ${scenes.joinToString { it.name }}")

        val success = repo.runScene(scene.sceneId, scene.homeId)
        return if (success) {
            ToolResult(true, jsonOutput(mapOf("success" to true, "scene" to scene.name)))
        } else {
            ToolResult(false, "", "执行场景失败: ${scene.name}")
        }
    }
}
