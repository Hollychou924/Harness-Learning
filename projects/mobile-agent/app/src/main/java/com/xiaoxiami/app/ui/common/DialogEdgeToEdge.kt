package com.xiaoxiami.app.ui.common

import android.graphics.Color as AndroidColor
import android.graphics.drawable.ColorDrawable
import android.view.ViewParent
import android.view.WindowManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * 为 Compose Dialog 的独立 Window 开启沉浸式（edge-to-edge）：
 * - 状态栏/导航栏透明
 * - 控制状态栏/导航栏图标明暗
 *
 * 注意：MainActivity 的 enableEdgeToEdge() 不会作用于 Dialog 的 Window，因此二级全屏 Dialog 需要单独处理。
 */
@Composable
fun DialogEdgeToEdge(
    statusBarDarkIcons: Boolean,
    navigationBarDarkIcons: Boolean,
    statusBarColor: Int = AndroidColor.TRANSPARENT,
    navigationBarColor: Int = AndroidColor.TRANSPARENT
) {
    val view = LocalView.current
    // 有些机型/Compose版本下 view.parent 不是直接的 DialogWindowProvider，需要向上遍历
    val window = run {
        var p: ViewParent? = view.parent
        var provider: DialogWindowProvider? = null
        while (p != null && provider == null) {
            if (p is DialogWindowProvider) provider = p
            p = p.parent
        }
        provider?.window
    } ?: return

    SideEffect {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        window.statusBarColor = statusBarColor
        window.navigationBarColor = navigationBarColor
        // 避免部分ROM给Dialog Window加默认背景导致看起来“有一条系统栏底色”
        window.setBackgroundDrawable(ColorDrawable(AndroidColor.TRANSPARENT))

        val controller = WindowInsetsControllerCompat(window, view)
        controller.isAppearanceLightStatusBars = statusBarDarkIcons
        controller.isAppearanceLightNavigationBars = navigationBarDarkIcons
    }
}

