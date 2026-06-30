package com.xiaoxiami.app.ui.browser

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.xiaoxiami.app.browser.BrowserRuntimeManager

/**
 * Visible browser panel dialog for file upload and interactive browsing.
 * Shows the WebView so onShowFileChooser can fire normally.
 */
@Composable
fun BrowserUploadPanel(
    browserRuntime: BrowserRuntimeManager,
    sessionId: String,
    onDismiss: () -> Unit
) {
    val pendingUpload by browserRuntime.pendingFileUpload.collectAsState()

    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        browserRuntime.resolveFileUpload(
            if (uri != null) arrayOf(uri) else null
        )
    }

    // When a file upload request appears, launch the system file picker
    LaunchedEffect(pendingUpload) {
        val upload = pendingUpload ?: return@LaunchedEffect
        if (upload.sessionId == sessionId) {
            val mimeTypes = upload.acceptTypes.filter { it.isNotBlank() }
                .ifEmpty { listOf("*/*") }
            filePickerLauncher.launch(mimeTypes.toTypedArray())
        }
    }

    Dialog(
        onDismissRequest = {
            // Cancel any pending upload
            browserRuntime.resolveFileUpload(null)
            onDismiss()
        },
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false
        )
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .clip(RoundedCornerShape(16.dp)),
            color = MaterialTheme.colorScheme.surface,
            shadowElevation = 8.dp
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                // Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF5F5F5))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Browser",
                        fontSize = 14.sp,
                        color = Color(0xFF333333),
                        modifier = Modifier.weight(1f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    IconButton(onClick = {
                        browserRuntime.resolveFileUpload(null)
                        onDismiss()
                    }) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "关闭",
                            tint = Color(0xFF666666)
                        )
                    }
                }

                // WebView
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(400.dp)
                ) {
                    val webView = browserRuntime.getWebView(sessionId)
                    if (webView != null) {
                        DisposableEffect(sessionId) {
                            browserRuntime.detachWebView(sessionId)
                            onDispose {
                                browserRuntime.detachWebView(sessionId)
                            }
                        }
                        AndroidView(
                            factory = {
                                browserRuntime.detachWebView(sessionId)
                                webView
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("会话不存在", color = Color.Gray)
                        }
                    }
                }
            }
        }
    }
}
