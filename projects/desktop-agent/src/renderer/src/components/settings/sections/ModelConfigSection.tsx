import { useState } from 'react'
import { Check } from 'lucide-react'
import { useSettingsStore, PROVIDER_PRESETS, BUILTIN_PROVIDER_ORDER } from '../settingsStore'
import type { ModelConfig } from '../../../api'
import { ProviderEditor } from './ProviderEditor'

export function ModelConfigSection() {
  const { modelConfig, refreshModelConfig, saveModelConfig } = useSettingsStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleSave = async (cfg: ModelConfig) => {
    try {
      await saveModelConfig(cfg)
      setError('')
      setEditingId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '模型保存失败，请重试')
    }
  }

  return (
    <section>
      <header className="mb-5">
        <h3 className="text-lg font-semibold text-[var(--ink)]">模型配置</h3>
        <p className="text-sm text-[var(--ink-soft)] mt-1">选择供应商并填写 API Key，配置后即可在输入框中使用</p>
      </header>

      {editingId ? (
        <>
          {error && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}
          <ProviderEditor
            providerId={editingId}
            current={modelConfig}
            onSave={handleSave}
            onCancel={() => { setError(''); setEditingId(null) }}
          />
        </>
      ) : (
        <div className="space-y-1.5">
          {/* 当前配置 */}
          {modelConfig && (
            <div className="floating-subsurface rounded-xl px-4 py-3 mb-3">
              <div className="text-xs text-[var(--ink-soft)] mb-1">当前使用</div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--ink)]">
                  {PROVIDER_PRESETS[modelConfig.providerId]?.label || modelConfig.providerId}
                </span>
                <span className="text-sm text-[var(--ink-soft)]">/ {modelConfig.model}</span>
                {PROVIDER_PRESETS[modelConfig.providerId]?.builtinApiKey && (
                  <span className="text-[10px] text-green-500">内置 Key</span>
                )}
              </div>
            </div>
          )}

          {/* 供应商列表 */}
          <div className="text-xs text-[var(--ink-soft)] px-1 pb-1">选择供应商</div>
          {BUILTIN_PROVIDER_ORDER.map((id) => {
            const preset = PROVIDER_PRESETS[id]
            const isActive = modelConfig?.providerId === id
            return (
              <button
                key={id}
                onClick={() => setEditingId(id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition ${
                  isActive
                    ? 'bg-sky-50 text-sky-600 border border-sky-200'
                    : 'hover:bg-black/[0.04] text-[var(--ink)] border border-transparent'
                }`}
              >
                <span className="flex-1 text-left font-medium">{preset.label}</span>
                {preset.builtinApiKey && <span className="text-[10px] text-green-500">内置 Key</span>}
                {isActive && <Check size={14} className="text-sky-500" />}
              </button>
            )
          })}

          {!modelConfig && (
            <p className="text-xs text-amber-500 px-1 pt-2">尚未配置模型，请选择供应商并填写 API Key</p>
          )}
        </div>
      )}
    </section>
  )
}
