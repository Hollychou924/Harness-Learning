package com.xiaoxiami.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * 聊天消息实体
 */
@Entity(tableName = "chat_messages")
data class ChatMessage(
    @PrimaryKey
    val id: String,
    val content: String,
    val isUser: Boolean,
    val timestamp: String, // 用于显示的格式化时间字符串
    val createdAt: Long,   // 用于排序的时间戳
    val imageUri: String? = null,
    val sessionId: String = "default", // 默认会话ID
    val memoryUpdated: Boolean = false,
    val memoryStatus: Int = 0,
    val executionStepsJson: String? = null
)
