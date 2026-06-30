package com.xiaoxiami.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.xiaoxiami.app.data.automation.AgentAutomationDao
import com.xiaoxiami.app.data.automation.AgentRuleEntity
import com.xiaoxiami.app.data.automation.AgentRuleRunEntity
import com.xiaoxiami.app.data.automation.AgentScheduleEntity
import com.xiaoxiami.app.data.automation.AgentScheduleRunEntity
import com.xiaoxiami.app.data.memory.LongTermMemory
import com.xiaoxiami.app.data.memory.LongTermMemoryDao
import com.xiaoxiami.app.data.remote.RemoteBridgeDao
import com.xiaoxiami.app.data.remote.RemoteBridgeRequestEntity
import com.xiaoxiami.app.data.remote.RemoteDeviceEntity
import com.xiaoxiami.app.data.trace.TraceArtifact
import com.xiaoxiami.app.data.trace.TraceDao
import com.xiaoxiami.app.data.trace.TraceRun
import com.xiaoxiami.app.data.trace.TraceSpan
import com.xiaoxiami.app.data.browser.BrowserSessionDao
import com.xiaoxiami.app.data.browser.BrowserSessionEntity
import com.xiaoxiami.app.data.iot.IotDao
import com.xiaoxiami.app.data.iot.IotDeviceEntity
import com.xiaoxiami.app.data.trace.TraceTypeConverters

@Database(
    entities = [
        TraceRun::class,
        TraceSpan::class,
        TraceArtifact::class,
        ActionItem::class,
        ChatMessage::class,
        ChatSession::class,
        LongTermMemory::class,
        AgentScheduleEntity::class,
        AgentScheduleRunEntity::class,
        AgentRuleEntity::class,
        AgentRuleRunEntity::class,
        RemoteDeviceEntity::class,
        RemoteBridgeRequestEntity::class,
        BrowserSessionEntity::class,
        IotDeviceEntity::class
    ],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class, TraceTypeConverters::class)
abstract class MemoryDatabase : RoomDatabase() {
    abstract fun traceDao(): TraceDao
    abstract fun actionItemDao(): ActionItemDao
    abstract fun chatMessageDao(): ChatMessageDao
    abstract fun chatSessionDao(): ChatSessionDao
    abstract fun longTermMemoryDao(): LongTermMemoryDao
    abstract fun agentAutomationDao(): AgentAutomationDao
    abstract fun remoteBridgeDao(): RemoteBridgeDao
    abstract fun browserSessionDao(): BrowserSessionDao
    abstract fun iotDao(): IotDao

    companion object {
        @Volatile
        private var INSTANCE: MemoryDatabase? = null

        fun getDatabase(context: Context): MemoryDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    MemoryDatabase::class.java,
                    "xiaoxiami_database"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
