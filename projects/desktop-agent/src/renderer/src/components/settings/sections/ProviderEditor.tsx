import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, CircleX, Eye, EyeOff, Loader2, Zap } from 'lucide-react'
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
  const [apiFormat, setApiFormat] = useState<'openai' | 'anthropic'>(
    (currentForProvider?.apiFormat as 'openai' | 'anthropic' | undefined) || preset.apiFormat
  )
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
      setError('请先填写名称')
      return null
    }
    if (!model.trim()) {
      setError('请先选择或填写模型')
      return null
    }
    if (!apiBaseUrl.trim()) {
      setError('请先填写连接地址')
      return null
    }
    if (!reuseSavedKey && !finalKey.trim()) {
      setError(isMify ? '请先填写 Mify 密钥' : '请先填写访问密钥')
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
      apiFormat: isCustom ? apiFormat : preset.apiFormat,
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
      const message = activate ? '已设为当前模型' : '已保存'
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
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {/* 标题 */}
        <div className="mb-5 flex items-center gap-2.5">
          <h4 className="text-[17px] font-semibold tracking-tight text-[var(--ink)]">{titleLabel}</h4>
          {isCurrentProvider && (
            <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
              当前使用
            </span>
          )}
        </div>

        <div className="space-y-5">
          {/* 自定义：名称 + 协议 */}
          {isCustom && (
            <SettingsGroup
              footer={
                apiFormat === 'openai'
                  ? 'OpenAI 兼容：适用于多数中转、Ollama 等本地服务。'
                  : 'Anthropic 兼容：适用于 Claude 官方及兼容端点。'
              }
            >
              <SettingsRow label="名称">
                <input
                  value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); resetFeedback() }}
                  placeholder="例如：公司内网、我的中转"
                  className={rowInputClass}
                />
              </SettingsRow>
              <SettingsRow label="协议" last>
                <div className="flex justify-end">
                  <Segmented
                    value={apiFormat}
                    options={[
                      { id: 'openai', label: 'OpenAI' },
                      { id: 'anthropic', label: 'Anthropic' }
                    ]}
                    onChange={(v) => { setApiFormat(v); resetFeedback() }}
                  />
                </div>
              </SettingsRow>
            </SettingsGroup>
          )}

          {/* 模型 */}
          <SettingsGroup
            footer={
              isMify && selectedMifyRow
                ? `通过 ${selectedMifyRow.providerLabel} 调用 · 上下文 ${formatContextLimit(contextLimit)}${selectedMifyRow.supportsVision ? '' : ' · 不支持图片'}`
                : !isCustom && !isMify
                  ? `上下文 ${formatContextLimit(contextLimit)}，可在下方高级设置中修改`
                  : undefined
            }
          >
            {isMify ? (
              <SettingsRow label="模型" last stacked>
                <select
                  value={`${customProviderId}::${model}`}
                  onChange={(e) => handleMifyModelPick(e.target.value)}
                  className={`${rowInputClass} h-9`}
                >
                  {!selectedMifyRow && model && (
                    <option value={`${customProviderId}::${model}`}>{model} · 已保存</option>
                  )}
                  {mifyGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.rows.map((row) => (
                        <option key={`${row.providerId}-${row.modelId}`} value={`${row.providerId}::${row.modelId}`}>
                          {row.modelId} · {row.providerLabel} · {formatContextLimit(row.contextLimit)}
                          {row.supportsVision ? '' : ' · 无图片'}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </SettingsRow>
            ) : (
              <SettingsRow label="模型" last stacked>
                <input
                  value={model}
                  onChange={(e) => handleModelPick(e.target.value)}
                  placeholder={modelCandidates[0] || '输入模型名称'}
                  className={rowInputClass}
                />
                {modelCandidates.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {modelCandidates.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleModelPick(id)}
                        className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                          model === id
                            ? 'bg-[var(--whale-blue)] text-white'
                            : 'bg-[var(--settings-input-bg)] text-[var(--ink-soft)] hover:bg-[var(--control-hover)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                )}
              </SettingsRow>
            )}
          </SettingsGroup>

          {/* 连接 */}
          <SettingsGroup
            footer={
              hasBuiltinKey && !useCustomKey
                ? '已内置密钥，可直接使用。'
                : hasSavedKey && !apiKey.trim()
                  ? '密钥已保存，留空即可继续使用。'
                  : isMify
                    ? '填写你自己的 Mify 密钥。'
                    : undefined
            }
          >
            <SettingsRow label="地址">
              <input
                value={apiBaseUrl}
                onChange={(e) => { setApiBaseUrl(e.target.value); resetFeedback() }}
                placeholder={preset.baseUrl || 'https://api.example.com/v1'}
                className={rowInputClass}
              />
            </SettingsRow>
            {showKeyInput ? (
              <SettingsRow label={isMify ? '密钥' : '密钥'} last>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setError(''); resetFeedback() }}
                    placeholder={hasSavedKey ? '已保存，留空继续使用' : preset.keyPlaceholder}
                    className={`${rowInputClass} pr-9`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--ink-soft)] hover:bg-black/[0.05]"
                    aria-label={showKey ? '隐藏密钥' : '显示密钥'}
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </SettingsRow>
            ) : (
              <SettingsRow label="密钥" last>
                <div className="flex items-center justify-end gap-2 text-[13px]">
                  <span className="text-emerald-600">无需填写</span>
                  <button
                    type="button"
                    onClick={() => setUseCustomKey(true)}
                    className="font-medium text-[var(--whale-blue)] hover:underline"
                  >
                    改用自己的
                  </button>
                </div>
              </SettingsRow>
            )}
          </SettingsGroup>

          {/* 高级 */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-[13px] text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
            >
              <span>高级设置</span>
              <ChevronDown size={14} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
            {showAdvanced && (
              <div className="mt-2">
                <SettingsGroup footer="切换推荐模型时会自动更新；只有特殊模型才需要手动改。">
                  <SettingsRow label="上下文" last>
                    <input
                      type="number"
                      min={1000}
                      step={1000}
                      value={contextLimit}
                      onChange={(e) => setContextLimit(Number(e.target.value) || getModelContextLimit(providerId, model, customProviderId))}
                      className={`${rowInputClass} text-right tabular-nums`}
                    />
                  </SettingsRow>
                </SettingsGroup>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部操作：主操作清晰，测试弱化 */}
      <div className="shrink-0 border-t border-[var(--settings-sep)] px-6 py-3.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testState === 'testing'}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-[var(--ink-soft)] transition hover:bg-[var(--settings-row-hover)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            {testState === 'testing' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : testState === 'success' ? (
              <CheckCircle2 size={14} className="text-emerald-500" />
            ) : testState === 'fail' ? (
              <CircleX size={14} className="text-red-500" />
            ) : (
              <Zap size={14} />
            )}
            {testState === 'testing' ? '测试中' : testState === 'success' ? '已连通' : testState === 'fail' ? '重试' : '测试'}
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => handleSave(false)}
            className="h-9 rounded-lg px-3.5 text-[13px] font-medium text-[var(--ink)] transition hover:bg-[var(--settings-row-hover)]"
          >
            仅保存
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            className="h-9 rounded-lg bg-[var(--whale-blue)] px-4 text-[13px] font-semibold text-white transition hover:brightness-110"
          >
            保存并使用
          </button>
        </div>

        {(error || notice || testMessage) && (
          <p
            className={`mt-2.5 text-[12px] leading-snug ${
              error || testState === 'fail' ? 'text-red-500' : 'text-emerald-600'
            }`}
          >
            {error || testMessage || notice}
          </p>
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

const rowInputClass =
  'w-full h-8 rounded-lg bg-transparent px-0 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)]/55'

function SettingsGroup({ children, footer }: { children: React.ReactNode; footer?: string }) {
  return (
    <div>
      <div className="overflow-hidden rounded-xl bg-[var(--settings-group-bg)]">{children}</div>
      {footer && <p className="mt-1.5 px-1 text-[11px] leading-relaxed text-[var(--ink-soft)]">{footer}</p>}
    </div>
  )
}

function SettingsRow({
  label,
  children,
  last,
  stacked
}: {
  label: string
  children: React.ReactNode
  last?: boolean
  stacked?: boolean
}) {
  if (stacked) {
    return (
      <div className={`px-3.5 py-2.5 ${last ? '' : 'border-b border-[var(--settings-sep)]'}`}>
        <div className="mb-1.5 text-[13px] text-[var(--ink-soft)]">{label}</div>
        {children}
      </div>
    )
  }

  return (
    <div
      className={`grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 px-3.5 py-2 ${
        last ? '' : 'border-b border-[var(--settings-sep)]'
      }`}
    >
      <div className="text-[13px] text-[var(--ink)]">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: Array<{ id: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg bg-[var(--settings-segment-bg)] p-0.5">
      {options.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`h-7 rounded-md px-2.5 text-[12px] transition ${
              active
                ? 'bg-[var(--settings-segment-thumb)] text-[var(--ink)] font-medium shadow-sm'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
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
