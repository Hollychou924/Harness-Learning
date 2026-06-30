package com.xiaoxiami.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * 聊天会话实体
 */
@Entity(tableName = "chat_sessions")
data class ChatSession(
    @PrimaryKey
    val id: String,
    val title: String = "新的聊天", // 会话标题，不超过12个字
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val messageCount: Int = 0 // 消息数量
)
