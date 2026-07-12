import { CheckCircle2 } from 'lucide-react'
import type { Turn } from '../../../agent/src/items'
import type { TodoItem } from '../store/task'
import { countCompletedSteps, deriveFileChangeProgress, deriveProgressSteps } from './executionExperience'
import { WhaleTooltip } from './WhaleTooltip'

type Props = {
  status: string
  currentTurn: Turn | null
  todos: TodoItem[]
  hasApprovalPending: boolean
}

export function ProgressPill({ status, currentTurn, todos, hasApprovalPending }: Props) {
  // 审批卡已改挂 Composer，审批中不再单独显示「等待你确认」pill
  if (hasApprovalPending) return null

  const steps = deriveProgressSteps(currentTurn, todos)
  if (status !== 'executing' || steps.length === 0) return null

  const done = countCompletedSteps(steps)
  const runningIndex = steps.findIndex((step) => step.status === 'running')
  const current = runningIndex >= 0 ? runningIndex + 1 : Math.min(done + 1, steps.length)
  const complete = done >= steps.length
  const percent = steps.length > 0 ? Math.round((done / steps.length) * 100) : 0
  const fileProgress = deriveFileChangeProgress(currentTurn)
  const showFileProgress = fileProgress.fileCount > 0

  return (
    <div className="relative group/progress inline-flex">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-black/[0.06] px-2.5 py-1 text-xs text-[var(--ink-soft)] shadow-sm">
        {complete ? <CheckCircle2 size={13} className="text-green-500" /> : <ProgressRing percent={percent} />}
        <span>{complete ? `已完成 ${steps.length} 步` : `第 ${current} / ${steps.length} 步`}</span>
        {showFileProgress && (
          <>
            <span className="h-3 w-px bg-black/[0.08]" />
            <span>已更改 {fileProgress.fileCount} 个文件</span>
            <span className="font-medium text-sky-600">+{fileProgress.addedChars}</span>
            <span className="font-medium text-amber-600">-{fileProgress.deletedChars}</span>
          </>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden w-72 -translate-x-1/2 rounded-2xl floating-surface p-2 group-hover/progress:block">
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

function ProgressRing({ percent }: { percent: number }) {
  const safePercent = Math.min(100, Math.max(0, percent))
  const radius = 6
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (safePercent / 100) * circumference
  return (
    <WhaleTooltip label={`${safePercent}%`}>
      <span className="relative flex h-4 w-4 items-center justify-center">
        <svg className="-rotate-90" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r={radius} fill="none" stroke="rgba(0,113,227,0.18)" strokeWidth="2" />
          <circle
            cx="8"
            cy="8"
            r={radius}
            fill="none"
            stroke="var(--whale-blue)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <span className="absolute h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
      </span>
    </WhaleTooltip>
  )
}
