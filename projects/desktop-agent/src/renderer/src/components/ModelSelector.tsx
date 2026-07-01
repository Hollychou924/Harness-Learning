import { useState, useEffect } from 'react'
import { ChevronDown, Check, Settings2 } from 'lucide-react'
import { api, type ModelConfig } from '../api'
import { useSettingsStore } from './settings/settingsStore'
import { PROVIDER_PRESETS, BUILTIN_PROVIDER_ORDER } from './providerPresets'

export function ModelSelector() {
  const [config, setConfig] = useState<ModelConfig | null>(null)
  const [open, setOpen] = useState(false)
  const { openSettings, modelConfig: storeConfig } = useSettingsStore()

  useEffect(() => {
    api.configGet('modelConfig').then((c) => {
      if (c) setConfig(c as ModelConfig)
    })
  }, [])

  // 设置页保存后同步更新
  useEffect(() => {
    if (storeConfig) setConfig(storeConfig)
  }, [storeConfig])

  const displayLabel = config
    ? `${PROVIDER_PRESETS[config.providerId]?.label || config.providerId} / ${config.model}`
    : '未配置模型'

  const handlePickProvider = (id: string) => {
    setOpen(false)
    openSettings('model')
  }

  return (
    <div className="relative no-drag flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition px-2 py-1 rounded-lg hover:bg-black/[0.04]"
      >
        <span className="truncate max-w-[160px]" title={displayLabel}>{displayLabel}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-80 glass rounded-xl p-3 shadow-lg space-y-2">
            {config && (
              <div className="text-xs text-[var(--ink-soft)] px-1 pb-1">
                当前：{PROVIDER_PRESETS[config.providerId]?.label || config.providerId}
                <span className="text-[var(--ink-soft)]/60"> · {config.model}</span>
              </div>
            )}
            <div className="space-y-0.5 max-h-60 overflow-y-auto">
              {BUILTIN_PROVIDER_ORDER.map((id) => {
                const preset = PROVIDER_PRESETS[id]
                const isActive = config?.providerId === id
                return (
                  <button
                    key={id}
                    onClick={() => handlePickProvider(id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition ${
                      isActive ? 'bg-sky-50 text-sky-600' : 'hover:bg-black/[0.04] text-[var(--ink)]'
                    }`}
                  >
                    <span className="flex-1 text-left">{preset.label}</span>
                    {preset.builtinApiKey && <span className="text-[10px] text-green-500">内置Key</span>}
                    {isActive && <Check size={13} className="text-sky-500" />}
                  </button>
                )
              })}
            </div>
            {!config && (
              <p className="text-xs text-amber-500 px-1">尚未配置模型，请选择供应商并填写 API Key</p>
            )}
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
