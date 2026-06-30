package com.xiaoxiami.app.ui.settings

import android.Manifest
import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Bluetooth
import androidx.compose.material.icons.outlined.Cameraswitch
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Contacts
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.PermMedia
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Sms
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.Button
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.xiaoxiami.app.service.AgentNotificationListenerService
import com.xiaoxiami.app.utils.UsageStatsHelper

private data class PermissionCardItem(
    val title: String,
    val description: String,
    val icon: ImageVector,
    val granted: Boolean,
    val statusLabel: String,
    val buttonLabel: String,
    val onAction: () -> Unit
)

private enum class PermissionCategory(
    val title: String,
    val subtitle: String
) {
    POPUP("弹窗可授权", "系统弹窗直接授权，无需离开应用"),
    SETTINGS("需跳转设置", "必须手动跳转系统设置页才能开启")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PermissionCenterPage(
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var refreshTick by remember { mutableIntStateOf(0) }
    var pendingPermissionGroup by remember { mutableStateOf<List<String>>(emptyList()) }
    var selectedCategory by rememberSaveable { mutableStateOf(PermissionCategory.POPUP) }

    BackHandler { onBack() }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        refreshTick++
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                refreshTick++
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    fun requestGroup(group: List<String>) {
        pendingPermissionGroup = group
        permissionLauncher.launch(group.toTypedArray())
    }

    fun open(intent: Intent) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    val popupItems = remember(refreshTick) {
        buildPopupGrantableItems(context, onRequest = ::requestGroup)
    }
    val settingsItems = remember(refreshTick) {
        buildSettingsJumpItems(context, onOpen = ::open)
    }
    val popupGrantedCount = popupItems.count { it.granted }
    val settingsGrantedCount = settingsItems.count { it.granted }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF6F7FB))
    ) {
        TopAppBar(
            title = {
                Text(
                    "权限中心",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold
                )
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(
                        imageVector = Icons.Outlined.ArrowBack,
                        contentDescription = "返回"
                    )
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = Color(0xFFF6F7FB)
            )
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                PermissionHeroCard(
                    popupGrantedCount = popupGrantedCount,
                    popupTotal = popupItems.size,
                    settingsGrantedCount = settingsGrantedCount,
                    settingsTotal = settingsItems.size
                )
            }

            item {
                CategorySelector(
                    selected = selectedCategory,
                    onSelected = { selectedCategory = it }
                )
            }

            when (selectedCategory) {
                PermissionCategory.POPUP -> {
                    item {
                        SectionShell(
                            title = "弹窗可授权",
                            subtitle = "点击「去开启」后系统会弹出授权框，同意即可开启，无需离开应用。"
                        ) {
                            popupItems.forEach { item ->
                                CompactPermissionCard(item)
                            }
                        }
                    }
                }

                PermissionCategory.SETTINGS -> {
                    item {
                        SectionShell(
                            title = "需跳转设置",
                            subtitle = "这类权限只能跳转到系统设置页面手动开启，应用无法通过弹窗授予。"
                        ) {
                            settingsItems.forEach { item ->
                                CompactPermissionCard(item)
                            }
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun PermissionHeroCard(
    popupGrantedCount: Int,
    popupTotal: Int,
    settingsGrantedCount: Int,
    settingsTotal: Int
) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(containerColor = Color(0xFF101828)),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "权限管理",
                color = Color.White,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = "授予权限后，小虾米才能帮你完成对应的操作。",
                color = Color.White.copy(alpha = 0.78f),
                fontSize = 13.sp,
                lineHeight = 19.sp
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OverviewBadge("弹窗可授权 $popupGrantedCount/$popupTotal", Color(0xFF2563EB))
                OverviewBadge("需跳转设置 $settingsGrantedCount/$settingsTotal", Color(0xFF14B8A6))
            }
        }
    }
}

@Composable
private fun OverviewBadge(
    label: String,
    color: Color
) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = color.copy(alpha = 0.2f)
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
private fun CategorySelector(
    selected: PermissionCategory,
    onSelected: (PermissionCategory) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        PermissionCategory.entries.forEach { category ->
            val isSelected = category == selected
            Surface(
                modifier = Modifier
                    .weight(1f)
                    .clickable { onSelected(category) },
                shape = RoundedCornerShape(14.dp),
                color = if (isSelected) Color(0xFF111827) else Color.White,
                tonalElevation = if (isSelected) 0.dp else 1.dp,
                shadowElevation = if (isSelected) 0.dp else 1.dp
            ) {
                Box(
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = category.title,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isSelected) Color.White else Color(0xFF101828),
                        maxLines = 1
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionShell(
    title: String,
    subtitle: String,
    content: @Composable ColumnScope.() -> Unit
) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors(containerColor = Color.White),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = title,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF101828)
                )
                Text(
                    text = subtitle,
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                    color = Color(0xFF667085)
                )
            }
            content()
        }
    }
}

@Composable
private fun CompactPermissionCard(item: PermissionCardItem) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = Color(0xFFF8FAFC)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                modifier = Modifier.size(32.dp),
                shape = RoundedCornerShape(10.dp),
                color = if (item.granted) Color(0xFFE9F7EF) else Color(0xFFFFF3E0)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = item.icon,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                        tint = if (item.granted) Color(0xFF2E7D32) else Color(0xFFEF6C00)
                    )
                }
            }
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = item.title,
                modifier = Modifier.widthIn(min = 56.dp),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = Color(0xFF1A1A1A),
                maxLines = 1
            )
            Spacer(modifier = Modifier.width(8.dp))
            StatusBadge(
                text = item.statusLabel,
                color = if (item.granted) Color(0xFF16A34A) else Color(0xFFF59E0B)
            )
            Spacer(modifier = Modifier.weight(1f))
            if (!item.granted) {
                Button(
                    onClick = item.onAction,
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 0.dp),
                    modifier = Modifier.height(32.dp)
                ) {
                    Text("去开启", fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(
    text: String,
    color: Color
) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = color.copy(alpha = 0.12f)
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            color = color,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

private fun buildPopupGrantableItems(
    context: Context,
    onRequest: (List<String>) -> Unit
): List<PermissionCardItem> {
    fun has(permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    val mediaPermissions = buildList {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.READ_MEDIA_IMAGES)
            add(Manifest.permission.READ_MEDIA_VIDEO)
            add(Manifest.permission.READ_MEDIA_AUDIO)
        } else {
            add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }

    val bluetoothGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        has(Manifest.permission.BLUETOOTH_CONNECT)
    } else {
        true
    }

    return buildList {
        add(PermissionCardItem(
            title = "相机",
            description = "", icon = Icons.Outlined.Cameraswitch,
            granted = has(Manifest.permission.CAMERA),
            statusLabel = if (has(Manifest.permission.CAMERA)) "已授权" else "未授权",
            buttonLabel = "去开启",
            onAction = { onRequest(listOf(Manifest.permission.CAMERA)) }
        ))
        add(PermissionCardItem(
            title = "麦克风",
            description = "", icon = Icons.Outlined.Mic,
            granted = has(Manifest.permission.RECORD_AUDIO),
            statusLabel = if (has(Manifest.permission.RECORD_AUDIO)) "已授权" else "未授权",
            buttonLabel = "去开启",
            onAction = { onRequest(listOf(Manifest.permission.RECORD_AUDIO)) }
        ))
        add(PermissionCardItem(
            title = "位置",
            description = "", icon = Icons.Outlined.LocationOn,
            granted = has(Manifest.permission.ACCESS_COARSE_LOCATION) || has(Manifest.permission.ACCESS_FINE_LOCATION),
            statusLabel = if (has(Manifest.permission.ACCESS_COARSE_LOCATION) || has(Manifest.permission.ACCESS_FINE_LOCATION)) "已授权" else "未授权",
            buttonLabel = "去开启",
            onAction = { onRequest(listOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION)) }
        ))
        val contactsAll = has(Manifest.permission.READ_CONTACTS) && has(Manifest.permission.WRITE_CONTACTS)
        val contactsAny = has(Manifest.permission.READ_CONTACTS) || has(Manifest.permission.WRITE_CONTACTS)
        add(PermissionCardItem(
            title = "联系人",
            description = "", icon = Icons.Outlined.Contacts,
            granted = contactsAll,
            statusLabel = if (contactsAll) "已授权" else if (contactsAny) "部分授权" else "未授权",
            buttonLabel = "去开启",
            onAction = { onRequest(listOf(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS)) }
        ))
        val calendarAll = has(Manifest.permission.READ_CALENDAR) && has(Manifest.permission.WRITE_CALENDAR)
        val calendarAny = has(Manifest.permission.READ_CALENDAR) || has(Manifest.permission.WRITE_CALENDAR)
        add(PermissionCardItem(
            title = "日历",
            description = "", icon = Icons.Outlined.CalendarMonth,
            granted = calendarAll,
            statusLabel = if (calendarAll) "已授权" else if (calendarAny) "部分授权" else "未授权",
            buttonLabel = "去开启",
            onAction = { onRequest(listOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR)) }
        ))
        val smsAll = has(Manifest.permission.READ_SMS) && has(Manifest.permission.SEND_SMS)
        val smsAny = has(Manifest.permission.READ_SMS) || has(Manifest.permission.SEND_SMS)
        add(PermissionCardItem(
            title = "短信",
            description = "", icon = Icons.Outlined.Sms,
            granted = smsAll,
            statusLabel = if (smsAll) "已授权" else if (smsAny) "部分授权" else "未授权",
            buttonLabel = "去开启",
            onAction = { onRequest(listOf(Manifest.permission.READ_SMS, Manifest.permission.SEND_SMS)) }
        ))
        val phoneAll = has(Manifest.permission.CALL_PHONE) && has(Manifest.permission.READ_CALL_LOG)
        val phoneAny = has(Manifest.permission.CALL_PHONE) || has(Manifest.permission.READ_CALL_LOG)
        add(PermissionCardItem(
            title = "电话与通话记录",
            description = "", icon = Icons.Outlined.Call,
            granted = phoneAll,
            statusLabel = if (phoneAll) "已授权" else if (phoneAny) "部分授权" else "未授权",
            buttonLabel = "去开启",
            onAction = { onRequest(listOf(Manifest.permission.CALL_PHONE, Manifest.permission.READ_CALL_LOG)) }
        ))
        val mediaAll = mediaPermissions.all(::has)
        val mediaAny = mediaPermissions.any(::has)
        add(PermissionCardItem(
            title = "媒体读取",
            description = "", icon = Icons.Outlined.PermMedia,
            granted = mediaAll,
            statusLabel = if (mediaAll) "已授权" else if (mediaAny) "部分授权" else "未授权",
            buttonLabel = "去开启",
            onAction = { onRequest(mediaPermissions) }
        ))
        // 通知权限：Android 13+ 可弹窗，低版本需跳设置（归入 settings tab）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = has(Manifest.permission.POST_NOTIFICATIONS)
            add(PermissionCardItem(
                title = "通知权限",
                description = "", icon = Icons.Outlined.Notifications,
                granted = granted,
                statusLabel = if (granted) "已授权" else "未授权",
                buttonLabel = "去开启",
                onAction = { onRequest(listOf(Manifest.permission.POST_NOTIFICATIONS)) }
            ))
        }
        // 蓝牙连接：Android 12+ 可弹窗，低版本需跳设置
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !bluetoothGranted) {
            add(PermissionCardItem(
                title = "蓝牙连接",
                description = "", icon = Icons.Outlined.Bluetooth,
                granted = false,
                statusLabel = "未授权",
                buttonLabel = "去开启",
                onAction = { onRequest(listOf(Manifest.permission.BLUETOOTH_CONNECT)) }
            ))
        }
    }
}

private fun buildSettingsJumpItems(
    context: Context,
    onOpen: (Intent) -> Unit
): List<PermissionCardItem> {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
    val exactAlarmGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        alarmManager?.canScheduleExactAlarms() == true
    } else {
        true
    }
    val canInstallUnknownApps = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.packageManager.canRequestPackageInstalls()
    } else {
        true
    }
    val canWriteSettings = Settings.System.canWrite(context)

    return buildList {
        add(PermissionCardItem(
            title = "通知访问",
            description = "", icon = Icons.Outlined.Notifications,
            granted = AgentNotificationListenerService.hasAccess(context),
            statusLabel = if (AgentNotificationListenerService.hasAccess(context)) "已开启" else "未开启",
            buttonLabel = "去设置",
            onAction = { onOpen(AgentNotificationListenerService.getSettingsIntent()) }
        ))
        add(PermissionCardItem(
            title = "使用情况访问",
            description = "", icon = Icons.Outlined.Visibility,
            granted = UsageStatsHelper.hasUsageStatsPermission(context),
            statusLabel = if (UsageStatsHelper.hasUsageStatsPermission(context)) "已开启" else "未开启",
            buttonLabel = "去设置",
            onAction = { onOpen(UsageStatsHelper.getSettingsIntent()) }
        ))
        add(PermissionCardItem(
            title = "未知来源安装",
            description = "", icon = Icons.Outlined.Security,
            granted = canInstallUnknownApps,
            statusLabel = if (canInstallUnknownApps) "已开启" else "未开启",
            buttonLabel = "去设置",
            onAction = {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    onOpen(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                        data = android.net.Uri.parse("package:${context.packageName}")
                    })
                } else {
                    onOpen(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = android.net.Uri.parse("package:${context.packageName}")
                    })
                }
            }
        ))
        add(PermissionCardItem(
            title = "修改系统设置",
            description = "", icon = Icons.Outlined.Settings,
            granted = canWriteSettings,
            statusLabel = if (canWriteSettings) "已开启" else "未开启",
            buttonLabel = "去设置",
            onAction = {
                onOpen(Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS).apply {
                    data = android.net.Uri.parse("package:${context.packageName}")
                })
            }
        ))
        add(PermissionCardItem(
            title = "精确闹钟",
            description = "", icon = Icons.Outlined.Timer,
            granted = exactAlarmGranted,
            statusLabel = if (exactAlarmGranted) "已开启" else "未开启",
            buttonLabel = "去设置",
            onAction = {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    onOpen(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM))
                } else {
                    onOpen(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = android.net.Uri.parse("package:${context.packageName}")
                    })
                }
            }
        ))
        // 低版本通知权限需跳设置
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            val granted = NotificationManagerCompat.from(context).areNotificationsEnabled()
            add(PermissionCardItem(
                title = "通知权限",
                description = "", icon = Icons.Outlined.Notifications,
                granted = granted,
                statusLabel = if (granted) "已开启" else "未开启",
                buttonLabel = "去设置",
                onAction = {
                    onOpen(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                    })
                }
            ))
        }
        // 低版本蓝牙连接需跳设置
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            add(PermissionCardItem(
                title = "蓝牙连接",
                description = "", icon = Icons.Outlined.Bluetooth,
                granted = true,
                statusLabel = "已开启",
                buttonLabel = "去设置",
                onAction = { onOpen(Intent(Settings.ACTION_BLUETOOTH_SETTINGS)) }
            ))
        }
    }
}

