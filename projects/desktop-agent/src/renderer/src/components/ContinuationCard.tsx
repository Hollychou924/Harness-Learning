import { useTaskStore } from '../store/task'

export function ContinuationCard() {
  const { continuationPending, respondContinuation } = useTaskStore()

  if (!continuationPending) return null

  return (
    <div className="floating-subsurface rounded-xl px-4 py-3.5 mx-auto max-w-4xl mb-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--ink)]">任务已执行到步数上限</div>
          <p className="text-xs text-[var(--ink-soft)] mt-1 leading-relaxed">
            {continuationPending.hint}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => respondContinuation('continue')}
          className="px-3 py-1.5 rounded-lg bg-[#0071e3] text-white text-xs font-medium hover:bg-[#005bb5] transition"
        >
          继续执行
        </button>
        <button
          type="button"
          onClick={() => respondContinuation('stop')}
          className="px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--control-bg)] text-[var(--ink)] text-xs font-medium hover:bg-[var(--control-hover)] transition"
        >
          停止并查看结果
        </button>
        <button
          type="button"
          onClick={() => respondContinuation('split')}
          className="px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--control-bg)] text-[var(--ink)] text-xs font-medium hover:bg-[var(--control-hover)] transition"
        >
          拆成更小任务
        </button>
      </div>
      <p className="mt-2 text-[11px] text-[var(--ink-soft)]">
        「拆分」会停止当前任务，并新建对话预填剩余目标，便于接力继续。
      </p>
    </div>
  )
}
