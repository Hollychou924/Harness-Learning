import { useEffect, useMemo, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { api, type ModelConfig } from '../../../api'
import { useSettingsStore, PROVIDER_PRESETS, BUILTIN_PROVIDER_ORDER } from '../settingsStore'
import { ProviderEditor } from './ProviderEditor'

interface StoredModel extends ModelConfig {
  _id?: string
}

function getSelectionKey(cfg: StoredModel | ModelConfig): string {
  if (cfg.providerId === 'custom') return `custom:${cfg.customModelId || (cfg as StoredModel)._id || cfg.model || 'saved'}`
  return `provider:${cfg.providerId}`
}

function getConfigLabel(cfg: StoredModel | ModelConfig | null): string {
  if (!cfg) return ''
  if (cfg.providerId === 'custom') return cfg.displayName || '自定义模型'
  return PROVIDER_PRESETS[cfg.providerId]?.label || cfg.providerId
}

export function ModelConfigSection() {
  const { modelConfig, refreshModelConfig, saveModelConfig } = useSettingsStore()
  const [selectedKey, setSelectedKey] = useState(modelConfig ? getSelectionKey(modelConfig) : 'provider:deepseek')
  const [selectionTouched, setSelectionTouched] = useState(false)
  const [configs, setConfigs] = useState<StoredModel[]>([])
  const [activeModelId, setActiveModelId] = useState<string | null>(null)

  const loadConfiguredModels = async () => {
    const store = await api.getModelList()
    setConfigs(store.configs as StoredModel[])
    setActiveModelId(store.activeId)
  }

  useEffect(() => {
    void loadConfiguredModels()
  }, [])

  useEffect(() => {
    if (!selectionTouched && modelConfig?.providerId) setSelectedKey(getSelectionKey(modelConfig))
  }, [modelConfig, selectionTouched])

  const providerIds = useMemo(() => BUILTIN_PROVIDER_ORDER.filter((id) => id !== 'custom' && PROVIDER_PRESETS[id]), [])
  const customConfigs = useMemo(() => configs.filter((cfg) => cfg.providerId === 'custom'), [configs])
  const selectedProviderId = selectedKey.startsWith('custom:') ? 'custom' : selectedKey.replace(/^provider:/, '')
  const selectedPreset = PROVIDER_PRESETS[selectedProviderId] || PROVIDER_PRESETS.custom
  const activeConfig = configs.find((cfg) => cfg._id === activeModelId) || modelConfig
  const selectedCustomConfig = selectedKey.startsWith('custom:')
    ? customConfigs.find((cfg) => getSelectionKey(cfg) === selectedKey) || null
    : undefined
  const customDraftId = selectedKey.startsWith('custom:new-') ? selectedKey.slice('custom:'.length) : undefined

  const selectKey = (key: string) => {
    setSelectionTouched(true)
    setSelectedKey(key)
  }

  const handleAddCustom = () => {
    selectKey(`custom:new-${Date.now().toString(36)}`)
  }

  const handleSave = async (cfg: ModelConfig, opts?: { activate?: boolean }) => {
    await saveModelConfig(cfg, opts)
    await refreshModelConfig()
    await loadConfiguredModels()
    if (cfg.providerId === 'custom') setSelectedKey(getSelectionKey(cfg))
  }

  return (
    <section className="flex h-full min-h-[520px] flex-col">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--ink)]">模型</h3>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">左边选来源，右边直接填模型、连接地址和密钥；Mify 通过下拉框选模型。</p>
        </div>
        {activeConfig && (
          <div className="hidden rounded-2xl bg-sky-50 px-4 py-2 text-right text-xs text-sky-700 md:block">
            <div className="font-medium">当前使用</div>
            <div className="mt-0.5 max-w-[260px] truncate">
              {getConfigLabel(activeConfig)} / {activeConfig.model}
            </div>
          </div>
        )}
      </header>

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="floating-subsurface min-h-0 rounded-2xl p-3 lg:overflow-y-auto">
          <div className="mb-3 px-2 text-xs font-medium text-[var(--ink-soft)]">模型来源</div>
          <div className="space-y-1.5">
            {providerIds.map((id) => {
              const preset = PROVIDER_PRESETS[id]
              const key = `provider:${id}`
              const selected = selectedKey === key
              const providerConfigs = configs.filter((cfg) => cfg.providerId === id)
              const isActive = activeConfig?.providerId === id
              const hasConfigured = providerConfigs.length > 0 || isActive
              const firstModel = providerConfigs[0]?.model || (isActive ? activeConfig?.model : '')
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectKey(key)}
                  className={`group w-full rounded-xl border px-3 py-3 text-left transition ${selected ? 'border-[#0071e3] bg-sky-50 text-sky-700' : 'border-transparent hover:border-black/[0.06] hover:bg-black/[0.035]'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{preset.label}</span>
                    {isActive && <Check size={14} className="flex-shrink-0 text-[#0071e3]" />}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--ink-soft)]">
                    {isActive ? (
                      <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-green-600">当前使用</span>
                    ) : hasConfigured ? (
                      <span className="rounded-full bg-black/[0.05] px-1.5 py-0.5">已保存</span>
                    ) : (
                      <span>未配置</span>
                    )}
                    {firstModel && <span className="min-w-0 flex-1 truncate">{firstModel}</span>}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-4 border-t border-black/[0.06] pt-3">
            <div className="mb-2 px-2 text-xs font-medium text-[var(--ink-soft)]">自定义模型</div>
            <div className="space-y-1.5">
              {customConfigs.map((cfg) => {
                const key = getSelectionKey(cfg)
                const selected = selectedKey === key
                const isActive = activeModelId ? cfg._id === activeModelId : activeConfig?.providerId === 'custom' && activeConfig?.customModelId === cfg.customModelId
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectKey(key)}
                    className={`group w-full rounded-xl border px-3 py-3 text-left transition ${selected ? 'border-[#0071e3] bg-sky-50 text-sky-700' : 'border-transparent hover:border-black/[0.06] hover:bg-black/[0.035]'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{cfg.displayName || '自定义模型'}</span>
                      {isActive && <Check size={14} className="flex-shrink-0 text-[#0071e3]" />}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--ink-soft)]">
                      {isActive ? <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-green-600">当前使用</span> : <span className="rounded-full bg-black/[0.05] px-1.5 py-0.5">已保存</span>}
                      <span className="min-w-0 flex-1 truncate">{cfg.model}</span>
                    </div>
                  </button>
                )
              })}

              <button
                type="button"
                onClick={handleAddCustom}
                className={`group w-full rounded-xl border border-dashed px-3 py-3 text-left transition ${selectedKey.startsWith('custom:new-') ? 'border-[#0071e3] bg-sky-50 text-sky-700' : 'border-black/[0.12] text-[var(--ink-soft)] hover:border-black/[0.24] hover:bg-black/[0.035]'}`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Plus size={15} />
                  新增自定义模型
                </div>
                <div className="mt-1 text-[11px] text-[var(--ink-soft)]">添加新的供应商名称、连接地址和模型 ID。</div>
              </button>
            </div>
          </div>
        </aside>

        <main className="min-h-0 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/[0.48]">
          {selectedPreset ? (
            <ProviderEditor
              key={`${selectedKey}:${selectedCustomConfig?._id || customDraftId || ''}`}
              providerId={selectedProviderId}
              current={modelConfig}
              configuredModels={configs}
              editorConfig={selectedKey.startsWith('custom:') ? selectedCustomConfig : undefined}
              customDraftId={customDraftId}
              onSave={handleSave}
              onSaved={loadConfiguredModels}
            />
          ) : (
            <div className="p-5 text-sm text-[var(--ink-soft)]">请选择一个模型来源。</div>
          )}
        </main>
      </div>
    </section>
  )
}
