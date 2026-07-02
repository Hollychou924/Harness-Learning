import type { ReactNode } from 'react'
import {
  Globe, FileText, FileSearch, FilePlus, FileEdit, Terminal, Code, FileType, FileSpreadsheet, type LucideIcon
} from 'lucide-react'
import type { ToolLogEntry } from '../store/task'
import { api } from '../api'
import { ToolCardShell, DetailBlock, type ToolCardStatus } from './ToolCardShell'

export interface ToolCardProps {
  entry: ToolLogEntry
}

export interface ToolCardDef {
  icon: ReactNode
  title: string
  target?: string
  status: ToolCardStatus
  badges?: ReactNode
  children?: ReactNode
}

function getStatus(entry: ToolLogEntry): ToolCardStatus {
  if (!entry.result) return 'calling'
  if (entry.result.includes('"error"')) return 'error'
  return 'done'
}

function extractTarget(name: string, args: Record<string, unknown>): string {
  if (name === 'fetch_page' && typeof args.url === 'string') return shortenUrl(args.url)
  if (name === 'read_file' && typeof args.path === 'string') return args.path
  if (name === 'list_files' && typeof args.dir === 'string') return args.dir
  if (name === 'write_file' && typeof args.path === 'string') return args.path
  if (name === 'create_docx' && typeof args.path === 'string') return args.path
  if (name === 'create_xlsx' && typeof args.path === 'string') return args.path
  if (name === 'parse_page' && typeof args.url === 'string') return shortenUrl(args.url)
  return ''
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname + (u.pathname !== '/' ? u.pathname.slice(0, 20) : '')
  } catch {
    return url.slice(0, 30)
  }
}

function formatResult(s: string): string {
  try {
    const obj = JSON.parse(s)
    if (obj.error) return `错误：${obj.error}`
    if (obj.text) return obj.text.slice(0, 800)
    if (obj.html) return `[网页内容 ${obj.length || '?'} 字符]`
    if (obj.title) return `标题：${obj.title}\n${obj.text?.slice(0, 400) || ''}`
    if (obj.items) return `共 ${obj.items.length} 项\n${obj.items.slice(0, 10).map((i: { name: string }) => '  ' + i.name).join('\n')}`
    return JSON.stringify(obj, null, 2).slice(0, 800)
  } catch {
    return s.slice(0, 800)
  }
}

const TOOL_META: Record<string, { label: string; icon: ReactNode }> = {
  fetch_page: { label: '网页读取', icon: <Globe size={14} /> },
  parse_page: { label: '内容解析', icon: <FileText size={14} /> },
  list_files: { label: '文件检索', icon: <FileSearch size={14} /> },
  read_file: { label: '文件读取', icon: <FileText size={14} /> },
  write_file: { label: '文件写入', icon: <FilePlus size={14} /> },
  create_docx: { label: '生成 Word', icon: <FileType size={14} /> },
  create_xlsx: { label: '生成 Excel', icon: <FileSpreadsheet size={14} /> },
  edit_file: { label: '文件编辑', icon: <FileEdit size={14} /> },
  shell: { label: '执行命令', icon: <Terminal size={14} /> },
}

export function ToolCard({ entry }: ToolCardProps) {
  const status = getStatus(entry)
  const meta = TOOL_META[entry.name]
  const target = extractTarget(entry.name, entry.args)

  if (entry.name === 'write_file') return <WriteFileCard entry={entry} />
  if (entry.name === 'create_docx') return <DocGenCard entry={entry} fileType="Word" />
  if (entry.name === 'create_xlsx') return <DocGenCard entry={entry} fileType="Excel" />
  if (entry.name === 'edit_file') return <EditFileCard entry={entry} />
  if (entry.name === 'shell') return <ShellCard entry={entry} />

  const title = meta?.label || formatToolName(entry.name)
  const icon = meta?.icon || <Code size={14} />

  return (
    <ToolCardShell status={status} icon={icon} title={title} target={target}>
      {Object.keys(entry.args).length > 0 && (
        <DetailBlock title="参数" content={JSON.stringify(entry.args, null, 2)} />
      )}
      {entry.result && (
        <DetailBlock title="结果" content={formatResult(entry.result)} />
      )}
    </ToolCardShell>
  )
}

function WriteFileCard({ entry }: ToolCardProps) {
  const status = getStatus(entry)
  const path = typeof entry.args.path === 'string' ? entry.args.path : ''
  const content = typeof entry.args.content === 'string' ? entry.args.content : ''
  const name = path.split('/').pop() || path || '未命名'
  const lines = content === '' ? 0 : content.split('\n').length

  return (
    <ToolCardShell
      status={status}
      icon={<FilePlus size={14} />}
      title={`写入 ${name}`}
      target={path}
      badges={status === 'done' && lines > 0 ? (
        <span className="text-xs font-mono text-green-600">+{lines} 行</span>
      ) : undefined}
    >
      {content && <DetailBlock title="内容" content={content} />}
    </ToolCardShell>
  )
}

function EditFileCard({ entry }: ToolCardProps) {
  const status = getStatus(entry)
  const path = typeof entry.args.path === 'string' ? entry.args.path : ''
  const oldText = typeof entry.args.old_text === 'string' ? entry.args.old_text : ''
  const newText = typeof entry.args.new_text === 'string' ? entry.args.new_text : ''
  const name = path.split('/').pop() || path || '未命名'
  const addLines = newText ? newText.split('\n').length : 0
  const delLines = oldText ? oldText.split('\n').length : 0

  return (
    <ToolCardShell
      status={status}
      icon={<FileEdit size={14} />}
      title={`编辑 ${name}`}
      target={path}
      badges={status === 'done' && (
        <>
          {addLines > 0 && <span className="text-xs font-mono text-green-600">+{addLines}</span>}
          {delLines > 0 && <span className="text-xs font-mono text-red-500">-{delLines}</span>}
        </>
      )}
    >
      {(oldText || newText) && (
        <div className="rounded-md bg-black/[0.03] overflow-hidden">
          <div className="px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--ink-soft)] border-b border-black/[0.04]">
            Diff
          </div>
          <pre className="px-2.5 py-1.5 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
            {oldText.split('\n').map((line, i) => (
              <div key={`d${i}`} className="text-red-500">- {line}</div>
            ))}
            {newText.split('\n').map((line, i) => (
              <div key={`a${i}`} className="text-green-600">+ {line}</div>
            ))}
          </pre>
        </div>
      )}
    </ToolCardShell>
  )
}

function ShellCard({ entry }: ToolCardProps) {
  const status = getStatus(entry)
  const command = typeof entry.args.command === 'string' ? entry.args.command : ''

  return (
    <ToolCardShell
      status={status}
      icon={<Terminal size={14} />}
      title={command ? `执行：${command}` : '执行命令'}
    >
      {entry.result && <DetailBlock title="输出" content={formatResult(entry.result)} />}
    </ToolCardShell>
  )
}


function DocGenCard({ entry, fileType }: ToolCardProps & { fileType: string }) {
  const status = getStatus(entry)
  const path = typeof entry.args.path === 'string' ? entry.args.path : ''
  const name = path.split('/').pop() || path || '未命名'
  const icon = fileType === 'Word' ? <FileType size={14} /> : <FileSpreadsheet size={14} />
  const ok = status === 'done' && entry.result && !entry.result.includes('"error"')
  let resultPath = ''
  if (ok) {
    try {
      const obj = JSON.parse(entry.result || '{}')
      if (obj.path) resultPath = obj.path
    } catch { /* ignore */ }
  }

  return (
    <ToolCardShell
      status={status}
      icon={icon}
      title={`生成 ${fileType}：${name}`}
      target={path}
      badges={ok ? <span className="text-xs font-mono text-green-600">✓ 已生成</span> : undefined}
    >
      {ok && resultPath && (
        <button
          onClick={() => api.openPath(resultPath)}
          className="text-xs text-[#0071e3] hover:underline"
        >
          打开文件 →
        </button>
      )}
      {!ok && entry.result && <DetailBlock title="结果" content={formatResult(entry.result)} />}
    </ToolCardShell>
  )
}

function formatToolName(name: string): string {
  if (name.startsWith('mcp__')) {
    const parts = name.split('__')
    if (parts.length >= 3) return `${parts[1]}: ${parts.slice(2).join('_')}`
  }
  return name
}
