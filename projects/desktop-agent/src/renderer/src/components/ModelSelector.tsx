import { useState, useEffect } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'
import { api, type ModelConfig } from '../api'
import { PROVIDER_PRESETS, BUILTIN_PROVIDER_ORDER, getContextLimit } from './providerPresets'

export function ModelSelector() {
  const [config, setConfig] = useState<ModelConfig | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    api.configGet('modelConfig').then((c) => {
      if (c) setConfig(c as ModelConfig)
    })
  }, [])

  const displayLabel = config
    ? `${PROVIDER_PRESETS[config.providerId]?.label || config.providerId} / ${config.model}`
    : '未配置模型'

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
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setEditing(false) }} />
          <div className="absolute right-0 top-full mt-1 z-50 w-80 glass rounded-xl p-3 shadow-lg space-y-2">
            {editing ? (
              <ConfigEditor
                current={config}
                onSave={(cfg) => {
                  api.saveModelConfig(cfg).then(() => {
                    setConfig(cfg)
                    setEditing(false)
                  })
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <>
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
                        onClick={() => setEditing({ providerId: id } as ModelConfig)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition ${
                          isActive ? 'bg-sky-50 text-sky-600' : 'hover:bg-black/[0.04] text-[var(--ink)]'
                        }`}
                      >
                        <span className="flex-1 text-left">{preset.label}</span>
                        {isActive && <Check size={13} className="text-sky-500" />}
                      </button>
                    )
                  })}
                </div>
                {!config && (
                  <p className="text-xs text-amber-500 px-1">尚未配置模型，请选择供应商并填写 API Key</p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ConfigEditor({
  current,
  onSave,
  onCancel
}: {
  current: ModelConfig | null
  onSave: (cfg: ModelConfig) => void
  onCancel: () => void
}) {
  const providerId = (current?.providerId || 'anthropic') as string
  const preset = PROVIDER_PRESETS[providerId]
  const [model, setModel] = useState(current?.model || preset.modelCandidates[0] || '')
  const [apiKey, setApiKey] = useState(current?.apiKey || '')
  const [apiBaseUrl, setApiBaseUrl] = useState(current?.apiBaseUrl || preset.baseUrl)

  const handleSave = () => {
    if (!apiKey.trim()) return
    onSave({
      providerId,
      model,
      apiKey: apiKey.trim(),
      apiBaseUrl: apiBaseUrl.trim(),
      apiFormat: preset.apiFormat,
      contextLimit: getContextLimit(providerId)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--ink)]">{preset.label}</span>
        <button onClick={onCancel} className="ml-auto text-[var(--ink-soft)] hover:text-[var(--ink)]">
          <X size={14} />
        </button>
      </div>

      {preset.modelCandidates.length > 0 && (
        <div>
          <label className="text-[10px] uppercase tracking-wide text-[var(--ink-soft)]">模型</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full mt-0.5 h-8 px-2 rounded-lg glass-soft text-sm outline-none"
          >
            {preset.modelCandidates.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            {!preset.modelCandidates.includes(model) && model && (
              <option value={model}>{model}</option>
            )}
          </select>
        </div>
      )}

      {preset.modelCandidates.length === 0 && (
        <div>
          <label className="text-[10px] uppercase tracking-wide text-[var(--ink-soft)]">模型 ID</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="输入模型 ID"
            className="w-full mt-0.5 h-8 px-2 rounded-lg glass-soft text-sm outline-none"
          />
        </div>
      )}

      <div>
        <label className="text-[10px] uppercase tracking-wide text-[var(--ink-soft)]">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={preset.keyPlaceholder}
          className="w-full mt-0.5 h-8 px-2 rounded-lg glass-soft text-sm outline-none"
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wide text-[var(--ink-soft)]">Base URL</label>
        <input
          value={apiBaseUrl}
          onChange={(e) => setApiBaseUrl(e.target.value)}
          placeholder="API Base URL"
          className="w-full mt-0.5 h-8 px-2 rounded-lg glass-soft text-sm outline-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!apiKey.trim() || !model.trim()}
        className="w-full h-8 rounded-lg bg-[#0071e3] text-white text-sm font-medium hover:brightness-110 transition disabled:opacity-40"
      >
        保存
      </button>
    </div>
  )
}
