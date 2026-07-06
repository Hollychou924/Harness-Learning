import { useTaskStore } from '../store/task'
import type { ToolCallItem, ReasoningItem, Turn } from '../../../agent/src/items'
import { describeToolCall } from './toolActivityText'
import { RunningStatusText } from './RunningStatusText'

// 底部状态条：融合 harnessclaw 三层降级 + Codex 计数摘要
// 四层降级（优先级从高到低）：
//   1. 当前执行动作实时状态（"正在读取 config.ts" + 计时）
//   2. 当前思考态（"思考中 · 3s"）
//   3. 计数摘要（"3 步完成 · 2 步进行中"）
//   4. 兜底（"思考中…"）
export function LiveStatusBar() {
  const { currentTurn, status } = useTaskStore()
  if (!currentTurn || status !== 'executing') return null

  const layer = pickLayer(currentTurn)

  return (
    <div className="flex items-center gap-2 px-1 py-1 text-sm sticky bottom-0">
      <RunningStatusText className={layer.className}>{layer.text}</RunningStatusText>
      {layer.elapsed && (
        <span className="text-xs text-[var(--ink-soft)] tabular-nums">{layer.elapsed}</span>
      )}
    </div>
  )
}

function pickLayer(turn: Turn): {
  text: string
  className: string
  elapsed: string | null
} {
  const items = turn.items
  const toolItems = items.filter((it): it is ToolCallItem => it.type === 'toolCall')
  const reasoningItems = items.filter((it): it is ReasoningItem => it.type === 'reasoning')

  // 层1：当前执行动作（最后一个 running/pending 的工具）
  const activeTool = [...toolItems].reverse().find((t) => t.status === 'running' || t.status === 'pending')
  if (activeTool) {
    return {
      text: describeToolCall(activeTool),
      className: 'text-[var(--ink)]',
      elapsed: activeTool.startedAt ? formatLive(activeTool.startedAt) : null
    }
  }

  // 层2：当前思考态（最后一个 running 的思考）
  const activeReasoning = [...reasoningItems].reverse().find((r) => r.status === 'running')
  if (activeReasoning) {
    return {
      text: '思考中',
      className: 'text-[var(--ink)]',
      elapsed: activeReasoning.startedAt ? formatLive(activeReasoning.startedAt) : null
    }
  }

  // 层3：计数摘要
  const running = toolItems.filter((t) => t.status === 'running' || t.status === 'pending').length
  const done = toolItems.filter((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'stopped' || t.status === 'canceled').length
  const failed = toolItems.filter((t) => t.status === 'failed').length
  if (done > 0 || running > 0) {
    const parts: string[] = []
    if (done > 0) parts.push(`${done} 步完成`)
    if (running > 0) parts.push(`${running} 步进行中`)
    if (failed > 0) parts.push(`${failed} 步出错`)
    return {
      text: parts.join(' · '),
      className: 'text-[var(--ink-soft)]',
      elapsed: null
    }
  }

  // 层4：兜底
  return {
    text: '思考中…',
    className: 'text-[var(--ink-soft)]',
    elapsed: null
  }
}

function formatLive(startedAt: number): string {
  const sec = Math.max(0, Math.round((Date.now() - startedAt) / 1000))
  if (sec < 1) return ''
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m${sec % 60}s`
}
