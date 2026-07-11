import { useState, useCallback, useEffect } from 'react'
import { hiddenCountForTurn } from './timelineNavigation'

// 虚拟分页 hook：来自 Kun useTimelineScroll
// TURN_PAGE_SIZE：每页显示的轮次数
// AUTO_COLLAPSE_THRESHOLD：超过此阈值允许用户折叠历史
// 默认完整显示；用户折叠后仍可从定位器直接恢复目标轮次
const TURN_PAGE_SIZE = 18
const AUTO_COLLAPSE_THRESHOLD = 24

export function useTimelineScroll(totalTurns: number) {
  // 隐藏的轮次数（从顶部隐藏）
  const [hiddenCount, setHiddenCount] = useState(0)

  // 折叠后隐藏最早的轮次，只保留最近一页
  const autoHidden = Math.max(0, totalTurns - TURN_PAGE_SIZE)
  const effectiveHidden = Math.min(hiddenCount, Math.max(0, totalTurns - 3)) // 至少保留最近3轮

  const visibleTurnCount = totalTurns - effectiveHidden
  const shouldShowCollapseButton = totalTurns > AUTO_COLLAPSE_THRESHOLD && effectiveHidden === 0

  const loadEarlier = useCallback(() => {
    setHiddenCount(Math.max(0, effectiveHidden - TURN_PAGE_SIZE))
  }, [effectiveHidden])

  const collapseEarlier = useCallback(() => {
    setHiddenCount(autoHidden)
  }, [autoHidden])

  const revealTurn = useCallback((turnIndex: number) => {
    setHiddenCount((current) => hiddenCountForTurn(current, turnIndex))
  }, [])

  useEffect(() => {
    setHiddenCount((current) => Math.min(current, Math.max(0, totalTurns - 3)))
  }, [totalTurns])

  return {
    visibleTurnCount,
    hiddenCount: effectiveHidden,
    hasHidden: effectiveHidden > 0,
    shouldShowCollapseButton,
    loadEarlier,
    collapseEarlier,
    revealTurn
  }
}
