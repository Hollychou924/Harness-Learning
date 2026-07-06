import { useState, useEffect } from 'react'
import { ChevronDown, Check, Settings2, Trash2 } from 'lucide-react'
import { api, type ModelConfig } from '../api'
import { useSettingsStore } from './settings/settingsStore'
import { PROVIDER_PRESETS } from './providerPresets'
import { WhaleTooltip } from './WhaleTooltip'

interface StoredModel extends ModelConfig {
  _id?: string
}

function getModelLabel(cfg: ModelConfig): string {
  if (cfg.providerId === 'custom') return cfg.displayName || '自定义模型'
  return PROVIDER_PRESETS[cfg.providerId]?.label || cfg.providerId
}

export function ModelSelector() {
  const [configs, setConfigs] = useState<StoredModel[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const { openSettings, modelConfig: storeConfig } = useSettingsStore()

  const refresh = async () => {
    const store = await api.getModelList()
    setConfigs(store.configs)
    setActiveId(store.activeId)
  }

  useEffect(() => { refresh() }, [])
  useEffect(() => { if (storeConfig) refresh() }, [storeConfig])

  const active = configs.find((c) => c._id === activeId) || configs[0] || null
  const displayLabel = active
    ? `${getModelLabel(active)} / ${active.model}`
    : '未配置模型'

  const handleSwitch = async (modelId: string) => {
    setOpen(false)
    await api.setActiveModel(modelId)
    await refresh()
  }

  const handleDelete = async (e: React.MouseEvent, modelId: string) => {
    e.stopPropagation()
    await api.deleteModel(modelId)
    await refresh()
  }

  return (
    <div className="relative no-drag flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition px-2 py-1 rounded-lg hover:bg-black/[0.04]"
      >
        <WhaleTooltip label={displayLabel} className="min-w-0 max-w-[160px]">
          <span className="truncate">{displayLabel}</span>
        </WhaleTooltip>
        <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-80 floating-surface rounded-xl p-3 space-y-2">
            {active && (
              <div className="text-xs text-[var(--ink-soft)] px-1 pb-1">
                当前：{getModelLabel(active)}
                <span className="text-[var(--ink-soft)]/60"> · {active.model}</span>
              </div>
            )}
            <div className="space-y-0.5 max-h-60 overflow-y-auto">
              {configs.length === 0 && (
                <p className="text-xs text-amber-500 px-1 py-2">尚未配置模型，请前往设置添加</p>
              )}
              {configs.map((c) => {
                const isActive = c._id === activeId
                const label = getModelLabel(c)
                return (
                  <div
                    key={c._id}
                    onClick={() => handleSwitch(c._id!)}
                    className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer transition ${
                      isActive ? 'bg-sky-50 text-sky-600' : 'hover:bg-black/[0.04] text-[var(--ink)]'
                    }`}
                  >
                    <span className="flex-1 text-left truncate">
                      {label}
                      <span className="text-[var(--ink-soft)]/60 text-xs"> · {c.model}</span>
                    </span>
                    {isActive && <Check size={13} className="text-sky-500 flex-shrink-0" />}
                    {!isActive && (
                      <WhaleTooltip label="删除此模型配置">
                        <button
                          onClick={(e) => handleDelete(e, c._id!)}
                          className="opacity-0 group-hover:opacity-100 text-[var(--ink-soft)] hover:text-red-500 transition flex-shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </WhaleTooltip>
                    )}
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => { setOpen(false); openSettings('model') }}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-[#0071e3] hover:underline pt-2 border-t border-black/[0.06] mt-2"
            >
              <Settings2 size={12} /> 在设置中管理
            </button>
          </div>
        </>
      )}
    </div>
  )
}
