package com.xiaoxiami.app.ui.common

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.foundation.layout.fillMaxSize

/**
 * 全屏Dialog：用于“新开一层页面”的体验（覆盖底层内容），避免在同一页面树里造成重叠。
 */
@Composable
fun FullScreenDialog(
    onDismiss: () -> Unit,
    statusBarDarkIcons: Boolean = true,
    navigationBarDarkIcons: Boolean = true,
    content: @Composable () -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = false,
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false
        )
    ) {
        DialogEdgeToEdge(
            statusBarDarkIcons = statusBarDarkIcons,
            navigationBarDarkIcons = navigationBarDarkIcons
        )
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            content()
        }
    }
}

