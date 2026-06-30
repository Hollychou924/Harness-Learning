package com.xiaoxiami.app.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/**
 * 聊天会话DAO
 */
@Dao
interface ChatSessionDao {
    
    /**
     * 获取所有会话，按更新时间倒序
     */
    @Query("SELECT * FROM chat_sessions ORDER BY updatedAt DESC")
    fun getAllSessions(): Flow<List<ChatSession>>
    
    /**
     * 根据ID获取会话
     */
    @Query("SELECT * FROM chat_sessions WHERE id = :sessionId")
    suspend fun getSessionById(sessionId: String): ChatSession?
    
    /**
     * 插入会话
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSession(session: ChatSession)
    
    /**
     * 更新会话
     */
    @Update
    suspend fun updateSession(session: ChatSession)
    
    /**
     * 删除会话
     */
    @Query("DELETE FROM chat_sessions WHERE id = :sessionId")
    suspend fun deleteSession(sessionId: String)
    
    /**
     * 更新会话标题
     */
    @Query("UPDATE chat_sessions SET title = :title WHERE id = :sessionId")
    suspend fun updateSessionTitle(sessionId: String, title: String)
    
    /**
     * 更新会话的更新时间和消息数量
     */
    @Query("UPDATE chat_sessions SET updatedAt = :updatedAt, messageCount = :messageCount WHERE id = :sessionId")
    suspend fun updateSessionInfo(sessionId: String, updatedAt: Long, messageCount: Int)
}
