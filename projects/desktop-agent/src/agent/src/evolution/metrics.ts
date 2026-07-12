/**
 * 看板过程指标：HITL / 重复错误率
 */
import type { FailureCase } from './types.js'

export interface RepeatFailureStats {
  total: number
  repeats: number
  /** 0–1；total=0 时为 0 */
  rate: number
}

/**
 * 近窗内：若某条 failure 的 attribution 或 trigger_tags 与更早条目重叠，计为重复。
 */
export function computeRepeatFailureRate(failures: FailureCase[], window = 50): RepeatFailureStats {
  const rows = failures.slice(-window)
  if (rows.length === 0) return { total: 0, repeats: 0, rate: 0 }

  let repeats = 0
  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i]
    const earlier = rows.slice(0, i)
    const attr = cur.attribution || 'defect'
    const tags = new Set((cur.trigger_tags || []).map((t) => t.toLowerCase()))
    const hit = earlier.some((prev) => {
      if ((prev.attribution || 'defect') === attr) return true
      return (prev.trigger_tags || []).some((t) => tags.has(t.toLowerCase()) && t !== 'feedback' && t !== 't1')
    })
    if (hit) repeats += 1
  }
  return {
    total: rows.length,
    repeats,
    rate: repeats / rows.length
  }
}

/** 判断「当前这条」相对历史是否重复失败 */
export function isRepeatFailure(
  history: FailureCase[],
  candidate: Pick<FailureCase, 'attribution' | 'trigger_tags'>
): { repeat: boolean; count: number } {
  const attr = candidate.attribution || 'defect'
  const tags = new Set((candidate.trigger_tags || []).map((t) => t.toLowerCase()))
  let count = 0
  for (const prev of history) {
    if ((prev.attribution || 'defect') === attr) {
      count += 1
      continue
    }
    if ((prev.trigger_tags || []).some((t) => tags.has(t.toLowerCase()) && !['feedback', 't1', 'test', 'verify'].includes(t))) {
      count += 1
    }
  }
  return { repeat: count > 0, count: count + 1 }
}
