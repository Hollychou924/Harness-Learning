import { useState } from 'react'
import { ChevronRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import type { Turn, ToolCallItem, ReasoningItem } from '../../../agent/src/items'
import { useDetailLevelStore } from './detailLevelStore'

// 轮次折叠条：某轮已完成且有最终回复时，把思考+工具活动收起成一条可点击摘要
// 融合 Codex 的过程折叠 + opencowork 状态色 + Codex 计数摘要
// 摘要信息：步数 + 时长 + 状态色（完成绿/出错红/运行蓝）
export function CollapsedTurnBar({ turn, children }: { turn: Turn; children: React.ReactNode }) {
  const detailLevel = useDetailLevelStore((s) => s.level)
  const [collapsed, setCollapsed] = useState(detailLevel !== 'expandAll')
  const toolItems = turn.items.filter((it): it is ToolCallItem => it.type === 'toolCall')
  const reasoningItems = turn.items.filter((it): it is ReasoningItem => it.type === 'reasoning')
  const stepCount = toolItems.length + reasoningItems.length
  const elapsedMs = turn.finishedAt ? turn.finishedAt - turn.startedAt : 0
  const hasError = toolItems.some((t) => t.status === 'failed')
  const hasStopped = toolItems.some((t) => t.status === 'stopped')
  const isRunning = turn.status === 'running'

  const statusIcon = isRunning
    ? <Loader2 size={14} className="text-sky-500 animate-spin flex-shrink-0" />
    : hasError
    ? <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
    : <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />

  const summaryParts: string[] = []
  if (toolItems.length > 0) summaryParts.push(`执行了 ${toolItems.length} 个动作`)
  if (reasoningItems.length > 0) summaryParts.push(`思考 ${reasoningItems.length} 次`)
  if (hasError) summaryParts.push('有错误')
  if (hasStopped) summaryParts.push('已停止')
  if (summaryParts.length === 0) summaryParts.push(`${stepCount} 步`)

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-[var(--ink-soft)] hover:bg-black/[0.04] transition-colors"
      >
        {statusIcon}
        <span>{collapsed ? summaryParts.join(' · ') : '收起过程'}</span>
        {elapsedMs > 0 && collapsed && <span className="text-xs">· {formatMs(elapsedMs)}</span>}
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
