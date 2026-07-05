import { useState } from 'react'
import { PanelLeft, PanelRight } from 'lucide-react'
import { useTaskStore } from './store/task'
import { Sidebar } from './components/Sidebar'
import { Workbench } from './components/Workbench'
import { RightPanel } from './components/RightPanel'
import { SettingsDialog } from './components/settings/SettingsDialog'
import { WhaleTooltip } from './components/WhaleTooltip'

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const status = useTaskStore((s) => s.status)

  return (
    <div className="flex h-screen w-screen overflow-hidden relative">
      <Sidebar collapsed={sidebarCollapsed} />
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        <Workbench />
      </main>
      <RightPanel collapsed={rightCollapsed} />
      <SettingsDialog />

      {/* 左侧折叠按钮：绝对定位在窗口左上角，红绿灯右侧，位置始终固定 */}
      <WhaleTooltip label={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'} className="no-drag fixed left-[80px] top-[7px] z-[60]">
        <button
          onClick={() => setSidebarCollapsed((v) => !v)}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition ${
            sidebarCollapsed
              ? 'bg-black/[0.06] text-[var(--ink)]'
              : 'text-[var(--ink-soft)] hover:bg-black/[0.06] hover:text-[var(--ink)]'
          }`}
        >
          <PanelLeft size={15} />
        </button>
      </WhaleTooltip>

      {/* 右侧折叠按钮：右栏仅在有任务时渲染，idle（含打开历史对话）时无右栏，按钮一同隐藏，避免成为死按钮 */}
      {status !== 'idle' && (
        <WhaleTooltip label={rightCollapsed ? '展开右栏' : '折叠右栏'} className="no-drag fixed right-2 top-[7px] z-[60]">
          <button
            onClick={() => setRightCollapsed((v) => !v)}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition ${
              rightCollapsed
                ? 'bg-black/[0.06] text-[var(--ink)]'
                : 'text-[var(--ink-soft)] hover:bg-black/[0.06] hover:text-[var(--ink)]'
            }`}
          >
            <PanelRight size={15} />
          </button>
        </WhaleTooltip>
      )}
    </div>
  )
}
