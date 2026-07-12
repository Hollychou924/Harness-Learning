import { useCallback, useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { api, type ImportSourceSummary } from '../api'
import {
  canShowImportReminder,
  loadImportReminderPreferences,
  markImportReminderCompleted,
  MAX_IMPORT_REMINDERS,
  remainingImportReminders,
  saveImportReminderPreferences,
  snoozeDurationMs
} from '../importPreferences'
import { useTaskStore } from '../store/task'
import { useSettingsStore } from './settings/settingsStore'

const STARTUP_DELAY_MS = 12_000

export function ExternalImportReminder() {
  const status = useTaskStore((state) => state.status)
  const settingsOpen = useSettingsStore((state) => state.open)
  const openSettings = useSettingsStore((state) => state.openSettings)
  const [sources, setSources] = useState<ImportSourceSummary[]>([])
  const [timesShown, setTimesShown] = useState(0)
  const snoozeTimerRef = useRef<number | null>(null)
  const bubbleVisibleRef = useRef(false)

  const clearSnoozeTimer = useCallback(() => {
    if (snoozeTimerRef.current != null) {
      window.clearTimeout(snoozeTimerRef.current)
      snoozeTimerRef.current = null
    }
  }, [])

  const tryShowReminder = useCallback(async () => {
    if (status !== 'idle' || settingsOpen || bubbleVisibleRef.current) return
    const preferences = loadImportReminderPreferences()
    setTimesShown(preferences.timesShown)
    if (!canShowImportReminder(preferences)) return

    const response = await api.scanExternalImports()
    if (!response.success || !response.preview) return
    const available = response.preview.sources.filter((source) =>
      source.detected &&
      source.compatibility !== 'unsupported' &&
      source.pending > 0 &&
      !preferences.ignoredSources.includes(source.id))
    if (available.length === 0) return

    const nextTimesShown = Math.min(MAX_IMPORT_REMINDERS, preferences.timesShown + 1)
    saveImportReminderPreferences({ ...preferences, timesShown: nextTimesShown })
    setTimesShown(nextTimesShown)
    bubbleVisibleRef.current = true
    setSources(available)
  }, [settingsOpen, status])

  const scheduleSnoozeWake = useCallback((wakeAt: number) => {
    clearSnoozeTimer()
    const delay = wakeAt - Date.now()
    if (delay <= 0) return
    snoozeTimerRef.current = window.setTimeout(() => {
      snoozeTimerRef.current = null
      void tryShowReminder()
    }, delay + 500)
  }, [clearSnoozeTimer, tryShowReminder])

  useEffect(() => {
    if (status !== 'idle' || settingsOpen) {
      clearSnoozeTimer()
      return
    }
    const preferences = loadImportReminderPreferences()
    setTimesShown(preferences.timesShown)
    if (preferences.snoozedUntil > Date.now()) scheduleSnoozeWake(preferences.snoozedUntil)

    const timer = window.setTimeout(() => { void tryShowReminder() }, STARTUP_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [clearSnoozeTimer, scheduleSnoozeWake, settingsOpen, status, tryShowReminder])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tryShowReminder()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [tryShowReminder])

  useEffect(() => () => clearSnoozeTimer(), [clearSnoozeTimer])

  if (sources.length === 0) return null

  const dismiss = () => {
    bubbleVisibleRef.current = false
    setSources([])
  }

  const snooze = () => {
    const preferences = loadImportReminderPreferences()
    const wakeAt = Date.now() + snoozeDurationMs(preferences.timesShown)
    saveImportReminderPreferences({ ...preferences, snoozedUntil: wakeAt })
    scheduleSnoozeWake(wakeAt)
    dismiss()
  }

  const openImport = () => {
    markImportReminderCompleted()
    setTimesShown(MAX_IMPORT_REMINDERS)
    dismiss()
    openSettings('import')
  }

  const remaining = remainingImportReminders(timesShown)
  const snoozeHint = remaining <= 1
    ? '这是最后一次提醒'
    : `稍后再说（${remaining - 1} 次后不再提醒）`

  return (
    <div className="fixed right-5 bottom-5 z-[70] w-[min(340px,calc(100vw-40px))] rounded-lg border border-black/[0.10] floating-surface p-3.5 shadow-xl overflow-hidden">
      <div className="flex gap-2.5 min-w-0">
        <span className="w-9 h-9 rounded-lg bg-blue-500/[0.10] text-[#0071e3] flex items-center justify-center flex-shrink-0">
          <Download size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-[var(--ink)] leading-snug">
            可导入{sources.length}个编程智能体配置
          </div>
          <div className="text-xs text-[var(--ink-soft)] mt-1 leading-snug">
            包括规则/记忆/项目/对话记录/功能配置等
          </div>
        </div>
      </div>
      <div className="mt-3.5 flex flex-col gap-2">
        <button
          onClick={openImport}
          className="h-9 rounded-lg bg-[#0071e3] text-white text-sm font-medium hover:brightness-[0.96]"
        >
          查看并导入
        </button>
        <button onClick={snooze} className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] py-1">
          {snoozeHint}
        </button>
      </div>
    </div>
  )
}
