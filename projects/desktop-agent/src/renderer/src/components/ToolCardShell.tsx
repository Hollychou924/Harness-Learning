import { useState, type ReactNode } from 'react'
import { ChevronRight, Check, AlertCircle } from 'lucide-react'
import { RunningStatusText } from './RunningStatusText'

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
    <div className="rounded-lg overflow-hidden text-sm text-[var(--ink-soft)]">
      <button
        onClick={() => canToggle && setOpen(!open)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 transition hover:text-[var(--ink)] ${canToggle ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {status === 'error' ? (
          <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
        ) : status === 'done' ? (
          <Check size={14} className="text-green-500 flex-shrink-0" />
        ) : null}
        <span className="text-[var(--ink-soft)] flex-shrink-0">{icon}</span>
        <span className="text-[var(--ink-soft)]">
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
          <RunningStatusText className="text-xs ml-auto">执行中</RunningStatusText>
        )}
      </button>
      {open && hasDetail && (
        <div className="px-2 pb-2 pt-1 space-y-1.5">{children}</div>
      )}
    </div>
  )
}

export function DetailBlock({ title, content }: { title: string; content: string }) {
  const [expanded, setExpanded] = useState(false)
  const tooLong = content.length > 200
  const shown = expanded ? content : content.slice(0, 200)
  return (
    <div className="overflow-hidden border-l border-black/[0.06] pl-3">
      <div className="py-1 text-[10px] uppercase tracking-wide text-[var(--ink-soft)]/70">
        {title}
      </div>
      <pre className="py-1 text-xs text-[var(--ink-soft)]/80 whitespace-pre-wrap break-all font-mono max-h-60 overflow-y-auto">
        {shown}
        {tooLong && !expanded && <span className="text-[var(--ink-soft)]"> …</span>}
      </pre>
      {tooLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="py-1 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          {expanded ? '收起' : `展开全部（${content.length} 字）`}
        </button>
      )}
    </div>
  )
}
