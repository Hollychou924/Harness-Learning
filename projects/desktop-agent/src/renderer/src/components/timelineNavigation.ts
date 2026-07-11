export function hiddenCountForTurn(currentHiddenCount: number, turnIndex: number): number {
  return Math.min(currentHiddenCount, Math.max(0, turnIndex))
}

// 标准阅读节奏：中心间距 20px、线条厚度 3px。仅当轮数铺满窗口后才压缩。
export const NAVIGATOR_PITCH_PX = 20
export const NAVIGATOR_PITCH_MIN_PX = 6
export const NAVIGATOR_MARK_THICKNESS_PX = 3

// 定位条显示门槛：至少 4 轮才渲染，避免短对话里出现无意义的一两根刻度。
export const NAVIGATOR_MIN_TURNS = 4

export function shouldShowNavigator(turnCount: number): boolean {
  return turnCount >= NAVIGATOR_MIN_TURNS
}

export function navigatorRowPitch(turnCount: number, availableHeight: number): number {
  if (turnCount <= 0) return 0
  const natural = turnCount * NAVIGATOR_PITCH_PX
  if (natural <= availableHeight) return NAVIGATOR_PITCH_PX
  return Math.max(NAVIGATOR_PITCH_MIN_PX, Math.floor(availableHeight / turnCount))
}

export function navigatorMarkHeight(turnCount: number, availableHeight: number): number {
  const pitch = navigatorRowPitch(turnCount, availableHeight)
  if (pitch <= 0) return 0
  if (pitch < 10) return 1
  if (pitch < 16) return 2
  return NAVIGATOR_MARK_THICKNESS_PX
}

// 悬停时以悬停轮次为中心逐级收回：中心 52，邻近 28/20，其余回到标准 12。
export function navigatorMarkWidth(distance: number, isHovered: boolean): number {
  if (isHovered) return 52
  if (distance === 1) return 28
  if (distance === 2) return 20
  return 12
}
