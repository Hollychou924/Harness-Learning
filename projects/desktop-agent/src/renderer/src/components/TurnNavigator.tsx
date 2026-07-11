import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Turn } from '../../../agent/src/items'
import { getFinalAnswerOfTurn } from '../store/turns'
import { navigatorMarkHeight, navigatorMarkWidth, navigatorRowPitch, shouldShowNavigator } from './timelineNavigation'
import { playNavigatorTick } from './navigatorTickSound'

interface TurnSummary {
  id: string
  index: number
  userText: string
  toolCount: number
  replyPreview: string
}

interface HoveredTurn {
  summary: TurnSummary
  anchor: DOMRect
}

function summarizeTurns(turns: Turn[]): TurnSummary[] {
  return turns.map((turn, index) => {
    const userText = turn.items
      .filter((item) => item.type === 'userMessage')
      .flatMap((item) => item.content.filter((content) => content.type === 'text').map((content) => content.text || ''))
      .join('')
    const toolCount = turn.items.filter((item) => item.type === 'toolCall').length
    const reply = getFinalAnswerOfTurn(turn)
    return {
      id: turn.id,
      index,
      userText,
      toolCount,
      replyPreview: reply ? reply.slice(0, 120) : ''
    }
  })
}

function TurnPreview({ hovered }: { hovered: HoveredTurn }) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(hovered.anchor.top)
  const [left, setLeft] = useState(hovered.anchor.right + 10)

  useLayoutEffect(() => {
    const width = ref.current?.offsetWidth || 320
    const height = ref.current?.offsetHeight || 120
    const centered = hovered.anchor.top + hovered.anchor.height / 2 - height / 2
    setLeft(Math.max(12, Math.min(hovered.anchor.right + 10, window.innerWidth - width - 12)))
    setTop(Math.max(12, Math.min(centered, window.innerHeight - height - 12)))
  }, [hovered])

  return createPortal(
    <div
      ref={ref}
      className="turn-navigator-preview fixed z-50 pointer-events-none"
      style={{ left, top }}
    >
      <div className="line-clamp-1 text-[13px] font-medium leading-5 text-[var(--ink)]">
        {hovered.summary.userText || `第 ${hovered.summary.index + 1} 轮对话`}
      </div>
      {hovered.summary.replyPreview && (
        <div className="mt-1 line-clamp-3 text-xs leading-[18px] text-[var(--ink-soft)]">
          {hovered.summary.replyPreview}
        </div>
      )}
      <div className="mt-2 flex gap-2 text-[10px] text-[var(--ink-soft)] opacity-70">
        <span>第 {hovered.summary.index + 1} 轮</span>
        {hovered.summary.toolCount > 0 && <span>使用 {hovered.summary.toolCount} 个工具</span>}
      </div>
    </div>,
    document.body
  )
}

export function TurnNavigator({
  turns,
  activeTurnId,
  onJump
}: {
  turns: Turn[]
  activeTurnId: string | null
  onJump: (turnId: string) => void
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [hoveredTurn, setHoveredTurn] = useState<HoveredTurn | null>(null)
  const [availableHeight, setAvailableHeight] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const summaries = summarizeTurns(turns)

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const observer = new ResizeObserver(() => setAvailableHeight(track.clientHeight))
    setAvailableHeight(track.clientHeight)
    observer.observe(track)
    return () => observer.disconnect()
  }, [])

  // 每次落到新的一格响一下，连续滑动时自然连成短促的哒哒声。
  useLayoutEffect(() => {
    if (hoveredIndex === null) return
    playNavigatorTick(hoveredIndex)
  }, [hoveredIndex])

  if (!shouldShowNavigator(turns.length)) return null

  const pitch = navigatorRowPitch(turns.length, availableHeight)
  const markHeight = navigatorMarkHeight(turns.length, availableHeight)

  return (
    <nav
      className="turn-navigator flex h-full w-14 flex-shrink-0 flex-col py-3"
      aria-label="对话快速定位"
      onMouseLeave={() => {
        setHoveredIndex(null)
        setHoveredTurn(null)
      }}
    >
      <div ref={trackRef} className="flex min-h-0 flex-1 flex-col justify-center">
        {summaries.map((summary) => {
          const isHovered = hoveredIndex === summary.index
          const isActive = activeTurnId === summary.id
          const distance = hoveredIndex === null ? Infinity : Math.abs(summary.index - hoveredIndex)
          const width = navigatorMarkWidth(distance, isHovered)
          return (
            <button
              key={summary.id}
              type="button"
              aria-label={`跳转到第 ${summary.index + 1} 轮`}
              aria-current={isActive ? 'true' : undefined}
              className="group flex items-center justify-start pl-1"
              style={{ height: pitch }}
              onMouseEnter={(event) => {
                setHoveredIndex(summary.index)
                setHoveredTurn({ summary, anchor: event.currentTarget.getBoundingClientRect() })
              }}
              onFocus={(event) => {
                setHoveredIndex(summary.index)
                setHoveredTurn({ summary, anchor: event.currentTarget.getBoundingClientRect() })
              }}
              onBlur={() => {
                setHoveredIndex(null)
                setHoveredTurn(null)
              }}
              onClick={() => onJump(summary.id)}
            >
              <span
                className={`turn-navigator-mark ${isHovered ? 'is-hovered' : ''} ${isActive ? 'is-active' : ''}`}
                style={{ width, height: markHeight }}
              />
            </button>
          )
        })}
      </div>
      {hoveredTurn && <TurnPreview hovered={hoveredTurn} />}
    </nav>
  )
}
