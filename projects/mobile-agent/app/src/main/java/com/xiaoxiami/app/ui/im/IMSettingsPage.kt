package com.xiaoxiami.app.ui.im

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.PowerSettingsNew
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.SettingsEthernet
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material.icons.outlined.UnfoldMore
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import com.xiaoxiami.app.MyApplication
import com.xiaoxiami.app.im.CredentialField
import com.xiaoxiami.app.im.GatewayStatus
import com.xiaoxiami.app.im.IMChannelConfig
import com.xiaoxiami.app.im.IMGatewayManager
import com.xiaoxiami.app.im.IMPlatform
import com.xiaoxiami.app.im.WeixinBindingStatus
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IMSettingsPage(
    onBack: () -> Unit
) {
    BackHandler { onBack() }

    val context = LocalContext.current
    val manager = remember { (context.applicationContext as MyApplication).imGatewayManager }
    val statuses by manager.statuses.collectAsState()
    val configs by manager.configs.collectAsState()
    val connectedCount = statuses.values.count { it.connected }

    var selectedPlatform by remember { mutableStateOf<IMPlatform?>(null) }

    if (selectedPlatform != null) {
        ChannelDetailPage(
            platform = selectedPlatform!!,
            manager = manager,
            onBack = { selectedPlatform = null }
        )
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF6F7FB))
    ) {
        TopAppBar(
            title = {
                Text("关联机器人", fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.Outlined.ArrowBack, contentDescription = "返回")
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFFF6F7FB))
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                OverviewCard(
                    connectedCount = connectedCount,
                    configuredCount = configs.values.count { it.enabled || it.credentials.isNotEmpty() }
                )
            }

            items(
                listOf(
                    IMPlatform.WEIXIN,
                    IMPlatform.FEISHU,
                    IMPlatform.QQ,
                    IMPlatform.DINGTALK,
                    IMPlatform.WECOM,
                    IMPlatform.TELEGRAM,
                    IMPlatform.DISCORD
                )
            ) { platform ->
                val config = configs[platform] ?: IMChannelConfig(platform)
                val status = statuses[platform] ?: GatewayStatus(platform = platform)
                ChannelOverviewCard(
                    platform = platform,
                    config = config,
                    status = status,
                    onClick = { selectedPlatform = platform }
                )
            }
        }
    }
}

@Composable
private fun OverviewCard(
    connectedCount: Int,
    configuredCount: Int
) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(containerColor = Color(0xFF101828)),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "把常用 IM 渠道接进小虾米",
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
                fontSize = 20.sp
            )
            Text(
                text = "统一接收消息、自动回复、把多平台对话收拢进一个 Agent。",
                color = Color.White.copy(alpha = 0.78f),
                fontSize = 13.sp,
                lineHeight = 19.sp
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SummaryBadge(label = "已连接 $connectedCount 个", color = Color(0xFF16A34A))
                SummaryBadge(label = "已配置 $configuredCount 个", color = Color(0xFF2563EB))
            }
        }
    }
}

@Composable
private fun SummaryBadge(
    label: String,
    color: Color
) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = color.copy(alpha = 0.18f)
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
            color = Color.White,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun ChannelOverviewCard(
    platform: IMPlatform,
    config: IMChannelConfig,
    status: GatewayStatus,
    onClick: () -> Unit
) {
    val meta = platform.meta
    val bound = config.credentials.isNotEmpty()
    val stateText = when {
        status.connected && platform == IMPlatform.WEIXIN -> "已绑定"
        status.connected -> "已连接"
        bound && platform == IMPlatform.WEIXIN -> "已绑定待恢复"
        config.enabled -> "已启用待连接"
        bound -> "已配置"
        else -> "未配置"
    }
    val stateColor = when {
        status.connected -> meta.accentColor
        bound || config.enabled -> Color(0xFFF59E0B)
        else -> Color(0xFF98A2B3)
    }
    val detailText = when {
        status.errorMessage.isNotBlank() -> status.errorMessage
        status.connected && status.botName.isNotBlank() -> "当前身份：${status.botName}"
        platform == IMPlatform.WEIXIN && !bound -> "推荐扫码绑定，后续自动恢复会话"
        else -> meta.subtitle
    }

    ElevatedCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.elevatedCardColors(containerColor = Color.White),
        shape = RoundedCornerShape(22.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(meta.accentColor.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = meta.iconRes),
                    contentDescription = meta.title,
                    modifier = Modifier.size(30.dp)
                )
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = meta.title,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF101828)
                    )
                    StatusPill(text = stateText, color = stateColor)
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = detailText,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    color = Color(0xFF667085)
                )
            }

            Spacer(modifier = Modifier.width(8.dp))
            Icon(
                imageVector = Icons.Outlined.UnfoldMore,
                contentDescription = null,
                tint = Color(0xFF98A2B3)
            )
        }
    }
}

@Composable
private fun StatusPill(
    text: String,
    color: Color
) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = color.copy(alpha = 0.12f)
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
            color = color,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChannelDetailPage(
    platform: IMPlatform,
    manager: IMGatewayManager,
    onBack: () -> Unit
) {
    BackHandler { onBack() }

    val scope = rememberCoroutineScope()
    val configs by manager.configs.collectAsState()
    val statuses by manager.statuses.collectAsState()
    val config = configs[platform] ?: IMChannelConfig(platform)
    val status = statuses[platform] ?: GatewayStatus(platform = platform)
    val meta = platform.meta

    var enabled by remember(platform, config.enabled) { mutableStateOf(config.enabled) }
    var credentials by remember(platform, config.credentials) {
        mutableStateOf(config.credentials.toMutableMap())
    }
    var formResult by remember(platform) { mutableStateOf<String?>(null) }
    var isTesting by remember(platform) { mutableStateOf(false) }

    var weixinQrUrl by remember(platform) { mutableStateOf<String?>(null) }
    var weixinSessionKey by remember(platform) { mutableStateOf<String?>(null) }
    var weixinBindingStatus by remember(platform) { mutableStateOf<WeixinBindingStatus?>(null) }
    var weixinActionMessage by remember(platform) { mutableStateOf<String?>(null) }
    var weixinLoading by remember(platform) { mutableStateOf(false) }

    LaunchedEffect(platform, weixinSessionKey) {
        if (platform != IMPlatform.WEIXIN || weixinSessionKey == null) return@LaunchedEffect
        while (isActive) {
            val sessionKey = weixinSessionKey ?: break
            val result = runCatching { manager.pollWeixinBindingStatus(sessionKey) }
                .getOrElse {
                    WeixinBindingStatus(
                        status = "error",
                        connected = false,
                        message = it.message ?: "绑定失败"
                    )
                }
            weixinBindingStatus = result
            weixinActionMessage = result.message
            if (result.status in setOf("confirmed", "expired", "error")) {
                if (result.status == "confirmed") {
                    enabled = true
                }
                weixinLoading = false
                weixinSessionKey = null
                if (result.status == "confirmed") {
                    weixinQrUrl = null
                }
                break
            }
            delay(1500)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF6F7FB))
    ) {
        TopAppBar(
            title = {
                Text("${meta.title} 渠道", fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.Outlined.ArrowBack, contentDescription = "返回")
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFFF6F7FB))
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                DetailHeroCard(
                    platform = platform,
                    status = status,
                    config = config
                )
            }

            if (platform == IMPlatform.WEIXIN) {
                item {
                    WeixinBindingCard(
                        status = status,
                        config = config,
                        enabled = enabled,
                        qrUrl = weixinQrUrl,
                        bindingStatus = weixinBindingStatus,
                        actionMessage = weixinActionMessage,
                        loading = weixinLoading,
                        onToggleEnabled = { checked ->
                            enabled = checked
                            scope.launch {
                                manager.saveConfig(
                                    IMPlatform.WEIXIN,
                                    IMChannelConfig(
                                        platform = IMPlatform.WEIXIN,
                                        enabled = checked,
                                        credentials = config.credentials
                                    )
                                )
                                if (checked) {
                                    manager.startGateway(IMPlatform.WEIXIN)
                                } else {
                                    manager.stopGateway(IMPlatform.WEIXIN)
                                }
                            }
                        },
                        onStartBinding = {
                            scope.launch {
                                weixinLoading = true
                                weixinActionMessage = null
                                val result = runCatching { manager.startWeixinBinding() }
                                result.onSuccess {
                                    weixinQrUrl = it.qrcodeUrl
                                    weixinSessionKey = it.sessionKey
                                    weixinBindingStatus = WeixinBindingStatus(
                                        status = "wait",
                                        connected = false,
                                        message = "请完成扫码"
                                    )
                                    weixinActionMessage = "二维码已生成"
                                }.onFailure {
                                    weixinLoading = false
                                    weixinActionMessage = it.message ?: "获取二维码失败"
                                    weixinBindingStatus = WeixinBindingStatus(
                                        status = "error",
                                        connected = false,
                                        message = weixinActionMessage ?: "获取二维码失败"
                                    )
                                }
                            }
                        },
                        onReconnect = {
                            scope.launch { manager.startGateway(IMPlatform.WEIXIN) }
                        },
                        onUnbind = {
                            scope.launch {
                                manager.unbindWeixin()
                                enabled = false
                                weixinQrUrl = null
                                weixinSessionKey = null
                                weixinBindingStatus = null
                                weixinActionMessage = "已解除微信绑定"
                            }
                        }
                    )
                }
            } else {
                item {
                    StandardConfigCard(
                        platform = platform,
                        fields = manager.getRequiredCredentials(platform),
                        credentials = credentials,
                        enabled = enabled,
                        testing = isTesting,
                        result = formResult,
                        status = status,
                        onEnabledChange = { enabled = it },
                        onCredentialChange = { key, value -> credentials[key] = value },
                        onTest = {
                            scope.launch {
                                isTesting = true
                                formResult = null
                                val result = manager.testGateway(
                                    platform,
                                    IMChannelConfig(platform = platform, enabled = true, credentials = credentials)
                                )
                                formResult = if (result.success) {
                                    "测试成功：${result.message.ifBlank { result.botName }}"
                                } else {
                                    "测试失败：${result.message}"
                                }
                                isTesting = false
                            }
                        },
                        onSave = {
                            manager.saveConfig(
                                platform,
                                IMChannelConfig(platform = platform, enabled = enabled, credentials = credentials)
                            )
                            scope.launch {
                                if (enabled) {
                                    manager.startGateway(platform)
                                } else {
                                    manager.stopGateway(platform)
                                }
                            }
                            formResult = "已保存当前配置"
                        }
                    )
                }
            }

            item {
                GuideCard(platform = platform)
            }
        }
    }
}

@Composable
private fun DetailHeroCard(
    platform: IMPlatform,
    status: GatewayStatus,
    config: IMChannelConfig
) {
    val meta = platform.meta
    val connected = status.connected
    val bound = config.credentials.isNotEmpty()
    val title = when {
        connected && platform == IMPlatform.WEIXIN -> "微信已可用"
        connected -> "渠道已在线"
        bound && platform == IMPlatform.WEIXIN -> "微信已绑定但当前离线"
        config.enabled -> "渠道已启用，等待连接"
        bound -> "配置已保存"
        else -> "尚未完成配置"
    }
    val subtitle = when {
        status.errorMessage.isNotBlank() -> status.errorMessage
        connected && status.botId.isNotBlank() -> "标识：${status.botId}"
        else -> meta.subtitle
    }

    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(containerColor = Color.White),
        shape = RoundedCornerShape(24.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(meta.accentColor.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = meta.iconRes),
                    contentDescription = meta.title,
                    modifier = Modifier.size(34.dp)
                )
            }
            Spacer(modifier = Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF101828)
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = subtitle,
                    color = Color(0xFF667085),
                    fontSize = 13.sp,
                    lineHeight = 19.sp
                )
            }
        }
    }
}

@Composable
private fun WeixinBindingCard(
    status: GatewayStatus,
    config: IMChannelConfig,
    enabled: Boolean,
    qrUrl: String?,
    bindingStatus: WeixinBindingStatus?,
    actionMessage: String?,
    loading: Boolean,
    onToggleEnabled: (Boolean) -> Unit,
    onStartBinding: () -> Unit,
    onReconnect: () -> Unit,
    onUnbind: () -> Unit
) {
    val context = LocalContext.current
    val isBound = config.hasCredential("bot_token")
    val qrBitmap = remember(qrUrl) {
        qrUrl?.takeIf { !looksLikeImageUrl(it) }?.let { generateQrBitmap(it) }
    }

    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(containerColor = Color.White),
        shape = RoundedCornerShape(22.dp)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "扫码绑定微信",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF101828)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "无需手动输入 Token。绑定成功后会自动保存会话，下次打开应用会继续接收微信消息。",
                        color = Color(0xFF667085),
                        fontSize = 13.sp,
                        lineHeight = 19.sp
                    )
                }
                if (isBound) {
                    Switch(
                        checked = enabled,
                        onCheckedChange = onToggleEnabled,
                        colors = SwitchDefaults.colors(checkedTrackColor = Color(0xFF07C160))
                    )
                }
            }

            when {
                status.connected -> {
                    MessageBanner(
                        text = "微信已连接，消息会直接进入小虾米。",
                        color = Color(0xFFECFDF3),
                        contentColor = Color(0xFF027A48),
                        icon = Icons.Outlined.CheckCircle
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedButton(onClick = onStartBinding, modifier = Modifier.weight(1f)) {
                            Icon(Icons.Outlined.Refresh, contentDescription = null)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("重新绑定")
                        }
                        OutlinedButton(onClick = onUnbind, modifier = Modifier.weight(1f)) {
                            Icon(Icons.Outlined.PowerSettingsNew, contentDescription = null)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("解绑微信")
                        }
                    }
                }

                isBound -> {
                    MessageBanner(
                        text = status.errorMessage.ifBlank { "微信凭证已保存，但当前没有成功连上服务。可以尝试重新连接或重新绑定。" },
                        color = Color(0xFFFFFAEB),
                        contentColor = Color(0xFFB54708),
                        icon = Icons.Outlined.ErrorOutline
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = onReconnect,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111827))
                        ) {
                            Icon(Icons.Outlined.Sync, contentDescription = null, tint = Color.White)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("重新连接", color = Color.White)
                        }
                        OutlinedButton(onClick = onUnbind, modifier = Modifier.weight(1f)) {
                            Text("解绑后重绑")
                        }
                    }
                }

                else -> {
                    Button(
                        onClick = onStartBinding,
                        enabled = !loading,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF07C160))
                    ) {
                        Icon(Icons.Outlined.QrCode2, contentDescription = null, tint = Color.White)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(if (loading) "正在生成绑定入口…" else "开始绑定微信", color = Color.White)
                    }
                }
            }

            if (actionMessage != null) {
                MessageBanner(
                    text = actionMessage,
                    color = when (bindingStatus?.status) {
                        "error", "expired" -> Color(0xFFFFEBEE)
                        "confirmed" -> Color(0xFFECFDF3)
                        else -> Color(0xFFEFF4FF)
                    },
                    contentColor = when (bindingStatus?.status) {
                        "error", "expired" -> Color(0xFFB42318)
                        "confirmed" -> Color(0xFF027A48)
                        else -> Color(0xFF175CD3)
                    }
                )
            }

            if (qrUrl != null && bindingStatus?.status in setOf("wait", "scaned")) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(Color(0xFFF8FAFC))
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (looksLikeImageUrl(qrUrl)) {
                        AsyncImage(
                            model = qrUrl,
                            contentDescription = "微信绑定二维码",
                            modifier = Modifier
                                .fillMaxWidth(0.72f)
                                .aspectRatio(1f)
                                .clip(RoundedCornerShape(18.dp))
                                .border(1.dp, Color(0xFFD0D5DD), RoundedCornerShape(18.dp)),
                            contentScale = ContentScale.Fit
                        )
                    } else if (qrBitmap != null) {
                        Image(
                            bitmap = qrBitmap.asImageBitmap(),
                            contentDescription = "微信绑定二维码",
                            modifier = Modifier
                                .fillMaxWidth(0.72f)
                                .aspectRatio(1f)
                                .clip(RoundedCornerShape(18.dp))
                                .border(1.dp, Color(0xFFD0D5DD), RoundedCornerShape(18.dp))
                        )
                    }

                    Text(
                        text = if (bindingStatus?.status == "scaned") {
                            "已扫码，请在微信中确认授权"
                        } else {
                            "可用另一台设备扫码；如果就在本机操作，也可以直接打开绑定链接。"
                        },
                        color = Color(0xFF475467),
                        fontSize = 13.sp,
                        lineHeight = 19.sp
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedButton(
                            onClick = { openUrl(context, qrUrl) },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Outlined.Link, contentDescription = null)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("打开绑定链接")
                        }
                        OutlinedButton(
                            onClick = { copyToClipboard(context, "微信绑定链接", qrUrl) },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Outlined.ContentCopy, contentDescription = null)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("复制链接")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StandardConfigCard(
    platform: IMPlatform,
    fields: List<CredentialField>,
    credentials: Map<String, String>,
    enabled: Boolean,
    testing: Boolean,
    result: String?,
    status: GatewayStatus,
    onEnabledChange: (Boolean) -> Unit,
    onCredentialChange: (String, String) -> Unit,
    onTest: () -> Unit,
    onSave: () -> Unit
) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(containerColor = Color.White),
        shape = RoundedCornerShape(22.dp)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "渠道配置",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "${platform.meta.title} 通过官方凭证连接，保存后即可接收消息并把回复交给 Agent。",
                        color = Color(0xFF667085),
                        fontSize = 13.sp,
                        lineHeight = 19.sp
                    )
                }
                Switch(
                    checked = enabled,
                    onCheckedChange = onEnabledChange,
                    colors = SwitchDefaults.colors(checkedTrackColor = platform.meta.accentColor)
                )
            }

            fields.forEach { field ->
                OutlinedTextField(
                    value = credentials[field.key].orEmpty(),
                    onValueChange = { onCredentialChange(field.key, it) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(field.label) },
                    placeholder = { Text(field.description, fontSize = 12.sp) },
                    supportingText = {
                        Text(if (field.required) "必填项" else "选填项")
                    },
                    visualTransformation = if (field.key.contains("secret") || field.key.contains("token")) {
                        PasswordVisualTransformation()
                    } else {
                        VisualTransformation.None
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(18.dp)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedButton(
                    onClick = onTest,
                    enabled = !testing,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Outlined.SettingsEthernet, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(if (testing) "测试中…" else "测试连接")
                }
                Button(
                    onClick = onSave,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = platform.meta.accentColor)
                ) {
                    Text(if (enabled) "保存并启用" else "保存配置", color = Color.White)
                }
            }

            if (result != null) {
                MessageBanner(
                    text = result,
                    color = if (result.startsWith("测试成功") || result.startsWith("已保存")) Color(0xFFECFDF3) else Color(0xFFFFEBEE),
                    contentColor = if (result.startsWith("测试成功") || result.startsWith("已保存")) Color(0xFF027A48) else Color(0xFFB42318)
                )
            }

            if (status.connected || status.errorMessage.isNotBlank()) {
                MessageBanner(
                    text = if (status.connected) {
                        "当前在线${if (status.botName.isNotBlank()) "：${status.botName}" else ""}"
                    } else {
                        status.errorMessage
                    },
                    color = if (status.connected) Color(0xFFEFF4FF) else Color(0xFFFFFAEB),
                    contentColor = if (status.connected) Color(0xFF175CD3) else Color(0xFFB54708)
                )
            }
        }
    }
}

@Composable
private fun GuideCard(platform: IMPlatform) {
    val tips = when (platform) {
        IMPlatform.WEIXIN -> listOf(
            "点击“开始绑定微信”后可直接显示二维码和绑定链接。",
            "如果你就在这台手机上操作，优先使用“打开绑定链接”。",
            "绑定后小虾米会自动恢复会话，不需要重复扫码。"
        )
        IMPlatform.FEISHU -> listOf(
            "先在飞书开放平台创建应用并开启机器人能力。",
            "把 App ID / App Secret 填进来后，建议先点“测试连接”。",
            "适合群聊问答、文档提醒和协作消息转发。"
        )
        IMPlatform.WECOM -> listOf(
            "先在企业微信管理后台创建应用型机器人。",
            "保存凭证后即可把企业微信消息接入 Agent。",
            "适合内部通知、审批提醒和企业自动化。"
        )
        IMPlatform.DINGTALK -> listOf(
            "钉钉建议使用企业自建应用，权限更稳定。",
            "接入完成后可以在群内直接@小虾米。",
            "若经常断开，优先重新测试凭证有效性。"
        )
        IMPlatform.TELEGRAM -> listOf(
            "先到 @BotFather 创建机器人，再把 Bot Token 填入这里。",
            "Allowed User IDs 可以限制只允许固定账号使用。",
            "适合远程通知、指令执行和个人控制台场景。"
        )
        IMPlatform.DISCORD -> listOf(
            "在 Discord Developer Portal 创建机器人并复制 Bot Token。",
            "邀请机器人进服务器后再保存配置，便于马上验证。",
            "适合社区运营和频道通知类场景。"
        )
        IMPlatform.QQ -> listOf(
            "QQ 需要官方机器人 App ID / App Secret。",
            "保存后会自动连接网关并接收群消息。",
            "适合 QQ 群自动回复和频道内智能助手。"
        )
    }

    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(containerColor = Color.White),
        shape = RoundedCornerShape(22.dp)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "接入说明",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold
            )
            tips.forEach { tip ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .padding(top = 7.dp)
                            .size(5.dp)
                            .clip(CircleShape)
                            .background(platform.meta.accentColor)
                    )
                    Text(
                        text = tip,
                        color = Color(0xFF475467),
                        fontSize = 13.sp,
                        lineHeight = 19.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun MessageBanner(
    text: String,
    color: Color,
    contentColor: Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null
) {
    Surface(
        color = color,
        shape = RoundedCornerShape(18.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (icon != null) {
                Icon(icon, contentDescription = null, tint = contentColor, modifier = Modifier.size(18.dp))
            }
            Text(
                text = text,
                color = contentColor,
                fontSize = 13.sp,
                lineHeight = 18.sp
            )
        }
    }
}

private fun openUrl(context: Context, url: String) {
    runCatching {
        context.startActivity(
            Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
    }
}

private fun copyToClipboard(context: Context, label: String, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText(label, text))
}

private fun looksLikeImageUrl(value: String): Boolean {
    val lower = value.lowercase()
    return lower.startsWith("data:image") ||
        lower.endsWith(".png") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".webp")
}

private fun generateQrBitmap(content: String, size: Int = 820): Bitmap? {
    return runCatching {
        val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size)
        Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).apply {
            for (x in 0 until size) {
                for (y in 0 until size) {
                    setPixel(
                        x,
                        y,
                        if (matrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE
                    )
                }
            }
        }
    }.getOrNull()
}
