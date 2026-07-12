import { useState } from 'react'
import { Check, Edit3, ListChecks, X } from 'lucide-react'
import { useTaskStore } from '../store/task'

/** 执行计划确认：挂在 Composer（输入框位置），风格对齐询问/审批卡 */
export function PlanCard() {
  const { pendingPlan, respondPlan } = useTaskStore()
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [pending, setPending] = useState(false)

  if (!pendingPlan) return null

  const handleDecision = async (decision: 'approve' | 'reject_stop' | 'reject_revise') => {
    if (decision === 'reject_revise' && !feedback.trim()) return
    setPending(true)
    try {
      await respondPlan(decision, decision === 'reject_revise' ? feedback : undefined)
      if (decision === 'reject_revise') {
        setFeedback('')
        setShowFeedback(false)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-[26px] floating-surface px-5 py-4 space-y-3">
      <div className="flex items-start gap-2">
        <ListChecks size={16} className="mt-0.5 flex-shrink-0 text-[var(--whale-blue)]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--ink)]">执行计划</span>
            <span className="rounded-full bg-[var(--whale-blue-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--whale-blue)]">
              待确认
            </span>
          </div>
          {pendingPlan.plan && (
            <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{pendingPlan.plan}</p>
          )}
        </div>
      </div>

      {pendingPlan.steps.length > 0 && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl bg-black/[0.025] px-3 py-2">
          {pendingPlan.steps.map((s) => (
            <div key={s.step} className="flex items-start gap-2.5 py-1 text-sm">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[11px] font-semibold text-[var(--ink-soft)]">
                {s.step}
              </span>
              <span className={`min-w-0 flex-1 leading-relaxed ${s.status === 'removed' ? 'text-[var(--ink-soft)] line-through' : 'text-[var(--ink)]'}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {showFeedback && (
        <label className="flex min-h-10 items-start gap-2 rounded-2xl border border-black/[0.08] bg-white px-3 py-2 transition focus-within:border-[#0071e3]">
          <Edit3 size={15} className="mt-0.5 flex-shrink-0 text-[var(--ink-soft)]" />
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={pending}
            placeholder="告诉小蓝鲸怎么调整计划…"
            rows={2}
            className="max-h-28 min-h-10 flex-1 resize-none bg-transparent text-sm leading-5 text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)] disabled:opacity-50"
          />
        </label>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleDecision('approve')}
          disabled={pending}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#0071e3] px-4 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40"
        >
          <Check size={14} />
          开始执行
        </button>
        {showFeedback ? (
          <button
            type="button"
            onClick={() => void handleDecision('reject_revise')}
            disabled={pending || !feedback.trim()}
            className="h-10 rounded-full px-3 text-sm font-medium text-[var(--ink)] transition hover:bg-black/[0.04] disabled:opacity-40"
          >
            提交调整
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowFeedback(true)}
            disabled={pending}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[var(--ink-soft)] transition hover:bg-black/[0.04] disabled:opacity-40"
          >
            <Edit3 size={13} />
            调整计划
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleDecision('reject_stop')}
          disabled={pending}
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40"
        >
          <X size={14} />
          不执行
        </button>
      </div>
    </div>
  )
}
