import { useState, type ReactNode } from 'react'
import { ChevronRight, Loader2, Check, AlertCircle } from 'lucide-react'

export type ToolCardStatus = 'calling' | 'done' | 'error'

export interface ToolCardShellProps {
  status: ToolCardStatus
  icon: ReactNode
  title: string
  target?: string
  badges?: ReactNode
  children?: ReactNode
}

export function ToolCardShell({ status, icon, title, target, badges, children }: ToolCardShellProps) {
  const [open, setOpen] = useState(false)
  const hasDetail = Boolean(children) && status !== 'calling'
  const canToggle = status !== 'calling' && hasDetail

  return (
    <div className="rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => canToggle && setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 transition ${
          open ? 'bg-black/[0.04]' : 'hover:bg-black/[0.02]'
        } ${canToggle ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {status === 'calling' ? (
          <Loader2 size={14} className="text-sky-500 animate-spin flex-shrink-0" />
        ) : status === 'error' ? (
          <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
        ) : (
          <Check size={14} className="text-green-500 flex-shrink-0" />
        )}
        <span className="text-[var(--ink-soft)] flex-shrink-0">{icon}</span>
        <span className={status === 'calling' ? 'text-[var(--ink-soft)]' : 'text-[var(--ink)]'}>
          {title}
          {target && <span className="text-[var(--ink-soft)]"> · {target}</span>}
        </span>
        {badges && <span className="flex items-center gap-1 ml-1">{badges}</span>}
        {canToggle && (
          <ChevronRight
            size={14}
            className={`text-[var(--ink-soft)] transition-transform ml-auto ${open ? 'rotate-90' : ''}`}
          />
        )}
        {!canToggle && status === 'calling' && (
          <span className="text-xs text-sky-500 ml-auto">执行中</span>
        )}
      </button>
      {open && hasDetail && (
        <div className="px-3 pb-2 pt-1 space-y-1.5">{children}</div>
      )}
    </div>
  )
}

export function DetailBlock({ title, content }: { title: string; content: string }) {
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
