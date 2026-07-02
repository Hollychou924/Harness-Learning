import { useMemo, useState } from 'react'
import { Brain, Wrench, MessageSquare, FileEdit } from 'lucide-react'
import type { Item, Turn } from '../../../agent/src/items'
import { describeToolCall } from './toolActivityText'

// 时间轴回放：拖动进度条重看这一轮任何时刻"AI在想什么/在做什么"
// 超越点A：Codex 只能展开/收起当时留下的条目，不能像视频进度条一样定位到任意时刻的执行截面
// 依据 2026-07-02 复刻并超越 Codex 展示逻辑方案

interface TimelineMark {
  atMs: number
  item: Item
}

function collectMarks(turn: Turn): TimelineMark[] {
  const marks: TimelineMark[] = []
  for (const item of turn.items) {
    if ('startedAt' in item && typeof item.startedAt === 'number') {
      marks.push({ atMs: item.startedAt - turn.startedAt, item })
    }
  }
  return marks.sort((a, b) => a.atMs - b.atMs)
}

function iconForItem(item: Item) {
  switch (item.type) {
    case 'reasoning': return <Brain size={13} />
    case 'toolCall': return <Wrench size={13} />
    case 'agentMessage': return <MessageSquare size={13} />
    case 'plan': return <FileEdit size={13} />
    default: return <MessageSquare size={13} />
  }
}

function labelForItem(item: Item): string {
  switch (item.type) {
    case 'reasoning': return item.summary[item.summary.length - 1] || '思考中'
    case 'toolCall': return describeToolCall(item)
    case 'agentMessage': return item.phase === 'final_answer' ? '生成最终回复' : '生成中间回复'
    case 'plan': return '提出执行计划'
    case 'approval': return '请求用户审批'
    case 'userMessage': return '收到用户消息'
    default: return ''
  }
}

export function TimelineScrubber({ turn }: { turn: Turn }) {
  const marks = useMemo(() => collectMarks(turn), [turn])
  const totalMs = turn.finishedAt ? turn.finishedAt - turn.startedAt : 0
  const [cursorMs, setCursorMs] = useState(0)

  if (!turn.finishedAt || marks.length === 0 || totalMs < 1000) return null

  // 当前进度条位置对应的执行截面：找到 <= 当前时刻的所有条目
  const activeMarks = marks.filter((m) => m.atMs <= cursorMs)
  const currentMark = activeMarks[activeMarks.length - 1] || marks[0]

  return (
    <div className="glass rounded-xl p-3 space-y-2.5">
      <div className="flex items-center gap-2 text-xs text-[var(--ink-soft)]">
        <span className="font-medium">回放这一轮</span>
        <span className="ml-auto font-mono">{(cursorMs / 1000).toFixed(1)}s / {(totalMs / 1000).toFixed(1)}s</span>
      </div>

      {/* 进度条：拖动定位到任意时刻 */}
      <div className="relative">
        <input
          type="range"
          min={0}
          max={totalMs}
          value={cursorMs}
          onChange={(e) => setCursorMs(Number(e.target.value))}
          className="w-full h-1.5 rounded-full bg-black/[0.06] accent-sky-500 cursor-pointer"
        />
        {/* 标记点：每个条目开始的时刻 */}
        <div className="relative h-2 -mt-1 pointer-events-none">
          {marks.map((m, i) => (
            <span
              key={i}
              className="absolute top-0 w-1 h-1 rounded-full bg-sky-400"
              style={{ left: `${(m.atMs / totalMs) * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* 当前时刻的执行截面 */}
      {currentMark && (
        <div className="flex items-center gap-2 text-sm rounded-lg bg-black/[0.03] px-2.5 py-1.5">
          <span className="text-[var(--ink-soft)] flex-shrink-0">{iconForItem(currentMark.item)}</span>
          <span className="text-[var(--ink)] truncate">{labelForItem(currentMark.item)}</span>
        </div>
      )}
    </div>
  )
}
