import { useEffect, useState } from 'react'
import type React from 'react'
import { Anchor, Check, Copy, CopyCheck, Edit3, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react'

type ActionKey = 'copy' | 'edit' | 'like' | 'dislike' | 'regenerate' | 'fork'

interface ActionItem {
  key: ActionKey
  label: string
  icon: React.ReactNode
  active?: boolean
  disabled?: boolean
  onClick: () => void | Promise<void>
}

interface MessageActionsProps {
  align: 'user' | 'assistant'
  time?: number
  actions: ActionItem[]
}

function formatTime(value?: number): string {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('zh-CN', { hour: 'numeric', minute: '2-digit' })
}

export function MessageActions({ align, time, actions }: MessageActionsProps) {
  const timeText = formatTime(time)
  if (!timeText && actions.length === 0) return null

  const actionButtons = actions.map((action) => (
    <button
      key={action.key}
      type="button"
      disabled={action.disabled}
      onClick={() => void action.onClick()}
      className={`group/action relative inline-flex h-7 w-7 items-center justify-center rounded-full text-xs transition ${
        action.active
          ? action.key === 'dislike'
            ? 'bg-rose-50 text-rose-500'
            : 'bg-sky-50 text-sky-600'
          : 'text-[var(--ink-soft)] hover:bg-black/[0.06] hover:text-[var(--ink)]'
      } ${action.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {action.icon}
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md floating-tooltip px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover/action:opacity-100 group-focus-visible/action:opacity-100">
        {action.label}
      </span>
    </button>
  ))

  return (
    <div
      className={`pointer-events-none mt-1.5 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/message:pointer-events-auto group-hover/message:opacity-100 group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100 ${
        align === 'user' ? 'justify-end' : 'justify-start'
      }`}
    >
      {align === 'user' ? (
        <>
          {timeText && <span className="px-1 text-xs text-[var(--ink-soft)]/75">{timeText}</span>}
          {actionButtons}
        </>
      ) : (
        <>
          {actionButtons}
          {timeText && <span className="px-1 text-xs text-[var(--ink-soft)]/75">{timeText}</span>}
        </>
      )}
    </div>
  )
}

export function useMessageFeedback() {
  const [feedback, setFeedback] = useState<Record<string, { like?: boolean; dislike?: boolean }>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem('xld.message-feedback.v1')
      if (raw) setFeedback(JSON.parse(raw))
    } catch {
      setFeedback({})
    }
  }, [])

  const toggle = (turnId: string, key: 'like' | 'dislike') => {
    setFeedback((current) => {
      const next = {
        ...current,
        [turnId]: {
          ...current[turnId],
          [key]: !current[turnId]?.[key]
        }
      }
      try {
        localStorage.setItem('xld.message-feedback.v1', JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return { feedback, toggle }
}

export const actionIcons = {
  copy: (active?: boolean) => active ? <CopyCheck size={15} /> : <Copy size={15} />,
  edit: <Edit3 size={15} />,
  like: (active?: boolean) => <ThumbsUp size={15} fill={active ? 'currentColor' : 'none'} />,
  dislike: (active?: boolean) => <ThumbsDown size={15} fill={active ? 'currentColor' : 'none'} />,
  regenerate: <RefreshCw size={15} />,
  fork: <Anchor size={15} />,
  done: <Check size={15} />
}
