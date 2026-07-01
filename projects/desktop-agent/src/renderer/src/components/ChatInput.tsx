import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, ArrowUp, ChevronDown, Check, X, FileText, Image as ImageIcon, Eye } from 'lucide-react'
import { api, type ModelConfig, type AttachmentFile } from '../api'
import { useSettingsStore } from './settings/settingsStore'
import { useTaskStore, type Attachment } from '../store/task'
import { PROVIDER_PRESETS, BUILTIN_PROVIDER_ORDER } from './providerPresets'

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  placeholder?: string
}

const PASTE_TEXT_THRESHOLD = 500

export function ChatInput({ value, onChange, onSend, placeholder }: Props) {
  const [config, setConfig] = useState<ModelConfig | null>(null)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null)
  const modelBtnRef = useRef<HTMLButtonElement>(null)
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)
  const { openSettings, modelConfig: storeConfig } = useSettingsStore()
  const { attachments, setAttachments } = useTaskStore()
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [value])

  const hasContent = value.trim().length > 0 || attachments.length > 0
  const modelLabel = config
    ? PROVIDER_PRESETS[config.providerId]?.label || config.providerId
    : '未配置'

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (hasContent) onSend()
    }
  }

  // 粘贴：大文本转附件，图片转附件
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      // 图片粘贴
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          const reader = new FileReader()
          reader.onload = () => {
            const newAtt: Attachment = {
              id: `paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: `粘贴图片.png`,
              type: 'image',
              size: file.size,
              dataUrl: reader.result as string,
              mime: item.type
            }
            setAttachments([...attachments, newAtt])
          }
          reader.readAsDataURL(file)
          return
        }
      }
    }

    // 大文本粘贴转附件
    const text = e.clipboardData?.getData('text/plain') || ''
    if (text.length > PASTE_TEXT_THRESHOLD) {
      e.preventDefault()
      const newAtt: Attachment = {
        id: `paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `粘贴文本_${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}.txt`,
        type: 'text',
        size: text.length,
        textContent: text,
        mime: 'text/plain'
      }
      setAttachments([...attachments, newAtt])
      return
    }
  }, [attachments, setAttachments])

  // 文件选择
  const handleFileSelect = async () => {
    const files = (await api.openFiles()) as AttachmentFile[]
    if (files.length === 0) return
    const newAtts: Attachment[] = files.map((f, i) => ({
      id: `file-${Date.now()}-${i}`,
      name: f.name,
      type: f.type,
      size: f.size,
      dataUrl: f.dataUrl,
      textContent: f.textContent,
      mime: f.mime
    }))
    setAttachments([...attachments, ...newAtts])
  }

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((a) => a.id !== id))
  }

  return (
    <>
      <div className="w-full max-w-3xl glass rounded-2xl shadow-lg">
        {/* 附件缩略图区 */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {attachments.map((att) => (
              <AttachmentThumb
                key={att.id}
                attachment={att}
                onRemove={() => removeAttachment(att.id)}
                onPreview={() => setPreviewAttachment(att)}
              />
            ))}
          </div>
        )}

        {/* 输入框 */}
        <div className="px-3 pt-2.5">
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder || '描述你要做的事…'}
            rows={1}
            className="w-full bg-transparent resize-none outline-none py-1 text-sm leading-relaxed min-h-[36px] max-h-[160px]"
          />
        </div>

        {/* 底部行：左下 + 号，右下 模型选择 + 发送 */}
        <div className="flex items-center justify-between px-2.5 pb-2 pt-1">
          {/* 左下：+ 号 */}
          <button
            onClick={handleFileSelect}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:bg-black/[0.06] hover:text-[var(--ink)] transition"
            title="添加文件"
          >
            <Plus size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files
              if (files && files.length > 0) {
                api.openFiles().then((ipcFiles) => {
                  if (ipcFiles.length > 0) {
                    const newAtts: Attachment[] = ipcFiles.map((f, i) => ({
                      id: `file-${Date.now()}-${i}`,
                      name: f.name, type: f.type, size: f.size,
                      dataUrl: f.dataUrl, textContent: f.textContent, mime: f.mime
                    }))
                    setAttachments([...attachments, ...newAtts])
                  }
                }).catch(() => {})
              }
              e.target.value = ''
            }}
          />

          {/* 右下：模型选择 + 发送 */}
          <div className="flex items-center gap-2">
            {/* 模型选择 */}
            <div className="relative">
              <button
                onClick={() => {
                  if (!modelMenuOpen && modelBtnRef.current) {
                    const rect = modelBtnRef.current.getBoundingClientRect()
                    setMenuPos({ left: rect.left, bottom: window.innerHeight - rect.top + 4 })
                  }
                  setModelMenuOpen(!modelMenuOpen)
                }}
                ref={modelBtnRef}
                className="flex items-center gap-1 text-[11px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition px-1.5 py-1.5 rounded-lg hover:bg-black/[0.04]"
              >
                <span className="truncate max-w-[120px]">{modelLabel}</span>
                <ChevronDown size={11} />
              </button>

            {modelMenuOpen && menuPos && createPortal(
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setModelMenuOpen(false)} />
                <div
                  className="fixed z-[9999] w-72 rounded-xl p-2 shadow-xl border border-white/50"
                  style={{
                    left: menuPos.left,
                    bottom: menuPos.bottom,
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(40px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(40px) saturate(180%)'
                  }}
                >
                  <div className="max-h-80 overflow-y-auto space-y-0.5">
                    {BUILTIN_PROVIDER_ORDER.map((id) => {
                      const preset = PROVIDER_PRESETS[id]
                      const isActive = config?.providerId === id
                      return (
                        <button
                          key={id}
                          onClick={() => { setModelMenuOpen(false); openSettings('model') }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition ${
                            isActive ? 'bg-sky-50 text-sky-600' : 'hover:bg-black/[0.06] text-[var(--ink)]'
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
              </>,
              document.body
            )}
            </div>

            {/* 发送按钮 */}
            <button
              onClick={() => hasContent && onSend()}
              disabled={!hasContent}
              className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition ${
                hasContent
                  ? 'bg-[#0071e3] text-white hover:brightness-110'
                  : 'bg-black/[0.06] text-[var(--ink-soft)]/40 cursor-not-allowed'
              }`}
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 附件预览弹窗 */}
      {previewAttachment && (
        <AttachmentPreview
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </>
  )
}

// ============ 附件缩略图 ============
function AttachmentThumb({ attachment, onRemove, onPreview }: {
  attachment: Attachment
  onRemove: () => void
  onPreview: () => void
}) {
  const sizeLabel = attachment.size < 1024
    ? `${attachment.size}B`
    : attachment.size < 1024 * 1024
    ? `${(attachment.size / 1024).toFixed(0)}KB`
    : `${(attachment.size / 1024 / 1024).toFixed(1)}MB`

  return (
    <div className="relative group w-20 h-20 rounded-lg overflow-hidden glass-soft border border-black/[0.08]">
      {/* 缩略图内容 */}
      <button onClick={onPreview} className="w-full h-full flex items-center justify-center">
        {attachment.type === 'image' && attachment.dataUrl ? (
          <img src={attachment.dataUrl} alt={attachment.name} className="w-full h-full object-cover" />
        ) : attachment.type === 'text' ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
            <FileText size={20} className="text-[var(--ink-soft)]" />
            <span className="text-[9px] text-[var(--ink-soft)] truncate w-full text-center">{attachment.name}</span>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
            <ImageIcon size={20} className="text-[var(--ink-soft)]" />
            <span className="text-[9px] text-[var(--ink-soft)] truncate w-full text-center">{attachment.name}</span>
          </div>
        )}
      </button>

      {/* 预览按钮（hover 显示） */}
      <button
        onClick={onPreview}
        className="absolute top-1 left-1 w-5 h-5 rounded bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
        title="预览"
      >
        <Eye size={11} />
      </button>

      {/* 删除按钮 */}
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-500"
        title="移除"
      >
        <X size={11} />
      </button>

      {/* 大小标签 */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[8px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition">
        {sizeLabel}
      </div>
    </div>
  )
}

// ============ 附件预览弹窗 ============
function AttachmentPreview({ attachment, onClose }: {
  attachment: Attachment
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative glass rounded-2xl overflow-hidden shadow-2xl max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/40 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--ink)] truncate">{attachment.name}</div>
            <div className="text-xs text-[var(--ink-soft)]">{attachment.mime}</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:bg-black/[0.06] hover:text-[var(--ink)] transition flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-4">
          {attachment.type === 'image' && attachment.dataUrl ? (
            <img src={attachment.dataUrl} alt={attachment.name} className="max-w-full max-h-[60vh] mx-auto rounded-lg" />
          ) : attachment.textContent ? (
            <pre className="text-xs text-[var(--ink)] whitespace-pre-wrap break-all font-mono leading-relaxed">
              {attachment.textContent.slice(0, 50000)}
              {attachment.textContent.length > 50000 && '\n\n… (内容过长，仅显示前 50000 字符)'}
            </pre>
          ) : (
            <div className="text-center text-sm text-[var(--ink-soft)] py-8">
              无法预览此文件类型
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
