package com.xiaoxiami.app.agent

import android.content.Context
import com.xiaoxiami.app.agent.tools.AnalyzeCurrentScreenTool
import com.xiaoxiami.app.agent.tools.AnalyzeImagesTool
import com.xiaoxiami.app.agent.tools.AppUsageReportTool
import com.xiaoxiami.app.agent.tools.BulkCalendarImportConfirmedTool
import com.xiaoxiami.app.agent.tools.BulkContactImportConfirmedTool
import com.xiaoxiami.app.agent.tools.BulkSmsSendConfirmedTool
import com.xiaoxiami.app.agent.tools.BrowserExtractTool
import com.xiaoxiami.app.agent.tools.BrowserOpenTool
import com.xiaoxiami.app.agent.tools.BrowserScreenshotTool
import com.xiaoxiami.app.agent.tools.BrowserSessionCloseTool
import com.xiaoxiami.app.agent.tools.BrowserSessionCreateTool
import com.xiaoxiami.app.agent.tools.BrowserSessionListTool
import com.xiaoxiami.app.agent.tools.BrowserNavigateTool
import com.xiaoxiami.app.agent.tools.BrowserDomSnapshotTool
import com.xiaoxiami.app.agent.tools.BrowserQueryElementsTool
import com.xiaoxiami.app.agent.tools.BrowserClickTool
import com.xiaoxiami.app.agent.tools.BrowserFillFormTool
import com.xiaoxiami.app.agent.tools.BrowserWaitForTool
import com.xiaoxiami.app.agent.tools.BrowserExtractPageTool
import com.xiaoxiami.app.agent.tools.BrowserHandoffToCustomTabTool
import com.xiaoxiami.app.agent.tools.BrowserDownloadFileTool
import com.xiaoxiami.app.agent.tools.BrowserUploadFileTool
import com.xiaoxiami.app.agent.tools.CallHistoryAnalysisTool
import com.xiaoxiami.app.agent.tools.CameraCaptureTool
import com.xiaoxiami.app.agent.tools.CaptureCurrentScreenTool
import com.xiaoxiami.app.agent.tools.DeleteCalendarEventTool
import com.xiaoxiami.app.agent.tools.FileCopyTool
import com.xiaoxiami.app.agent.tools.FileDeleteTool
import com.xiaoxiami.app.agent.tools.FileInfoTool
import com.xiaoxiami.app.agent.tools.FileListTool
import com.xiaoxiami.app.agent.tools.FileMoveTool
import com.xiaoxiami.app.agent.tools.FileReadTool
import com.xiaoxiami.app.agent.tools.FileSearchTool
import com.xiaoxiami.app.agent.tools.FileWriteTool
import com.xiaoxiami.app.agent.tools.UpdateCalendarEventTool
import com.xiaoxiami.app.agent.tools.DeleteSmsConfirmedTool
import com.xiaoxiami.app.agent.tools.DeleteCallLogConfirmedTool
import com.xiaoxiami.app.agent.tools.QueryVolumeTool
import com.xiaoxiami.app.agent.tools.QueryBrightnessTool
import com.xiaoxiami.app.agent.tools.IotListDevicesTool
import com.xiaoxiami.app.agent.tools.IotGetDeviceStatusTool
import com.xiaoxiami.app.agent.tools.IotControlDeviceTool
import com.xiaoxiami.app.agent.tools.IotRunActionTool
import com.xiaoxiami.app.agent.tools.IotRunSceneTool
import com.xiaoxiami.app.agent.tools.ListRemindersTool
import com.xiaoxiami.app.agent.tools.CancelReminderTool
import com.xiaoxiami.app.agent.tools.UpdateReminderTool
import com.xiaoxiami.app.agent.tools.ListInstalledAppsTool
import com.xiaoxiami.app.agent.tools.CronAddTool
import com.xiaoxiami.app.agent.tools.CronDeleteTool
import com.xiaoxiami.app.agent.tools.CronListTool
import com.xiaoxiami.app.agent.tools.CronRunTool
import com.xiaoxiami.app.agent.tools.CronRunsTool
import com.xiaoxiami.app.agent.tools.CronUpdateTool
import com.xiaoxiami.app.agent.tools.CreateScheduledTaskTool
import com.xiaoxiami.app.agent.tools.CreateCalendarEventTool
import com.xiaoxiami.app.agent.tools.CreateContactTool
import com.xiaoxiami.app.agent.tools.CreateLocalReminderTool
import com.xiaoxiami.app.agent.tools.DeleteContactConfirmedTool
import com.xiaoxiami.app.agent.tools.DelegateTool
import com.xiaoxiami.app.agent.tools.DialNumberTool
import com.xiaoxiami.app.agent.tools.DismissNotificationTool
import com.xiaoxiami.app.agent.tools.DraftSmsTool
import com.xiaoxiami.app.agent.tools.GetAudioOutputDevicesTool
import com.xiaoxiami.app.agent.tools.GetContactDetailTool
import com.xiaoxiami.app.agent.tools.GetCurrentLocationTool
import com.xiaoxiami.app.agent.tools.GetForegroundAppTool
import com.xiaoxiami.app.agent.tools.GetScheduledTaskTool
import com.xiaoxiami.app.agent.tools.InstallApkPromptedTool
import com.xiaoxiami.app.agent.tools.LaunchMapNavigationTool
import com.xiaoxiami.app.agent.tools.MediaNextPreviousTool
import com.xiaoxiami.app.agent.tools.MediaPlayPauseTool
import com.xiaoxiami.app.agent.tools.MediaSessionListTool
import com.xiaoxiami.app.agent.tools.MemoryForgetTool
import com.xiaoxiami.app.agent.tools.MemorySearchTool
import com.xiaoxiami.app.agent.tools.MemoryStoreTool
import com.xiaoxiami.app.agent.tools.OpenAppTool
import com.xiaoxiami.app.agent.tools.OpenBluetoothSettingsTool
import com.xiaoxiami.app.agent.tools.OpenDeeplinkTool
import com.xiaoxiami.app.agent.tools.OpenDisplaySettingsTool
import com.xiaoxiami.app.agent.tools.OpenFileWithAppTool
import com.xiaoxiami.app.agent.tools.OpenNfcSettingsTool
import com.xiaoxiami.app.agent.tools.OpenSystemSettingsPageTool
import com.xiaoxiami.app.agent.tools.OpenWifiSettingsTool
import com.xiaoxiami.app.agent.tools.PickFilesTool
import com.xiaoxiami.app.agent.tools.PickImagesTool
import com.xiaoxiami.app.agent.tools.PlaceCallConfirmedTool
import com.xiaoxiami.app.agent.tools.PdfReadTool
import com.xiaoxiami.app.agent.tools.QueryBatteryStatusTool
import com.xiaoxiami.app.agent.tools.QueryNetworkStatusTool
import com.xiaoxiami.app.agent.tools.QueryStorageStatusTool
import com.xiaoxiami.app.agent.tools.ReadCalendarTool
import com.xiaoxiami.app.agent.tools.ReadCallLogTool
import com.xiaoxiami.app.agent.tools.ReadClipboardTool
import com.xiaoxiami.app.agent.tools.ReadNotificationsTool
import com.xiaoxiami.app.agent.tools.ReadSmsMessagesTool
import com.xiaoxiami.app.agent.tools.ReadSmsThreadsTool
import com.xiaoxiami.app.agent.tools.ReplyToNotificationTool
import com.xiaoxiami.app.agent.tools.RulesAddTool
import com.xiaoxiami.app.agent.tools.RulesDeleteTool
import com.xiaoxiami.app.agent.tools.RulesListTool
import com.xiaoxiami.app.agent.tools.RulesPreviewTool
import com.xiaoxiami.app.agent.tools.RulesRunsTool
import com.xiaoxiami.app.agent.tools.RulesUpdateTool
import com.xiaoxiami.app.agent.tools.ListScheduledTasksTool
import com.xiaoxiami.app.agent.tools.RemoteAndroidBridgeStatusTool
import com.xiaoxiami.app.agent.tools.RemoteAndroidCallPeerTool
import com.xiaoxiami.app.agent.tools.RemoteAndroidDisconnectTool
import com.xiaoxiami.app.agent.tools.RemoteAndroidDevicesTool
import com.xiaoxiami.app.agent.tools.RemoteAndroidPairTool
import com.xiaoxiami.app.agent.tools.RemoteAndroidRequestStatusTool
import com.xiaoxiami.app.agent.tools.buildRemoteAndroidForwardingTools
import com.xiaoxiami.app.agent.tools.SaveFileToDownloadsTool
import com.xiaoxiami.app.agent.tools.ScheduleTool
import com.xiaoxiami.app.agent.tools.SearchContactsTool
import com.xiaoxiami.app.agent.tools.SearchGlobalDeviceIndexTool
import com.xiaoxiami.app.agent.tools.SearchLocalMediaTool
import com.xiaoxiami.app.agent.tools.SendSmsConfirmedTool
import com.xiaoxiami.app.agent.tools.SetFlashlightTool
import com.xiaoxiami.app.agent.tools.SetScreenBrightnessTool
import com.xiaoxiami.app.agent.tools.SetStreamVolumeTool
import com.xiaoxiami.app.agent.tools.ShareFilesTool
import com.xiaoxiami.app.agent.tools.ShareTextTool
import com.xiaoxiami.app.agent.tools.ShellExecTool
import com.xiaoxiami.app.agent.tools.ShellWriteScriptTool
import com.xiaoxiami.app.agent.tools.ShellInstallPackageTool
import com.xiaoxiami.app.agent.tools.SmsHistoryAnalysisTool
import com.xiaoxiami.app.agent.tools.SnoozeNotificationTool
import com.xiaoxiami.app.agent.tools.TriggerNotificationActionTool
import com.xiaoxiami.app.agent.tools.UninstallAppPromptedTool
import com.xiaoxiami.app.agent.tools.UpdateScheduledTaskTool
import com.xiaoxiami.app.agent.tools.UpdateContactTool
import com.xiaoxiami.app.agent.tools.DeleteScheduledTaskTool
import com.xiaoxiami.app.agent.tools.HttpRequestTool
import com.xiaoxiami.app.agent.tools.WebSearchTool
import com.xiaoxiami.app.agent.tools.WebFetchTool
import com.xiaoxiami.app.agent.tools.WriteClipboardTool
import com.xiaoxiami.app.agent.tools.ImageInfoTool
import com.xiaoxiami.app.data.MemoryDatabase
import com.xiaoxiami.app.repository.AgentAutomationRepository
import com.xiaoxiami.app.repository.GeminiRepository
import com.xiaoxiami.app.repository.MemoryRepository

object AndroidToolRegistry {
    fun build(
        context: Context,
        geminiRepository: GeminiRepository,
        memoryRepository: MemoryRepository
    ): List<Tool> {
        val app = context.applicationContext as com.xiaoxiami.app.MyApplication
        val automationRepository = AgentAutomationRepository(
            context = context.applicationContext,
            dao = MemoryDatabase.getDatabase(context.applicationContext).agentAutomationDao()
        )
        val baseTools = listOf(
            MemorySearchTool(memoryRepository),
            MemoryStoreTool(memoryRepository),
            MemoryForgetTool(memoryRepository),
            WebSearchTool(geminiRepository),
            BrowserOpenTool(context),
            BrowserExtractTool(),
            BrowserSessionCreateTool(app.browserRuntimeManager),
            BrowserSessionListTool(app.browserRuntimeManager),
            BrowserSessionCloseTool(app.browserRuntimeManager),
            BrowserNavigateTool(app.browserRuntimeManager),
            BrowserDomSnapshotTool(app.browserRuntimeManager),
            BrowserQueryElementsTool(app.browserRuntimeManager),
            BrowserClickTool(app.browserRuntimeManager),
            BrowserFillFormTool(app.browserRuntimeManager),
            BrowserWaitForTool(app.browserRuntimeManager),
            BrowserExtractPageTool(app.browserRuntimeManager),
            BrowserScreenshotTool(app.browserRuntimeManager),
            BrowserHandoffToCustomTabTool(context, app.browserRuntimeManager),
            BrowserDownloadFileTool(context, app.browserRuntimeManager),
            BrowserUploadFileTool(app.browserRuntimeManager),
            ShellExecTool(app.shellRuntime),
            ShellWriteScriptTool(app.shellRuntime),
            ShellInstallPackageTool(app.shellRuntime),
            HttpRequestTool(),
            WebFetchTool(),
            PdfReadTool(context),
            ImageInfoTool(context),
            ScheduleTool(automationRepository),
            CronAddTool(automationRepository),
            CronListTool(automationRepository),
            CronUpdateTool(automationRepository),
            CronDeleteTool(automationRepository),
            CronRunTool(automationRepository),
            CronRunsTool(automationRepository),
            CreateScheduledTaskTool(automationRepository),
            ListScheduledTasksTool(automationRepository),
            GetScheduledTaskTool(automationRepository),
            UpdateScheduledTaskTool(automationRepository),
            DeleteScheduledTaskTool(automationRepository),
            RulesAddTool(automationRepository),
            RulesListTool(automationRepository),
            RulesUpdateTool(automationRepository),
            RulesDeleteTool(automationRepository),
            RulesPreviewTool(automationRepository),
            RulesRunsTool(automationRepository),
            DelegateTool(context, geminiRepository, memoryRepository),
            RemoteAndroidBridgeStatusTool(app.remoteBridgeManager),
            RemoteAndroidPairTool(app.remoteBridgeManager),
            RemoteAndroidDisconnectTool(app.remoteBridgeManager),
            RemoteAndroidCallPeerTool(app.remoteBridgeManager),
            RemoteAndroidDevicesTool(app.remoteBridgeRepository),
            RemoteAndroidRequestStatusTool(app.remoteBridgeRepository),
            AnalyzeImagesTool(geminiRepository),
            GetForegroundAppTool(context),
            GetCurrentLocationTool(context),
            ReadNotificationsTool(context),
            DismissNotificationTool(context),
            CaptureCurrentScreenTool(),
            AnalyzeCurrentScreenTool(geminiRepository),
            ReadCalendarTool(context),
            CreateCalendarEventTool(context),
            SearchContactsTool(context),
            GetContactDetailTool(context),
            SearchLocalMediaTool(context),
            PickImagesTool(),
            PickFilesTool(),
            OpenAppTool(context),
            OpenDeeplinkTool(context),
            OpenSystemSettingsPageTool(context),
            OpenWifiSettingsTool(context),
            OpenBluetoothSettingsTool(context),
            OpenNfcSettingsTool(context),
            OpenDisplaySettingsTool(context),
            ShareTextTool(context),
            ShareFilesTool(context),
            ReadClipboardTool(context),
            WriteClipboardTool(context),
            DraftSmsTool(context),
            SendSmsConfirmedTool(),
            ReadSmsThreadsTool(context),
            ReadSmsMessagesTool(context),
            DialNumberTool(context),
            PlaceCallConfirmedTool(context),
            ReadCallLogTool(context),
            CreateContactTool(context),
            UpdateContactTool(context),
            DeleteContactConfirmedTool(context),
            CameraCaptureTool(),
            SaveFileToDownloadsTool(context),
            OpenFileWithAppTool(context),
            QueryBatteryStatusTool(context),
            QueryStorageStatusTool(context),
            QueryNetworkStatusTool(context),
            LaunchMapNavigationTool(context),
            CreateLocalReminderTool(context),
            ReplyToNotificationTool(context),
            TriggerNotificationActionTool(context),
            SnoozeNotificationTool(context),
            MediaSessionListTool(context),
            MediaPlayPauseTool(context),
            MediaNextPreviousTool(context),
            SetStreamVolumeTool(context),
            SetFlashlightTool(context),
            SetScreenBrightnessTool(context),
            GetAudioOutputDevicesTool(context),
            InstallApkPromptedTool(context),
            UninstallAppPromptedTool(context),
            AppUsageReportTool(context),
            SmsHistoryAnalysisTool(context),
            CallHistoryAnalysisTool(context),
            BulkCalendarImportConfirmedTool(context),
            BulkContactImportConfirmedTool(context),
            BulkSmsSendConfirmedTool(),
            SearchGlobalDeviceIndexTool(context),
            // ── Phase 1: 文件操作 ──
            FileListTool(context),
            FileReadTool(context),
            FileWriteTool(context),
            FileCopyTool(context),
            FileMoveTool(context),
            FileDeleteTool(context),
            FileSearchTool(context),
            FileInfoTool(context),
            // ── Phase 1: 日历补全 ──
            UpdateCalendarEventTool(context),
            DeleteCalendarEventTool(context),
            // ── Phase 1: 缺口补全 ──
            DeleteSmsConfirmedTool(context),
            DeleteCallLogConfirmedTool(context),
            QueryVolumeTool(context),
            QueryBrightnessTool(context),
            ListRemindersTool(context),
            CancelReminderTool(context),
            UpdateReminderTool(context),
            ListInstalledAppsTool(context),
            IotListDevicesTool(context),
            IotGetDeviceStatusTool(context),
            IotControlDeviceTool(context),
            IotRunActionTool(context),
            IotRunSceneTool(context)
        )
        val routedRemoteTools = buildRemoteAndroidForwardingTools(
            localTools = baseTools,
            bridgeManager = app.remoteBridgeManager,
            bridgeRepository = app.remoteBridgeRepository
        )
        return baseTools + routedRemoteTools
    }
}
