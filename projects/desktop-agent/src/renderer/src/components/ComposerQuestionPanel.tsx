import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Edit3, X } from 'lucide-react'
import type { QuestionRequest } from '../store/task'
import { WhaleTooltip } from './WhaleTooltip'

interface Props {
  question: QuestionRequest
  onAnswer: (selectedOptionIds: string[], customAnswer: string, skipped: boolean, skipAll?: boolean) => Promise<void>
}

interface AnswerDraft {
  selectedOptionIds: string[]
  customAnswer: string
  skipped: boolean
}

export function ComposerQuestionPanel({ question, onAnswer }: Props) {
  const prompts = useMemo(() => question.prompts && question.prompts.length > 0 ? question.prompts : [{
    id: 'question-1',
    question: question.question,
    detail: question.detail,
    options: question.options,
    multiple: question.multiple,
    allowCustom: question.allowCustom,
    allowSkip: question.allowSkip
  }], [question])
  const [index, setIndex] = useState(0)
  const [drafts, setDrafts] = useState<Record<number, AnswerDraft>>({})
  const [submitting, setSubmitting] = useState(false)
  const current = prompts[index]
  const draft = drafts[index] || { selectedOptionIds: [], customAnswer: '', skipped: false }
  const isLast = index === prompts.length - 1
  const canSubmit = draft.selectedOptionIds.length > 0 || draft.customAnswer.trim().length > 0

  const setDraft = (next: AnswerDraft): void => {
    setDrafts((prev) => ({ ...prev, [index]: next }))
  }

  const finishCurrent = async (next: AnswerDraft): Promise<void> => {
    setDraft(next)
    if (!isLast) {
      setIndex(index + 1)
      return
    }
    setSubmitting(true)
    try {
      if (prompts.length === 1) {
        await onAnswer(next.selectedOptionIds, next.customAnswer.trim(), next.skipped, false)
        return
      }
      const finalDrafts = { ...drafts, [index]: next }
      const customAnswer = prompts.map((prompt, promptIndex) => {
        const answer = finalDrafts[promptIndex] || { selectedOptionIds: [], customAnswer: '', skipped: true }
        const labels = prompt.options
          .filter((option) => answer.selectedOptionIds.includes(option.id))
          .map((option) => option.label)
        return {
          question: prompt.question,
          selected: labels,
          custom: answer.customAnswer,
          skipped: answer.skipped
        }
      })
      await onAnswer([], JSON.stringify(customAnswer, null, 2), false, false)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleOption = async (optionId: string): Promise<void> => {
    if (submitting) return
    if (current.multiple) {
      const selected = draft.selectedOptionIds.includes(optionId)
        ? draft.selectedOptionIds.filter((id) => id !== optionId)
        : [...draft.selectedOptionIds, optionId]
      setDraft({ ...draft, selectedOptionIds: selected, skipped: false })
      return
    }
    await finishCurrent({ selectedOptionIds: [optionId], customAnswer: '', skipped: false })
  }

  const submitCustom = async (): Promise<void> => {
    if (!canSubmit || submitting) return
    await finishCurrent({ selectedOptionIds: draft.selectedOptionIds, customAnswer: draft.customAnswer.trim(), skipped: false })
  }

  const skipCurrent = async (): Promise<void> => {
    if (submitting || !current.allowSkip) return
    await finishCurrent({ selectedOptionIds: [], customAnswer: '', skipped: true })
  }

  const skipAll = async (): Promise<void> => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onAnswer([], '', true, true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-[26px] floating-surface px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-relaxed text-[var(--ink)]">{current.question}</div>
          {current.detail && (
            <div className="mt-3 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-black/[0.025] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--ink-soft)]">
              {current.detail}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <WhaleTooltip label="上一题">
            <button
              type="button"
              onClick={() => setIndex(Math.max(0, index - 1))}
              disabled={index === 0 || submitting}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-soft)] transition hover:bg-black/[0.04] disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
          </WhaleTooltip>
          <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-[var(--ink-soft)]">{index + 1} / {prompts.length}</span>
          <WhaleTooltip label="下一题">
            <button
              type="button"
              onClick={() => setIndex(Math.min(prompts.length - 1, index + 1))}
              disabled={isLast || submitting}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-soft)] transition hover:bg-black/[0.04] disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </WhaleTooltip>
          <WhaleTooltip label="跳过全部问题">
            <button
              type="button"
              onClick={skipAll}
              disabled={submitting}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-soft)] transition hover:bg-black/[0.04] disabled:opacity-40"
            >
              <X size={15} />
            </button>
          </WhaleTooltip>
        </div>
      </div>

      {current.options.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {current.options.map((option, optionIndex) => {
            const checked = draft.selectedOptionIds.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => void toggleOption(option.id)}
                disabled={submitting}
                className={`w-full rounded-2xl px-3 py-2 text-left transition disabled:opacity-50 ${checked ? 'bg-black/[0.055]' : 'hover:bg-black/[0.025]'}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${checked ? 'bg-[var(--ink)] text-white' : 'bg-black/[0.06] text-[var(--ink-soft)]'}`}>
                    {current.multiple && checked ? <Check size={12} /> : optionIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ink)]">{option.label}</span>
                </div>
                {option.description && <div className="ml-7 mt-1 text-xs leading-relaxed text-[var(--ink-soft)]">{option.description}</div>}
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        {current.allowCustom && (
          <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-black/[0.08] bg-white px-3 py-2 transition focus-within:border-[#0071e3]">
            <Edit3 size={15} className="flex-shrink-0 text-[var(--ink-soft)]" />
            <textarea
              value={draft.customAnswer}
              onChange={(e) => setDraft({ ...draft, customAnswer: e.target.value, skipped: false })}
              disabled={submitting}
              placeholder="没有合适选项？直接写你的想法"
              rows={1}
              className="max-h-24 min-h-5 flex-1 resize-none bg-transparent text-sm leading-5 text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)] disabled:opacity-50"
            />
          </label>
        )}
        {current.allowSkip && (
          <button
            type="button"
            onClick={() => void skipCurrent()}
            disabled={submitting}
            className="h-10 flex-shrink-0 rounded-full px-3 text-sm font-medium text-[var(--ink-soft)] transition hover:bg-black/[0.04] disabled:opacity-40"
          >
            跳过
          </button>
        )}
        <button
          type="button"
          onClick={() => void submitCustom()}
          disabled={!canSubmit || submitting}
          className="inline-flex h-10 flex-shrink-0 items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-35"
        >
          {isLast ? '提交' : '下一题'}
          {!isLast && <ChevronRight size={14} />}
        </button>
      </div>
    </div>
  )
}
