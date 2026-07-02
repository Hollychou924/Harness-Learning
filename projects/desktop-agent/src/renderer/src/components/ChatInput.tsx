import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, ArrowUp, ChevronDown, Check, X, FileText, Image as ImageIcon, Eye, AlertCircle } from 'lucide-react'
import { api, type ModelConfig, type AttachmentFile } from '../api'
import { useSettingsStore } from './settings/settingsStore'
import { useTaskStore, type Attachment } from '../store/task'
import { PROVIDER_PRESETS, BUILTIN_PROVIDER_ORDER, modelSupportsVision } from './providerPresets'

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  placeholder?: string
}

const PASTE_TEXT_THRESHOLD = 500

// IME 合成态安全窗(ms)：macOS WKWebView 上 compositionend 可能早于确认键 keydown
const COMPOSE_GUARD_MS = 120

// 非标准换行：\r\n / \r / U+2028 / U+2029，textarea 原生不折行需手动规范化
const WEIRD_LINE_BREAKS = /\r\n?|[\u2028\u2029]/g
const WEIRD_DETECT = /\r|[\u2028\u2029]/

function normalizePastedText(text: string): string {
  return text.replace(WEIRD_LINE_BREAKS, '\n')
}

function hasWeirdLineBreaks(text: string): boolean {
  return WEIRD_DETECT.test(text)
}

export function ChatInput({ value, onChange, onSend, placeholder }: Props) {
  const [config, setConfig] = useState<ModelConfig | null>(null)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null)
  const modelBtnRef = useRef<HTMLButtonElement>(null)
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)
  const { openSettings, modelConfig: storeConfig } = useSettingsStore()
  const { attachments, setAttachments } = useTaskStore()
  const taRef = useRef<HTMLTextAreaElement>(null)

  // IME 合成态跟踪
  const composingRef = useRef(false)
  const lastComposeEndRef = useRef(0)

  // 拖拽计数器(防子元素 dragleave 闪烁)
  const [isDragging, setIsDragging] = useState(false)
  const dragDepthRef = useRef(0)

  // 视觉能力提示
  const [visionWarn, setVisionWarn] = useState(false)

  // @文件引用
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionItems, setMentionItems] = useState<Array<{ name: string; type: string; path: string; size: number }>>([])
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionLoading, setMentionLoading] = useState(false)
  const mentionStartRef = useRef(-1) // @ 符号在 value 中的位置

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

  const currentModelSupportsVision = config
    ? modelSupportsVision(config.providerId, config.model)
    : true

  // ── IME 合成态保护：合成中或刚结束合成(< 120ms)的回车不发送 ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && mentionOpen) { setMentionOpen(false); e.preventDefault(); return }
    if (mentionOpen && e.key === 'Enter' && !e.shiftKey) {
      // @菜单打开时回车选中第一项
      e.preventDefault()
      if (mentionItems.length > 0) selectMentionItem(mentionItems[0])
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent.isComposing) { e.preventDefault(); return }
      if ((e as unknown as { keyCode?: number }).keyCode === 229) { e.preventDefault(); return }
      if (composingRef.current) { e.preventDefault(); return }
      const msSinceEnd = Date.now() - lastComposeEndRef.current
      if (msSinceEnd >= 0 && msSinceEnd < COMPOSE_GUARD_MS) { e.preventDefault(); return }
      e.preventDefault()
      if (hasContent) onSend()
    }
  }

  const handleCompositionStart = () => { composingRef.current = true }
  const handleCompositionEnd = () => {
    composingRef.current = false
    lastComposeEndRef.current = Date.now()
  }

  // ── 内部统一添加附件入口(粘贴/拖拽/选择共用) ──
  const addAttachments = useCallback((newAtts: Attachment[]) => {
    if (newAtts.length === 0) return
    // 检查视觉能力：有不支持图片的模型时提示
    const hasImage = newAtts.some((a) => a.type === 'image')
    if (hasImage && !currentModelSupportsVision) {
      setVisionWarn(true)
      setTimeout(() => setVisionWarn(false), 4000)
    }
    setAttachments([...attachments, ...newAtts])
  }, [attachments, setAttachments, currentModelSupportsVision])

  // ── @文件引用：检测光标前是否有未完成的 @ 引用 ──
  const detectMention = useCallback((text: string, cursorPos: number) => {
    const before = text.slice(0, cursorPos)
    const atIdx = before.lastIndexOf('@')
    if (atIdx === -1) {
      setMentionOpen(false)
      return
    }
    // @ 必须在行首或前面是空格
    if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) {
      setMentionOpen(false)
      return
    }
    const query = before.slice(atIdx + 1)
    // 如果包含空格或换行，说明已经结束引用
    if (/\s/.test(query)) {
      setMentionOpen(false)
      return
    }
    mentionStartRef.current = atIdx
    setMentionQuery(query)
    setMentionOpen(true)
    loadMentionItems(query)
  }, [])

  const loadMentionItems = useCallback(async (query: string) => {
    setMentionLoading(true)
    try {
      const result = await api.workspaceListFiles()
      let items = result.items
      if (query) {
        items = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
      }
      setMentionItems(items.slice(0, 12))
    } catch {
      setMentionItems([])
    } finally {
      setMentionLoading(false)
    }
  }, [])

  const selectMentionItem = useCallback(async (item: { name: string; type: string; path: string }) => {
    // 删除输入框中的 @query 部分
    const atIdx = mentionStartRef.current
    if (atIdx >= 0) {
      const newValue = value.slice(0, atIdx) + value.slice(atIdx + 1 + mentionQuery.length)
      onChange(newValue)
    }
    setMentionOpen(false)

    // 读取文件内容，作为文本附件注入
    if (item.type === 'file') {
      const result = await api.workspaceReadFile(item.path)
      if (result.content) {
        const newAtt: Attachment = {
          id: `mention-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: item.name,
          type: 'text',
          size: item.size,
          textContent: result.content,
          mime: 'text/plain'
        }
        addAttachments([newAtt])
      }
    }
    // 目录暂时不处理，仅关闭菜单
  }, [value, onChange, mentionQuery, addAttachments])

  // ── 粘贴：图片转附件，大文本转附件，非标准换行规范化 ──
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
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
            addAttachments([newAtt])
          }
          reader.readAsDataURL(file)
          return
        }
      }
    }

    const text = e.clipboardData?.getData('text/plain') || ''

    // 非标准换行规范化：textarea 原生不处理 \r/U+2028/U+2029，会连成一行
    if (text && hasWeirdLineBreaks(text) && text.length <= PASTE_TEXT_THRESHOLD) {
      e.preventDefault()
      const normalized = normalizePastedText(text)
      const el = taRef.current
      if (el) {
        const start = el.selectionStart
        const end = el.selectionEnd
        const newVal = value.slice(0, start) + normalized + value.slice(end)
        onChange(newVal)
        requestAnimationFrame(() => {
          const p = start + normalized.length
          el.setSelectionRange(p, p)
          el.focus()
        })
      }
      return
    }

    // 大文本粘贴转附件
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
      addAttachments([newAtt])
      return
    }
  }, [addAttachments, value, onChange])

  // ── 文件选择 ──
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
    addAttachments(newAtts)
  }

  // ── 拖拽上传 ──
  const dragHasFiles = (e: React.DragEvent): boolean => {
    return Array.from(e.dataTransfer?.types ?? []).includes('Files')
  }
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
    dragDepthRef.current++
    if (!isDragging) setIsDragging(true)
  }, [isDragging])
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
  }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDragging(false)
  }, [])
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
    dragDepthRef.current = 0
    setIsDragging(false)
    const droppedFiles = e.dataTransfer?.files
    if (!droppedFiles || droppedFiles.length === 0) return
    const newAtts: Attachment[] = []
    for (let i = 0; i < droppedFiles.length; i++) {
      const file = droppedFiles[i]
      const isImage = file.type.startsWith('image/')
      const isText = file.type.startsWith('text/') || /\.(txt|md|json|csv|log|ts|js|tsx|jsx|py|go|rs|java|html|css|xml|yaml|yml|sh|sql)$/i.test(file.name)
      if (isImage) {
        // 大图用 Object URL 减少内存占用(不用 dataURL 永久驻留 base64)
        const objectUrl = URL.createObjectURL(file)
        newAtts.push({
          id: `drop-${Date.now()}-${i}`,
          name: file.name,
          type: 'image',
          size: file.size,
          objectUrl,
          mime: file.type
        })
      } else if (isText) {
        const textContent = await readFileAsText(file)
        newAtts.push({
          id: `drop-${Date.now()}-${i}`,
          name: file.name,
          type: 'text',
          size: file.size,
          textContent,
          mime: file.type || 'text/plain'
        })
      } else {
        newAtts.push({
          id: `drop-${Date.now()}-${i}`,
          name: file.name,
          type: 'file',
          size: file.size,
          mime: file.type || 'application/octet-stream'
        })
      }
    }
    addAttachments(newAtts)
  }, [addAttachments])

  const removeAttachment = (id: string) => {
    const att = attachments.find((a) => a.id === id)
    if (att?.objectUrl) URL.revokeObjectURL(att.objectUrl)
    setAttachments(attachments.filter((a) => a.id !== id))
  }

  return (
    <>
      <div
        className="relative w-full max-w-3xl glass rounded-2xl shadow-lg transition-all"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 拖拽高亮遮罩 */}
        {isDragging && (
          <div className="absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-[#0071e3] bg-sky-50/60 flex items-center justify-center pointer-events-none">
            <span className="text-sm font-medium text-[#0071e3]">松开以上传文件</span>
          </div>
        )}

        {/* 视觉能力提示 */}
        {visionWarn && (
          <div className="flex items-center gap-1.5 px-3 pt-2.5 text-xs text-amber-600">
            <AlertCircle size={13} className="flex-shrink-0" />
            <span>当前模型可能不支持图片，会尝试发送，不支持时自动退回纯文字</span>
          </div>
        )}

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
            onChange={(e) => {
              onChange(e.target.value)
              detectMention(e.target.value, e.target.selectionStart)
            }}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onPaste={handlePaste}
            placeholder={placeholder || '描述你要做的事…'}
            rows={1}
            className="w-full bg-transparent resize-none outline-none py-1 text-sm leading-relaxed min-h-[36px] max-h-[160px]"
          />
        </div>

        {/* 底部行：左下 + 号，右下 模型选择 + 发送 */}
        <div className="flex items-center justify-between px-2.5 pb-2 pt-1">
          <button
            onClick={handleFileSelect}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:bg-black/[0.06] hover:text-[var(--ink)] transition"
            title="添加文件"
          >
            <Plus size={18} />
          </button>

          <div className="flex items-center gap-2">
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
                            {preset.supportsVision && (
                              <span className="text-[10px] text-sky-500" title="支持图片输入">👁</span>
                            )}
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

      {/* @文件引用菜单 */}
      {mentionOpen && (
        <div className="absolute bottom-full left-3 mb-1 z-20 w-72 rounded-xl p-1.5 shadow-xl border border-white/50 max-h-64 overflow-y-auto"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)'
          }}
        >
          {mentionLoading ? (
            <div className="px-2 py-3 text-xs text-[var(--ink-soft)] text-center">加载中…</div>
          ) : mentionItems.length === 0 ? (
            <div className="px-2 py-3 text-xs text-[var(--ink-soft)] text-center">无匹配文件</div>
          ) : (
            mentionItems.map((item) => (
              <button
                key={item.path}
                onClick={() => selectMentionItem(item)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-black/[0.06] transition text-left"
              >
                <span className="flex-shrink-0 text-xs">{item.type === 'dir' ? '📁' : '📄'}</span>
                <span className="flex-1 truncate text-[var(--ink)]">{item.name}</span>
                <span className="text-[10px] text-[var(--ink-soft)]">
                  {item.size < 1024 ? `${item.size}B` : `${(item.size / 1024).toFixed(0)}KB`}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {previewAttachment && (
        <AttachmentPreview
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </>
  )
}

// ── 文件读取辅助 ──
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
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
      <button onClick={onPreview} className="w-full h-full flex items-center justify-center">
        {attachment.type === 'image' && (attachment.dataUrl || attachment.objectUrl) ? (
          <img src={attachment.objectUrl || attachment.dataUrl} alt={attachment.name} className="w-full h-full object-cover" />
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

      <button
        onClick={onPreview}
        className="absolute top-1 left-1 w-5 h-5 rounded bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
        title="预览"
      >
        <Eye size={11} />
      </button>

      <button
        onClick={onRemove}
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-500"
        title="移除"
      >
        <X size={11} />
      </button>

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

        <div className="flex-1 overflow-auto p-4">
          {attachment.type === 'image' && (attachment.dataUrl || attachment.objectUrl) ? (
            <img src={attachment.objectUrl || attachment.dataUrl} alt={attachment.name} className="max-w-full max-h-[60vh] mx-auto rounded-lg" />
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
