import { useState } from 'react'
import { ChevronLeft, ChevronDown, Settings } from 'lucide-react'
import {
  useSettingsStore,
  PROVIDER_PRESETS,
  getContextLimit,
  MIFY_PROVIDER_ID_CHIPS,
  MIFY_GATEWAY_DEFAULT_MODEL_ID,
  getMifyModelIds
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
  const hasBuiltinKey = Boolean(preset.builtinApiKey)

  const [customProviderId, setCustomProviderId] = useState(
    current?.customProviderId || (isMify ? 'xiaomi' : '')
  )
  const mifyModels = isMify ? getMifyModelIds(customProviderId) : []
  const [model, setModel] = useState(
    current?.model ||
    (isMify ? MIFY_GATEWAY_DEFAULT_MODEL_ID : preset.modelCandidates[0] || '')
  )
  // mify 或内置 Key 厂商：不要求用户填 Key，用预置值
  const [apiKey, setApiKey] = useState(current?.apiKey || preset.builtinApiKey || '')
  const [apiBaseUrl, setApiBaseUrl] = useState(current?.apiBaseUrl || preset.baseUrl)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [useCustomKey, setUseCustomKey] = useState(false)

  const handleSave = () => {
    // mify/内置Key：没填自定义 Key 时用预置值
    const finalKey = (isMify || hasBuiltinKey) && !useCustomKey
      ? (preset.builtinApiKey || '')
      : apiKey.trim()
    if (!finalKey.trim() || !model.trim()) return
    onSave({
      providerId,
      model,
      apiKey: finalKey,
      apiBaseUrl: apiBaseUrl.trim(),
      apiFormat: preset.apiFormat,
      contextLimit: getContextLimit(providerId),
      ...(isMify ? { customProviderId } : {})
    })
  }

  const handleMifyProviderChange = (id: string) => {
    setCustomProviderId(id)
    const models = getMifyModelIds(id)
    if (models.length > 0 && !models.includes(model)) {
      setModel(models[0])
    }
  }

  // 是否需要显示 API Key 输入框：mify 和内置 Key 厂商默认不显示，除非用户选"使用自定义 Key"
  const showKeyInput = !isMify && !hasBuiltinKey || useCustomKey

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
          {(isMify || hasBuiltinKey) && (
            <p className="text-xs text-green-500 mt-0.5">
              {isMify ? '内置 Key 免配置，选模型即用' : '已预置内置 Key，可直接保存'}
            </p>
          )}
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

        {showKeyInput && (
          <Field label="API Key">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={preset.keyPlaceholder}
              className="w-full h-9 px-2 rounded-lg glass-soft text-sm outline-none"
            />
          </Field>
        )}

        {/* 内置 Key 厂商：提供"使用自定义 Key"选项 */}
        {(isMify || hasBuiltinKey) && !useCustomKey && (
          <button
            onClick={() => setUseCustomKey(true)}
            className="text-xs text-[#0071e3] hover:underline"
          >
            使用自定义 Key
          </button>
        )}

        {/* 高级设置：BaseURL + 思考开关，默认折叠 */}
        <div className="border-t border-black/[0.06] pt-3">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition"
          >
            <Settings size={12} />
            高级设置
            <ChevronDown size={12} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-4">
              <Field label="Base URL">
                <input
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="API Base URL"
                  className="w-full h-9 px-2 rounded-lg glass-soft text-sm outline-none"
                />
                <p className="text-[11px] text-[var(--ink-soft)] mt-1">已自动预填，通常无需修改</p>
              </Field>
              <div className="text-[11px] text-[var(--ink-soft)]">
                思考能力：模型支持时自动开启，无需手动配置
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={!model.trim() || (showKeyInput && !apiKey.trim())}
            className="h-9 px-5 rounded-lg bg-[#0071e3] text-white text-sm font-medium hover:brightness-110 transition disabled:opacity-40"
          >
            使用此模型
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
