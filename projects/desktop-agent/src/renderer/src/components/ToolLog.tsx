import { useState } from 'react'
import { ChevronRight, Globe, FileText, FileSearch, FilePlus, Loader2, Check } from 'lucide-react'
import type { ToolLogEntry } from '../store/task'

// 工具中文名 + 进行/完成两态文案
const TOOL_META: Record<string, { label: string; doing: string; done: string; icon: React.ReactNode }> = {
  fetch_page: {
    label: '网页读取',
    doing: '读取中',
    done: '已读取',
    icon: <Globe size={14} />
  },
  parse_page: {
    label: '内容解析',
    doing: '解析中',
    done: '已解析',
    icon: <FileText size={14} />
  },
  list_files: {
    label: '文件检索',
    doing: '检索中',
    done: '已检索',
    icon: <FileSearch size={14} />
  },
  read_file: {
    label: '文件读取',
    doing: '读取中',
    done: '已读取',
    icon: <FileText size={14} />
  },
  write_file: {
    label: '文件写入',
    doing: '写入中',
    done: '已写入',
    icon: <FilePlus size={14} />
  }
}

export function ToolLog({ entry }: { entry: ToolLogEntry }) {
  const [open, setOpen] = useState(false)
  const meta = TOOL_META[entry.name] || {
    label: entry.name,
    doing: '执行中',
    done: '已执行',
    icon: <FileText size={14} />
  }
  const done = Boolean(entry.result)
  const failed = entry.result?.includes('"error"')
  const target = extractTarget(entry.name, entry.args)

  return (
    <div className="rounded-lg overflow-hidden text-sm">
      {/* 步骤头：一行可读文案，点击展开详情 */}
      <button
        onClick={() => done && setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 transition ${
          open ? 'bg-black/[0.04]' : 'hover:bg-black/[0.02]'
        }`}
      >
        {done ? (
          failed ? (
            <span className="w-3.5 h-3.5 flex items-center justify-center text-amber-500">⚠</span>
          ) : (
            <Check size={14} className="text-green-500 flex-shrink-0" />
          )
        ) : (
          <Loader2 size={14} className="text-sky-500 animate-spin flex-shrink-0" />
        )}
        <span className="text-[var(--ink-soft)] flex-shrink-0">{meta.icon}</span>
        <span className={done ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'}>
          {meta.label}
          {target && <span className="text-[var(--ink-soft)]"> · {target}</span>}
        </span>
        <span className={`text-xs ml-auto ${done ? 'text-[var(--ink-soft)]' : 'text-sky-500'}`}>
          {done ? meta.done : meta.doing}
        </span>
        {done && (
          <ChevronRight
            size={14}
            className={`text-[var(--ink-soft)] transition-transform ${open ? 'rotate-90' : ''}`}
          />
        )}
      </button>

      {/* 折叠详情：命令/参数/结果，默认收起 */}
      {open && done && (
        <div className="px-3 pb-2 pt-1 space-y-1.5">
          {Object.keys(entry.args).length > 0 && (
            <DetailBlock title="参数" content={JSON.stringify(entry.args, null, 2)} />
          )}
          {entry.result && (
            <DetailBlock title="结果" content={formatResult(entry.result)} />
          )}
        </div>
      )}
    </div>
  )
}

function DetailBlock({ title, content }: { title: string; content: string }) {
  const [expanded, setExpanded] = useState(false)
  const tooLong = content.length > 200
  const shown = expanded ? content : content.slice(0, 200)
  return (
    <div className="rounded-md bg-black/[0.03] overflow-hidden">
      <div className="px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--ink-soft)] border-b border-black/[0.04]">
        {title}
      </div>
      <pre className="px-2.5 py-1.5 text-xs text-[var(--ink-soft)] whitespace-pre-wrap break-all font-mono max-h-60 overflow-y-auto">
        {shown}
        {tooLong && !expanded && <span className="text-[var(--ink-soft)]"> …</span>}
      </pre>
      {tooLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-2.5 py-1 text-xs text-[#0071e3] hover:underline"
        >
          {expanded ? '收起' : `展开全部（${content.length} 字）`}
        </button>
      )}
    </div>
  )
}

// 从工具参数里提取一个可读的目标，比如 URL 或文件名
function extractTarget(name: string, args: Record<string, unknown>): string {
  if (name === 'fetch_page' && typeof args.url === 'string') {
    return shortenUrl(args.url)
  }
  if (name === 'read_file' && typeof args.path === 'string') return args.path
  if (name === 'list_files' && typeof args.dir === 'string') return args.dir
  if (name === 'write_file' && typeof args.path === 'string') return args.path
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
