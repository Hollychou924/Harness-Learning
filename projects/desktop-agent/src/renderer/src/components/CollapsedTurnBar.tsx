import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Turn, ToolCallItem, ReasoningItem } from '../../../agent/src/items'

// 轮内折叠条：某轮已完成且有最终回复时，把思考+工具活动收起成一条可点击摘要
// 复刻 Codex 的 C9t/hIn 机制：最终回复一出现，过程自动收起，点击展开/收起
// 动效用纯 CSS max-height + opacity 过渡，不引入 framer-motion 依赖
export function CollapsedTurnBar({ turn, children }: { turn: Turn; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true)
  const toolItems = turn.items.filter((it): it is ToolCallItem => it.type === 'toolCall')
  const reasoningItems = turn.items.filter((it): it is ReasoningItem => it.type === 'reasoning')
  const stepCount = toolItems.length + reasoningItems.length
  const elapsedMs = turn.finishedAt ? turn.finishedAt - turn.startedAt : 0

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-[var(--ink-soft)] hover:bg-black/[0.04] transition-colors"
      >
        <span>{collapsed ? `${stepCount} 步已折叠` : '收起过程'}</span>
        {elapsedMs > 0 && <span className="text-xs">· {formatMs(elapsedMs)}</span>}
        <ChevronRight
          size={14}
          className={`text-[var(--ink-soft)] transition-transform duration-200 ${collapsed ? 'rotate-0' : 'rotate-90'}`}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: collapsed ? 0 : 2000, opacity: collapsed ? 0 : 1 }}
      >
        <div className="pt-2">{children}</div>
      </div>
    </div>
  )
}

function formatMs(ms: number): string {
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(0)}s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}m ${s}s`
}
