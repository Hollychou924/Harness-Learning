
package com.xiaoxiami.app.utils

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.xiaoxiami.app.MainActivity
import com.xiaoxiami.app.R
import com.xiaoxiami.app.receiver.LocalReminderReceiver

object NotificationHelper {

    const val CHANNEL_ID = "agent_status_channel"
    private const val CHANNEL_NAME = "Xiaoxiami Status"
    private const val REMINDER_CHANNEL_NAME = "Local Reminder"

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifications for agent and automation status"
            }
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)

            val reminderChannel = NotificationChannel(
                LocalReminderReceiver.CHANNEL_ID,
                REMINDER_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifications for Xiaoxiami local reminders"
            }
            notificationManager.createNotificationChannel(reminderChannel)
        }
    }

    fun sendNotification(
        context: Context,
        title: String,
        message: String,
        targetScreen: String,
        traceId: String? = null
    ) {
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("target_screen", targetScreen)
            traceId?.let { putExtra("trace_id", it) }
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground) // 请确保这个图标存在
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        // 🆕 使用traceId的hashCode作为通知ID,确保同一个trace只有一个通知
        // 如果没有traceId,使用固定ID (1000),这样同类通知会互相覆盖
        val notificationId = traceId?.hashCode() ?: 1000
        
        android.util.Log.d("NotificationHelper", "发送通知: ID=$notificationId, title=$title, traceId=$traceId")
        notificationManager.notify(notificationId, notification)
    }
}
