package com.xiaoxiami.app.service

import android.app.Notification
import android.app.PendingIntent
import android.app.RemoteInput
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import android.support.v4.media.session.MediaControllerCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationManagerCompat
import androidx.media.session.MediaButtonReceiver
import android.media.session.MediaSessionManager
import android.view.KeyEvent
import com.xiaoxiami.app.data.MemoryDatabase
import com.xiaoxiami.app.repository.AgentAutomationRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class AgentNotificationListenerService : NotificationListenerService() {

    data class NotificationActionSnapshot(
        val title: String,
        val hasRemoteInput: Boolean
    )

    data class NotificationSnapshot(
        val key: String,
        val packageName: String,
        val title: String,
        val text: String,
        val postTime: Long,
        val actions: List<NotificationActionSnapshot>
    )

    companion object {
        private const val TAG = "AgentNotifService"

        @Volatile
        private var instance: AgentNotificationListenerService? = null
        private val notificationCache = linkedMapOf<String, NotificationSnapshot>()

        fun hasAccess(context: Context): Boolean {
            return NotificationManagerCompat.getEnabledListenerPackages(context)
                .contains(context.packageName)
        }

        fun getSettingsIntent(): Intent {
            return Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        }

        fun getCachedNotifications(
            limit: Int = 20,
            packageNames: Set<String> = emptySet(),
            sinceMs: Long = 0L
        ): List<NotificationSnapshot> {
            return notificationCache.values
                .asSequence()
                .filter { packageNames.isEmpty() || packageNames.contains(it.packageName) }
                .filter { sinceMs <= 0L || it.postTime >= sinceMs }
                .sortedByDescending { it.postTime }
                .take(limit)
                .toList()
        }

        fun dismissNotification(key: String): Boolean {
            val service = instance ?: return false
            return runCatching {
                service.cancelNotification(key)
                true
            }.getOrDefault(false)
        }

        fun replyToNotification(key: String, replyText: String): Boolean {
            val service = instance ?: return false
            val sbn = service.activeNotifications?.firstOrNull { it.key == key } ?: return false
            val action = sbn.notification.actions?.firstOrNull { action ->
                action.remoteInputs?.isNotEmpty() == true
            } ?: return false

            return runCatching {
                val intent = Intent()
                val bundle = Bundle().apply {
                    val firstInput = action.remoteInputs.first()
                    putCharSequence(firstInput.resultKey, replyText)
                }
                RemoteInput.addResultsToIntent(action.remoteInputs, intent, bundle)
                action.actionIntent.send(service, 0, intent)
                true
            }.onFailure {
                Log.e(TAG, "replyToNotification failed", it)
            }.getOrDefault(false)
        }

        fun triggerAction(key: String, actionIndex: Int): Boolean {
            val service = instance ?: return false
            val sbn = service.activeNotifications?.firstOrNull { it.key == key } ?: return false
            val action = sbn.notification.actions?.getOrNull(actionIndex) ?: return false
            return runCatching {
                action.actionIntent.send()
                true
            }.onFailure {
                Log.e(TAG, "triggerAction failed", it)
            }.getOrDefault(false)
        }

        fun snooze(key: String, durationMs: Long): Boolean {
            val service = instance ?: return false
            return runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    service.snoozeNotification(key, durationMs)
                    true
                } else {
                    false
                }
            }.getOrDefault(false)
        }

        fun mediaSessions(context: Context): List<Map<String, Any?>> {
            if (!hasAccess(context)) return emptyList()
            val manager = context.getSystemService(Context.MEDIA_SESSION_SERVICE) as? MediaSessionManager
                ?: return emptyList()
            val component = ComponentName(context, AgentNotificationListenerService::class.java)
            return runCatching {
                manager.getActiveSessions(component).map { controller ->
                    mapOf(
                        "packageName" to controller.packageName,
                        "title" to (controller.metadata?.description?.title?.toString() ?: ""),
                        "state" to playbackStateName(controller.playbackState?.state)
                    )
                }
            }.getOrDefault(emptyList())
        }

        fun mediaCommand(context: Context, packageName: String?, action: String): Boolean {
            if (!hasAccess(context)) return false
            val manager = context.getSystemService(Context.MEDIA_SESSION_SERVICE) as? MediaSessionManager
                ?: return false
            val component = ComponentName(context, AgentNotificationListenerService::class.java)
            val controllers = runCatching { manager.getActiveSessions(component) }.getOrDefault(emptyList())
            val controller = controllers.firstOrNull {
                packageName.isNullOrBlank() || it.packageName == packageName
            } ?: return false

            return runCatching {
                when (action.lowercase()) {
                    "play_pause" -> {
                        val state = controller.playbackState?.state
                        if (state == PlaybackStateCompat.STATE_PLAYING) {
                            controller.transportControls.pause()
                        } else {
                            controller.transportControls.play()
                        }
                    }
                    "next" -> controller.transportControls.skipToNext()
                    "previous" -> controller.transportControls.skipToPrevious()
                    else -> return false
                }
                true
            }.onFailure {
                Log.e(TAG, "mediaCommand failed", it)
            }.getOrDefault(false)
        }

        private fun playbackStateName(state: Int?): String {
            return when (state) {
                PlaybackStateCompat.STATE_PLAYING -> "PLAYING"
                PlaybackStateCompat.STATE_PAUSED -> "PAUSED"
                PlaybackStateCompat.STATE_BUFFERING -> "BUFFERING"
                PlaybackStateCompat.STATE_CONNECTING -> "CONNECTING"
                PlaybackStateCompat.STATE_STOPPED -> "STOPPED"
                else -> "UNKNOWN"
            }
        }

        private fun toSnapshot(sbn: StatusBarNotification): NotificationSnapshot {
            val notification = sbn.notification
            val extras = notification.extras
            val actions = notification.actions?.map { action ->
                NotificationActionSnapshot(
                    title = action.title?.toString().orEmpty(),
                    hasRemoteInput = action.remoteInputs?.isNotEmpty() == true
                )
            }.orEmpty()
            return NotificationSnapshot(
                key = sbn.key,
                packageName = sbn.packageName,
                title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty(),
                text = extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty(),
                postTime = sbn.postTime,
                actions = actions
            )
        }
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onListenerConnected() {
        super.onListenerConnected()
        instance = this
        notificationCache.clear()
        activeNotifications?.forEach { sbn ->
            notificationCache[sbn.key] = toSnapshot(sbn)
        }
    }

    override fun onListenerDisconnected() {
        instance = null
        super.onListenerDisconnected()
    }

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return
        val snapshot = toSnapshot(sbn)
        notificationCache[sbn.key] = snapshot
        serviceScope.launch {
            runCatching {
                AgentAutomationRepository(
                    context = this@AgentNotificationListenerService,
                    dao = MemoryDatabase.getDatabase(this@AgentNotificationListenerService).agentAutomationDao()
                ).handleNotificationPosted(
                    packageName = snapshot.packageName,
                    title = snapshot.title,
                    text = snapshot.text
                )
            }.onFailure {
                Log.e(TAG, "handleNotificationPosted failed", it)
            }
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        if (sbn == null) return
        notificationCache.remove(sbn.key)
    }
}
