import { useEffect, useState } from 'react'
import { ArrowRight, Download, X } from 'lucide-react'
import { api, type ImportSourceId } from '../api'
import { loadImportReminderPreferences, saveImportReminderPreferences } from '../importPreferences'
import { useTaskStore } from '../store/task'
import { useSettingsStore } from './settings/settingsStore'

const TEN_MINUTES = 10 * 60 * 1000
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

export function ExternalImportReminder() {
  const status = useTaskStore((state) => state.status)
  const settingsOpen = useSettingsStore((state) => state.open)
  const openSettings = useSettingsStore((state) => state.openSettings)
  const [sources, setSources] = useState<Array<{ id: ImportSourceId; name: string }>>([])

  useEffect(() => {
    if (status !== 'idle' || settingsOpen) return
    const timer = window.setTimeout(async () => {
      const preferences = loadImportReminderPreferences()
      if (!preferences.enabled || preferences.snoozedUntil > Date.now()) return
      const response = await api.scanExternalImports()
      if (!response.success || !response.preview) return
      const available = response.preview.sources.filter((source) =>
        source.detected && source.compatibility !== 'unsupported' && source.pending > 0 && !preferences.ignoredSources.includes(source.id))
      setSources(available.map(({ id, name }) => ({ id, name })))
    }, 12_000)
    return () => window.clearTimeout(timer)
  }, [status, settingsOpen])

  if (sources.length === 0) return null

  const later = (delay: number) => {
    const preferences = loadImportReminderPreferences()
    saveImportReminderPreferences({ ...preferences, snoozedUntil: Date.now() + delay })
    setSources([])
  }

  const ignore = () => {
    const preferences = loadImportReminderPreferences()
    saveImportReminderPreferences({ ...preferences, ignoredSources: [...new Set([...preferences.ignoredSources, ...sources.map((source) => source.id)])] })
    setSources([])
  }

  return (
    <div className="fixed right-5 bottom-5 z-[70] w-[min(390px,calc(100vw-40px))] rounded-lg border border-black/[0.10] floating-surface p-4 shadow-xl">
      <button title="稍后提醒" onClick={() => later(TEN_MINUTES)} className="absolute right-2 top-2 w-7 h-7 rounded-md flex items-center justify-center text-[var(--ink-soft)] hover:bg-black/[0.06]"><X size={15} /></button>
      <div className="flex gap-3 pr-6">
        <span className="w-9 h-9 rounded-lg bg-blue-500/[0.10] text-[#0071e3] flex items-center justify-center flex-shrink-0"><Download size={18} /></span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--ink)]">发现可导入的新资料</div>
          <div className="text-xs text-[var(--ink-soft)] mt-1">{sources.map((source) => source.name).join('、')} 中有项目、对话或个性化资料可以迁移。</div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 justify-end">
        <button onClick={ignore} className="h-8 px-2 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]">不再提醒这些来源</button>
        <button onClick={() => later(SEVEN_DAYS)} className="h-8 px-2 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]">7 天后提醒</button>
        <button onClick={() => { setSources([]); openSettings('import') }} className="h-8 px-3 rounded-lg bg-[#0071e3] text-white text-xs font-medium flex items-center gap-1.5">查看并导入<ArrowRight size={13} /></button>
      </div>
    </div>
  )
}
