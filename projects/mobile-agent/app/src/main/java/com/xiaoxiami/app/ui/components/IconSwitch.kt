package com.xiaoxiami.app.ui.components

import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.xiaoxiami.app.R

/**
 * 开关状态枚举
 */
enum class SwitchState {
    OFF,        // 未开启
    LOADING,    // 开启中
    ON          // 已开启
}

/**
 * 自定义图标开关组件
 * 支持三种状态：未开启、开启中、已开启
 * 使用自定义图标素材，带震动反馈和平滑过渡动画
 */
@Composable
fun IconSwitch(
    state: SwitchState,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
    loadingText: String = "Gemini连通性测试中"  // 🆕 支持自定义 Loading 文案
) {
    val context = LocalContext.current
    
    // 震动反馈函数
    fun vibrate() {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(android.content.Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(android.content.Context.VIBRATOR_SERVICE) as? Vibrator
            }
            
            vibrator?.let {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    it.vibrate(VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    it.vibrate(50)
                }
            }
            android.util.Log.d("IconSwitch", "Vibration triggered")
        } catch (e: Exception) {
            android.util.Log.e("IconSwitch", "Vibration failed", e)
        }
    }
    
    // 淡入淡出动画
    val alpha by animateFloatAsState(
        targetValue = 1f,
        animationSpec = tween(durationMillis = 300),
        label = "alpha"
    )
    
    // Loading状态的旋转动画 - 围绕中心旋转
    val infiniteTransition = rememberInfiniteTransition(label = "loading")
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = LinearEasing), // 2秒一圈，流畅旋转
            repeatMode = RepeatMode.Restart
        ),
        label = "rotation"
    )
    
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp) // 减少间距
    ) {
        // 图标区域 - 添加白色背景避免与渐变背景重叠
        Box(
            modifier = Modifier
                .size(100.dp)
                .background(Color.White, shape = androidx.compose.foundation.shape.CircleShape)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    enabled = state != SwitchState.LOADING
                ) {
                    // 点击时震动
                    vibrate()
                    onToggle()
                },
            contentAlignment = Alignment.Center
        ) {
            // 使用 Crossfade 实现平滑过渡
            Crossfade(
                targetState = state,
                animationSpec = tween(durationMillis = 300),
                label = "switch_crossfade"
            ) { currentState ->
                when (currentState) {
                    SwitchState.OFF -> {
                        Image(
                            painter = painterResource(id = R.drawable.switch_off),
                            contentDescription = "未开启",
                            modifier = Modifier
                                .fillMaxSize()
                                .alpha(alpha)
                        )
                    }
                    SwitchState.LOADING -> {
                        Image(
                            painter = painterResource(id = R.drawable.switch_loading),
                            contentDescription = "开启中",
                            modifier = Modifier
                                .fillMaxSize()
                                .rotate(rotation)
                        )
                    }
                    SwitchState.ON -> {
                        Image(
                            painter = painterResource(id = R.drawable.switch_on),
                            contentDescription = "已开启",
                            modifier = Modifier
                                .fillMaxSize()
                                .alpha(alpha)
                        )
                    }
                }
            }
        }
        
        // 状态文字
        AnimatedContent(
            targetState = state,
            transitionSpec = {
                fadeIn(animationSpec = tween(200)) togetherWith
                    fadeOut(animationSpec = tween(200))
            },
            label = "status_text"
        ) { currentState ->
            Text(
                text = when (currentState) {
                    SwitchState.OFF -> "未开启"
                    SwitchState.LOADING -> loadingText
                    SwitchState.ON -> "已开启"
                },
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                color = when (currentState) {
                    SwitchState.OFF -> Color.Gray
                    SwitchState.LOADING -> Color(0xFF8B4BAA) // 紫色
                    SwitchState.ON -> Color(0xFF8B4BAA) // 紫色
                }
            )
        }
    }
}
