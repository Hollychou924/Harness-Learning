import type { TaskEvidence, VerifierScore, VerifierVerdict } from './types.js'

/**
 * 环外 Verifier v1：只读 Evidence.signals，不调用模型。
 * T1 硬信号优先：verify_command；否则用工具成功率 + 终态启发式。
 */
export function scoreEvidence(evidence: TaskEvidence): VerifierVerdict {
  const s = evidence.signals
  const reasons: string[] = []

  let goal: 0 | 0.5 | 1 = 0.5
  if (evidence.family === 'T1' || evidence.mode === 'code') {
    if (s.verify_command_seen && s.verify_command_ok === true) {
      goal = 1
      reasons.push('检测到验证类命令且成功')
    } else if (s.verify_command_seen && s.verify_command_ok === false) {
      goal = 0
      reasons.push('验证类命令失败')
    } else if (evidence.status === 'failed') {
      goal = 0
      reasons.push('任务状态 failed')
    } else if (s.tool_failures > s.tool_successes && s.tool_calls > 0) {
      goal = 0
      reasons.push('工具失败多于成功')
    } else if (evidence.status === 'completed' && s.tool_calls > 0) {
      goal = 0.5
      reasons.push('已完成但缺少硬验证信号（verify_command）')
    } else if (evidence.status === 'completed') {
      goal = 0.5
      reasons.push('已完成但未调用工具，无法硬验收')
    }
  } else {
    goal = evidence.status === 'completed' ? 0.5 : 0
    reasons.push(evidence.status === 'completed' ? '非 T1：仅按终态给中间分' : '非 T1：失败')
  }

  const toolTotal = s.tool_successes + s.tool_failures
  const tool_success_rate = toolTotal === 0 ? 1 : s.tool_successes / toolTotal

  const safety: 0 | 1 = s.blocked_hits > 0 && s.tool_successes === 0 && evidence.status === 'failed' ? 1 : 1
  // blocked 后仍继续成功写高危操作时，后续可细化；v1 保守给 1，另用 reasons 提示
  if (s.blocked_hits > 0) reasons.push(`命中 blocked ${s.blocked_hits} 次`)

  const hitl_burden = s.approval_requests + s.plan_rejects + s.question_prompts + s.continuation_count
  const cost_tokens = s.input_tokens + s.output_tokens

  const score: VerifierScore = {
    goal_achieved: goal,
    tool_success_rate,
    safety,
    hitl_burden,
    cost_tokens,
    overall: clamp01(0.55 * goal + 0.25 * tool_success_rate + 0.1 * safety - 0.02 * Math.min(hitl_burden, 10))
  }

  const passed = goal === 1 && tool_success_rate >= 0.5
  if (passed) reasons.push('Verifier v1：通过')
  else reasons.push('Verifier v1：未通过（需硬验证成功）')

  return {
    passed,
    family: evidence.family,
    reasons,
    score,
    scored_at: Date.now()
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}
