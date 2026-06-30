package com.xiaoxiami.app.ui.im

import androidx.annotation.DrawableRes
import androidx.compose.ui.graphics.Color
import com.xiaoxiami.app.R
import com.xiaoxiami.app.im.IMPlatform

data class IMPlatformMeta(
    val title: String,
    val subtitle: String,
    val accentColor: Color,
    @DrawableRes val iconRes: Int
)

val IMPlatform.meta: IMPlatformMeta
    get() = when (this) {
        IMPlatform.FEISHU -> IMPlatformMeta(
            title = "飞书",
            subtitle = "适合团队协作、群聊问答和文档通知",
            accentColor = Color(0xFF2E6DF6),
            iconRes = R.drawable.im_feishu
        )
        IMPlatform.WECOM -> IMPlatformMeta(
            title = "企业微信",
            subtitle = "企业内部助手、机器人消息和审批提醒",
            accentColor = Color(0xFF1BB56B),
            iconRes = R.drawable.im_wecom
        )
        IMPlatform.DINGTALK -> IMPlatformMeta(
            title = "钉钉",
            subtitle = "工作通知、群机器人消息与任务同步",
            accentColor = Color(0xFF007AFF),
            iconRes = R.drawable.im_dingtalk
        )
        IMPlatform.TELEGRAM -> IMPlatformMeta(
            title = "Telegram",
            subtitle = "适合个人远程控制和跨设备通知",
            accentColor = Color(0xFF229ED9),
            iconRes = R.drawable.im_telegram
        )
        IMPlatform.DISCORD -> IMPlatformMeta(
            title = "Discord",
            subtitle = "社区频道、机器人对话与事件播报",
            accentColor = Color(0xFF5865F2),
            iconRes = R.drawable.im_discord
        )
        IMPlatform.QQ -> IMPlatformMeta(
            title = "QQ",
            subtitle = "QQ 官方机器人消息接入与群内对话",
            accentColor = Color(0xFF12B7F5),
            iconRes = R.drawable.im_qq
        )
        IMPlatform.WEIXIN -> IMPlatformMeta(
            title = "微信",
            subtitle = "扫码绑定后即可直接在微信里和小虾米对话",
            accentColor = Color(0xFF07C160),
            iconRes = R.drawable.im_weixin
        )
    }
