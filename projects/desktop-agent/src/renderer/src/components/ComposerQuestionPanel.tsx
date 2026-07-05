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
    <div className="mb-3 overflow-hidden rounded-2xl floating-surface">
      <div className="flex items-center gap-3 border-b border-black/[0.06] bg-sky-50 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sky-600 shadow-sm">
          <Edit3 size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[var(--ink)]">需要你选择一下</div>
          <div className="truncate text-xs text-[var(--ink-soft)]">选择后会继续执行，也可以输入其他想法</div>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-xs text-[var(--ink-soft)] shadow-sm">{index + 1} / {prompts.length}</span>
        <WhaleTooltip label="跳过全部问题">
          <button
            type="button"
            onClick={skipAll}
            disabled={submitting}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-soft)] transition hover:bg-white disabled:opacity-40"
          >
            <X size={15} />
          </button>
        </WhaleTooltip>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div>
          <div className="text-sm font-medium leading-relaxed text-[var(--ink)]">{current.question}</div>
          {current.detail && <div className="mt-1 text-xs leading-relaxed text-[var(--ink-soft)]">{current.detail}</div>}
        </div>

        {current.options.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {current.options.map((option) => {
              const checked = draft.selectedOptionIds.includes(option.id)
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => void toggleOption(option.id)}
                  disabled={submitting}
                  className={`rounded-xl border px-3 py-2 text-left transition disabled:opacity-50 ${checked ? 'border-sky-300 bg-sky-50' : 'border-black/[0.06] bg-white hover:bg-black/[0.02]'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${checked ? 'border-sky-500 bg-sky-500 text-white' : 'border-black/20'}`}>
                      {checked && <Check size={11} />}
                    </span>
                    <span className="text-sm text-[var(--ink)]">{option.label}</span>
                  </div>
                  {option.description && <div className="ml-6 mt-1 text-xs leading-relaxed text-[var(--ink-soft)]">{option.description}</div>}
                </button>
              )
            })}
          </div>
        )}

        {current.allowCustom && (
          <label className="block space-y-1.5">
            <span className="text-xs text-[var(--ink-soft)]">其他</span>
            <textarea
              value={draft.customAnswer}
              onChange={(e) => setDraft({ ...draft, customAnswer: e.target.value, skipped: false })}
              disabled={submitting}
              placeholder="输入你的答案，发送后继续"
              className="max-h-28 min-h-16 w-full resize-none rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-300 disabled:opacity-50"
            />
          </label>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIndex(Math.max(0, index - 1))}
              disabled={index === 0 || submitting}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm text-[var(--ink-soft)] transition hover:bg-black/[0.03] disabled:opacity-40"
            >
              <ChevronLeft size={14} /> 上一题
            </button>
            {current.allowSkip && (
              <button
                type="button"
                onClick={() => void skipCurrent()}
                disabled={submitting}
                className="h-8 rounded-lg px-3 text-sm text-[var(--ink-soft)] transition hover:bg-black/[0.03] disabled:opacity-40"
              >
                跳过
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => void submitCustom()}
            disabled={!canSubmit || submitting}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0071e3] px-4 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40"
          >
            {isLast ? '完成' : '下一题'}
            {!isLast && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
