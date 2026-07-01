import { useState } from 'react'
import { Check, Loader2, X, Edit3 } from 'lucide-react'
import { useTaskStore } from '../store/task'

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
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--ink)]">执行计划</span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 text-sky-600">
          待确认
        </span>
      </div>

      {pendingPlan.plan && (
        <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{pendingPlan.plan}</p>
      )}

      {pendingPlan.steps.length > 0 && (
        <div className="space-y-1">
          {pendingPlan.steps.map((s) => (
            <div key={s.step} className="flex items-center gap-2 text-sm">
              <span className="text-xs font-mono text-[var(--ink-soft)] w-5">{s.step}.</span>
              <span className={s.status === 'removed' ? 'text-[var(--ink-soft)] line-through' : 'text-[var(--ink)]'}>
                {s.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {showFeedback && (
        <div className="space-y-2">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="告诉 Agent 怎么调整计划…"
            rows={2}
            className="w-full px-3 py-2 rounded-lg glass-soft text-sm outline-none resize-none"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleDecision('approve')}
          disabled={pending}
          className="h-8 px-4 rounded-lg bg-[#0071e3] text-white text-sm font-medium hover:brightness-110 transition disabled:opacity-40"
        >
          <span className="flex items-center gap-1.5"><Check size={14} /> 开始</span>
        </button>
        {showFeedback ? (
          <button
            onClick={() => handleDecision('reject_revise')}
            disabled={pending || !feedback.trim()}
            className="h-8 px-4 rounded-lg glass text-sm font-medium hover:brightness-105 transition disabled:opacity-40"
          >
            让 Agent 调整
          </button>
        ) : (
          <button
            onClick={() => setShowFeedback(true)}
            disabled={pending}
            className="h-8 px-3 rounded-lg glass text-sm text-[var(--ink-soft)] hover:brightness-105 transition"
          >
            <span className="flex items-center gap-1.5"><Edit3 size={13} /> 调整计划</span>
          </button>
        )}
        <button
          onClick={() => handleDecision('reject_stop')}
          disabled={pending}
          className="h-8 px-3 rounded-lg glass text-sm text-red-600 hover:bg-red-50 transition ml-auto"
        >
          <span className="flex items-center gap-1.5"><X size={14} /> 不执行</span>
        </button>
      </div>
    </div>
  )
}
