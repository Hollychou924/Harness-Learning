import { useState } from 'react'
import type { Turn } from '../../../agent/src/items'
import { getFinalAnswerOfTurn } from '../store/turns'

// 跨轮导航条：对话超过 3 轮后，在回复区左侧出现一排竖向刻度条
// 每条代表一轮，长度按该轮内容量比例；悬停看摘要、点击跳转定位、移开消失
// 超越 Codex：Codex 只有轮内折叠，没有跨轮的快速定位导航
const MIN_TURNS = 3

interface TurnSummary {
  id: string
  index: number
  userText: string
  toolCount: number
  replyPreview: string
  weight: number
}

function summarizeTurns(turns: Turn[]): TurnSummary[] {
  return turns.map((t, i) => {
    const userText = t.items
      .filter((it) => it.type === 'userMessage')
      .flatMap((it) => it.content.filter((c) => c.type === 'text').map((c) => c.text || ''))
      .join('')
    const toolCount = t.items.filter((it) => it.type === 'toolCall').length
    const reply = getFinalAnswerOfTurn(t)
    const replyPreview = reply ? reply.slice(0, 40) : ''
    // 权重按条目数算，决定刻度条长度（最少1份，让短轮次也有可见刻度）
    const weight = Math.max(1, t.items.length)
    return { id: t.id, index: i, userText, toolCount, replyPreview, weight }
  })
}

export function TurnNavigator({ turns, onJump }: { turns: Turn[]; onJump: (turnId: string) => void }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const summaries = summarizeTurns(turns)
  const totalWeight = summaries.reduce((sum, s) => sum + s.weight, 0)

  if (turns.length < MIN_TURNS) return null

  return (
    <div className="flex flex-col items-center gap-0.5 py-2 h-full overflow-hidden flex-shrink-0" onMouseLeave={() => setHoveredIndex(null)}>
      {summaries.map((s) => {
        const heightPct = (s.weight / totalWeight) * 100
        const isHovered = hoveredIndex === s.index
        return (
          <div
            key={s.id}
            className="group relative flex justify-center"
            onMouseEnter={() => setHoveredIndex(s.index)}
          >
            {/* 刻度条：悬停时变宽变深，体现"灵动" */}
            <button
              onClick={() => onJump(s.id)}
              aria-label={`跳转到第 ${s.index + 1} 轮`}
              className="rounded-full transition-all duration-200"
              style={{
                height: `${Math.max(6, heightPct * 0.8)}px`,
                width: isHovered ? 6 : 3,
                background: isHovered ? 'rgb(14 165 233)' : 'rgb(0 0 0 / 0.15)'
              }}
            />
            {/* 悬停浮层：摘要信息 */}
            {isHovered && (
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-10 w-52 rounded-lg floating-surface p-2.5 space-y-1 pointer-events-none">
                <div className="text-[10px] text-[var(--ink-soft)]">第 {s.index + 1} 轮</div>
                {s.userText && (
                  <div className="text-xs text-[var(--ink)] line-clamp-2">{s.userText}</div>
                )}
                <div className="flex items-center gap-2 text-[10px] text-[var(--ink-soft)]">
                  {s.toolCount > 0 && <span>🔧 {s.toolCount}</span>}
                  {s.replyPreview && <span className="truncate">↳ {s.replyPreview}…</span>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
