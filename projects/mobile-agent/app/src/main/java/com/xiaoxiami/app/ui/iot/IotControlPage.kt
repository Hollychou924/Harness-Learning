@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package com.xiaoxiami.app.ui.iot

import android.graphics.Bitmap
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import com.xiaoxiami.app.data.iot.IotDeviceEntity
import com.xiaoxiami.app.repository.IotLoginState
import com.xiaoxiami.app.service.LoginStep
import com.xiaoxiami.app.service.MiotProperty
import com.xiaoxiami.app.service.MiotAction
import com.xiaoxiami.app.service.MiotSpec
import com.xiaoxiami.app.service.PropertyValue
import com.xiaoxiami.app.service.XiaomiScene
import com.xiaoxiami.app.viewmodel.IotViewModel

private val SERVERS = listOf(
    "cn" to "中国大陆",
    "de" to "欧洲 (德国)",
    "us" to "美国",
    "ru" to "俄罗斯",
    "tw" to "台湾",
    "sg" to "新加坡",
    "in" to "印度",
    "i2" to "印度 2"
)

@Composable
fun IotControlPage(onBack: () -> Unit) {
    val viewModel: IotViewModel = viewModel()
    val loginState by viewModel.loginState.collectAsState()
    val devices by viewModel.devices.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val scenes by viewModel.scenes.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Show error/success messages via Snackbar
    LaunchedEffect(errorMessage) {
        if (errorMessage != null) {
            snackbarHostState.showSnackbar(
                message = errorMessage!!,
                duration = SnackbarDuration.Short
            )
            viewModel.clearError()
        }
    }

    BackHandler { onBack() }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("智能家居", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Outlined.ArrowBack, "返回")
                    }
                },
                actions = {
                    if (loginState is IotLoginState.LoggedIn) {
                        IconButton(onClick = { viewModel.syncDevices() }) {
                            Icon(Icons.Outlined.Refresh, "刷新设备")
                        }
                        IconButton(onClick = { viewModel.logout() }) {
                            Icon(Icons.Outlined.Logout, "退出登录")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFFF6F7FB)
                )
            )
        },
        containerColor = Color(0xFFF6F7FB)
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (loginState) {
                is IotLoginState.LoggedOut, is IotLoginState.Unknown, is IotLoginState.Error -> {
                    LoginSection(viewModel, isLoading, errorMessage)
                }
                is IotLoginState.LoggedIn -> {
                    DeviceListSection(viewModel, devices, scenes, isLoading)
                }
            }

            if (isLoading) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter),
                    color = Color(0xFF10B981)
                )
            }
        }
    }
}

@Composable
private fun LoginSection(
    viewModel: IotViewModel,
    isLoading: Boolean,
    errorMessage: String?
) {
    var username by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var selectedServer by rememberSaveable { mutableStateOf("cn") }
    var showQrLogin by remember { mutableStateOf(false) }
    var serverExpanded by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    val qrLoginUrl by viewModel.qrLoginUrl.collectAsState()
    val qrRefreshing by viewModel.qrRefreshing.collectAsState()
    val loginStep by viewModel.loginStep.collectAsState()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Spacer(modifier = Modifier.height(32.dp))
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Surface(
                    modifier = Modifier.size(72.dp),
                    shape = CircleShape,
                    color = Color(0xFF10B981).copy(alpha = 0.1f)
                ) {
                    Icon(
                        Icons.Outlined.Home,
                        contentDescription = null,
                        modifier = Modifier.padding(18.dp),
                        tint = Color(0xFF10B981)
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text("连接你的小米智能家居", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFF101828))
                Spacer(modifier = Modifier.height(8.dp))
                Text("授权后即可通过AI助手控制家中设备", fontSize = 14.sp, color = Color(0xFF667085))
            }
        }

        if (errorMessage != null) {
            item {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFFEF3F2)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Outlined.ErrorOutline, null, tint = Color(0xFFB42318), modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(errorMessage, color = Color(0xFFB42318), fontSize = 13.sp, modifier = Modifier.weight(1f))
                        IconButton(onClick = { viewModel.clearError() }, modifier = Modifier.size(24.dp)) {
                            Icon(Icons.Outlined.Close, null, tint = Color(0xFFB42318), modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }

        if (!showQrLogin) {
            // Password login form
            item {
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.elevatedCardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        OutlinedTextField(
                            value = username,
                            onValueChange = { username = it },
                            label = { Text("小米账号") },
                            placeholder = { Text("手机号/邮箱/小米ID") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            leadingIcon = { Icon(Icons.Outlined.Person, null) },
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                            shape = RoundedCornerShape(12.dp)
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it },
                            label = { Text("密码") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            leadingIcon = { Icon(Icons.Outlined.Lock, null) },
                            trailingIcon = {
                                IconButton(onClick = { showPassword = !showPassword }) {
                                    Icon(
                                        if (showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                        null
                                    )
                                }
                            },
                            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                            keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
                            shape = RoundedCornerShape(12.dp)
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // Server selector
                        ExposedDropdownMenuBox(
                            expanded = serverExpanded,
                            onExpandedChange = { serverExpanded = it }
                        ) {
                            OutlinedTextField(
                                value = SERVERS.find { it.first == selectedServer }?.second ?: "中国大陆",
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("服务器") },
                                modifier = Modifier.fillMaxWidth().menuAnchor(),
                                leadingIcon = { Icon(Icons.Outlined.Language, null) },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = serverExpanded) },
                                shape = RoundedCornerShape(12.dp)
                            )
                            ExposedDropdownMenu(
                                expanded = serverExpanded,
                                onDismissRequest = { serverExpanded = false }
                            ) {
                                SERVERS.forEach { (code, label) ->
                                    DropdownMenuItem(
                                        text = { Text(label) },
                                        onClick = {
                                            selectedServer = code
                                            serverExpanded = false
                                        }
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        Button(
                            onClick = {
                                focusManager.clearFocus()
                                viewModel.login(username, password, selectedServer)
                            },
                            modifier = Modifier.fillMaxWidth().height(50.dp),
                            enabled = username.isNotBlank() && password.isNotBlank() && !isLoading,
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                            Text("登录授权", fontSize = 16.sp)
                        }
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Divider(modifier = Modifier.weight(1f), color = Color(0xFFE4E7EC))
                    Text("  或者  ", color = Color(0xFF667085), fontSize = 13.sp)
                    Divider(modifier = Modifier.weight(1f), color = Color(0xFFE4E7EC))
                }
            }

            item {
                OutlinedButton(
                    onClick = { showQrLogin = true },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Outlined.QrCode2, null, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("使用米家App扫码登录")
                }
            }
        } else {
            // QR code login
            item {
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.elevatedCardColors(containerColor = Color.White)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        if (qrLoginUrl != null) {
                            val qrBitmap = remember(qrLoginUrl) { generateQrBitmap(qrLoginUrl!!, 480) }
                            if (qrBitmap != null) {
                                Box(contentAlignment = Alignment.Center) {
                                    Image(
                                        bitmap = qrBitmap.asImageBitmap(),
                                        contentDescription = "扫码登录",
                                        modifier = Modifier
                                            .size(240.dp)
                                            .alpha(if (qrRefreshing) 0.3f else 1f)
                                    )
                                    if (qrRefreshing) {
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(32.dp),
                                                strokeWidth = 3.dp,
                                                color = Color(0xFF10B981)
                                            )
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Text("二维码刷新中...", fontSize = 13.sp, color = Color(0xFF667085))
                                        }
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(16.dp))
                            if (!qrRefreshing) {
                                Row(
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color(0xFF10B981))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("等待扫码确认...", color = Color(0xFF667085), fontSize = 14.sp)
                                }
                            }
                            Text(
                                "二维码会自动刷新，无需手动操作",
                                fontSize = 12.sp,
                                color = Color(0xFF98A2B3),
                                modifier = Modifier.padding(top = 8.dp)
                            )
                        } else {
                            Text(
                                "请打开米家App扫码登录",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                "获取二维码后使用米家App扫一扫",
                                fontSize = 13.sp,
                                color = Color(0xFF667085),
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(20.dp))
                            Button(
                                onClick = { viewModel.startQrLogin(selectedServer) },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.height(44.dp)
                            ) {
                                Text("获取二维码")
                            }
                        }
                    }
                }
            }

            item {
                TextButton(
                    onClick = { showQrLogin = false },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("使用账号密码登录", color = Color(0xFF667085))
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Outlined.Lock, null, modifier = Modifier.size(14.dp), tint = Color(0xFF98A2B3))
                Spacer(modifier = Modifier.width(4.dp))
                Text("账号信息加密存储在本地设备，不会上传到任何服务器", fontSize = 11.sp, color = Color(0xFF98A2B3))
            }
        }
    }
}

@Composable
private fun DeviceListSection(
    viewModel: IotViewModel,
    devices: List<IotDeviceEntity>,
    scenes: List<com.xiaoxiami.app.service.XiaomiScene>,
    isLoading: Boolean
) {
    val deviceSpecs by viewModel.deviceSpecs.collectAsState()
    val deviceProperties by viewModel.deviceProperties.collectAsState()

    // Search & filter state
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var filterOnlineOnly by rememberSaveable { mutableStateOf(false) }

    if (devices.isEmpty() && !isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Outlined.DevicesOther, null, modifier = Modifier.size(64.dp), tint = Color(0xFFD0D5DD))
                Spacer(modifier = Modifier.height(16.dp))
                Text("暂无设备", fontSize = 16.sp, color = Color(0xFF667085))
                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = { viewModel.syncDevices() },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("同步设备")
                }
            }
        }
        return
    }

    // Filter + sort: online first, then by home/room/name
    val filteredDevices = remember(devices, searchQuery, filterOnlineOnly) {
        devices
            .filter { d ->
                (searchQuery.isBlank() || d.name.contains(searchQuery, ignoreCase = true)
                    || d.roomName.contains(searchQuery, ignoreCase = true)
                    || d.model.contains(searchQuery, ignoreCase = true))
                    && (!filterOnlineOnly || d.isOnline)
            }
            .sortedWith(compareByDescending<IotDeviceEntity> { it.isOnline }
                .thenBy { it.homeName }.thenBy { it.roomName }.thenBy { it.name })
    }
    val grouped = filteredDevices.groupBy { "${it.homeName} > ${it.roomName}" }
    val onlineCount = devices.count { it.isOnline }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Search bar
        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("搜索设备、房间...", fontSize = 14.sp) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                leadingIcon = { Icon(Icons.Outlined.Search, null, modifier = Modifier.size(20.dp)) },
                trailingIcon = {
                    if (searchQuery.isNotBlank()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Outlined.Close, null, modifier = Modifier.size(18.dp))
                        }
                    }
                },
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedContainerColor = Color.White,
                    focusedContainerColor = Color.White
                )
            )
        }

        // Filter chips
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = !filterOnlineOnly,
                    onClick = { filterOnlineOnly = false },
                    label = { Text("全部 ${devices.size}", fontSize = 12.sp) },
                    shape = RoundedCornerShape(16.dp)
                )
                FilterChip(
                    selected = filterOnlineOnly,
                    onClick = { filterOnlineOnly = true },
                    label = { Text("在线 $onlineCount", fontSize = 12.sp) },
                    shape = RoundedCornerShape(16.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Color(0xFF10B981).copy(alpha = 0.15f),
                        selectedLabelColor = Color(0xFF10B981)
                    )
                )
            }
        }

        // Scenes section
        if (scenes.isNotEmpty()) {
            item {
                var sceneToConfirm by remember { mutableStateOf<XiaomiScene?>(null) }

                Text("快捷场景", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF344054))
                Spacer(modifier = Modifier.height(8.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(scenes) { scene ->
                        SuggestionChip(
                            onClick = { sceneToConfirm = scene },
                            label = { Text(scene.name, fontSize = 13.sp) },
                            icon = { Icon(Icons.Outlined.PlayArrow, null, modifier = Modifier.size(16.dp)) },
                            shape = RoundedCornerShape(20.dp)
                        )
                    }
                }

                sceneToConfirm?.let { scene ->
                    AlertDialog(
                        onDismissRequest = { sceneToConfirm = null },
                        icon = { Icon(Icons.Outlined.PlayArrow, contentDescription = null) },
                        title = { Text("执行场景") },
                        text = { Text("确定要执行「${scene.name}」吗？") },
                        confirmButton = {
                            TextButton(onClick = {
                                viewModel.runScene(scene.sceneId, scene.homeId)
                                sceneToConfirm = null
                            }) { Text("执行") }
                        },
                        dismissButton = {
                            TextButton(onClick = { sceneToConfirm = null }) { Text("取消") }
                        }
                    )
                }
            }
        }

        // Device groups
        grouped.forEach { (group, groupDevices) ->
            item {
                Text(group, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = Color(0xFF667085),
                    modifier = Modifier.padding(top = 8.dp))
            }
            items(groupDevices, key = { it.did }) { device ->
                DeviceCard(
                    device = device,
                    spec = deviceSpecs[device.model],
                    properties = deviceProperties[device.did],
                    onToggle = { on -> viewModel.toggleDevice(device.did, on) },
                    onExpand = {
                        viewModel.loadDeviceSpec(device.model)
                        viewModel.loadDeviceProperties(device.did, device.model)
                    },
                    onSetProperty = { siid, piid, value -> viewModel.setProperty(device.did, siid, piid, value) },
                    onRunAction = { siid, aiid -> viewModel.runAction(device.did, siid, aiid) },
                    onToggleFavorite = { viewModel.toggleFavorite(device.did) }
                )
            }
        }

        item { Spacer(modifier = Modifier.height(16.dp)) }
    }

}

@Composable
private fun DeviceCard(
    device: IotDeviceEntity,
    spec: MiotSpec?,
    properties: List<PropertyValue>?,
    onToggle: (Boolean) -> Unit,
    onExpand: () -> Unit,
    onSetProperty: (Int, Int, Any) -> Unit,
    onRunAction: (Int, Int) -> Unit,
    onToggleFavorite: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    // Auto-refresh properties every 30s when expanded and online
    if (expanded && device.isOnline) {
        LaunchedEffect(device.did) {
            while (true) {
                kotlinx.coroutines.delay(30_000L)
                onExpand()
            }
        }
    }

    // Find power state from properties
    val powerProp = spec?.properties?.find { it.name == "on" || it.name == "switch-status" || it.name == "power" || (it.siid == 2 && it.piid == 1 && it.type == "bool") }
    val powerValue = if (powerProp != null) {
        properties?.find { it.siid == powerProp.siid && it.piid == powerProp.piid }?.value
    } else null
    val isOn = powerValue == true || powerValue == 1

    ElevatedCard(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (!device.isOnline) Modifier.alpha(0.6f) else Modifier),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.elevatedCardColors(containerColor = Color.White)
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        expanded = !expanded
                        if (expanded && device.isOnline) onExpand()
                    }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Device type icon with online indicator
                val deviceType = DeviceTypeMapper.getDeviceType(device.model)
                Box(contentAlignment = Alignment.BottomEnd) {
                    Surface(
                        modifier = Modifier.size(40.dp),
                        shape = RoundedCornerShape(10.dp),
                        color = if (device.isOnline) Color(0xFF10B981).copy(alpha = 0.1f) else Color(0xFFF2F4F7)
                    ) {
                        Icon(
                            deviceType.icon, contentDescription = deviceType.label,
                            modifier = Modifier.padding(8.dp),
                            tint = if (device.isOnline) Color(0xFF10B981) else Color(0xFF98A2B3)
                        )
                    }
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(if (device.isOnline) Color(0xFF10B981) else Color(0xFFD0D5DD))
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(device.name, fontWeight = FontWeight.Medium, fontSize = 15.sp, color = Color(0xFF101828))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(deviceType.label, fontSize = 12.sp, color = Color(0xFF667085))
                        Text(" · ", fontSize = 12.sp, color = Color(0xFF98A2B3))
                        Text(device.model, fontSize = 12.sp, color = Color(0xFF98A2B3), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }

                // Power toggle (only show if device is online and has power property)
                if (device.isOnline && powerProp != null) {
                    Switch(
                        checked = isOn,
                        onCheckedChange = { onToggle(it) },
                        colors = SwitchDefaults.colors(
                            checkedTrackColor = Color(0xFF10B981),
                            checkedThumbColor = Color.White
                        )
                    )
                } else if (!device.isOnline) {
                    Text("离线", fontSize = 12.sp, color = Color(0xFF98A2B3))
                }

                // Favorite star
                IconButton(
                    onClick = onToggleFavorite,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        if (device.isFavorite) Icons.Outlined.Star else Icons.Outlined.StarBorder,
                        contentDescription = if (device.isFavorite) "取消收藏" else "收藏",
                        tint = if (device.isFavorite) Color(0xFFF59E0B) else Color(0xFFD0D5DD),
                        modifier = Modifier.size(18.dp)
                    )
                }

                Icon(
                    if (expanded) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                    null,
                    tint = Color(0xFF98A2B3),
                    modifier = Modifier.size(20.dp)
                )
            }

            // Expanded property list
            AnimatedVisibility(visible = expanded, enter = expandVertically(), exit = shrinkVertically()) {
                if (!device.isOnline) {
                    Column(modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
                        Divider(color = Color(0xFFF2F4F7))
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Outlined.CloudOff, null,
                                modifier = Modifier.size(16.dp),
                                tint = Color(0xFF98A2B3)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("设备离线，无法获取状态", fontSize = 13.sp, color = Color(0xFF98A2B3))
                        }
                    }
                } else if (spec != null && properties != null) {
                    Column(modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
                        Divider(color = Color(0xFFF2F4F7))
                        Spacer(modifier = Modifier.height(8.dp))

                        val displayProps = spec.properties.filter { prop ->
                            "r" in prop.rw && properties.any { it.siid == prop.siid && it.piid == prop.piid && it.code == 0 }
                        }

                        displayProps.forEach { prop ->
                            val pv = properties.find { it.siid == prop.siid && it.piid == prop.piid }
                            if (pv != null && pv.code == 0) {
                                PropertyRow(prop, pv, device.isOnline && "w" in prop.rw, onSetProperty)
                            }
                        }

                        if (displayProps.isEmpty()) {
                            Text("正在加载属性...", fontSize = 13.sp, color = Color(0xFF98A2B3))
                        }

                        // Actions section
                        if (spec.actions.isNotEmpty() && device.isOnline) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Divider(color = Color(0xFFF2F4F7))
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("操作", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = Color(0xFF344054))
                            Spacer(modifier = Modifier.height(6.dp))
                            @OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                spec.actions.forEach { action ->
                                    AssistChip(
                                        onClick = { onRunAction(action.siid, action.aiid) },
                                        label = { Text(action.description.ifBlank { action.name }, fontSize = 12.sp) },
                                        leadingIcon = { Icon(Icons.Outlined.PlayArrow, null, modifier = Modifier.size(14.dp)) },
                                        shape = RoundedCornerShape(16.dp)
                                    )
                                }
                            }
                        }
                    }
                } else {
                    Box(modifier = Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp, color = Color(0xFF10B981))
                    }
                }
            }
        }
    }
}

@Composable
private fun PropertyRow(
    prop: MiotProperty,
    value: PropertyValue,
    writable: Boolean,
    onSet: (Int, Int, Any) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            prop.name.replace("-", " ").replaceFirstChar { it.uppercase() },
            fontSize = 13.sp, color = Color(0xFF344054),
            modifier = Modifier.weight(1f)
        )

        when {
            prop.type == "bool" -> {
                val checked = value.value == true || value.value == 1
                if (writable) {
                    Switch(
                        checked = checked,
                        onCheckedChange = { onSet(prop.siid, prop.piid, it) },
                        modifier = Modifier.height(24.dp),
                        colors = SwitchDefaults.colors(checkedTrackColor = Color(0xFF10B981), checkedThumbColor = Color.White)
                    )
                } else {
                    Text(if (checked) "开" else "关", fontSize = 13.sp, color = Color(0xFF667085))
                }
            }
            prop.valueList != null && prop.valueList.isNotEmpty() -> {
                val currentVal = (value.value as? Number)?.toInt()
                val currentItem = prop.valueList.find { it.value == currentVal }
                val displayText = currentItem?.description ?: currentVal?.toString() ?: "N/A"

                if (writable) {
                    var dropdownExpanded by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = dropdownExpanded,
                        onExpandedChange = { dropdownExpanded = it }
                    ) {
                        SuggestionChip(
                            onClick = { dropdownExpanded = true },
                            label = { Text(displayText, fontSize = 12.sp) },
                            modifier = Modifier.menuAnchor(),
                            shape = RoundedCornerShape(8.dp)
                        )
                        ExposedDropdownMenu(
                            expanded = dropdownExpanded,
                            onDismissRequest = { dropdownExpanded = false }
                        ) {
                            prop.valueList.forEach { item ->
                                DropdownMenuItem(
                                    text = {
                                        Text(
                                            item.description,
                                            fontWeight = if (item.value == currentVal) FontWeight.Bold else FontWeight.Normal
                                        )
                                    },
                                    onClick = {
                                        dropdownExpanded = false
                                        onSet(prop.siid, prop.piid, item.value)
                                    }
                                )
                            }
                        }
                    }
                } else {
                    Text(displayText, fontSize = 13.sp, color = Color(0xFF667085))
                }
            }
            prop.range != null && writable && (prop.type == "int" || prop.type == "uint" || prop.type == "float") -> {
                val min = prop.range!![0].toFloat()
                val max = if (prop.range!!.size > 1) prop.range!![1].toFloat() else 100f
                val current = (value.value as? Number)?.toFloat() ?: min
                var sliderValue by remember(value) { mutableStateOf(current) }

                Text("${sliderValue.toInt()}", fontSize = 13.sp, color = Color(0xFF667085), modifier = Modifier.width(36.dp))
                Slider(
                    value = sliderValue,
                    onValueChange = { sliderValue = it },
                    onValueChangeFinished = {
                        if (prop.type == "float") onSet(prop.siid, prop.piid, sliderValue)
                        else onSet(prop.siid, prop.piid, sliderValue.toInt())
                    },
                    valueRange = min..max,
                    modifier = Modifier.width(120.dp),
                    colors = SliderDefaults.colors(thumbColor = Color(0xFF10B981), activeTrackColor = Color(0xFF10B981))
                )
                prop.unit?.let { Text(it, fontSize = 11.sp, color = Color(0xFF98A2B3)) }
            }
            else -> {
                val displayValue = when (val v = value.value) {
                    is Number -> v.toString()
                    is Boolean -> if (v) "开" else "关"
                    else -> v?.toString() ?: "N/A"
                }
                Text(
                    "$displayValue${prop.unit?.let { " $it" } ?: ""}",
                    fontSize = 13.sp,
                    color = Color(0xFF667085)
                )
            }
        }
    }
}

private fun generateQrBitmap(content: String, size: Int): Bitmap? {
    return try {
        val writer = QRCodeWriter()
        val bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size)
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
        for (x in 0 until size) {
            for (y in 0 until size) {
                bitmap.setPixel(x, y, if (bitMatrix.get(x, y)) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
            }
        }
        bitmap
    } catch (e: Exception) {
        null
    }
}
