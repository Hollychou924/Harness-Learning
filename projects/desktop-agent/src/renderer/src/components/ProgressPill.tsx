import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { ToolCallItem, Turn } from '../../../agent/src/items'

type Props = {
  status: string
  currentTurn: Turn | null
  hasApprovalPending: boolean
}

export function ProgressPill({ status, currentTurn, hasApprovalPending }: Props) {
  if (hasApprovalPending) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs text-amber-700">
        <AlertCircle size={13} />
        等待你确认
      </div>
    )
  }

  const toolItems = (currentTurn?.items ?? []).filter((it): it is ToolCallItem => it.type === 'toolCall')
  const total = toolItems.length
  if (status !== 'executing' || total === 0) return null

  const done = toolItems.filter((it) => it.status === 'completed' || it.status === 'failed' || it.status === 'stopped' || it.status === 'canceled').length
  const current = Math.min(done + 1, total)
  const complete = done >= total

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-black/[0.06] px-2.5 py-1 text-xs text-[var(--ink-soft)] shadow-sm">
      {complete ? <CheckCircle2 size={13} className="text-green-500" /> : <Loader2 size={13} className="text-sky-500 animate-spin" />}
      <span>{complete ? `已完成 ${total} 步` : `第 ${current} / ${total} 步`}</span>
    </div>
  )
}
