import { useState, useCallback } from 'react'

// 虚拟分页 hook：来自 Kun useTimelineScroll
// TURN_PAGE_SIZE：每页显示的轮次数
// AUTO_COLLAPSE_THRESHOLD：超过此阈值自动折叠历史
// 最近轮次始终可见，更早的需手动加载
const TURN_PAGE_SIZE = 18
const AUTO_COLLAPSE_THRESHOLD = 24

export function useTimelineScroll(totalTurns: number) {
  // 隐藏的轮次数（从顶部隐藏）
  const [hiddenCount, setHiddenCount] = useState(0)

  // 自动折叠：超过阈值时，隐藏最早的轮次，只保留 TURN_PAGE_SIZE 轮
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

  return {
    visibleTurnCount,
    hiddenCount: effectiveHidden,
    hasHidden: effectiveHidden > 0,
    shouldShowCollapseButton,
    loadEarlier,
    collapseEarlier
  }
}
