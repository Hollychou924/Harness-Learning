import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Plus, ArrowUp, ChevronDown, Check, X, FileText, Image as ImageIcon, Eye, AlertCircle, FolderPlus, FolderOpen, Folder, History, AtSign, Target, StopCircle, RefreshCw, Loader2, Hand, ShieldCheck, ShieldAlert, GitBranch, Laptop, Search } from 'lucide-react'
import { api, type ModelConfig, type AttachmentFile } from '../api'
import { useSettingsStore, type ApprovalMode } from './settings/settingsStore'
import { useTaskStore, type Attachment, type Project, DEFAULT_PROJECT_ID } from '../store/task'
import { PROVIDER_PRESETS, modelSupportsVision } from './providerPresets'
import { WhaleTooltip } from './WhaleTooltip'
import { CreateBranchDialog } from './Dialogs'
import { CommitHistoryDialog } from './CommitHistoryDialog'

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop?: () => void
  isRunning?: boolean
  placeholder?: string
  /** 是否显示项目归属选择器：仅新对话时为 true，老对话归属已定不显示 */
  showProjectPicker?: boolean
}

const PASTE_TEXT_THRESHOLD = 500

// IME 合成态安全窗(ms)：macOS WKWebView 上 compositionend 可能早于确认键 keydown
const COMPOSE_GUARD_MS = 120

// 非标准换行：\r\n / \r / U+2028 / U+2029，textarea 原生不折行需手动规范化
const WEIRD_LINE_BREAKS = /\r\n?|[\u2028\u2029]/g
const WEIRD_DETECT = /\r|[\u2028\u2029]/

function getModelLabel(config: ModelConfig | null): string {
  if (!config) return '未配置'
  if (config.providerId === 'custom') return config.displayName || '自定义模型'
  return PROVIDER_PRESETS[config.providerId]?.label || config.providerId
}

// 右下角模型展示用的"品牌 · 模型ID"组合：品牌为主，模型 ID 为辅，便于区分同一供应商下的不同模型
function getModelDisplay(config: ModelConfig | null): { brand: string; modelId: string; full: string } {
  const brand = getModelLabel(config)
  const modelId = config?.model?.trim() || ''
  const full = modelId ? `${brand} · ${modelId}` : brand
  return { brand, modelId, full }
}

const APPROVAL_MODE_OPTIONS: Array<{
  id: ApprovalMode
  label: string
  desc: string
  icon: ReactNode
  activeClass: string
  iconClass: string
}> = [
  {
    id: 'always_ask',
    label: '始终询问',
    desc: '编辑文件时，每次都向你确认',
    icon: <Hand size={15} />,
    activeClass: 'text-[var(--ink-soft)]',
    iconClass: 'text-[var(--ink-soft)]'
  },
  {
    id: 'risk_only',
    label: '仅风险询问',
    desc: '仅在有高风险操作才请求确认',
    icon: <ShieldCheck size={15} />,
    activeClass: 'text-[#1f8fff]',
    iconClass: 'text-[#1f8fff]'
  },
  {
    id: 'auto',
    label: '全自动执行',
    desc: '不受限制访问文件',
    icon: <ShieldAlert size={15} />,
    activeClass: 'text-[#ff5a1f]',
    iconClass: 'text-[#ff5a1f]'
  }
]

function normalizePastedText(text: string): string {
  return text.replace(WEIRD_LINE_BREAKS, '\n')
}

function hasWeirdLineBreaks(text: string): boolean {
  return WEIRD_DETECT.test(text)
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '上传失败')
}

function attachmentStatusOf(attachment: Attachment): 'ready' | 'uploading' | 'failed' {
  return attachment.status ?? 'ready'
}

function attachmentFromPickedFile(file: AttachmentFile, id: string): Attachment {
  return {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    dataUrl: file.dataUrl,
    textContent: file.textContent,
    mime: file.mime,
    sourcePath: file.sourcePath,
    status: file.error ? 'failed' : 'ready',
    error: file.error
  }
}

async function attachmentFromBrowserFile(file: File, id: string): Promise<Attachment> {
  const isImage = file.type.startsWith('image/')
  const isText = file.type.startsWith('text/') || /\.(txt|md|json|csv|log|ts|js|tsx|jsx|py|go|rs|java|html|css|xml|yaml|yml|sh|sql)$/i.test(file.name)

  try {
    if (isImage) {
      const dataUrl = await readFileAsDataURL(file)
      return {
        id,
        name: file.name,
        type: 'image',
        size: file.size,
        dataUrl,
        mime: file.type,
        status: 'ready',
        sourceFile: file
      }
    }
    if (isText) {
      const textContent = await readFileAsText(file)
      return {
        id,
        name: file.name,
        type: 'text',
        size: file.size,
        textContent,
        mime: file.type || 'text/plain',
        status: 'ready',
        sourceFile: file
      }
    }
    return {
      id,
      name: file.name,
      type: 'file',
      size: file.size,
      mime: file.type || 'application/octet-stream',
      status: 'ready',
      sourceFile: file
    }
  } catch (error) {
    return {
      id,
      name: file.name,
      type: isImage ? 'image' : isText ? 'text' : 'file',
      size: file.size,
      mime: file.type || 'application/octet-stream',
      status: 'failed',
      error: errorMessageOf(error),
      sourceFile: file
    }
  }
}

export function ChatInput({ value, onChange, onSend, onStop, isRunning = false, placeholder, showProjectPicker = false }: Props) {
  const [config, setConfig] = useState<ModelConfig | null>(null)
  const [modelList, setModelList] = useState<Array<ModelConfig & { _id?: string }>>([])
  const [activeModelId, setActiveModelId] = useState<string | null>(null)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [approvalMenuOpen, setApprovalMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null)
  const modelBtnRef = useRef<HTMLButtonElement>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const approvalMenuRef = useRef<HTMLDivElement>(null)
  const approvalButtonRef = useRef<HTMLButtonElement>(null)
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)
  const { openSettings, modelConfig: storeConfig, approvalMode, saveGeneral, maxIterations, showThinking } = useSettingsStore()
  const { attachments, setAttachments, projects, activeProjectId, activeSessionId, setActiveProject, createProject } = useTaskStore()
  const activeProject = projects.find((p) => p.id === activeProjectId)
  const activeWorkspaceDir = activeProject?.folderPath
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)

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
    void refreshModelList()
  }, [])

  useEffect(() => {
    if (storeConfig) setConfig(storeConfig)
  }, [storeConfig])

  // 拉取已配置模型列表：右下角下拉只展示"已保存且带密钥、可直接切换使用"的模型
  const refreshModelList = useCallback(async () => {
    try {
      const result = await api.getModelList()
      setModelList(result.configs || [])
      setActiveModelId(result.activeId ?? null)
    } catch {
      setModelList([])
    }
  }, [])

  // 切换激活模型：成功后刷新当前模型展示与列表选中态
  const switchModel = useCallback(async (modelId: string) => {
    setModelMenuOpen(false)
    const result = await api.setActiveModel(modelId)
    if (result.success) {
      await refreshModelList()
      const next = modelList.find((c) => (c as ModelConfig & { _id?: string })._id === modelId)
      if (next) setConfig(next)
    }
  }, [refreshModelList, modelList])

  useEffect(() => {
    if (!addMenuOpen) return
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (addMenuRef.current?.contains(target)) return
      if (addButtonRef.current?.contains(target)) return
      setAddMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointerDown, true)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointerDown, true)
  }, [addMenuOpen])

  useEffect(() => {
    if (!approvalMenuOpen) return
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (approvalMenuRef.current?.contains(target)) return
      if (approvalButtonRef.current?.contains(target)) return
      setApprovalMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointerDown, true)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointerDown, true)
  }, [approvalMenuOpen])

  // textarea 自适应高度
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const minHeight = showProjectPicker ? 46 : 52
    ta.style.height = Math.min(Math.max(ta.scrollHeight, minHeight), 180) + 'px'
  }, [value, showProjectPicker])

  const hasBlockedAttachment = attachments.some((a) => attachmentStatusOf(a) !== 'ready')
  const readyAttachmentCount = attachments.filter((a) => attachmentStatusOf(a) === 'ready').length
  const hasContent = !hasBlockedAttachment && (value.trim().length > 0 || readyAttachmentCount > 0)
  const shouldStop = isRunning && !hasContent && Boolean(onStop)
  const sendLabel = hasBlockedAttachment ? '请先删除或重试失败附件' : '发送'
  const modelDisplay = getModelDisplay(config)
  // 仅展示已保存且带有效密钥的模型，点击即可直接切换使用
  const configuredModels = useMemo(
    () => modelList.filter((c) => c.hasSavedApiKey === true),
    [modelList]
  )
  const activeApprovalMode = APPROVAL_MODE_OPTIONS.find((option) => option.id === approvalMode) || APPROVAL_MODE_OPTIONS[0]

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
      const result = await api.workspaceListFiles(activeWorkspaceDir)
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

  const selectMentionItem = useCallback(async (item: { name: string; type: string; path: string; size: number }) => {
    // 删除输入框中的 @query 部分
    const atIdx = mentionStartRef.current
    if (atIdx >= 0) {
      const newValue = value.slice(0, atIdx) + value.slice(atIdx + 1 + mentionQuery.length)
      onChange(newValue)
    }
    setMentionOpen(false)

    // 读取文件内容，作为文本附件注入
    if (item.type === 'file') {
      const result = await api.workspaceReadFile(item.path, activeWorkspaceDir)
      const newAtt: Attachment = {
        id: `mention-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: item.name,
        type: 'text',
        size: item.size,
        textContent: result.content,
        mime: 'text/plain',
        sourcePath: activeWorkspaceDir ? `${activeWorkspaceDir}/${item.path}` : undefined,
        status: result.content ? 'ready' : 'failed',
        error: result.content ? undefined : (result.error || '文件读取失败')
      }
      addAttachments([newAtt])
    }
    // 目录暂时不处理，仅关闭菜单
  }, [value, onChange, mentionQuery, addAttachments, activeWorkspaceDir])

  // ── 粘贴：图片转附件，大文本转附件，非标准换行规范化 ──
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          void attachmentFromBrowserFile(file, `paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
            .then((newAtt) => addAttachments([{ ...newAtt, name: '粘贴图片.png' }]))
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
    setAddMenuOpen(false)
    const files = (await api.openFiles()) as AttachmentFile[]
    if (files.length === 0) return
    const newAtts: Attachment[] = files.map((f, i) => attachmentFromPickedFile(f, `file-${Date.now()}-${i}`))
    addAttachments(newAtts)
  }


  const openMentionPicker = useCallback(() => {
    const prefix = value && !value.endsWith(' ') && !value.endsWith('\n') ? `${value} @` : `${value}@`
    onChange(prefix)
    mentionStartRef.current = prefix.lastIndexOf('@')
    setMentionQuery('')
    setMentionOpen(true)
    setAddMenuOpen(false)
    void loadMentionItems('')
    setTimeout(() => taRef.current?.focus(), 0)
  }, [value, onChange, loadMentionItems])

  const handlePickFolderAsProject = useCallback(async () => {
    const folderPath = await api.pickFolder()
    if (!folderPath) return
    const name = folderPath.split('/').filter(Boolean).pop() || '新项目'
    const id = createProject(name, '📁', folderPath)
    setActiveProject(id)
    setAddMenuOpen(false)
    setProjectMenuOpen(false)
  }, [createProject, setActiveProject])

  const handleCreateBlankProject = useCallback(async (name: string) => {
    const folderPath = await api.createProjectFolder(name)
    if (!folderPath) throw new Error('项目目录创建失败')
    const id = createProject(name, '📁', folderPath)
    setActiveProject(id)
    setProjectMenuOpen(false)
  }, [createProject, setActiveProject])

  const appendQuickContext = useCallback((text: string) => {
    const next = value.trim() ? `${value}
${text}` : text
    onChange(next)
    setAddMenuOpen(false)
    setTimeout(() => taRef.current?.focus(), 0)
  }, [value, onChange])

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
      newAtts.push(await attachmentFromBrowserFile(file, `drop-${Date.now()}-${i}`))
    }
    addAttachments(newAtts)
  }, [addAttachments])

  const removeAttachment = (id: string) => {
    const att = attachments.find((a) => a.id === id)
    if (att?.objectUrl) URL.revokeObjectURL(att.objectUrl)
    if (previewAttachment?.id === id) setPreviewAttachment(null)
    setAttachments(attachments.filter((a) => a.id !== id))
  }

  const retryAttachment = async (attachment: Attachment) => {
    if (attachment.objectUrl) URL.revokeObjectURL(attachment.objectUrl)
    setAttachments(attachments.map((a) => a.id === attachment.id ? { ...a, status: 'uploading', error: undefined } : a))
    try {
      const next = attachment.sourceFile
        ? await attachmentFromBrowserFile(attachment.sourceFile, attachment.id)
        : attachment.sourcePath
          ? attachmentFromPickedFile(await api.readAttachmentFile(attachment.sourcePath), attachment.id)
          : { ...attachment, status: 'failed' as const, error: '找不到原文件，无法重试' }
      const current = useTaskStore.getState().attachments
      setAttachments(current.map((a) => a.id === attachment.id ? { ...next, name: attachment.name } : a))
    } catch (error) {
      const current = useTaskStore.getState().attachments
      setAttachments(current.map((a) => a.id === attachment.id ? { ...a, status: 'failed', error: errorMessageOf(error) } : a))
    }
  }

  return (
    <>
      <div className="relative w-full max-w-4xl">
        {/* 新对话首页：项目归属条，贴在输入框上方 */}
        {showProjectPicker && (
          <ProjectPicker
            projects={projects}
            activeProjectId={activeProjectId}
            onPick={(id) => { setActiveProject(id); setProjectMenuOpen(false) }}
            onClearProject={() => { setActiveProject(DEFAULT_PROJECT_ID); setProjectMenuOpen(false) }}
            onLoadExistingProject={handlePickFolderAsProject}
            onCreateBlankProject={handleCreateBlankProject}
            open={projectMenuOpen}
            setOpen={setProjectMenuOpen}
          />
        )}

      <div
        className={`relative w-full floating-surface transition-all ${
          showProjectPicker ? '-mt-px rounded-t-[20px] rounded-b-[28px]' : 'rounded-[28px]'
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 拖拽高亮遮罩 */}
        {isDragging && (
          <div className="absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-[#0071e3] bg-sky-50 flex items-center justify-center pointer-events-none">
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
                onRetry={() => void retryAttachment(att)}
              />
            ))}
          </div>
        )}

        {/* 输入框 */}
        <div className={`px-4 ${showProjectPicker ? 'pt-1.5' : 'pt-3'}`}>
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
            rows={2}
            className={`w-full bg-transparent resize-none outline-none py-1 text-sm leading-[22px] max-h-[180px] ${showProjectPicker ? 'min-h-[46px]' : 'min-h-[52px]'}`}
          />
        </div>

        {/* 底部行：左下 + 号，右下 模型选择 + 发送 */}
        <div className={`flex items-center justify-between px-3 ${showProjectPicker ? 'pb-1.5 pt-0' : 'pb-3 pt-1'}`}>
          <div className="flex items-center gap-1">
            <div className="relative">
              <WhaleTooltip label="添加上下文">
                <button
                  ref={addButtonRef}
                  onClick={() => setAddMenuOpen((v) => !v)}
                  className={`flex-shrink-0 rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:bg-black/[0.06] hover:text-[var(--ink)] transition ${showProjectPicker ? 'w-7 h-7' : 'w-8 h-8'}`}
                >
                  <Plus size={showProjectPicker ? 17 : 18} />
                </button>
              </WhaleTooltip>
              {addMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setAddMenuOpen(false)} />
                  <div ref={addMenuRef} className="absolute left-0 bottom-10 z-40 w-64 floating-surface rounded-xl p-1.5">
                    <AddMenuItem icon={<FileText size={14} />} label="添加本地文件" desc="图片、文档、文本都可以" onClick={handleFileSelect} />
                    <AddMenuItem icon={<AtSign size={14} />} label="引用项目文件" desc="从当前项目里选择文件" onClick={openMentionPicker} />
                    <AddMenuItem icon={<FolderOpen size={14} />} label="添加本地文件夹" desc="作为新的项目上下文" onClick={handlePickFolderAsProject} />
                    <AddMenuItem icon={<History size={14} />} label="引用当前对话" desc={activeSessionId ? '让小蓝鲸延续已有上下文' : '当前还没有可引用的对话'} disabled={!activeSessionId} onClick={() => appendQuickContext('请参考当前对话历史继续处理：')} />
                    <AddMenuItem icon={<Target size={14} />} label="补充目标" desc="把验收标准写进输入框" onClick={() => appendQuickContext('补充目标：')} />
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                ref={approvalButtonRef}
                onClick={() => {
                  setAddMenuOpen(false)
                  setApprovalMenuOpen((v) => !v)
                }}
                className={`flex items-center gap-1.5 px-1.5 rounded-lg text-[13px] font-medium hover:bg-black/[0.04] transition ${showProjectPicker ? 'py-1' : 'py-1.5'} ${activeApprovalMode.activeClass}`}
              >
                <span className={activeApprovalMode.iconClass}>{activeApprovalMode.icon}</span>
                <span className="truncate max-w-[96px]">{activeApprovalMode.label}</span>
                <ChevronDown size={13} />
              </button>

              {approvalMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setApprovalMenuOpen(false)} />
                  <div ref={approvalMenuRef} className="absolute left-0 bottom-10 z-40 w-[23rem] max-w-[calc(100vw-2rem)] floating-surface rounded-2xl p-2">
                    <div className="px-2.5 pb-1.5 pt-1 text-[12px] text-[var(--ink-soft)]">
                      选择小蓝鲸什么时候需要问你
                    </div>
                    {APPROVAL_MODE_OPTIONS.map((option) => {
                      const selected = option.id === approvalMode
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            saveGeneral({ maxIterations, approvalMode: option.id, showThinking })
                            setApprovalMenuOpen(false)
                          }}
                          className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition ${
                            selected ? 'bg-black/[0.04]' : 'hover:bg-black/[0.04]'
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-black/[0.04] ${option.iconClass}`}>
                            {option.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-[var(--ink)]">{option.label}</span>
                            <span className="block text-xs text-[var(--ink-soft)] mt-0.5">{option.desc}</span>
                          </span>
                          {selected && <Check size={16} className="text-[var(--ink-soft)] flex-shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => {
                  if (!modelMenuOpen) {
                    void refreshModelList()
                    if (modelBtnRef.current) {
                      const rect = modelBtnRef.current.getBoundingClientRect()
                      const menuWidth = Math.min(288, window.innerWidth - 24)
                      const left = Math.min(
                        window.innerWidth - menuWidth - 12,
                        Math.max(12, rect.right - menuWidth)
                      )
                      setMenuPos({ left, bottom: window.innerHeight - rect.top + 8 })
                    }
                  }
                  setModelMenuOpen(!modelMenuOpen)
                }}
                ref={modelBtnRef}
                className="flex items-center gap-1 text-[11px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition px-1.5 py-1.5 rounded-lg hover:bg-black/[0.04]"
                title={modelDisplay.full}
              >
                <span className="truncate max-w-[88px]">{modelDisplay.brand}</span>
                {modelDisplay.modelId && (
                  <>
                    <span className="text-[var(--ink-soft)]/60">·</span>
                    <span className="truncate max-w-[120px] text-[var(--ink-soft)]/80">{modelDisplay.modelId}</span>
                  </>
                )}
                <ChevronDown size={11} />
              </button>

              {modelMenuOpen && menuPos && createPortal(
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setModelMenuOpen(false)} />
                  <div
                    className="fixed z-[9999] w-72 max-w-[calc(100vw-24px)] rounded-xl p-2 floating-surface overflow-hidden"
                    style={{
                      left: menuPos.left,
                      bottom: menuPos.bottom,
                      background: 'var(--floating-bg)'
                    }}
                  >
                    <div
                      className="overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-0.5"
                      style={{ maxHeight: 'min(20rem, calc(100vh - 7rem))' }}
                    >
                      {configuredModels.length === 0 ? (
                        <div className="px-2 py-3 text-center text-xs text-[var(--ink-soft)]">
                          还没有已配置密钥的模型
                        </div>
                      ) : (
                        configuredModels.map((cfg) => {
                          const id = (cfg as ModelConfig & { _id?: string })._id || ''
                          const isActive = id === activeModelId
                          const disp = getModelDisplay(cfg)
                          return (
                            <button
                              key={id || `${cfg.providerId}-${cfg.model}`}
                              onClick={() => void switchModel(id)}
                              className={`w-full min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition ${
                                isActive ? 'bg-sky-50 text-sky-600' : 'hover:bg-black/[0.06] text-[var(--ink)]'
                              }`}
                              title={disp.full}
                            >
                              <span className="flex-1 min-w-0 text-left truncate">
                                <span className="truncate">{disp.brand}</span>
                                {disp.modelId && <span className="text-[var(--ink-soft)]/70"> · {disp.modelId}</span>}
                              </span>
                              {isActive && <Check size={13} className="text-sky-500 flex-shrink-0" />}
                            </button>
                          )
                        })
                      )}
                      <button
                        onClick={() => { setModelMenuOpen(false); openSettings('model') }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 mt-1 rounded-lg text-sm text-[var(--ink-soft)] hover:bg-black/[0.06] hover:text-[var(--ink)] transition border-t border-black/[0.06] pt-2"
                      >
                        <Plus size={13} />
                        管理模型…
                      </button>
                    </div>
                  </div>
                </>,
                document.body
              )}
            </div>

            <WhaleTooltip label={shouldStop ? '停止任务' : sendLabel}>
              <button
                onClick={() => {
                  if (shouldStop) {
                    onStop?.()
                    return
                  }
                  if (hasContent) onSend()
                }}
                disabled={!hasContent && !shouldStop}
                className={`flex-shrink-0 rounded-lg flex items-center justify-center transition ${showProjectPicker ? 'w-7 h-7' : 'w-8 h-8'} ${
                  hasContent || shouldStop
                    ? shouldStop
                      ? 'bg-red-500 text-white hover:brightness-110'
                      : 'bg-[#0071e3] text-white hover:brightness-110'
                    : 'bg-black/[0.06] text-[var(--ink-soft)]/40 cursor-not-allowed'
                }`}
              >
                {shouldStop ? <StopCircle size={showProjectPicker ? 17 : 18} /> : <ArrowUp size={showProjectPicker ? 15 : 16} />}
              </button>
            </WhaleTooltip>
          </div>
        </div>
      </div>

      {/* @文件引用菜单 */}
      {mentionOpen && (
        <div className="absolute bottom-full left-3 mb-1 z-20 w-72 rounded-xl p-1.5 floating-surface max-h-64 overflow-y-auto">
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
      </div>

      {previewAttachment && (
        <AttachmentPreview
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}

    </>
  )
}


function AddMenuItem({ icon, label, desc, onClick, disabled = false }: {
  icon: React.ReactNode
  label: string
  desc: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-black/[0.05] transition disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span className="mt-0.5 text-[var(--ink-soft)] flex-shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-[var(--ink)]">{label}</span>
        <span className="block text-xs text-[var(--ink-soft)] mt-0.5">{desc}</span>
      </span>
    </button>
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
function AttachmentThumb({ attachment, onRemove, onPreview, onRetry }: {
  attachment: Attachment
  onRemove: () => void
  onPreview: () => void
  onRetry: () => void
}) {
  const status = attachmentStatusOf(attachment)
  const sizeLabel = attachment.size < 1024
    ? `${attachment.size}B`
    : attachment.size < 1024 * 1024
    ? `${(attachment.size / 1024).toFixed(0)}KB`
    : `${(attachment.size / 1024 / 1024).toFixed(1)}MB`

  return (
    <div className={`relative group w-20 h-20 rounded-lg overflow-hidden glass-soft border ${status === 'failed' ? 'border-red-300 bg-red-50/70' : 'border-black/[0.08]'}`}>
      <button type="button" onClick={onPreview} className="w-full h-full flex items-center justify-center">
        {attachment.type === 'image' && (attachment.dataUrl || attachment.objectUrl) ? (
          <img src={attachment.objectUrl || attachment.dataUrl} alt={attachment.name} className={`w-full h-full object-cover ${status !== 'ready' ? 'opacity-45' : ''}`} />
        ) : status === 'failed' ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
            <AlertCircle size={20} className="text-red-500" />
            <span className="text-[9px] text-red-500 truncate w-full text-center">{attachment.name}</span>
          </div>
        ) : status === 'uploading' ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
            <Loader2 size={20} className="text-[var(--whale-blue)] animate-spin" />
            <span className="text-[9px] text-[var(--ink-soft)] truncate w-full text-center">{attachment.name}</span>
          </div>
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

      {status === 'ready' && (
      <WhaleTooltip label="预览" className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition">
        <button
          type="button"
          onClick={onPreview}
          className="w-5 h-5 rounded bg-[var(--whale-blue)]/90 text-white flex items-center justify-center"
        >
          <Eye size={11} />
        </button>
      </WhaleTooltip>
      )}

      <WhaleTooltip label="移除" className="absolute top-1 right-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500"
        >
          <X size={11} />
        </button>
      </WhaleTooltip>

      {status === 'failed' && (
        <WhaleTooltip label={attachment.error || '上传失败'} className="absolute bottom-1 left-1 right-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRetry() }}
            className="w-full h-5 rounded bg-red-500 text-white text-[9px] flex items-center justify-center gap-1 hover:bg-red-600"
          >
            <RefreshCw size={10} />
            重试
          </button>
        </WhaleTooltip>
      )}

      {status !== 'failed' && (
        <div className={`absolute bottom-0 left-0 right-0 ${status === 'uploading' ? 'bg-[var(--whale-blue)]' : 'bg-[var(--whale-blue)]/90'} text-white text-[8px] text-center py-0.5 ${status === 'uploading' ? '' : 'opacity-0 group-hover:opacity-100'} transition`}>
          {status === 'uploading' ? '上传中' : sizeLabel}
        </div>
      )}
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
      <div className="absolute inset-0 floating-screen" />
      <div
        className="relative floating-surface rounded-2xl overflow-hidden max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.08] flex-shrink-0">
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
          {attachmentStatusOf(attachment) === 'failed' ? (
            <div className="text-center text-sm text-red-500 py-8">
              上传失败：{attachment.error || '请重试上传'}
            </div>
          ) : attachment.type === 'image' && (attachment.dataUrl || attachment.objectUrl) ? (
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

/* ---- 输入框上方：项目归属选择器 ---- */
function ProjectPicker({
  projects, activeProjectId, onPick, onClearProject, onLoadExistingProject, onCreateBlankProject, open, setOpen
}: {
  projects: Project[]
  activeProjectId: string
  onPick: (id: string) => void
  onClearProject: () => void
  onLoadExistingProject: () => Promise<void>
  onCreateBlankProject: (name: string) => Promise<void>
  open: boolean
  setOpen: (v: boolean | ((p: boolean) => boolean)) => void
}) {
  const active = projects.find((p) => p.id === activeProjectId)
  const isNoProject = activeProjectId === DEFAULT_PROJECT_ID
  const sorted = [...projects].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0) || a.order - b.order
  )
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const [blankOpen, setBlankOpen] = useState(false)
  const [blankName, setBlankName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [menuStyle, setMenuStyle] = useState<{ left: number; top: number; maxHeight: number } | null>(null)
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const [createBranchOpen, setCreateBranchOpen] = useState(false)
  const [commitHistoryOpen, setCommitHistoryOpen] = useState(false)
  const [branchLoading, setBranchLoading] = useState(false)
  const [switchingBranch, setSwitchingBranch] = useState('')
  const [branchQuery, setBranchQuery] = useState('')
  const [currentBranch, setCurrentBranch] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [changedFiles, setChangedFiles] = useState(0)
  const [branchError, setBranchError] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)

  const showToast = (text: string) => {
    setToast(text)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2400)
  }

  const friendlyBranchError = (message?: string) => {
    const text = message || ''
    if (/not a git repository|没有找到 Git 仓库/i.test(text)) {
      return text.includes('没有找到 Git 仓库')
        ? text
        : '在当前项目文件夹及其上下级目录中都没有找到 Git 仓库。请绑定含有 .git 的目录，或先执行 git init。'
    }
    if (/local changes.*overwritten|would be overwritten by (checkout|switch)/is.test(text)) return '当前有未保存的项目修改，请先提交或处理后再切换分支。'
    if (/untracked working tree files.*overwritten/is.test(text)) return '当前有未保存的新文件，请先处理后再切换分支。'
    if (/^[\x00-\x7F]{40,}$/.test(text) || text.length > 160) return '分支切换失败，请检查未保存的修改后重试。'
    return text || '分支切换失败，请稍后重试。'
  }

  const loadBranches = useCallback(async () => {
    if (!active?.folderPath) {
      setCurrentBranch('')
      setBranches([])
      setChangedFiles(0)
      setBranchError('当前项目没有绑定本地文件夹')
      return
    }
    setBranchLoading(true)
    setBranchError('')
    try {
      const result = await api.getBranchInfo(active.folderPath)
      if (result.success) {
        setCurrentBranch(result.currentBranch || '')
        setBranches(result.branches || [])
        setChangedFiles(result.changedFiles || 0)
      } else {
        setCurrentBranch('')
        setBranches([])
        setChangedFiles(0)
        setBranchError(friendlyBranchError(result.error || '无法读取分支'))
      }
    } catch {
      setCurrentBranch('')
      setBranches([])
      setChangedFiles(0)
      setBranchError('无法连接到本地项目')
    } finally {
      setBranchLoading(false)
    }
  }, [active?.folderPath])

  useEffect(() => { void loadBranches() }, [loadBranches])

  const close = () => setOpen(false)
  const updateMenuPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = 320
    const gap = 8
    const margin = 12
    const listRows = sorted.length > 0 ? Math.min(sorted.length, 5) : 1
    const expectedHeight = 88 + listRows * 36 + 142 + (blankOpen ? 76 : 0)
    const availableHeight = window.innerHeight - margin * 2
    const height = Math.min(expectedHeight, availableHeight)
    const left = Math.min(window.innerWidth - width - margin, Math.max(margin, rect.left))
    const belowTop = rect.bottom + gap
    const aboveTop = rect.top - height - gap
    const hasRoomBelow = belowTop + height <= window.innerHeight - margin
    const top = hasRoomBelow ? belowTop : Math.max(margin, aboveTop)
    setMenuStyle({ left, top, maxHeight: Math.min(height, window.innerHeight - top - margin) })
  }, [blankOpen, sorted.length])

  useEffect(() => {
    if (blankOpen) setTimeout(() => nameRef.current?.focus(), 0)
  }, [blankOpen])
  useEffect(() => {
    if (open) updateMenuPosition()
  }, [open, updateMenuPosition])
  useEffect(() => {
    if (open) return
    setBlankOpen(false)
    setBlankName('')
    setError('')
    setBusy(false)
  }, [open])

  const submitBlankProject = async () => {
    const name = blankName.trim()
    if (!name || busy) return
    setBusy(true)
    setError('')
    try {
      await onCreateBlankProject(name)
      setBlankName('')
      setBlankOpen(false)
    } catch {
      setError('创建失败，请换个名称再试')
    } finally {
      setBusy(false)
    }
  }

  const switchBranch = async (branchName: string) => {
    if (!active?.folderPath || branchName === currentBranch || switchingBranch) return
    setSwitchingBranch(branchName)
    try {
      const result = await api.switchBranch(active.folderPath, branchName)
      if (!result.success) {
        showToast(friendlyBranchError(result.error))
        return
      }
      setCurrentBranch(result.currentBranch || branchName)
      setBranches(result.branches || branches)
      setChangedFiles(result.changedFiles || 0)
      setBranchMenuOpen(false)
      showToast(`已切换到 ${branchName}`)
    } catch {
      showToast('无法连接到本地项目')
    } finally {
      setSwitchingBranch('')
    }
  }

  const createBranch = async (branchName: string): Promise<string | null> => {
    if (!active?.folderPath) return '当前项目没有绑定本地文件夹'
    const result = await api.createBranch(active.folderPath, branchName)
    if (!result.success) return result.error || '创建失败'
    setCurrentBranch(result.currentBranch || branchName)
    setBranches(result.branches || branches)
    setChangedFiles(result.changedFiles || 0)
    setCreateBranchOpen(false)
    setBranchMenuOpen(false)
    showToast(`已创建并切换到 ${branchName}`)
    return null
  }

  const visibleBranches = branches.filter((name) => name.toLowerCase().includes(branchQuery.trim().toLowerCase()))

  return (
    <div className="relative z-[1] mx-auto w-[calc(100%-28px)] rounded-t-[24px] border border-b-0 border-black/[0.04] bg-[var(--composer-project-bg)] px-5 pb-1.5 pt-2">
      <div className="flex min-w-0 items-center overflow-visible">
        <button
          ref={buttonRef}
          onClick={() => {
            if (!open) updateMenuPosition()
            setOpen(!open)
          }}
          className="no-drag flex h-7 min-w-0 max-w-full items-center gap-2 rounded-xl px-2.5 text-left text-[var(--ink)] transition hover:bg-black/[0.05]"
        >
          {isNoProject ? (
            <X size={16} className="flex-shrink-0 text-[var(--ink-soft)]" />
          ) : (
            <Folder size={16} className="flex-shrink-0 text-[var(--ink-soft)]" />
          )}
          <span className="min-w-0 truncate text-sm font-medium">
            {isNoProject ? '不加载任何项目' : (active?.name ?? '选择项目')}
          </span>
          <ChevronDown size={14} className="flex-shrink-0 text-[var(--ink-soft)]" />
        </button>
        <button onClick={() => showToast('暂时只支持本地模式')} className="no-drag ml-1 flex h-7 flex-shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-sm text-[var(--ink)] transition hover:bg-black/[0.05]">
          <Laptop size={15} />
          本地
        </button>
        <div className="relative ml-1 flex-shrink-0">
          <button
            onClick={() => { setBranchMenuOpen((value) => !value); setOpen(false); setBranchQuery('') }}
            className="no-drag flex h-7 max-w-[220px] items-center gap-1.5 rounded-xl px-2.5 text-sm text-[var(--ink)] transition hover:bg-black/[0.05]"
          >
            <GitBranch size={15} />
            <span className="truncate">{currentBranch || (branchLoading ? '正在读取分支…' : '分支')}</span>
          </button>
          {branchMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setBranchMenuOpen(false)} />
              <div className="absolute left-0 top-9 z-50 w-[340px] max-w-[calc(100vw-32px)] floating-surface rounded-2xl p-2">
                <div className="flex h-9 items-center gap-2 px-2 text-[var(--ink-soft)]">
                  <Search size={15} />
                  <input value={branchQuery} onChange={(event) => setBranchQuery(event.target.value)} placeholder="搜索分支" className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none" autoFocus />
                </div>
                <div className="px-2 pb-1 pt-2 text-xs font-medium text-[var(--ink-soft)]">分支</div>
                <div className="max-h-56 overflow-y-auto">
                  {branchLoading && branches.length === 0 && <div className="px-2 py-4 text-center text-xs text-[var(--ink-soft)]">正在读取分支…</div>}
                  {!branchLoading && branchError && <div className="px-2 py-4 text-center text-xs text-red-500">{branchError}</div>}
                  {!branchLoading && !branchError && visibleBranches.length === 0 && <div className="px-2 py-4 text-center text-xs text-[var(--ink-soft)]">没有找到分支</div>}
                  {visibleBranches.map((name) => (
                    <button key={name} disabled={Boolean(switchingBranch)} onClick={() => void switchBranch(name)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-[var(--ink)] hover:bg-black/[0.05] disabled:opacity-50">
                      <GitBranch size={15} className="flex-shrink-0 text-[var(--ink-soft)]" />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      {name === currentBranch && <Check size={15} className="flex-shrink-0" />}
                      {name === switchingBranch && <span className="flex-shrink-0 text-xs text-[var(--ink-soft)]">正在切换…</span>}
                      {name === currentBranch && changedFiles > 0 && <span className="text-xs text-[var(--ink-soft)]">未提交：{changedFiles} 个文件</span>}
                    </button>
                  ))}
                </div>
                <div className="mt-2 border-t border-black/[0.08] pt-2">
                  <button disabled={!active?.folderPath || Boolean(branchError)} onClick={() => setCreateBranchOpen(true)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-[var(--ink)] hover:bg-black/[0.05] disabled:opacity-40">
                    <Plus size={16} />
                    创建并切换新分支…
                  </button>
                  <button disabled={!active?.folderPath || Boolean(branchError)} onClick={() => { setBranchMenuOpen(false); setCommitHistoryOpen(true) }} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-[var(--ink)] hover:bg-black/[0.05] disabled:opacity-40">
                    <GitBranch size={16} />
                    项目提交历史
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {createBranchOpen && <CreateBranchDialog onCancel={() => setCreateBranchOpen(false)} onCreate={createBranch} />}
      {commitHistoryOpen && active?.folderPath && <CommitHistoryDialog workspaceDir={active.folderPath} projectName={active.name} onClose={() => setCommitHistoryOpen(false)} />}
      {toast && createPortal(<div className="pointer-events-none fixed bottom-24 left-1/2 z-[240] max-w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl floating-toast px-4 py-2 text-center text-xs leading-relaxed text-white">{toast}</div>, document.body)}

      {open && (
        createPortal(
          <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            ref={ref}
            className="fixed z-50 w-80 max-w-[calc(100vw-24px)] floating-surface rounded-2xl p-2 overflow-hidden flex flex-col"
            style={menuStyle ? { left: menuStyle.left, top: menuStyle.top, maxHeight: menuStyle.maxHeight } : undefined}
          >
            <div className="px-2.5 pt-2 pb-1.5">
              <div className="text-sm font-semibold text-[var(--ink)]">请选择或新建一个项目</div>
            </div>
            {sorted.length > 0 && (
              <div
                className="mt-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ maxHeight: Math.max(72, Math.min(160, (menuStyle?.maxHeight ?? 420) - (blankOpen ? 240 : 166))) }}
              >
                {sorted.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onPick(p.id)}
                    className={`w-full h-8 min-w-0 flex items-center gap-2.5 px-2.5 rounded-xl text-left hover:bg-black/[0.05] transition ${
                      p.id === activeProjectId ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'
                    }`}
                  >
                    <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                      <Folder size={15} className="text-[var(--ink-soft)]" />
                    </span>
                    <span className="flex-1 min-w-0 text-sm truncate">{p.name}</span>
                    {p.id === activeProjectId && <Check size={12} className="text-[#0071e3] flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
            {sorted.length === 0 && (
              <div className="mx-2 mt-2 rounded-xl bg-black/[0.03] px-3 py-4 text-center text-xs text-[var(--ink-soft)]">
                左侧还没有加载项目
              </div>
            )}
            <div className="border-t border-black/[0.08] mt-2 pt-2">
              <button
                onClick={() => { setError(''); void onLoadExistingProject() }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-[var(--ink-soft)] hover:bg-black/[0.05] hover:text-[var(--ink)] transition"
              >
                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  <FolderOpen size={15} className="text-[var(--ink-soft)]" />
                </span>
                加载已有项目
              </button>
              <button
                onClick={() => { setBlankOpen((v) => !v); setError('') }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-[var(--ink-soft)] hover:bg-black/[0.05] hover:text-[var(--ink)] transition"
              >
                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  <FolderPlus size={15} className="text-[var(--ink-soft)]" />
                </span>
                新建空白项目
              </button>
              {blankOpen && (
                <div className="mx-2 mb-1 rounded-xl bg-black/[0.03] p-2">
                  <input
                    ref={nameRef}
                    value={blankName}
                    onChange={(e) => setBlankName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void submitBlankProject(); if (e.key === 'Escape') setBlankOpen(false) }}
                    placeholder="输入项目名称"
                    className="w-full h-8 px-2.5 rounded-lg bg-white/80 border border-black/10 outline-none text-sm focus:border-[#0071e3]"
                  />
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <span className="min-w-0 text-[11px] text-red-500 truncate">{error}</span>
                    <button
                      onClick={() => void submitBlankProject()}
                      disabled={!blankName.trim() || busy}
                      className="h-7 px-3 rounded-lg bg-[var(--ink)] text-white text-xs disabled:opacity-40 transition"
                    >
                      {busy ? '创建中' : '创建'}
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={() => onClearProject()}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition ${
                  isNoProject ? 'text-[var(--ink)] bg-black/[0.04]' : 'text-[var(--ink-soft)] hover:bg-black/[0.05] hover:text-[var(--ink)]'
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  <X size={15} className="text-[var(--ink-soft)]" />
                </span>
                <span className="flex-1 text-left">不加载任何项目</span>
                {isNoProject && <Check size={12} className="text-[#0071e3] flex-shrink-0" />}
              </button>
            </div>
          </div>
          </>,
          document.body
        )
      )}
    </div>
  )
}
