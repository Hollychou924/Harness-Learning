import type { TaskEvidence, TaskFamily, VerifierVerdict } from './types.js'
import { scoreEvidence } from './verifier.js'
import { listFailureCases } from './experience/store.js'
import { attributionLabel, classifyAttribution } from './attribution.js'

export const SHORT_FAIL_MAX_ROUNDS = 3

export interface ShortFailDecision {
  allow: boolean
  reason: string
  round: number
}

/**
 * 短失败环闸门（与 Critic 的 ReflectionGovernor 分离）：
 * Verifier 未过时，最多再催 ≤3 轮「按经验修 → 再验证」。
 */
export function shouldShortFail(opts: {
  family: TaskFamily
  mode: 'work' | 'code'
  round: number
  maxRounds?: number
  evidence: TaskEvidence
}): ShortFailDecision {
  const maxRounds = opts.maxRounds ?? SHORT_FAIL_MAX_ROUNDS
  const round = opts.round
  if (opts.family !== 'T1' && opts.mode !== 'code') {
    return { allow: false, reason: '非 T1/Code，不启短失败环', round }
  }
  if (round >= maxRounds) {
    return { allow: false, reason: `短失败环已用尽（${maxRounds}）`, round }
  }

  const peek: TaskEvidence = {
    ...opts.evidence,
    status: 'completed',
    finished_at: opts.evidence.finished_at || Date.now()
  }
  const verdict = scoreEvidence(peek)
  if (verdict.passed) {
    return { allow: false, reason: 'Verifier 已通过', round }
  }

  const s = opts.evidence.signals
  if (s.verify_command_ok === false) {
    return { allow: true, reason: '验证命令失败，进入短失败环', round }
  }
  if (!s.verify_command_seen) {
    return { allow: true, reason: '缺少硬验证信号，催促补跑验证', round }
  }
  if (s.tool_failures > 0) {
    return { allow: true, reason: '存在工具失败且未过 Verifier', round }
  }
  return { allow: true, reason: 'Verifier 未通过', round }
}

export function peekVerdict(evidence: TaskEvidence): VerifierVerdict {
  return scoreEvidence({
    ...evidence,
    status: 'completed',
    finished_at: evidence.finished_at || Date.now()
  })
}

export function buildShortFailNudge(opts: {
  round: number
  maxRounds: number
  verdict: VerifierVerdict
  workspaceDir?: string
  evidence?: TaskEvidence
}): string {
  const attr = classifyAttribution({
    evidence: opts.evidence,
    symptom: opts.verdict.reasons.join('; ')
  })
  const hints: string[] = []
  if (opts.workspaceDir) {
    const cases = listFailureCases(opts.workspaceDir, 30)
      .filter((fc) => (fc.attribution || 'defect') === attr.category || !fc.attribution)
      .slice(-5)
      .reverse()
    for (const fc of cases) {
      const label = attributionLabel(fc.attribution || 'defect')
      hints.push(`- [${label}] ${fc.fix_hint}${fc.verify_hint ? `（验证：${fc.verify_hint}）` : ''}`)
    }
  }
  if (hints.length === 0) {
    hints.push('- 先用 shell 跑项目测试或编译命令，根据报错做最小修改，再重跑同一验证命令')
    hints.push('- 未看到验证成功前，不要宣称任务完成')
  }

  return [
    `[系统·短失败环 ${opts.round + 1}/${opts.maxRounds}] Verifier 未通过（归因：${attributionLabel(attr.category)}/${attr.scope}），请继续修复并重新验证，不要只做文字总结。`,
    `原因：${opts.verdict.reasons.join('；')}`,
    `归因说明：${attr.rationale}`,
    '经验提示：',
    ...hints,
    '要求：必须调用工具完成修改与验证；验证成功后再给出最终结论。'
  ].join('\n')
}
