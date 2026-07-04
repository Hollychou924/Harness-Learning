import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { AlertTriangle, ChevronRight, Clipboard, ClipboardCheck, FileCode, FileText, FolderOpen, Loader2, Terminal } from 'lucide-react'
import type { ToolCallItem } from '../../../agent/src/items'

// 工具特化视图：让命令、读文件、列文件、写文件都变成用户能看懂的过程卡。

type ParsedResult = Record<string, unknown> | null

function parseResult(result?: string): ParsedResult {
  if (!result) return null
  try {
    const parsed = JSON.parse(result)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

function fileNameOf(path: string, fallback = '未命名'): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  return normalized.split('/').pop() || normalized || fallback
}

function countLines(text: string): number {
  if (!text) return 0
  return text.split('\n').length
}

function formatBytes(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  if (sec < 1) return '刚刚开始'
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m${sec % 60}s`
}

function useElapsedLabel(item: ToolCallItem): string | null {
  const isRunning = item.status === 'running' || item.status === 'pending'
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!isRunning) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [isRunning])

  if (!item.startedAt) return null
  const end = isRunning ? now : item.finishedAt
  if (!end) return null
  const ms = end - item.startedAt
  if (ms < 1000 && !isRunning) return null
  return formatDuration(ms)
}

function shortenMiddle(value: string, max = 112): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const left = Math.ceil((max - 3) * 0.62)
  const right = Math.floor((max - 3) * 0.38)
  return `${clean.slice(0, left)}...${clean.slice(-right)}`
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const disabled = !value

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>): Promise<void> => {
    event.stopPropagation()
    if (disabled) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--ink-soft)] hover:bg-black/[0.04] disabled:opacity-40"
      title={label}
    >
      {copied ? <ClipboardCheck size={12} className="text-green-600" /> : <Clipboard size={12} />}
      {copied ? '已复制' : label}
    </button>
  )
}

function DetailPre({ children, tone = 'neutral', maxHeight = 'max-h-60' }: { children: ReactNode; tone?: 'neutral' | 'danger' | 'success'; maxHeight?: string }) {
  const toneClass = tone === 'danger'
    ? 'bg-red-50/70 text-red-700'
    : tone === 'success'
      ? 'bg-green-50/60 text-green-700'
      : 'bg-black/[0.03] text-[var(--ink-soft)]'

  return (
    <pre className={`px-3 py-2 text-xs whitespace-pre-wrap break-all font-mono overflow-y-auto ${maxHeight} ${toneClass}`}>
      {children}
    </pre>
  )
}

function isDeletionCommand(command: string): boolean {
  return /(^|[;&|]\s*)rm\s+/.test(command.trim()) || /\btrash\s+/.test(command.trim())
}

/** write_file 的文件变更预览：展示写入目标、行数和内容片段。 */
export function WriteFileDiffView({ item }: { item: ToolCallItem }) {
  const [open, setOpen] = useState(false)
  const filePath = typeof item.args.path === 'string' ? item.args.path : ''
  const content = typeof item.args.content === 'string' ? item.args.content : ''
  const fileName = fileNameOf(filePath)
  const lines = countLines(content)
  const parsed = parseResult(item.result)
  const hasError = item.status === 'failed' || typeof parsed?.error === 'string'

  return (
    <div className={`rounded-lg overflow-hidden text-sm border ${hasError ? 'border-red-200 bg-red-50/30' : 'border-black/[0.06]'}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-black/[0.02] transition"
      >
        <FileCode size={14} className={hasError ? 'text-red-500 flex-shrink-0' : 'text-sky-600 flex-shrink-0'} />
        <span className="text-[var(--ink)] font-mono truncate" title={filePath}>{fileName}</span>
        <span className="text-xs text-green-600 flex-shrink-0">写入 {lines} 行</span>
        {hasError && <span className="text-xs text-red-500 flex-shrink-0">写入失败</span>}
        <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ml-auto ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-black/[0.04]">
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-[var(--ink-soft)] bg-black/[0.015]">
            <span className="truncate" title={filePath}>{filePath || '未提供路径'}</span>
            <CopyButton value={content} label="复制内容" />
          </div>
          {hasError ? (
            <DetailPre tone="danger">{String(parsed?.error || item.error || '写入失败')}</DetailPre>
          ) : content ? (
            <DetailPre tone="success">{content.slice(0, 2400)}{content.length > 2400 ? `\n...（共 ${content.length} 字，仅显示前 2400 字）` : ''}</DetailPre>
          ) : (
            <div className="px-3 py-2 text-xs text-[var(--ink-soft)]">写入的是空文件。</div>
          )}
        </div>
      )}
    </div>
  )
}

/** shell 的终端输出展示：运行中动画、耗时、长命令缩略、复制和错误说明。 */
export function ShellOutputView({ item }: { item: ToolCallItem }) {
  const [open, setOpen] = useState(false)
  const command = typeof item.args.command === 'string' ? item.args.command : ''
  const parsed = parseResult(item.result)
  const stdout = typeof parsed?.stdout === 'string' ? parsed.stdout : ''
  const stderr = typeof parsed?.stderr === 'string' ? parsed.stderr : ''
  const errorText = typeof parsed?.error === 'string' ? parsed.error : item.error || ''
  const exitCode = typeof parsed?.exitCode === 'number' ? parsed.exitCode : null
  const output = [stdout, stderr, errorText].filter(Boolean).join('\n') || (!parsed ? item.result || '' : '')
  const elapsed = useElapsedLabel(item)
  const isRunning = item.status === 'running' || item.status === 'pending'
  const hasError = item.status === 'failed' || (exitCode !== null && exitCode !== 0) || Boolean(errorText)
  const hasDeletionRisk = isDeletionCommand(command)
  const outputLines = output ? countLines(output) : 0
  const shortCommand = shortenMiddle(command)

  return (
    <div className={`rounded-lg overflow-hidden text-sm border ${hasError ? 'border-red-200 bg-red-50/25' : hasDeletionRisk ? 'border-amber-200 bg-amber-50/30' : 'border-black/[0.06]'}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-black/[0.02] transition ${isRunning ? 'whale-shimmer bg-sky-50/40' : ''}`}
      >
        {isRunning ? <Loader2 size={14} className="text-sky-500 animate-spin flex-shrink-0" /> : <Terminal size={14} className="text-[var(--ink-soft)] flex-shrink-0" />}
        <span className="text-[var(--ink)] font-mono truncate flex-1 text-left" title={command}>$ {shortCommand || '命令'}</span>
        {hasDeletionRisk && <span className="inline-flex items-center gap-1 text-xs text-amber-600 flex-shrink-0"><AlertTriangle size={12} />删除动作</span>}
        {isRunning && <span className="text-xs text-sky-600 flex-shrink-0">运行中</span>}
        {elapsed && <span className="text-xs text-[var(--ink-soft)] flex-shrink-0">{elapsed}</span>}
        {outputLines > 0 && <span className="text-xs text-[var(--ink-soft)] flex-shrink-0">{outputLines} 行输出</span>}
        {hasError && <span className="text-xs text-red-500 flex-shrink-0">{exitCode !== null ? `退出码 ${exitCode}` : '出错'}</span>}
        {!hasError && !isRunning && exitCode === 0 && <span className="text-xs text-green-600 flex-shrink-0">完成</span>}
        <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-black/[0.04]">
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-[var(--ink-soft)] bg-black/[0.015]">
            <span className="truncate" title={command}>完整命令：{command || '未提供命令'}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <CopyButton value={command} label="复制命令" />
              <CopyButton value={output} label="复制输出" />
            </div>
          </div>
          {hasDeletionRisk && (
            <div className="flex items-start gap-2 px-3 py-2 text-xs text-amber-700 bg-amber-50/70 border-b border-amber-100">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              这条命令包含删除动作，执行前后都要重点关注结果。
            </div>
          )}
          {isRunning && !output && (
            <div className="px-3 py-3 text-xs text-sky-600 flex items-center gap-2">
              <Loader2 size={13} className="animate-spin" />
              正在等待命令返回结果...
            </div>
          )}
          {output && (
            <DetailPre tone={hasError ? 'danger' : 'neutral'} maxHeight="max-h-72">
              {output.slice(0, 6000)}{output.length > 6000 ? `\n...（共 ${output.length} 字，仅显示前 6000 字）` : ''}
            </DetailPre>
          )}
        </div>
      )}
    </div>
  )
}

export function ReadFileView({ item }: { item: ToolCallItem }) {
  const [open, setOpen] = useState(false)
  const filePath = typeof item.args.path === 'string' ? item.args.path : ''
  const parsed = parseResult(item.result)
  const content = typeof parsed?.content === 'string'
    ? parsed.content
    : typeof parsed?.text === 'string'
      ? parsed.text
      : typeof item.result === 'string'
        ? item.result
        : ''
  const size = formatBytes(parsed?.size)
  const hasError = item.status === 'failed' || typeof parsed?.error === 'string'
  const lines = countLines(content)

  return (
    <div className={`rounded-lg overflow-hidden text-sm border ${hasError ? 'border-red-200 bg-red-50/25' : 'border-black/[0.06]'}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-black/[0.02] transition">
        <FileText size={14} className={hasError ? 'text-red-500 flex-shrink-0' : 'text-[var(--ink-soft)] flex-shrink-0'} />
        <span className="text-[var(--ink)] font-mono truncate" title={filePath}>{fileNameOf(filePath, '文件')}</span>
        {!hasError && lines > 0 && <span className="text-xs text-[var(--ink-soft)] flex-shrink-0">{lines} 行</span>}
        {!hasError && size && <span className="text-xs text-[var(--ink-soft)] flex-shrink-0">{size}</span>}
        {hasError && <span className="text-xs text-red-500 flex-shrink-0">读取失败</span>}
        <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ml-auto ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-black/[0.04]">
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-[var(--ink-soft)] bg-black/[0.015]">
            <span className="truncate" title={filePath}>{filePath || '未提供路径'}</span>
            <CopyButton value={content} label="复制内容" />
          </div>
          {hasError ? <DetailPre tone="danger">{String(parsed?.error || item.error || '读取失败')}</DetailPre> : <DetailPre>{content.slice(0, 2400)}{content.length > 2400 ? `\n...（共 ${content.length} 字，仅显示前 2400 字）` : ''}</DetailPre>}
        </div>
      )}
    </div>
  )
}

export function ListFilesView({ item }: { item: ToolCallItem }) {
  const [open, setOpen] = useState(false)
  const dir = typeof item.args.dir === 'string' ? item.args.dir : '.'
  const parsed = parseResult(item.result)
  const items = useMemo(() => Array.isArray(parsed?.items) ? parsed.items as Array<Record<string, unknown>> : [], [parsed])
  const hasError = item.status === 'failed' || typeof parsed?.error === 'string'
  const fileCount = items.filter((it) => it.type !== 'dir').length
  const dirCount = items.filter((it) => it.type === 'dir').length

  return (
    <div className={`rounded-lg overflow-hidden text-sm border ${hasError ? 'border-red-200 bg-red-50/25' : 'border-black/[0.06]'}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-black/[0.02] transition">
        <FolderOpen size={14} className={hasError ? 'text-red-500 flex-shrink-0' : 'text-[var(--ink-soft)] flex-shrink-0'} />
        <span className="text-[var(--ink)] font-mono truncate" title={dir}>列出 {dir}</span>
        {!hasError && <span className="text-xs text-[var(--ink-soft)] flex-shrink-0">{fileCount} 个文件 · {dirCount} 个文件夹</span>}
        {hasError && <span className="text-xs text-red-500 flex-shrink-0">检索失败</span>}
        <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ml-auto ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-black/[0.04]">
          {hasError ? (
            <DetailPre tone="danger">{String(parsed?.error || item.error || '检索失败')}</DetailPre>
          ) : items.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--ink-soft)]">这个位置没有列出文件。</div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-black/[0.04]">
              {items.slice(0, 80).map((entry, index) => {
                const name = typeof entry.name === 'string' ? entry.name : '未命名'
                const path = typeof entry.path === 'string' ? entry.path : name
                const type = entry.type === 'dir' ? '文件夹' : '文件'
                return (
                  <div key={`${path}-${index}`} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                    <span className="text-[var(--ink-soft)] w-10 flex-shrink-0">{type}</span>
                    <span className="font-mono text-[var(--ink)] truncate" title={path}>{name}</span>
                    <span className="ml-auto text-[var(--ink-soft)] flex-shrink-0">{formatBytes(entry.size) || ''}</span>
                  </div>
                )
              })}
              {items.length > 80 && <div className="px-3 py-2 text-xs text-[var(--ink-soft)]">仅显示前 80 项，共 {items.length} 项。</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** 根据工具类型选择特化视图，无匹配返回 null（走通用渲染） */
export function trySpecialView(item: ToolCallItem): React.ReactNode | null {
  if (item.kind === 'write_file' && typeof item.args.path === 'string') {
    return <WriteFileDiffView item={item} />
  }
  if (item.kind === 'read_file' && typeof item.args.path === 'string') {
    return <ReadFileView item={item} />
  }
  if (item.kind === 'list_files') {
    return <ListFilesView item={item} />
  }
  if (item.kind === 'shell') {
    return <ShellOutputView item={item} />
  }
  return null
}
