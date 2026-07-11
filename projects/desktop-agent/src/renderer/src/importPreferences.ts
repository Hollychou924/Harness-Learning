import type { ImportSourceId } from './api'

const KEY = 'xld.externalImportReminder.v2'
const LEGACY_KEY = 'xld.externalImportReminder.v1'

export const MAX_IMPORT_REMINDERS = 3
const DAY_MS = 24 * 60 * 60 * 1000

export interface ImportReminderPreferences {
  enabled: boolean
  /** 已展示次数，上限 MAX_IMPORT_REMINDERS */
  timesShown: number
  snoozedUntil: number
  ignoredSources: ImportSourceId[]
}

export function snoozeDurationMs(timesShown: number): number {
  // 第 1 次点「稍后再说」后隔 3 天；第 2 次后隔 7 天
  if (timesShown >= 2) return 7 * DAY_MS
  return 3 * DAY_MS
}

export function canShowImportReminder(preferences: ImportReminderPreferences, now = Date.now()): boolean {
  return preferences.enabled &&
    preferences.timesShown < MAX_IMPORT_REMINDERS &&
    preferences.snoozedUntil <= now
}

export function remainingImportReminders(timesShown: number): number {
  return Math.max(0, MAX_IMPORT_REMINDERS - timesShown)
}

function readRaw(): Partial<ImportReminderPreferences> {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || '{}'
    return JSON.parse(raw) as Partial<ImportReminderPreferences>
  } catch {
    return {}
  }
}

export function loadImportReminderPreferences(): ImportReminderPreferences {
  const saved = readRaw()
  return {
    enabled: saved.enabled !== false,
    timesShown: typeof saved.timesShown === 'number'
      ? Math.min(MAX_IMPORT_REMINDERS, Math.max(0, saved.timesShown))
      : 0,
    snoozedUntil: typeof saved.snoozedUntil === 'number' ? saved.snoozedUntil : 0,
    ignoredSources: Array.isArray(saved.ignoredSources) ? saved.ignoredSources : []
  }
}

export function saveImportReminderPreferences(value: ImportReminderPreferences): void {
  localStorage.setItem(KEY, JSON.stringify(value))
}

/** 用户主动进入导入页后，不再弹出提醒 */
export function markImportReminderCompleted(): void {
  const preferences = loadImportReminderPreferences()
  saveImportReminderPreferences({ ...preferences, timesShown: MAX_IMPORT_REMINDERS })
}
