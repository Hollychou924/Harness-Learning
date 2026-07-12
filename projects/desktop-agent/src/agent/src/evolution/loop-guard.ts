/**
 * LoopGuard：防止重复工具 / 乒乓空转。
 * 熔断后由 L0 停止并提示拆分，而不是无限转。
 */
export interface LoopGuardVerdict {
  trip: boolean
  reason: string
}

function stableArgs(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args, Object.keys(args).sort())
  } catch {
    return String(args)
  }
}

export class LoopGuard {
  private recent: string[] = []

  constructor(
    /** 滑动窗口长度 */
    private readonly windowSize = 8,
    /** 同一指纹在窗口内达到该次数则熔断 */
    private readonly repeatThreshold = 3
  ) {}

  fingerprint(toolName: string, args: Record<string, unknown>): string {
    return `${toolName}:${stableArgs(args)}`
  }

  observe(toolName: string, args: Record<string, unknown>): LoopGuardVerdict {
    const fp = this.fingerprint(toolName, args)
    this.recent.push(fp)
    if (this.recent.length > this.windowSize) this.recent.shift()

    const same = this.recent.filter((x) => x === fp).length
    if (same >= this.repeatThreshold) {
      return {
        trip: true,
        reason: `LoopGuard：相同工具调用重复 ${same} 次（${toolName}），疑似空转，已熔断`
      }
    }

    if (this.recent.length >= 6) {
      const slice = this.recent.slice(-6)
      const [a, b, c, d, e, f] = slice
      if (a === c && c === e && b === d && d === f && a !== b) {
        return {
          trip: true,
          reason: `LoopGuard：工具乒乓空转（${a.split(':')[0]} ↔ ${b.split(':')[0]}），已熔断`
        }
      }
    }

    return { trip: false, reason: '' }
  }

  reset(): void {
    this.recent = []
  }
}
