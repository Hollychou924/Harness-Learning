import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useSettingsStore, type SettingsTab } from './settingsStore'
import { ModelConfigSection } from './sections/ModelConfigSection'
import { GeneralSection } from './sections/GeneralSection'
import { AboutSection } from './sections/AboutSection'
import { DiagnosticsSection } from './sections/DiagnosticsSection'
import { ArchivedSection } from './sections/ArchivedSection'
import { ImportSection } from './sections/ImportSection'
import { EvolutionSection } from './sections/EvolutionSection'

const NAV_ITEMS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: '通用' },
  { id: 'model', label: '模型' },
  { id: 'archived', label: '已归档' },
  { id: 'import', label: '导入' },
  { id: 'evolution', label: '进化' },
  { id: 'diagnostics', label: '反馈' },
  { id: 'about', label: '关于' }
]

export function SettingsDialog() {
  const { open, activeTab, closeSettings, setActiveTab } = useSettingsStore()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeSettings])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeSettings}>
      {/* 遮罩 */}
      <div className="absolute inset-0 floating-screen" />

      {/* 弹窗主体 */}
      <div
        className="relative flex flex-col w-[min(960px,92vw)] h-[min(680px,82vh)] floating-surface rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--settings-sep)] flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">设置</h2>
          </div>
          <button
            onClick={closeSettings}
            className="no-drag w-8 h-8 rounded-full flex items-center justify-center text-[var(--ink-soft)] hover:bg-[var(--settings-row-hover)] hover:text-[var(--ink)] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* 左导航 + 右内容 */}
        <div className="flex flex-1 min-h-0">
          {/* 左侧导航 */}
          <nav className="w-[168px] flex-shrink-0 border-r border-[var(--settings-sep)] overflow-y-auto py-3 px-2 bg-[var(--settings-sidebar-bg)]">
            <div className="space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-[10px] text-[13px] transition ${
                    activeTab === item.id
                      ? 'bg-[var(--settings-nav-active-bg)] text-[var(--settings-nav-active-fg)] font-medium'
                      : 'text-[var(--ink-soft)] hover:bg-[var(--settings-row-hover)] hover:text-[var(--ink)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          {/* 右侧内容区；导入页常挂载以便打开设置时预加载，切 tab 不重复扫描 */}
          <div
            className={`relative flex-1 min-w-0 min-h-0 ${
              activeTab === 'model' ? 'overflow-hidden p-0' : 'overflow-y-auto px-8 py-6'
            }`}
          >
            {activeTab === 'model' && <ModelConfigSection />}
            {activeTab === 'general' && <GeneralSection />}
            {activeTab === 'about' && <AboutSection />}
            {activeTab === 'archived' && <ArchivedSection />}
            <div className={activeTab === 'import' ? 'relative h-full min-h-full' : 'hidden'}>
              <ImportSection />
            </div>
            {activeTab === 'diagnostics' && <DiagnosticsSection />}
            {activeTab === 'evolution' && <EvolutionSection />}
          </div>
        </div>
      </div>
    </div>
  )
}
