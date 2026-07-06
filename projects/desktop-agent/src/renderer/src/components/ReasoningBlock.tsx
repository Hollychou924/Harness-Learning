import { useEffect, useRef, useState } from 'react'
import { Brain, ChevronRight, XCircle, StopCircle } from 'lucide-react'
import type { ReasoningItem } from '../../../agent/src/items'
import { useDetailLevelStore } from './detailLevelStore'

// 思考展示：融合 opencowork（自动展开/收起）+ MyAgents（手动 pin）+ 四态状态机
// 策略：思考中强制展开 → 完成2秒宽限展开 → 自动收起 → 用户展开过则 pin 住
// 四态：active(思考中) / completed(已完成) / failed(失败) / stopped(已停止)
export function ReasoningBlock({
  item,
  finalAnswerStarted
}: {
  item: ReasoningItem
  finalAnswerStarted: boolean
}) {
  const isActive = item.status === 'running'
  const isFailed = item.status === 'failed'
  const isStopped = item.status === 'stopped'

  // 用户手动 pin：展开过就记住，不被自动收起打断（来自 MyAgents 理念）
  const [userPinned, setUserPinned] = useState(false)
  const detailLevel = useDetailLevelStore((s) => s.level)
  // 刚完成2秒宽限：让用户有机会扫一眼（来自综合方案）
  const [justCompleted, setJustCompleted] = useState(false)
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // 实时计时器（来自 opencowork）
  const [liveElapsed, setLiveElapsed] = useState(0)
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  // 默认展开条件：活跃 / 失败 / 停止 / 刚完成2秒内
  const defaultExpanded = isActive || isFailed || isStopped || justCompleted
  const forceExpanded = isActive // 思考中强制展开，不可收起
  const expanded = forceExpanded || userPinned || defaultExpanded || detailLevel === 'expandAll'

  // 思考中：实时计时
  useEffect(() => {
    if (!isActive || !item.startedAt) return
    const tick = (): void => setLiveElapsed(Math.round((Date.now() - item.startedAt) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isActive, item.startedAt])

  // 思考完成：触发2秒宽限
  useEffect(() => {
    if (!isActive && item.status === 'completed' && !item.finishedAt) return
    if (!isActive && item.finishedAt && !userPinned) {
      setJustCompleted(true)
      completedTimerRef.current = setTimeout(() => setJustCompleted(false), 2000)
    }
    return () => {
      if (completedTimerRef.current) {
        clearTimeout(completedTimerRef.current)
        completedTimerRef.current = undefined
      }
    }
  }, [isActive, item.finishedAt, item.status, userPinned])

  // 最终回复开始 + 非活跃 → 清除宽限，触发收起
  useEffect(() => {
    if (finalAnswerStarted && !isActive && !userPinned) {
      setJustCompleted(false)
    }
  }, [finalAnswerStarted, isActive, userPinned])

  // 清理计时器
  useEffect(() => () => {
    if (liveTimerRef.current) clearInterval(liveTimerRef.current)
    if (completedTimerRef.current) clearTimeout(completedTimerRef.current)
  }, [])

  const elapsedLabel = formatElapsed(item, liveElapsed, isActive)
  const headline = isActive ? '思考过程' : getHeadline(item.status, elapsedLabel)
  const fullContent = item.content.filter(Boolean).join('')
  const summaryText = item.summary.filter(Boolean).join('') || fullContent.slice(0, 80)

  const handleToggle = (): void => {
    if (forceExpanded) return // 思考中不可收起
    const willExpand = !expanded
    setUserPinned(willExpand)
    if (!willExpand) setJustCompleted(false)
  }

  return (
    <div className="rounded-xl overflow-hidden text-[var(--ink-soft)]">
      <button
        onClick={handleToggle}
        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm transition ${
          forceExpanded ? 'cursor-default' : 'hover:text-[var(--ink)] cursor-pointer'
        }`}
      >
        {!isActive && getStatusIcon(item.status)}
        <span className={`flex-shrink-0 ${isFailed ? 'text-red-500' : isStopped ? 'text-amber-500' : 'text-[var(--ink-soft)]'}`}>
          {headline}
        </span>
        {isActive && elapsedLabel && (
          <span className="text-xs text-[var(--ink-soft)]/70 flex-shrink-0">{elapsedLabel}</span>
        )}
        {!expanded && summaryText && (
          <span className="text-xs text-[var(--ink-soft)] truncate flex-1 text-left">{summaryText}</span>
        )}
        {!forceExpanded && (
          <ChevronRight
            size={14}
            className={`text-[var(--ink-soft)] transition-transform ml-auto flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}
          />
        )}
      </button>
      {expanded && fullContent && (
        <div className="px-2 pb-2 pt-0.5">
          <div className="text-xs text-[var(--ink-soft)]/80 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto border-l border-black/[0.06] pl-3">
            {fullContent}
          </div>
        </div>
      )}
    </div>
  )
}

function getStatusIcon(status: ReasoningItem['status']) {
  if (status === 'failed') return <XCircle size={14} className="text-red-500 flex-shrink-0" />
  if (status === 'stopped') return <StopCircle size={14} className="text-amber-500 flex-shrink-0" />
  return <Brain size={14} className="text-[var(--ink-soft)] flex-shrink-0" />
}

function getHeadline(status: ReasoningItem['status'], elapsedLabel: string): string {
  switch (status) {
    case 'running':
      return elapsedLabel ? `思考中 · ${elapsedLabel}` : '思考中…'
    case 'failed':
      return elapsedLabel ? `思考失败 · ${elapsedLabel}` : '思考失败'
    case 'stopped':
      return elapsedLabel ? `已停止 · ${elapsedLabel}` : '已停止'
    default:
      return elapsedLabel ? `想了 ${elapsedLabel}` : '已思考'
  }
}

function formatElapsed(item: ReasoningItem, liveElapsed: number, isActive: boolean): string {
  if (isActive && liveElapsed > 0) {
    return liveElapsed < 60 ? `${liveElapsed} 秒` : `${Math.floor(liveElapsed / 60)} 分 ${liveElapsed % 60} 秒`
  }
  if (!item.finishedAt) return ''
  const sec = Math.max(0, Math.round((item.finishedAt - item.startedAt) / 1000))
  if (sec < 1) return ''
  if (sec < 60) return `${sec} 秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m} 分 ${s} 秒`
}
