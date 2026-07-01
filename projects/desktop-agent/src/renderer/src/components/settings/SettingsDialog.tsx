import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useSettingsStore, type SettingsTab } from './settingsStore'
import { ModelConfigSection } from './sections/ModelConfigSection'
import { GeneralSection } from './sections/GeneralSection'
import { MifySection } from './sections/MifySection'
import { PermissionsSection } from './sections/PermissionsSection'
import { AgentSection } from './sections/AgentSection'
import { AboutSection } from './sections/AboutSection'

interface NavGroup {
  group: string
  items: { id: SettingsTab; label: string }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: '核心',
    items: [
      { id: 'model', label: '模型配置' },
      { id: 'general', label: '通用设置' }
    ]
  },
  {
    group: '高级',
    items: [
      { id: 'mify', label: 'Mify 网关' },
      { id: 'permissions', label: '权限与审批' },
      { id: 'agent', label: 'Agent 行为' }
    ]
  },
  {
    group: '其他',
    items: [
      { id: 'about', label: '关于' }
    ]
  }
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
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      {/* 弹窗主体 */}
      <div
        className="relative flex flex-col w-[min(960px,92vw)] h-[min(680px,82vh)] glass rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/40 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)]">设置</h2>
            <p className="text-xs text-[var(--ink-soft)] mt-0.5">管理模型、权限和高级选项</p>
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
          <nav className="w-48 flex-shrink-0 border-r border-white/40 overflow-y-auto py-3 px-2 space-y-4">
            {NAV_GROUPS.map((g) => (
              <div key={g.group}>
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]/60">
                  {g.group}
                </div>
                <div className="space-y-0.5">
                  {g.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition ${
                        activeTab === item.id
                          ? 'bg-[#0071e3] text-white font-medium'
                          : 'text-[var(--ink-soft)] hover:bg-black/[0.04] hover:text-[var(--ink)]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* 右侧内容区 */}
          <div className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
            {activeTab === 'model' && <ModelConfigSection />}
            {activeTab === 'general' && <GeneralSection />}
            {activeTab === 'mify' && <MifySection />}
            {activeTab === 'permissions' && <PermissionsSection />}
            {activeTab === 'agent' && <AgentSection />}
            {activeTab === 'about' && <AboutSection />}
          </div>
        </div>
      </div>
    </div>
  )
}
