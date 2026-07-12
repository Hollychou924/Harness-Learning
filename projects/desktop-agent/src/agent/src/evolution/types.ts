// Evidence / Verifier / Experience schema 1.0（冻结）
// 权威说明：docs/20-m0-execution-baseline.md
// 增字段仅允许 optional；破坏性变更必须升 schema_version

export const EVIDENCE_SCHEMA_VERSION = '1.0' as const
export const HARNESS_VERSION = 'desktop-agent-0.1.0'

export type TaskFamily = 'T1' | 'T2' | 'other'
export type T1Subtype = 't1-fix' | 't1-add' | 't1-refactor-safe' | 't1-verify-only'

/** L1 四类归因：风格 / 规范 / 逻辑 / 缺陷 */
export type AttributionCategory = 'style' | 'convention' | 'logic' | 'defect'

/**
 * 记忆作用域。冲突优先级：
 * project(规范) > user(风格偏好) > general(通用最佳实践)
 */
export type MemoryScope = 'project' | 'user' | 'general'

export interface EvidenceSignals {
  iterations: number
  continuation_count: number
  input_tokens: number
  output_tokens: number
  tool_calls: number
  tool_failures: number
  tool_successes: number
  approval_requests: number
  approval_rejects: number
  plan_rejects: number
  question_prompts: number
  blocked_hits: number
  verify_command_seen: boolean
  verify_command_ok: boolean | null
  tactics_injected: number
  /** 短失败环已触发次数 */
  short_fail_rounds?: number
  /** 后续由离线标注或规则回填 */
  tactics_hit?: number
  /**
   * 重复错误粗标（optional，schema 1.0 兼容）：
   * 本任务 failure 的 trigger_tags/attribution 是否在近窗 failure_cases 中出现过
   */
  repeat_failure?: boolean
  /** 近窗内同 attribution 失败次数（含本次） */
  repeat_failure_count?: number
}

export interface UserIntervention {
  at: number
  kind: 'approval' | 'plan' | 'question' | 'continuation' | 'cancel' | 'other'
  decision: string
  detail?: string
}

export interface CriticRound {
  at: number
  reason: string
  input_tokens: number
  output_tokens: number
  echo: boolean
  useful: boolean | null
}

export interface VerifierScore {
  goal_achieved: 0 | 0.5 | 1
  tool_success_rate: number
  safety: 0 | 1
  hitl_burden: number
  cost_tokens: number
  /** 0–1 综合，便于排序；非唯一门禁 */
  overall: number
}

export interface VerifierVerdict {
  passed: boolean
  family: TaskFamily
  reasons: string[]
  score: VerifierScore
  scored_at: number
}

export interface ItemEvidenceRow {
  ts: number
  event: string
  item_id?: string
  item_type?: string
  tool_name?: string
  status?: string
  summary?: string
}

export interface TaskEvidence {
  schema_version: typeof EVIDENCE_SCHEMA_VERSION
  harness_version: string
  task_id: string
  turn_id: string
  session_id?: string
  mode: 'work' | 'code'
  family: TaskFamily
  user_goal: string
  started_at: number
  finished_at?: number
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  signals: EvidenceSignals
  interventions: UserIntervention[]
  items: ItemEvidenceRow[]
  critic_rounds: CriticRound[]
  verdict?: VerifierVerdict
  /** optional：任务契约快照（schema 1.0 兼容） */
  goal_contract?: {
    user_goal: string
    do_not: string[]
    acceptance_criteria: string[]
    verify_hint?: string
  }
}

export function emptySignals(): EvidenceSignals {
  return {
    iterations: 0,
    continuation_count: 0,
    input_tokens: 0,
    output_tokens: 0,
    tool_calls: 0,
    tool_failures: 0,
    tool_successes: 0,
    approval_requests: 0,
    approval_rejects: 0,
    plan_rejects: 0,
    question_prompts: 0,
    blocked_hits: 0,
    verify_command_seen: false,
    verify_command_ok: null,
    tactics_injected: 0,
    short_fail_rounds: 0
  }
}

/** L1：可执行失败案例（不是日记） */
export interface FailureCase {
  id: string
  family: TaskFamily
  subtype?: T1Subtype
  created_at: number
  symptom: string
  root_cause: string
  fix_hint: string
  trigger_tags: string[]
  verify_hint?: string
  source_task_id?: string
  /** 四类归因（optional，旧数据缺省按 defect） */
  attribution?: AttributionCategory
  scope?: MemoryScope
  /** 0–1，低于阈值可不注入 */
  confidence?: number
  enabled?: boolean
  rationale?: string
}

export interface GapPattern {
  id: string
  family: TaskFamily
  title: string
  description: string
  trigger_tags: string[]
  tactic_ids: string[]
  count: number
  updated_at: number
  attribution?: AttributionCategory
  scope?: MemoryScope
}

export interface Tactic {
  id: string
  family: TaskFamily
  title: string
  /** 注入 system / 用户侧提示的可执行条文 */
  body: string
  trigger_tags: string[]
  priority: number
  enabled: boolean
  hit_count: number
  updated_at: number
  attribution?: AttributionCategory
  scope?: MemoryScope
  /** 生效前是否已过回测门禁；false 则不注入 */
  validated?: boolean
  /** 晋升回测绑定的 Golden case id（如 t1-018） */
  backtest_case_ids?: string[]
  /** 晋升通过时间戳 */
  validated_at?: number
  /** 来源失败案例 id */
  source_failure_id?: string
  /** 最近一次回测摘要 */
  validation_note?: string
}

export interface ReflectionDecision {
  allow: boolean
  reason: string
  remaining_budget: number
}
