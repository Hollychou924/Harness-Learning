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
  const currentForProvider = current?.providerId === providerId ? current : null
  const isMify = preset.isMify === true
  const hasBuiltinKey = Boolean(preset.builtinApiKey)
  const hasSavedKey = Boolean(currentForProvider?.hasSavedApiKey)
  const inheritedConfigWasCleared = Boolean(
    current?.providerId === providerId &&
    current.apiKey === '' &&
    current.model &&
    !current.hasSavedApiKey
  )
  const [error, setError] = useState(
    inheritedConfigWasCleared ? '当前模型访问配置异常，已清空，请重新粘贴访问配置' : ''
  )

  const [customProviderId, setCustomProviderId] = useState(
    currentForProvider?.customProviderId || (isMify ? 'xiaomi' : '')
  )
  const mifyModels = isMify ? getMifyModelIds(customProviderId) : []
  const [model, setModel] = useState(
    currentForProvider?.model ||
    (isMify ? MIFY_GATEWAY_DEFAULT_MODEL_ID : preset.modelCandidates[0] || '')
  )
  // 页面不持有已保存的访问钥匙；留空表示继续使用后台已保存的钥匙。
  const [apiKey, setApiKey] = useState(currentForProvider?.apiKey || '')
  const [apiBaseUrl, setApiBaseUrl] = useState(currentForProvider?.apiBaseUrl || preset.baseUrl)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [useCustomKey, setUseCustomKey] = useState(false)

  const handleSave = () => {
    // 留空并且后台已有保存值时，交给后台沿用原来的访问钥匙；重新填写时以新输入为准。
    const reuseSavedKey = hasSavedKey && !apiKey.trim()
    const useBuiltInKey = (isMify || hasBuiltinKey) && !useCustomKey && !hasSavedKey
    const finalKey = reuseSavedKey
      ? ''
      : useBuiltInKey
        ? (preset.builtinApiKey || '')
        : apiKey.trim()
    if (!reuseSavedKey && /[\u0100-\uFFFF]/.test(finalKey)) {
      setError('模型访问配置里包含中文或特殊字符，请重新填写')
      return
    }
    if (!reuseSavedKey && /[\r\n\t]/.test(finalKey)) {
      setError('模型访问配置里包含换行，请重新填写')
      return
    }
    if (!model.trim()) return
    if (!reuseSavedKey && !finalKey.trim()) return
    setError('')
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
              className="w-full h-9 px-2 rounded-lg floating-subsurface text-sm outline-none"
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
              className="w-full h-9 px-2 rounded-lg floating-subsurface text-sm outline-none"
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
              className="w-full h-9 px-2 rounded-lg floating-subsurface text-sm outline-none"
            />
          )}
        </Field>

        {showKeyInput && (
          <Field label="API Key">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setError('') }}
              placeholder={hasSavedKey ? '已保存，留空则继续使用' : preset.keyPlaceholder}
              className="w-full h-9 px-2 rounded-lg floating-subsurface text-sm outline-none"
            />
            {hasSavedKey && !apiKey.trim() && (
              <p className="text-[11px] text-[var(--ink-soft)] mt-1">已保存访问钥匙；不重新填写就继续使用原值</p>
            )}
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
                  className="w-full h-9 px-2 rounded-lg floating-subsurface text-sm outline-none"
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
            disabled={!model.trim() || (showKeyInput && !apiKey.trim() && !hasSavedKey)}
            className="h-9 px-5 rounded-lg bg-[#0071e3] text-white text-sm font-medium hover:brightness-110 transition disabled:opacity-40"
          >
            使用此模型
          </button>
          {error && <span className="self-center text-xs text-red-500">{error}</span>}
          <button
            onClick={onCancel}
            className="h-9 px-4 rounded-lg floating-subsurface text-sm font-medium hover:brightness-105 transition"
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
