import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Turn } from '../../../agent/src/items'
import { deriveExecutionSummary } from './executionExperience'

export function ExecutionSummaryBar({ status, turn }: { status: string; turn: Turn | null }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (status !== 'executing') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [status])

  const summary = deriveExecutionSummary(status, turn, now)
  if (summary.mode === 'idle') return null

  return (
    <div className="space-y-2">
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-sky-700 ${summary.mode === 'thinking' ? 'whale-shimmer bg-sky-50' : 'bg-sky-50/70'}`}>
        <Loader2 size={14} className="animate-spin" />
        <span>{summary.label}</span>
      </div>
      <div className="h-px w-full bg-black/[0.06]" />
    </div>
  )
}
