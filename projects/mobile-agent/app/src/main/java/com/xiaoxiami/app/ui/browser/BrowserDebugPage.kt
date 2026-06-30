package com.xiaoxiami.app.ui.browser

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.xiaoxiami.app.browser.BrowserAction
import com.xiaoxiami.app.browser.BrowserRuntimeManager
import com.xiaoxiami.app.browser.BrowserSessionSnapshot
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun BrowserDebugPage(
    browserRuntime: BrowserRuntimeManager,
    onBack: () -> Unit
) {
    val sessions by browserRuntime.sessionsFlow.collectAsState()
    var expandedSessionId by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8F8F8))
            .windowInsetsPadding(WindowInsets.statusBars)
    ) {
        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "返回")
            }
            Icon(
                imageVector = Icons.Outlined.Language,
                contentDescription = null,
                tint = Color(0xFF1565C0),
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "浏览器自动化",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = "${sessions.size} 个会话",
                fontSize = 13.sp,
                color = Color.Gray
            )
        }

        if (sessions.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Outlined.Language,
                        contentDescription = null,
                        tint = Color(0xFFCCCCCC),
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("没有活跃的浏览器会话", color = Color.Gray, fontSize = 14.sp)
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(sessions, key = { it.id }) { session ->
                    BrowserSessionCard(
                        session = session,
                        isExpanded = expandedSessionId == session.id,
                        onToggle = {
                            expandedSessionId = if (expandedSessionId == session.id) null else session.id
                        },
                        browserRuntime = browserRuntime
                    )
                }
            }
        }
    }
}

@Composable
private fun BrowserSessionCard(
    session: BrowserSessionSnapshot,
    isExpanded: Boolean,
    onToggle: () -> Unit,
    browserRuntime: BrowserRuntimeManager
) {
    val scope = rememberCoroutineScope()

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Session header
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Status indicator
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(
                            when {
                                session.loading -> Color(0xFFFFA726) // Orange for loading
                                session.consecutiveErrors > 0 -> Color(0xFFEF5350) // Red for errors
                                else -> Color(0xFF66BB6A) // Green for OK
                            }
                        )
                )
                Spacer(modifier = Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = session.name,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = session.url.take(60),
                        fontSize = 12.sp,
                        color = Color.Gray,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                if (session.consecutiveErrors > 0) {
                    Text(
                        text = "${session.consecutiveErrors} err",
                        fontSize = 11.sp,
                        color = Color(0xFFEF5350)
                    )
                }
            }

            // Expanded content
            if (isExpanded) {
                Spacer(modifier = Modifier.height(8.dp))
                Divider(color = Color(0xFFEEEEEE))
                Spacer(modifier = Modifier.height(8.dp))

                // WebView preview
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(300.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFF0F0F0))
                ) {
                    val webView = browserRuntime.getWebView(session.id)
                    if (webView != null) {
                        AndroidView(
                            factory = {
                                browserRuntime.detachWebView(session.id)
                                webView
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("WebView 不可用", color = Color.Gray)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Action timeline
                val actions = remember(session.id) {
                    browserRuntime.getActionLog(session.id)
                }
                if (actions.isNotEmpty()) {
                    Text(
                        text = "Action Timeline (${actions.size})",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF333333)
                    )
                    Spacer(modifier = Modifier.height(4.dp))

                    Column {
                        actions.takeLast(20).reversed().forEach { action ->
                            ActionTimelineItem(action)
                        }
                    }

                    // Replay button
                    Spacer(modifier = Modifier.height(8.dp))
                    TextButton(
                        onClick = {
                            scope.launch {
                                browserRuntime.replayActions(session.id, actions)
                            }
                        }
                    ) {
                        Icon(
                            Icons.Default.PlayArrow,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("重放全部动作", fontSize = 13.sp)
                    }
                }

                // Error history
                if (session.lastError.isNotBlank()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "最近错误: ${session.lastError}",
                        fontSize = 12.sp,
                        color = Color(0xFFEF5350)
                    )
                }

                // Health suggestions
                if (session.consecutiveErrors >= 3) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = if (session.consecutiveErrors >= 5) "建议: 重启会话" else "建议: 使用 Custom Tabs",
                        fontSize = 12.sp,
                        color = Color(0xFFFFA726),
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
private fun ActionTimelineItem(action: BrowserAction) {
    val timeFormat = remember { SimpleDateFormat("HH:mm:ss", Locale.getDefault()) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = timeFormat.format(Date(action.timestamp)),
            fontSize = 11.sp,
            color = Color(0xFF999999),
            modifier = Modifier.width(56.dp)
        )
        Icon(
            imageVector = if (action.success) Icons.Default.Check else Icons.Default.Close,
            contentDescription = null,
            tint = if (action.success) Color(0xFF66BB6A) else Color(0xFFEF5350),
            modifier = Modifier.size(14.dp)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = action.type,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = Color(0xFF333333),
            modifier = Modifier.width(60.dp)
        )
        Text(
            text = action.resultSummary.take(40),
            fontSize = 11.sp,
            color = Color(0xFF666666),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
    }
}
