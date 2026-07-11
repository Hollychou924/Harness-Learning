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
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex flex-1 min-h-0">
        {/* 左侧：Apple 风格来源列表 */}
        <aside className="flex w-[240px] flex-shrink-0 flex-col border-r border-[var(--settings-sep)] bg-[var(--settings-sidebar-bg)]">
          <div className="px-4 pt-5 pb-3">
            <h3 className="text-[15px] font-semibold text-[var(--ink)] tracking-tight">模型</h3>
            {activeConfig ? (
              <p className="mt-1 text-[11px] text-[var(--ink-soft)] leading-relaxed truncate">
                正在使用 {getConfigLabel(activeConfig)}
                {activeConfig.model ? ` · ${activeConfig.model}` : ''}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-[var(--ink-soft)]">选择服务商并完成配置</p>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-4">
            <ListSection title="服务商">
              {providerIds.map((id) => {
                const preset = PROVIDER_PRESETS[id]
                const key = `provider:${id}`
                const selected = selectedKey === key
                const providerConfigs = configs.filter((cfg) => cfg.providerId === id)
                const isActive = activeConfig?.providerId === id
                const hasConfigured = providerConfigs.length > 0 || isActive
                const firstModel = providerConfigs[0]?.model || (isActive ? activeConfig?.model : '')
                return (
                  <ListRow
                    key={id}
                    selected={selected}
                    onClick={() => selectKey(key)}
                    title={preset.label}
                    subtitle={isActive ? firstModel || '当前使用' : hasConfigured ? firstModel || '已配置' : '未配置'}
                    active={isActive}
                    muted={!hasConfigured && !isActive}
                  />
                )
              })}
            </ListSection>

            <ListSection title="自定义">
              {customConfigs.map((cfg) => {
                const key = getSelectionKey(cfg)
                const selected = selectedKey === key
                const isActive = activeModelId
                  ? cfg._id === activeModelId
                  : activeConfig?.providerId === 'custom' && activeConfig?.customModelId === cfg.customModelId
                return (
                  <ListRow
                    key={key}
                    selected={selected}
                    onClick={() => selectKey(key)}
                    title={cfg.displayName || '自定义模型'}
                    subtitle={cfg.model || '已保存'}
                    active={isActive}
                  />
                )
              })}
              <button
                type="button"
                onClick={handleAddCustom}
                className={`flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] transition ${
                  selectedKey.startsWith('custom:new-')
                    ? 'bg-[var(--settings-nav-active-bg)] text-[var(--settings-nav-active-fg)]'
                    : 'text-[var(--whale-blue)] hover:bg-[var(--settings-row-hover)]'
                }`}
              >
                <Plus size={15} strokeWidth={2.25} />
                添加自定义模型
              </button>
            </ListSection>
          </div>
        </aside>

        {/* 右侧：编辑区 */}
        <main className="min-h-0 min-w-0 flex-1 bg-[var(--floating-bg)]">
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
            <div className="flex h-full items-center justify-center p-8 text-sm text-[var(--ink-soft)]">
              请选择一个服务商
            </div>
          )}
        </main>
      </div>
    </section>
  )
}

function ListSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-soft)]/80">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function ListRow({
  title,
  subtitle,
  selected,
  active,
  muted,
  onClick
}: {
  title: string
  subtitle?: string
  selected: boolean
  active?: boolean
  muted?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left transition ${
        selected
          ? 'bg-[var(--settings-nav-active-bg)] text-[var(--settings-nav-active-fg)]'
          : 'hover:bg-[var(--settings-row-hover)] text-[var(--ink)]'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[13px] font-medium leading-tight ${muted && !selected ? 'text-[var(--ink-soft)]' : ''}`}>
          {title}
        </div>
        {subtitle && (
          <div
            className={`mt-0.5 truncate text-[11px] leading-tight ${
              selected ? 'text-[var(--settings-nav-active-fg)]/70' : 'text-[var(--ink-soft)]'
            }`}
          >
            {subtitle}
          </div>
        )}
      </div>
      {active && (
        <Check
          size={14}
          strokeWidth={2.5}
          className={`flex-shrink-0 ${selected ? 'text-[var(--settings-nav-active-fg)]' : 'text-[var(--whale-blue)]'}`}
        />
      )}
    </button>
  )
}
