import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useSettingsStore, type SettingsTab } from './settingsStore'
import { ModelConfigSection } from './sections/ModelConfigSection'
import { GeneralSection } from './sections/GeneralSection'
import { AboutSection } from './sections/AboutSection'
import { DiagnosticsSection } from './sections/DiagnosticsSection'
import { ArchivedSection } from './sections/ArchivedSection'

const NAV_ITEMS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: '通用' },
  { id: 'model', label: '模型' },
  { id: 'archived', label: '已归档' },
  { id: 'diagnostics', label: '日志' },
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.08] flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)]">设置</h2>
          </div>
          <button
            onClick={closeSettings}
            className="no-drag w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:bg-black/[0.06] hover:text-[var(--ink)] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* 左导航 + 右内容 */}
        <div className="flex flex-1 min-h-0">
          {/* 左侧导航 */}
          <nav className="w-44 flex-shrink-0 border-r border-black/[0.08] overflow-y-auto py-3 px-2">
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${
                    activeTab === item.id
                      ? 'bg-[#0071e3] text-white font-medium shadow-sm shadow-blue-500/20'
                      : 'text-[var(--ink-soft)] hover:bg-black/[0.04] hover:text-[var(--ink)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          {/* 右侧内容区 */}
          <div className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
            {activeTab === 'model' && <ModelConfigSection />}
            {activeTab === 'general' && <GeneralSection />}
            {activeTab === 'about' && <AboutSection />}
            {activeTab === 'archived' && <ArchivedSection />}
            {activeTab === 'diagnostics' && <DiagnosticsSection />}
          </div>
        </div>
      </div>
    </div>
  )
}
