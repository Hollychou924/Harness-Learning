/**
 * Goal Contract：做到什么程度才算完成（非 Plan 步骤列表）
 * 启发式生成，无 LLM 硬依赖；注入 system 并参与 Stop Gate
 */
export interface GoalContract {
  task_type: 'code' | 'work'
  user_goal: string
  do_not: string[]
  constraints: string[]
  acceptance_criteria: string[]
  verify_hint?: string
  allowed_paths?: string[]
  needs_user_confirm: boolean
}

const DELETE_RE = /删除|移除|drop\s+table|rm\s+-rf|清空/
const SCHEMA_RE = /schema|migration|数据库|表结构/
const VERIFY_RE = /测试|test|编译|tsc|build|验证|跑一遍/

/**
 * 从用户首条消息 + 模式生成最小契约
 */
export function buildGoalContract(
  userMessage: string,
  mode: 'work' | 'code'
): GoalContract {
  const goal = userMessage.trim().slice(0, 800) || '（未填写目标）'
  const do_not: string[] = [
    '不删除测试或通过改测试期望刷绿',
    '不覆盖用户未要求的无关文件',
    '不扩大到未声明的重构范围'
  ]
  const constraints: string[] = []
  const acceptance_criteria: string[] = []

  if (mode === 'code') {
    acceptance_criteria.push('用 shell 跑项目约定的测试或编译，并看到成功结果')
    acceptance_criteria.push('修改范围仅覆盖完成目标所需的最小文件集')
    constraints.push('改完必须硬验证，未验证不得宣称完成')
    if (VERIFY_RE.test(goal)) {
      acceptance_criteria.push('用户点名的验证命令或场景已执行并通过')
    }
  } else {
    acceptance_criteria.push('最终交付含可核对的结论与来源')
    acceptance_criteria.push('不确定处已明确标注，未臆测')
  }

  if (DELETE_RE.test(goal)) {
    constraints.push('涉及删除/破坏性操作须用户确认')
  }
  if (SCHEMA_RE.test(goal)) {
    do_not.push('禁止直接改库表结构；须先 migration/评审流程（若项目有约定）')
  }

  const verify_hint =
    mode === 'code'
      ? 'shell 执行测试/编译（如 npm test、node --test、tsc）并确认退出码 0'
      : '交付物结构完整且来源可追溯'

  return {
    task_type: mode,
    user_goal: goal,
    do_not,
    constraints,
    acceptance_criteria,
    verify_hint,
    needs_user_confirm: DELETE_RE.test(goal) || /权限|安全|生产|线上/.test(goal)
  }
}

/** 注入 system 的契约块（压缩时必须保留） */
export function formatGoalContractBlock(contract: GoalContract): string {
  const lines = [
    '',
    '## 任务契约（Goal Contract）',
    `目标：${contract.user_goal}`,
    `非目标 / 禁止：${contract.do_not.join('；')}`,
    `约束：${contract.constraints.join('；') || '无额外约束'}`,
    `验收：${contract.acceptance_criteria.join('；')}`,
    contract.verify_hint ? `验证方式：${contract.verify_hint}` : '',
    contract.needs_user_confirm ? '高风险：涉及破坏性/权限操作时先征求用户确认。' : '',
    '完成判定：未满足验收与验证方式前，不得宣称任务完成；应继续工具验证或进入短失败修复。'
  ]
  return lines.filter(Boolean).join('\n')
}

export const GOAL_CONTRACT_MARKER = '## 任务契约（Goal Contract）'

/**
 * Stop Gate：code/T1 在无硬验证成功时不允许「通过完成」
 * 返回 ok=false 时应进入短失败环而非 finish completed
 */
export function evaluateStopGate(opts: {
  mode: 'work' | 'code'
  contract: GoalContract
  verifySeen: boolean
  verifyOk: boolean | null
}): { ok: boolean; reason: string } {
  if (opts.mode !== 'code') {
    return { ok: true, reason: 'Work 模式不强制硬验证 Stop Gate' }
  }
  if (opts.contract.acceptance_criteria.some((c) => /测试|编译|验证|shell/.test(c))) {
    if (!opts.verifySeen) {
      return { ok: false, reason: '契约要求硬验证，但尚未执行验证命令' }
    }
    if (opts.verifyOk === false) {
      return { ok: false, reason: '验证命令已执行但未通过' }
    }
    if (opts.verifyOk !== true) {
      return { ok: false, reason: '验证结果未知，不能宣称完成' }
    }
  }
  return { ok: true, reason: '契约 Stop Gate 通过' }
}
