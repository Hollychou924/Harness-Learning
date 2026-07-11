import { useEffect, useRef, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useTaskStore } from './store/task'
import { Sidebar } from './components/Sidebar'
import { Workbench } from './components/Workbench'
import { RightPanel } from './components/RightPanel'
import { SettingsDialog } from './components/settings/SettingsDialog'
import { useSettingsStore } from './components/settings/settingsStore'
import { api } from './api'
import { ExternalImportReminder } from './components/ExternalImportReminder'

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const status = useTaskStore((s) => s.status)
  const themeMode = useSettingsStore((s) => s.themeMode)
  const preventSystemSleep = useSettingsStore((s) => s.preventSystemSleep)
  const loadGeneral = useSettingsStore((s) => s.loadGeneral)
  const mergeImportedData = useTaskStore((s) => s.mergeImportedData)
  const reconcileSessions = useTaskStore((s) => s.reconcileSessions)
  const startupSyncDone = useRef(false)
  const showRightToggle = status !== 'idle'

  useEffect(() => {
    loadGeneral()
  }, [loadGeneral])

  useEffect(() => {
    if (startupSyncDone.current) return
    startupSyncDone.current = true
    console.log('[renderer] App startup sync begin')
    void (async () => {
      try {
        const response = await api.getExternalImportHistory()
        console.log('[renderer] import history', { success: response.success, projects: response.catalog?.projects.length, sessions: response.catalog?.sessions.length })
        if (response.success && response.catalog) {
          mergeImportedData(response.catalog.projects, response.catalog.sessions)
        }
        await reconcileSessions()
        console.log('[renderer] startup reconcile light done')
      } catch (error) {
        console.error('[renderer] startup sync failed', error)
      }
      window.setTimeout(() => {
        void reconcileSessions({ full: true })
          .then(() => console.log('[renderer] startup reconcile full done'))
          .catch((error) => console.error('[renderer] startup reconcile full failed', error))
      }, 2500)
    })()
  }, [mergeImportedData, reconcileSessions])

  useEffect(() => {
    void api.setThemeMode(themeMode)
  }, [themeMode])

  useEffect(() => {
    void api.setPreventSleepEnabled(preventSystemSleep)
  }, [preventSystemSleep])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const effective = themeMode === 'system' ? (media.matches ? 'dark' : 'light') : themeMode
      document.documentElement.dataset.theme = effective
      document.documentElement.style.colorScheme = effective
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [themeMode])

  return (
    <div className="flex h-screen w-screen overflow-hidden relative">
      <Sidebar collapsed={sidebarCollapsed} />
      <main className="relative flex-1 flex flex-col min-w-0 min-h-0">
        <Workbench
          rightCollapsed={rightCollapsed}
          showRightToggle={showRightToggle}
          onToggleRight={() => setRightCollapsed((v) => !v)}
        />
      </main>
      <RightPanel
        collapsed={rightCollapsed}
        showToggle={showRightToggle && !rightCollapsed}
        onToggleRight={() => setRightCollapsed((v) => !v)}
      />
      <SettingsDialog />
      <ExternalImportReminder />

      <button
        title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
        onClick={() => setSidebarCollapsed((v) => !v)}
        className={`no-drag fixed left-[70px] top-[6px] z-[60] w-7 h-7 rounded-md flex items-center justify-center transition ${
          sidebarCollapsed
            ? 'bg-black/[0.06] text-[var(--ink)]'
            : 'text-[var(--ink-soft)] hover:bg-black/[0.06] hover:text-[var(--ink)]'
        }`}
      >
        {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>
    </div>
  )
}
