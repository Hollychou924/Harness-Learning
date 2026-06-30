package com.xiaoxiami.app.utils

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process
import android.util.Log

object AppUsageHelper {
    private const val TAG = "AppUsageHelper"

    fun hasUsageStatsPermission(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    data class PhoneEvent(
        val type: EventType,
        val timestamp: Long
    )

    enum class EventType {
        UNLOCK,      // 解锁 (KEYGUARD_HIDDEN or MOVE_TO_FOREGROUND of Launcher?) 
                     // Actually KEYGUARD_HIDDEN is the best proxy for "Unlock"
        SCREEN_OFF,  // 熄屏 (SCREEN_NON_INTERACTIVE)
        SCREEN_ON    // 亮屏 (SCREEN_INTERACTIVE) - Optional
    }

    fun getPhoneEvents(context: Context, startTime: Long, endTime: Long): List<PhoneEvent> {
        if (!hasUsageStatsPermission(context)) return emptyList()

        val events = mutableListOf<PhoneEvent>()
        val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val usageEvents = usageStatsManager.queryEvents(startTime, endTime)
        
        val event = UsageEvents.Event()
        while (usageEvents.hasNextEvent()) {
            usageEvents.getNextEvent(event)
            
            when (event.eventType) {
                UsageEvents.Event.KEYGUARD_HIDDEN -> {
                    events.add(PhoneEvent(EventType.UNLOCK, event.timeStamp))
                }
                UsageEvents.Event.SCREEN_NON_INTERACTIVE -> {
                    events.add(PhoneEvent(EventType.SCREEN_OFF, event.timeStamp))
                }
                // We can add SCREEN_INTERACTIVE if needed, but UNLOCK is more meaningful for "User started using phone"
            }
        }
        
        return events.sortedBy { it.timestamp }
    }
}