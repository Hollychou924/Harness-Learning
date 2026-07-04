import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { Turn } from '../../../agent/src/items'
import type { TodoItem } from '../store/task'
import { countCompletedSteps, deriveProgressSteps } from './executionExperience'

type Props = {
  status: string
  currentTurn: Turn | null
  todos: TodoItem[]
  hasApprovalPending: boolean
}

export function ProgressPill({ status, currentTurn, todos, hasApprovalPending }: Props) {
  if (hasApprovalPending) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs text-amber-700">
        <AlertCircle size={13} />
        等待你确认
      </div>
    )
  }

  const steps = deriveProgressSteps(currentTurn, todos)
  if (status !== 'executing' || steps.length === 0) return null

  const done = countCompletedSteps(steps)
  const runningIndex = steps.findIndex((step) => step.status === 'running')
  const current = runningIndex >= 0 ? runningIndex + 1 : Math.min(done + 1, steps.length)
  const complete = done >= steps.length

  return (
    <div className="relative group/progress inline-flex">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-black/[0.06] px-2.5 py-1 text-xs text-[var(--ink-soft)] shadow-sm">
        {complete ? <CheckCircle2 size={13} className="text-green-500" /> : <Loader2 size={13} className="text-sky-500 animate-spin" />}
        <span>{complete ? `已完成 ${steps.length} 步` : `第 ${current} / ${steps.length} 步`}</span>
      </div>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden w-72 -translate-x-1/2 rounded-2xl border border-white/60 bg-white/95 p-2 shadow-xl group-hover/progress:block">
        <div className="space-y-1">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs">
              <span className={`h-2 w-2 rounded-full ${
                step.status === 'completed' ? 'bg-green-500' : step.status === 'running' ? 'bg-sky-500 animate-pulse' : 'bg-black/15'
              }`} />
              <span className="w-10 text-[var(--ink-soft)]">第 {index + 1} 步</span>
              <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{step.label}</span>
              <span className="text-[var(--ink-soft)]">
                {step.status === 'completed' ? '完成' : step.status === 'running' ? '进行中' : '未开始'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
