import { useMemo, useState } from 'react'
import { Check, ChevronRight, HelpCircle, MessageSquareText, X } from 'lucide-react'
import type { QuestionItem } from '../../../agent/src/items'
import { useTaskStore } from '../store/task'

export function QuestionCard({ item }: { item: QuestionItem }) {
  const { pendingQuestion, respondQuestion } = useTaskStore()
  const [selected, setSelected] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [collapsed, setCollapsed] = useState(item.decision !== 'pending')

  const isPending = item.decision === 'pending'
  const isActive = isPending && pendingQuestion?.requestId === item.requestId
  const selectedLabels = useMemo(() => {
    const ids = item.selectedOptionIds || []
    return item.options.filter((option) => ids.includes(option.id)).map((option) => option.label)
  }, [item.options, item.selectedOptionIds])

  const answerLabel = item.decision === 'skipped'
    ? '已跳过'
    : [...selectedLabels, item.customAnswer].filter(Boolean).join('、') || '已回答'

  const toggleOption = (id: string): void => {
    if (!isActive) return
    if (item.multiple) {
      setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
      return
    }
    setSelected((prev) => prev[0] === id ? [] : [id])
  }

  const canSubmit = selected.length > 0 || custom.trim().length > 0

  const submit = async (): Promise<void> => {
    if (!isActive || !canSubmit) return
    await respondQuestion(selected, custom.trim(), false)
    setCollapsed(true)
  }

  const skip = async (): Promise<void> => {
    if (!isActive) return
    await respondQuestion([], '', true)
    setCollapsed(true)
  }

  if (!isPending && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full glass rounded-xl px-3 py-2 flex items-center gap-2 text-sm hover:bg-black/[0.02] transition"
      >
        <Check size={14} className="text-green-600 flex-shrink-0" />
        <span className="text-[var(--ink)] truncate">{item.question}</span>
        <span className="text-xs text-[var(--ink-soft)] truncate">{answerLabel}</span>
        <ChevronRight size={14} className="text-[var(--ink-soft)] ml-auto flex-shrink-0" />
      </button>
    )
  }

  if (!isPending) {
    return (
      <div className="glass rounded-xl p-4 space-y-3 border border-green-100">
        <button onClick={() => setCollapsed(true)} className="w-full flex items-center gap-2 text-left">
          <Check size={16} className="text-green-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-[var(--ink)]">{item.question}</div>
            <div className="text-xs text-[var(--ink-soft)] mt-1">{answerLabel}</div>
          </div>
          <X size={14} className="text-[var(--ink-soft)] flex-shrink-0" />
        </button>
      </div>
    )
  }

  return (
    <div className="glass rounded-xl p-4 space-y-3 border border-sky-100">
      <div className="flex items-start gap-2">
        <HelpCircle size={16} className="text-sky-600 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[var(--ink)]">需要你补充一下</div>
          <div className="text-sm text-[var(--ink)] mt-1 leading-relaxed">{item.question}</div>
          {item.detail && <div className="text-xs text-[var(--ink-soft)] mt-1 leading-relaxed">{item.detail}</div>}
        </div>
      </div>

      {item.options.length > 0 && (
        <div className="space-y-1.5">
          {item.options.map((option) => {
            const checked = selected.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleOption(option.id)}
                disabled={!isActive}
                className={`w-full text-left rounded-lg px-3 py-2 border transition ${checked ? 'border-sky-300 bg-sky-50/70' : 'border-black/[0.06] hover:bg-black/[0.02]'} disabled:opacity-60`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 ${checked ? 'border-sky-500 bg-sky-500' : 'border-black/20'}`} />
                  <span className="text-sm text-[var(--ink)]">{option.label}</span>
                </div>
                {option.description && <div className="text-xs text-[var(--ink-soft)] ml-5 mt-1">{option.description}</div>}
              </button>
            )
          })}
        </div>
      )}

      {item.allowCustom && (
        <label className="block space-y-1">
          <span className="text-xs text-[var(--ink-soft)] flex items-center gap-1"><MessageSquareText size={12} />其他想法</span>
          <textarea
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            disabled={!isActive}
            placeholder="也可以直接写你的要求"
            className="w-full min-h-16 rounded-lg border border-black/[0.08] bg-white/60 px-3 py-2 text-sm outline-none focus:border-sky-300 disabled:opacity-60"
          />
        </label>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={!isActive || !canSubmit}
          className="h-8 px-4 rounded-lg bg-[#0071e3] text-white text-sm font-medium hover:brightness-110 transition disabled:opacity-40"
        >
          提交选择
        </button>
        {item.allowSkip && (
          <button
            onClick={skip}
            disabled={!isActive}
            className="h-8 px-3 rounded-lg glass text-sm text-[var(--ink-soft)] hover:bg-black/[0.03] transition disabled:opacity-40"
          >
            跳过
          </button>
        )}
        {!isActive && <span className="text-xs text-[var(--ink-soft)]">等待连接到当前任务...</span>}
      </div>
    </div>
  )
}
