import { useEffect, useState } from 'react'
import type { Turn } from '../../../agent/src/items'
import { deriveExecutionSummary } from './executionExperience'
import { RunningStatusText } from './RunningStatusText'

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
      <div className="inline-flex items-center px-1 py-1 text-sm">
        <RunningStatusText>{summary.label}</RunningStatusText>
      </div>
      <div className="h-px w-full bg-black/[0.06]" />
    </div>
  )
}
