import { useState, useEffect, useRef } from 'react'
import { Plus, ArrowUp, ChevronDown, Check } from 'lucide-react'
import { api, type ModelConfig } from '../api'
import { useSettingsStore } from './settings/settingsStore'
import { PROVIDER_PRESETS, BUILTIN_PROVIDER_ORDER } from './providerPresets'

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  placeholder?: string
}

export function ChatInput({ value, onChange, onSend, placeholder }: Props) {
  const [config, setConfig] = useState<ModelConfig | null>(null)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const { openSettings, modelConfig: storeConfig } = useSettingsStore()
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    api.configGet('modelConfig').then((c) => {
      if (c) setConfig(c as ModelConfig)
    })
  }, [])

  useEffect(() => {
    if (storeConfig) setConfig(storeConfig)
  }, [storeConfig])

  // textarea 自适应高度
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 128) + 'px'
  }, [value])

  const hasContent = value.trim().length > 0
  const modelLabel = config
    ? PROVIDER_PRESETS[config.providerId]?.label || config.providerId
    : '未配置'

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (hasContent) onSend()
    }
  }

  return (
    <div className="w-full max-w-3xl glass rounded-2xl shadow-lg overflow-hidden">
      {/* 输入行 */}
      <div className="flex items-end gap-2 px-2.5 pt-2.5">
        {/* 多模态 + */}
        <button
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:bg-black/[0.06] hover:text-[var(--ink)] transition mb-0.5"
          title="添加附件"
        >
          <Plus size={18} />
        </button>

        {/* 输入框 */}
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || '描述你要做的事…'}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none py-1.5 text-sm leading-relaxed min-h-[36px] max-h-[128px]"
        />

        {/* 动态发送按钮 */}
        <button
          onClick={() => hasContent && onSend()}
          disabled={!hasContent}
          className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition mb-0.5 ${
            hasContent
              ? 'bg-[#0071e3] text-white hover:brightness-110'
              : 'bg-black/[0.06] text-[var(--ink-soft)]/40 cursor-not-allowed'
          }`}
        >
          <ArrowUp size={16} />
        </button>
      </div>

      {/* 底部：模型切换 */}
      <div className="relative px-3 pb-2 pt-1">
        <button
          onClick={() => setModelMenuOpen(!modelMenuOpen)}
          className="flex items-center gap-1 text-[11px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition"
        >
          <span className="truncate max-w-[180px]">{modelLabel}</span>
          {config?.model && <span className="text-[var(--ink-soft)]/60">/ {config.model}</span>}
          <ChevronDown size={11} />
        </button>

        {modelMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setModelMenuOpen(false)} />
            <div className="absolute left-0 bottom-full mb-1 z-50 w-72 glass rounded-xl p-2 shadow-lg space-y-0.5">
              <div className="max-h-56 overflow-y-auto">
                {BUILTIN_PROVIDER_ORDER.map((id) => {
                  const preset = PROVIDER_PRESETS[id]
                  const isActive = config?.providerId === id
                  return (
                    <button
                      key={id}
                      onClick={() => { setModelMenuOpen(false); openSettings('model') }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition ${
                        isActive ? 'bg-sky-50 text-sky-600' : 'hover:bg-black/[0.04] text-[var(--ink)]'
                      }`}
                    >
                      <span className="flex-1 text-left">{preset.label}</span>
                      {preset.builtinApiKey && <span className="text-[10px] text-green-500">内置</span>}
                      {isActive && <Check size={13} className="text-sky-500" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
