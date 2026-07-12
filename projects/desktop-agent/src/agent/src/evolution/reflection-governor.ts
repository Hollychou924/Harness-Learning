import type { ReflectionDecision, TaskEvidence } from './types.js'

/**
 * ReflectionGovernor：防止 Reflection Theater。
 * - 无外部证据（工具/验证信号）→ 禁止 Critic
 * - 每任务 Critic 预算有限
 * - Verifier 已通过 → 默认不再复查
 */
export class ReflectionGovernor {
  private used = 0

  constructor(
    private readonly budget: number = 2,
    private readonly requireEvidence: boolean = true
  ) {}

  decide(evidence: TaskEvidence, opts?: { force?: boolean }): ReflectionDecision {
    const remaining = Math.max(0, this.budget - this.used)
    if (opts?.force) {
      if (remaining <= 0) return { allow: false, reason: 'Critic 预算已耗尽', remaining_budget: 0 }
      this.used += 1
      return { allow: true, reason: '强制复查', remaining_budget: remaining - 1 }
    }

    if (remaining <= 0) {
      return { allow: false, reason: 'Critic 预算已耗尽', remaining_budget: 0 }
    }

    if (evidence.verdict?.passed) {
      return { allow: false, reason: 'Verifier 已通过，跳过复查', remaining_budget: remaining }
    }

    const s = evidence.signals
    const hasEvidence = s.tool_calls > 0 || s.verify_command_seen
    if (this.requireEvidence && !hasEvidence) {
      return { allow: false, reason: '无外部证据，禁止启动 Critic', remaining_budget: remaining }
    }

    const failed =
      evidence.status === 'failed' ||
      s.verify_command_ok === false ||
      (s.tool_failures > 0 && s.tool_successes === 0)

    if (!failed && evidence.verdict && evidence.verdict.score.goal_achieved >= 0.5) {
      return { allow: false, reason: '未失败且目标分未跌破阈值', remaining_budget: remaining }
    }

    if (!failed) {
      return { allow: false, reason: '无失败信号，默认不复查', remaining_budget: remaining }
    }

    this.used += 1
    return { allow: true, reason: '失败且有证据，允许 Critic', remaining_budget: remaining - 1 }
  }

  remaining(): number {
    return Math.max(0, this.budget - this.used)
  }
}
