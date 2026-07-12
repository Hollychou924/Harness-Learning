/**
 * 打断策略表：什么时候自动处理，什么时候问用户
 */
export type InterruptAction = 'auto' | 'record_and_auto' | 'ask_user' | 'escalate_stop'

export interface InterruptDecision {
  action: InterruptAction
  reason: string
}

const SAFETY_RE = /删除|权限|安全|生产|线上|密钥|密码|rm\s+-rf|drop\s+|清空数据|不可逆/
const STYLE_CLARIFY_RE = /命名|注释|格式|偏好|风格|要不要|是否需要/
const MULTI_OPTION_RE = /方案[ABC]|哪个更好|选一个|还是/

/**
 * 决定是否打断用户。
 * consecutiveFailures：近期工具/验证连续失败次数
 */
export function decideInterrupt(input: {
  kind: 'question' | 'plan' | 'approval' | 'technical_error' | 'product_choice'
  text?: string
  riskLevel?: 'low' | 'medium' | 'high'
  consecutiveFailures?: number
  hasProjectConvention?: boolean
}): InterruptDecision {
  const text = input.text || ''
  const fails = input.consecutiveFailures ?? 0

  if (fails >= 3) {
    return { action: 'escalate_stop', reason: '连续失败≥3，停止重试并升级给用户' }
  }
  if (input.riskLevel === 'high' || SAFETY_RE.test(text)) {
    return { action: 'ask_user', reason: '安全/破坏性/权限相关，必须用户决策' }
  }
  if (input.kind === 'product_choice' || (MULTI_OPTION_RE.test(text) && /产品|交互|文案|定价/.test(text))) {
    return { action: 'ask_user', reason: '涉及产品取舍' }
  }
  if (input.kind === 'approval' && input.riskLevel === 'medium') {
    return { action: 'ask_user', reason: '中风险审批默认询问' }
  }
  if (input.hasProjectConvention && /规范|约定|分层/.test(text)) {
    return { action: 'auto', reason: '已有项目规范覆盖，自动遵守' }
  }
  if (input.kind === 'technical_error' || input.riskLevel === 'low') {
    return { action: 'auto', reason: '可回滚技术问题，自动处理' }
  }
  if (STYLE_CLARIFY_RE.test(text) && input.kind === 'question') {
    return { action: 'record_and_auto', reason: '风格澄清可记录偏好后自行选择合理默认' }
  }
  if (MULTI_OPTION_RE.test(text) && input.kind === 'question') {
    return { action: 'record_and_auto', reason: '多方案且无产品目标差异时自主选择并记录' }
  }
  if (input.kind === 'question') {
    return { action: 'ask_user', reason: '缺少关键需求或无法从代码推断' }
  }
  return { action: 'ask_user', reason: '默认谨慎询问' }
}
