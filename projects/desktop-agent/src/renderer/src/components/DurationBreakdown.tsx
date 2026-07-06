import type { Turn } from '../../../agent/src/items'

// 耗时分布：一轮任务里思考/工具调用/等待各占多少时间，比 Codex 单一的"想了N秒"更直观
// 超越点B：不止告诉你总耗时，还告诉你时间花在哪
interface Segment {
  label: string
  ms: number
  color: string
}

function computeSegments(turn: Turn): Segment[] {
  let reasoningMs = 0
  let toolMs = 0
  for (const item of turn.items) {
    if (item.type === 'reasoning' && item.finishedAt) {
      reasoningMs += Math.max(0, item.finishedAt - item.startedAt)
    } else if (item.type === 'toolCall' && item.finishedAt) {
      toolMs += Math.max(0, item.finishedAt - item.startedAt)
    }
  }
  const totalMs = turn.finishedAt ? turn.finishedAt - turn.startedAt : 0
  const waitingMs = Math.max(0, totalMs - reasoningMs - toolMs)
  const segments: Segment[] = []
  if (reasoningMs > 0) segments.push({ label: '思考', ms: reasoningMs, color: 'rgb(14 165 233)' })
  if (toolMs > 0) segments.push({ label: '工具调用', ms: toolMs, color: 'rgb(34 197 94)' })
  if (waitingMs > 0) segments.push({ label: '等待模型', ms: waitingMs, color: 'rgb(0 0 0 / 0.15)' })
  return segments
}

export function DurationBreakdown({ turn }: { turn: Turn }) {
  if (!turn.finishedAt) return null
  const segments = computeSegments(turn)
  const totalMs = turn.finishedAt - turn.startedAt
  if (segments.length === 0 || totalMs < 1000) return null

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--ink-soft)]">
      <div className="flex h-1.5 flex-1 max-w-[160px] rounded-full overflow-hidden bg-black/[0.04]">
        {segments.map((s, i) => (
          <div
            key={i}
            className="relative group/duration"
            style={{ width: `${(s.ms / totalMs) * 100}%`, background: s.color }}
          >
            <span className="pointer-events-none absolute bottom-full left-1/2 z-[9999] mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md floating-tooltip px-2 py-1 text-[11px] font-medium leading-none text-white opacity-0 transition-opacity duration-150 group-hover/duration:opacity-100">
              {s.label} {formatMs(s.ms)}
            </span>
          </div>
        ))}
      </div>
      <span className="font-mono">{formatMs(totalMs)}</span>
    </div>
  )
}

function formatMs(ms: number): string {
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(sec < 10 ? 1 : 0)}s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}m ${s}s`
}
