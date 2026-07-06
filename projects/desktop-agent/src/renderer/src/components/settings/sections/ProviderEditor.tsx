import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, CircleX, Eye, EyeOff, Loader2, Settings, Zap } from 'lucide-react'
import { PROVIDER_PRESETS } from '../settingsStore'
import {
  getModelContextLimit,
  MIFY_MODEL_ROWS,
  MIFY_GATEWAY_DEFAULT_MODEL_ID,
  findMifyModelRow
} from '../../providerPresets'
import { api, type ModelConfig } from '../../../api'

interface Props {
  providerId: string
  current: (ModelConfig & { _id?: string }) | null
  configuredModels: Array<ModelConfig & { _id?: string }>
  editorConfig?: (ModelConfig & { _id?: string }) | null
  customDraftId?: string
  onSave: (cfg: ModelConfig, opts?: { activate?: boolean }) => Promise<void>
  onSaved?: () => void
}

type TestState = 'idle' | 'testing' | 'success' | 'fail'

export function ProviderEditor({ providerId, current, configuredModels, editorConfig, customDraftId, onSave, onSaved }: Props) {
  const preset = PROVIDER_PRESETS[providerId] || PROVIDER_PRESETS.custom
  const isMify = preset.isMify === true
  const isCustom = providerId === 'custom'
  const fallbackMifyRow = MIFY_MODEL_ROWS.find((row) => row.modelId === MIFY_GATEWAY_DEFAULT_MODEL_ID) || MIFY_MODEL_ROWS[0]

  const savedForProvider = useMemo(() => {
    if (editorConfig !== undefined) return null
    const matching = configuredModels.filter((cfg) => cfg.providerId === providerId)
    return matching.find((cfg) => current && cfg.model === current.model && cfg.customProviderId === current.customProviderId && cfg.customModelId === current.customModelId) || matching[0] || null
  }, [configuredModels, current, editorConfig, providerId])

  const currentForProvider = editorConfig !== undefined
    ? editorConfig
    : current?.providerId === providerId ? current : savedForProvider
  const initialMifyRow = isMify
    ? findMifyModelRow(currentForProvider?.customProviderId, currentForProvider?.model || '')
    : undefined
  const initialCustomProviderId = currentForProvider?.customProviderId || initialMifyRow?.providerId || fallbackMifyRow?.providerId || 'xiaomi'
  const initialModel = currentForProvider?.model || initialMifyRow?.modelId || (isMify ? (fallbackMifyRow?.modelId || MIFY_GATEWAY_DEFAULT_MODEL_ID) : preset.modelCandidates[0] || '')
  const inheritedCustomModelId = currentForProvider?.customModelId || currentForProvider?._id || customDraftId

  const [customProviderId, setCustomProviderId] = useState(initialCustomProviderId)
  const [customModelId] = useState(inheritedCustomModelId || `custom-${Date.now().toString(36)}`)
  const [displayName, setDisplayName] = useState(currentForProvider?.displayName || (isCustom ? '我的自定义模型' : preset.label))
  const [model, setModel] = useState(initialModel)
  const [apiKey, setApiKey] = useState(currentForProvider?.apiKey || '')
  const [apiBaseUrl, setApiBaseUrl] = useState(currentForProvider?.apiBaseUrl || preset.baseUrl)
  const [contextLimit, setContextLimit] = useState(
    isCustom
      ? currentForProvider?.contextLimit || getModelContextLimit(providerId, initialModel, initialCustomProviderId)
      : getModelContextLimit(providerId, initialModel, initialCustomProviderId)
  )
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [useCustomKey, setUseCustomKey] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [toast, setToast] = useState('')
  const [testState, setTestState] = useState<TestState>('idle')
  const [testMessage, setTestMessage] = useState('')
  const toastTimer = useRef<number | null>(null)

  const hasBuiltinKey = Boolean(preset.builtinApiKey)
  const hasSavedKey = Boolean(currentForProvider?.hasSavedApiKey)
  const showKeyInput = !hasBuiltinKey || useCustomKey
  const selectedMifyRow = isMify ? findMifyModelRow(customProviderId, model) : undefined
  const modelCandidates = preset.modelCandidates
  const titleLabel = isCustom ? (displayName.trim() || preset.label) : preset.label
  const isCurrentProvider = (() => {
    if (!current || current.providerId !== providerId || current.model !== model) return false
    if (isMify) return (current.customProviderId || '') === customProviderId
    if (isCustom) return (current.customModelId || current._id || '') === customModelId
    return true
  })()

  const mifyGroups = useMemo(() => {
    const groups: Array<{ label: string; rows: typeof MIFY_MODEL_ROWS }> = []
    for (const row of MIFY_MODEL_ROWS) {
      let group = groups.find((item) => item.label === row.groupLabel)
      if (!group) {
        group = { label: row.groupLabel, rows: [] }
        groups.push(group)
      }
      group.rows.push(row)
    }
    return groups
  }, [])

  const resetFeedback = () => {
    setNotice('')
    setTestState('idle')
    setTestMessage('')
  }

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2200)
  }

  const buildConfig = (): ModelConfig | null => {
    const reuseSavedKey = hasSavedKey && !apiKey.trim()
    const useBuiltInKey = hasBuiltinKey && !useCustomKey && !hasSavedKey
    const finalKey = reuseSavedKey ? '' : useBuiltInKey ? (preset.builtinApiKey || '') : apiKey.trim()
    if (isCustom && !displayName.trim()) {
      setError('请先填写供应商名称')
      return null
    }
    if (!model.trim()) {
      setError('请先选择或填写模型 ID')
      return null
    }
    if (!apiBaseUrl.trim()) {
      setError('请先填写连接地址')
      return null
    }
    if (!reuseSavedKey && !finalKey.trim()) {
      setError(isMify ? '请先填写你的 Mify 密钥' : '请先填写访问密钥')
      return null
    }
    if (!reuseSavedKey && /[\u0100-\uFFFF]/.test(finalKey)) {
      setError('访问密钥里包含中文或特殊字符，请重新填写')
      return null
    }
    if (!reuseSavedKey && /[\r\n\t]/.test(finalKey)) {
      setError('访问密钥里包含换行，请重新填写')
      return null
    }
    setError('')
    return {
      providerId,
      model: model.trim(),
      apiKey: finalKey,
      apiBaseUrl: apiBaseUrl.trim(),
      apiFormat: preset.apiFormat,
      contextLimit: Number(contextLimit) || getModelContextLimit(providerId, model, customProviderId),
      ...(isMify ? { customProviderId } : {}),
      ...(isCustom ? { customModelId, displayName: displayName.trim() } : {})
    }
  }

  const handleSave = async (activate: boolean) => {
    const cfg = buildConfig()
    if (!cfg) return
    try {
      await onSave(cfg, { activate })
      const message = activate ? '已保存，并切换为当前使用' : '已保存'
      setNotice(message)
      showToast(message)
      setError('')
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败，请重试')
    }
  }

  const handleTest = async () => {
    const cfg = buildConfig()
    if (!cfg) return
    setTestState('testing')
    setTestMessage('')
    try {
      const result = await api.testModelConfig(cfg)
      setTestState(result.success ? 'success' : 'fail')
      setTestMessage(result.message || result.error || (result.success ? '连接成功' : '连接失败'))
    } catch (e) {
      setTestState('fail')
      setTestMessage(e instanceof Error ? e.message : '连接失败，请检查配置')
    }
  }

  const handleMifyModelPick = (value: string) => {
    const [provider, nextModel] = value.split('::')
    setCustomProviderId(provider)
    setModel(nextModel)
    setContextLimit(getModelContextLimit('mify', nextModel, provider))
    resetFeedback()
  }

  const handleModelPick = (nextModel: string) => {
    setModel(nextModel)
    if (!isCustom) setContextLimit(getModelContextLimit(providerId, nextModel))
    resetFeedback()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div className="floating-subsurface rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-semibold text-[var(--ink)]">{titleLabel}</h4>
                {isCurrentProvider && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-600">当前使用</span>}
                {hasSavedKey && !isCurrentProvider && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">已保存</span>}
              </div>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">
                {isMify ? '选择模型、填写连接地址和你的 Mify 密钥，保存后即可使用。' : isCustom ? '给这组配置起一个供应商名称，后续可继续新增更多自定义模型。' : '填写模型、连接地址和访问密钥，保存后可在输入框旁快速切换。'}
              </p>
            </div>
            {hasBuiltinKey && !useCustomKey && (
              <button type="button" onClick={() => setUseCustomKey(true)} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
                改用自己的密钥
              </button>
            )}
          </div>
        </div>

        {isCustom && (
          <Field label="供应商名称">
            <input
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); resetFeedback() }}
              placeholder="例如：公司内网模型、我的中转服务"
              className="w-full h-10 rounded-xl floating-subsurface px-3 text-sm outline-none"
            />
          </Field>
        )}

        {isMify ? (
          <div className="space-y-3">
            <Field label="选择模型">
              <select
                value={`${customProviderId}::${model}`}
                onChange={(e) => handleMifyModelPick(e.target.value)}
                className="w-full h-11 rounded-xl floating-subsurface px-3 text-sm outline-none"
              >
                {!selectedMifyRow && model && <option value={`${customProviderId}::${model}`}>{model} · 已保存配置</option>}
                {mifyGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.rows.map((row) => (
                      <option key={`${row.providerId}-${row.modelId}`} value={`${row.providerId}::${row.modelId}`}>
                        {row.modelId} · {row.providerLabel} · {formatContextLimit(row.contextLimit)}{row.supportsVision ? '' : ' · 不支持图片'}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            {selectedMifyRow && (
              <div className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700">
                当前会通过 {selectedMifyRow.providerLabel} 调用 {selectedMifyRow.modelId}，上下文长度 {formatContextLimit(contextLimit)}。
              </div>
            )}
          </div>
        ) : (
          <Field label="模型 ID">
            <input
              value={model}
              onChange={(e) => handleModelPick(e.target.value)}
              placeholder={modelCandidates[0] || '输入模型 ID'}
              className="w-full h-10 rounded-xl floating-subsurface px-3 text-sm outline-none"
            />
            {modelCandidates.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {modelCandidates.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleModelPick(id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs transition ${model === id ? 'border-[#0071e3] bg-sky-50 text-[#0071e3]' : 'border-black/[0.06] text-[var(--ink-soft)] hover:bg-black/[0.04]'}`}
                  >
                    {id}
                  </button>
                ))}
              </div>
            )}
            {!isCustom && <p className="mt-1.5 text-[11px] text-[var(--ink-soft)]">已按当前模型设为 {formatContextLimit(contextLimit)} 上下文。</p>}
          </Field>
        )}

        <Field label="连接地址">
          <input
            value={apiBaseUrl}
            onChange={(e) => { setApiBaseUrl(e.target.value); resetFeedback() }}
            placeholder={preset.baseUrl || 'https://api.example.com/v1'}
            className="w-full h-10 rounded-xl floating-subsurface px-3 text-sm outline-none"
          />
          <p className="mt-1 text-[11px] text-[var(--ink-soft)]">一般只需要填模型 ID、连接地址和访问密钥；调用格式默认处理，不需要你额外选择。</p>
        </Field>

        {showKeyInput ? (
          <Field label={isMify ? 'Mify 密钥' : '访问密钥'}>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setError(''); resetFeedback() }}
                placeholder={hasSavedKey ? '已保存，留空则继续使用' : preset.keyPlaceholder}
                className="w-full h-10 rounded-xl floating-subsurface px-3 pr-10 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--ink-soft)] hover:bg-black/[0.05]"
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {hasSavedKey && !apiKey.trim() && <p className="mt-1 text-[11px] text-[var(--ink-soft)]">不重新填写就继续使用已保存的密钥。</p>}
            {isMify && <p className="mt-1 text-[11px] text-[var(--ink-soft)]">请填写你自己的 Mify 密钥。</p>}
          </Field>
        ) : (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            当前无需填写密钥。<button type="button" onClick={() => setUseCustomKey(true)} className="ml-1 font-medium underline">改用自己的密钥</button>
          </div>
        )}

        <div className="border-t border-black/[0.06] pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
          >
            <Settings size={12} /> 高级设置
            <ChevronDown size={12} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-3 rounded-xl bg-black/[0.025] p-3">
              <Field label="上下文长度">
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={contextLimit}
                  onChange={(e) => setContextLimit(Number(e.target.value) || getModelContextLimit(providerId, model, customProviderId))}
                  className="w-full h-9 rounded-lg floating-subsurface px-3 text-sm outline-none"
                />
              </Field>
              <p className="text-[11px] text-[var(--ink-soft)]">切换内置模型时会自动更新；只有接入特殊模型时才需要手动改。</p>
            </div>
          )}
        </div>

      </div>

      <div className="shrink-0 border-t border-black/[0.06] bg-white/80 px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testState === 'testing'}
            className="h-10 flex-1 min-w-[120px] rounded-xl bg-orange-500 px-4 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-50"
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              {testState === 'testing' ? <Loader2 size={14} className="animate-spin" /> : testState === 'success' ? <CheckCircle2 size={14} /> : testState === 'fail' ? <CircleX size={14} /> : <Zap size={14} />}
              {testState === 'testing' ? '测试中...' : testState === 'success' ? '连接成功' : testState === 'fail' ? '重新测试' : '测试连接'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            className="h-10 flex-1 min-w-[112px] rounded-xl floating-subsurface px-4 text-sm font-medium transition hover:brightness-105"
          >
            保存
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            className="h-10 flex-[1.4] min-w-[132px] rounded-xl bg-[#0071e3] px-4 text-sm font-medium text-white transition hover:brightness-110"
          >
            保存并使用
          </button>
        </div>
        {(error || notice || testMessage) && (
          <div className={`mt-2 rounded-xl px-3 py-2 text-xs ${error || testState === 'fail' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {error || testMessage || notice}
          </div>
        )}
      </div>
      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-full floating-toast px-3 py-1.5 text-xs text-white">
          {toast}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-soft)]">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function formatContextLimit(value: number): string {
  if (value === 1_048_576) return '1M'
  if (value === 262_144) return '256K'
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(2))}M`
  if (value >= 1000) return `${Math.round(value / 1000)}K`
  return String(value)
}
