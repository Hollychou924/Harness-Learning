import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useTaskStore } from './store/task'
import { Sidebar } from './components/Sidebar'
import { Workbench } from './components/Workbench'
import { RightPanel } from './components/RightPanel'
import { SettingsDialog } from './components/settings/SettingsDialog'

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const status = useTaskStore((s) => s.status)
  const showRightToggle = status !== 'idle'

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
