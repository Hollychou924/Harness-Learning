package com.xiaoxiami.app

import android.app.Activity
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import androidx.core.view.WindowCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.xiaoxiami.app.config.AIConfig
import com.xiaoxiami.app.ui.chat.ChatHistoryDrawer
import com.xiaoxiami.app.ui.chat.ChatPage
import com.xiaoxiami.app.ui.automation.ScheduledTasksPage
import com.xiaoxiami.app.ui.memory.MemoryManagementPage
import com.xiaoxiami.app.ui.settings.PermissionCenterPage
import com.xiaoxiami.app.ui.skills.SkillsPage
import com.xiaoxiami.app.ui.im.IMSettingsPage
import com.xiaoxiami.app.ui.theme.XiaoxiamiTheme
import com.xiaoxiami.app.viewmodel.ChatViewModel
import com.tencent.upgrade.core.DefaultUpgradeStrategyRequestCallback
import com.tencent.upgrade.core.UpgradeManager
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        AIConfig.loadGeminiKey(this)
        com.xiaoxiami.app.utils.NotificationHelper.createNotificationChannel(this)
        com.xiaoxiami.app.config.DebugConfig.init(this)

        UpgradeManager.getInstance().checkUpgrade(false, null, DefaultUpgradeStrategyRequestCallback())

        setContent {
            XiaoxiamiTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    HomeScreen()
                }
            }
        }
    }
}

private enum class HomeOverlay {
    NONE,
    MEMORY,
    SCHEDULED_TASKS,
    PERMISSION_CENTER,
    SKILLS,
    IM_SETTINGS,
    BROWSER_AUTOMATION,
    IOT_CONTROL
}

@Composable
fun HomeScreen() {
    val context = LocalContext.current
    val activity = context as? Activity

    SideEffect {
        activity?.window?.let { window ->
            window.statusBarColor = android.graphics.Color.parseColor("#F8F8F8")
            WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = true
        }
    }

    val chatViewModel: ChatViewModel = viewModel()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val chatListState = rememberLazyListState()
    val app = remember { context.applicationContext as MyApplication }
    var activeOverlay by rememberSaveable { mutableStateOf(HomeOverlay.NONE) }

    val configuration = LocalConfiguration.current
    val screenWidth = configuration.screenWidthDp.dp
    val drawerWidth = screenWidth * 0.75f
    val isDrawerOpen = drawerState.isOpen

    val drawerOffset by animateDpAsState(
        targetValue = if (isDrawerOpen) drawerWidth else 0.dp,
        animationSpec = tween(300),
        label = "drawer"
    )

    Box(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .width(drawerWidth)
                .fillMaxHeight()
                .offset(x = drawerOffset - drawerWidth)
                .background(Color.White)
                .zIndex(1f)
        ) {
            ChatHistoryDrawer(
                viewModel = chatViewModel,
                onSessionClick = { sessionId ->
                    scope.launch {
                        chatViewModel.switchSession(sessionId)
                        drawerState.close()
                    }
                },
                onNewChatClick = {
                    scope.launch {
                        chatViewModel.createNewSession()
                        drawerState.close()
                    }
                },
                onMemoryManagementClick = {
                    scope.launch {
                        drawerState.close()
                        activeOverlay = HomeOverlay.MEMORY
                    }
                },
                onScheduledTasksClick = {
                    scope.launch {
                        drawerState.close()
                        activeOverlay = HomeOverlay.SCHEDULED_TASKS
                    }
                },
                onPermissionCenterClick = {
                    scope.launch {
                        drawerState.close()
                        activeOverlay = HomeOverlay.PERMISSION_CENTER
                    }
                },
                onSkillsClick = {
                    scope.launch {
                        drawerState.close()
                        activeOverlay = HomeOverlay.SKILLS
                    }
                },
                onIMSettingsClick = {
                    scope.launch {
                        drawerState.close()
                        activeOverlay = HomeOverlay.IM_SETTINGS
                    }
                },
                onBrowserDebugClick = {
                    scope.launch {
                        drawerState.close()
                        activeOverlay = HomeOverlay.BROWSER_AUTOMATION
                    }
                },
                onIotControlClick = {
                    scope.launch {
                        drawerState.close()
                        activeOverlay = HomeOverlay.IOT_CONTROL
                    }
                }
            )
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .offset(x = drawerOffset)
                .zIndex(2f)
        ) {
            ChatPage(
                onNavigateToHistory = {},
                onNewChat = { chatViewModel.createNewSession() },
                onOpenDrawer = {
                    scope.launch { drawerState.open() }
                },
                viewModel = chatViewModel,
                listState = chatListState
            )

            if (isDrawerOpen) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.5f))
                        .zIndex(100f)
                        .pointerInput(isDrawerOpen) {
                            var dragOffset = 0f
                            detectHorizontalDragGestures(
                                onDragStart = { dragOffset = 0f },
                                onDragEnd = {
                                    if (dragOffset < -50f) {
                                        scope.launch { drawerState.close() }
                                    }
                                    dragOffset = 0f
                                },
                                onDragCancel = { dragOffset = 0f },
                                onHorizontalDrag = { change, dragAmount ->
                                    change.consume()
                                    dragOffset += dragAmount
                                }
                            )
                        }
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null
                        ) {
                            scope.launch { drawerState.close() }
                        }
                )
            }
        }

        if (activeOverlay != HomeOverlay.NONE) {
            val backToDrawer: () -> Unit = {
                activeOverlay = HomeOverlay.NONE
                scope.launch { drawerState.open() }
            }
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFFF6F7FB))
                    .zIndex(200f)
            ) {
                when (activeOverlay) {
                    HomeOverlay.MEMORY -> MemoryManagementPage(onBack = backToDrawer)
                    HomeOverlay.SCHEDULED_TASKS -> ScheduledTasksPage(onBack = backToDrawer)
                    HomeOverlay.PERMISSION_CENTER -> PermissionCenterPage(onBack = backToDrawer)
                    HomeOverlay.SKILLS -> SkillsPage(onBack = backToDrawer)
                    HomeOverlay.IM_SETTINGS -> IMSettingsPage(onBack = backToDrawer)
                    HomeOverlay.BROWSER_AUTOMATION -> com.xiaoxiami.app.ui.browser.BrowserDebugPage(
                        browserRuntime = app.browserRuntimeManager,
                        onBack = backToDrawer
                    )
                    HomeOverlay.IOT_CONTROL -> com.xiaoxiami.app.ui.iot.IotControlPage(
                        onBack = backToDrawer
                    )
                    HomeOverlay.NONE -> Unit
                }
            }
        }
    }
}
