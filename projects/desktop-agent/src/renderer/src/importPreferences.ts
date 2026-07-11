import type { ImportSourceId } from './api'

const KEY = 'xld.externalImportReminder.v1'

export interface ImportReminderPreferences {
  enabled: boolean
  snoozedUntil: number
  ignoredSources: ImportSourceId[]
}

export function loadImportReminderPreferences(): ImportReminderPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<ImportReminderPreferences>
    return {
      enabled: saved.enabled !== false,
      snoozedUntil: typeof saved.snoozedUntil === 'number' ? saved.snoozedUntil : 0,
      ignoredSources: Array.isArray(saved.ignoredSources) ? saved.ignoredSources : []
    }
  } catch {
    return { enabled: true, snoozedUntil: 0, ignoredSources: [] }
  }
}

export function saveImportReminderPreferences(value: ImportReminderPreferences): void {
  localStorage.setItem(KEY, JSON.stringify(value))
}
