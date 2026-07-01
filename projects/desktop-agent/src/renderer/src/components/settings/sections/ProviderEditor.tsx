import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import {
  useSettingsStore,
  PROVIDER_PRESETS,
  getContextLimit,
  MIFY_PROVIDER_ID_CHIPS,
  MIFY_PROVIDER_MODELS,
  MIFY_GATEWAY_DEFAULT_MODEL_ID
} from '../settingsStore'
import type { ModelConfig } from '../../../api'

interface Props {
  providerId: string
  current: ModelConfig | null
  onSave: (cfg: ModelConfig) => void
  onCancel: () => void
}

export function ProviderEditor({ providerId, current, onSave, onCancel }: Props) {
  const preset = PROVIDER_PRESETS[providerId]
  const isMify = preset.isMify === true

  const [customProviderId, setCustomProviderId] = useState(
    current?.customProviderId || (isMify ? 'xiaomi' : '')
  )
  const mifyModels = isMify ? (MIFY_PROVIDER_MODELS[customProviderId] || []) : []
  const [model, setModel] = useState(
    current?.model ||
    (isMify ? MIFY_GATEWAY_DEFAULT_MODEL_ID : preset.modelCandidates[0] || '')
  )
  const [apiKey, setApiKey] = useState(current?.apiKey || preset.builtinApiKey || '')
  const [apiBaseUrl, setApiBaseUrl] = useState(current?.apiBaseUrl || preset.baseUrl)

  const handleSave = () => {
    if (!apiKey.trim() || !model.trim()) return
    onSave({
      providerId,
      model,
      apiKey: apiKey.trim(),
      apiBaseUrl: apiBaseUrl.trim(),
      apiFormat: preset.apiFormat,
      contextLimit: getContextLimit(providerId),
      ...(isMify ? { customProviderId } : {})
    })
  }

  const handleMifyProviderChange = (id: string) => {
    setCustomProviderId(id)
    const models = MIFY_PROVIDER_MODELS[id] || []
    if (models.length > 0 && !models.includes(model)) {
      setModel(models[0])
    }
  }

  return (
    <div>
      <button
        onClick={onCancel}
        className="flex items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition mb-4"
      >
        <ChevronLeft size={16} /> 返回供应商列表
      </button>

      <div className="space-y-4">
        <div>
          <h4 className="text-base font-semibold text-[var(--ink)]">{preset.label}</h4>
        </div>

        {isMify && (
          <Field label="路由供应商">
            <select
              value={customProviderId}
              onChange={(e) => handleMifyProviderChange(e.target.value)}
              className="w-full h-9 px-2 rounded-lg glass-soft text-sm outline-none"
            >
              {MIFY_PROVIDER_ID_CHIPS.map((chip) => (
                <option key={chip.id} value={chip.id}>{chip.label}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="模型">
          {isMify || preset.modelCandidates.length > 0 ? (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-9 px-2 rounded-lg glass-soft text-sm outline-none"
            >
              {(isMify ? mifyModels : preset.modelCandidates).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
              {!isMify && !preset.modelCandidates.includes(model) && model && (
                <option value={model}>{model}</option>
              )}
            </select>
          ) : (
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="输入模型 ID"
              className="w-full h-9 px-2 rounded-lg glass-soft text-sm outline-none"
            />
          )}
        </Field>

        <Field label="API Key">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={preset.keyPlaceholder}
            className="w-full h-9 px-2 rounded-lg glass-soft text-sm outline-none"
          />
          {preset.builtinApiKey && (
            <p className="text-[11px] text-green-500 mt-1">已预置内置 Key，可直接保存</p>
          )}
        </Field>

        <Field label="Base URL">
          <input
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="API Base URL"
            className="w-full h-9 px-2 rounded-lg glass-soft text-sm outline-none"
          />
        </Field>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || !model.trim()}
            className="h-9 px-5 rounded-lg bg-[#0071e3] text-white text-sm font-medium hover:brightness-110 transition disabled:opacity-40"
          >
            保存
          </button>
          <button
            onClick={onCancel}
            className="h-9 px-4 rounded-lg glass text-sm font-medium hover:brightness-105 transition"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wide text-[var(--ink-soft)] font-medium">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}
