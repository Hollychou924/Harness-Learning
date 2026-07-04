import { Loader2 } from 'lucide-react'

// 压缩分隔器：来自 lobsterai ContextCompactionDivider + Codex compact 机制
// 当对话上下文被压缩时，在历史流中插入一个视觉分隔器，告诉用户"这里压缩过"
// active=true 时显示动画进度条，表示正在压缩
export function CompactDivider({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div
      className="flex w-full items-center gap-3 py-3 text-[var(--ink-soft)]"
      role={active ? 'status' : undefined}
      aria-live={active ? 'polite' : undefined}
    >
      <div className="h-px min-w-0 flex-1 bg-black/[0.06]" />
      <div className="flex max-w-[min(100%,360px)] flex-col items-center gap-1.5 bg-[var(--paper)] px-2">
        <div className="inline-flex max-w-full items-center gap-2 text-xs leading-relaxed text-[var(--ink-soft)]">
          {active ? (
            <Loader2 size={13} className="animate-spin flex-shrink-0" />
          ) : (
            <CompactIcon className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ink-soft)]/70" />
          )}
          <span className="truncate">{label}</span>
        </div>
        {active && (
          <div className="h-0.5 w-32 max-w-full rounded-full bg-black/[0.06] overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-sky-400 animate-pulse" />
          </div>
        )}
      </div>
      <div className="h-px min-w-0 flex-1 bg-black/[0.06]" />
    </div>
  )
}

function CompactIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 34" fill="none" aria-hidden="true" className={className}>
      <path d="M6 5V24C6 26.2091 7.79086 28 10 28H22.5M28 29V10C28 7.79086 26.2091 6 24 6H11.5"
        stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M11.5 13.5H21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.5 19H17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="5" r="2" fill="currentColor" />
      <circle cx="28" cy="29" r="2" fill="currentColor" />
    </svg>
  )
}
