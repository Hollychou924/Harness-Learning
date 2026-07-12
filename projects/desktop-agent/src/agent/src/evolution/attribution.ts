/**
 * L1 四类归因（适配进化环）
 * 优先级冲突：项目规范(convention) > 用户风格(style) > 逻辑/缺陷
 * schema 仅增 optional 字段，保持 Evidence 1.0 兼容
 */
import type { AttributionCategory, FailureCase, MemoryScope, TaskEvidence, TaskFamily } from './types.js'

export const ATTRIBUTION_LABEL: Record<AttributionCategory, string> = {
  style: '风格',
  convention: '规范',
  logic: '逻辑',
  defect: '缺陷'
}

/** 注入排序权重：规范优先于风格，缺陷略高于纯逻辑（避坑更急） */
export const ATTRIBUTION_INJECT_WEIGHT: Record<AttributionCategory, number> = {
  convention: 40,
  style: 30,
  defect: 25,
  logic: 20
}

export interface AttributionResult {
  category: AttributionCategory
  scope: MemoryScope
  confidence: number
  rationale: string
}

const STYLE_RE = /命名|缩写|注释|排版|格式|风格|偏好|usrInfo|变量名|函数拆分|详略/
const CONVENTION_RE = /规范|分层|架构|Result|错误码|统一封装|项目约定|公共组件|依赖用法|注解/
const LOGIC_RE = /边界|需求理解|业务逻辑|漏了|遗漏|条件|意图|拆解/
const DEFECT_RE = /语法|编译|类型错误|测试失败|报错|崩溃|安全|漏洞|空指针|verify|验证失败|blocked/

/**
 * 规则归因 v1：优先看 Verifier/信号硬证据，再看文本关键词。
 * 不做 LLM 分类，保证可测、可回放。
 */
export function classifyAttribution(input: {
  evidence?: TaskEvidence
  symptom?: string
  rootCause?: string
  userFeedback?: string
}): AttributionResult {
  const text = [input.symptom, input.rootCause, input.userFeedback, ...(input.evidence?.verdict?.reasons || [])]
    .filter(Boolean)
    .join('；')

  const s = input.evidence?.signals
  if (s?.blocked_hits && s.blocked_hits > 0) {
    return { category: 'defect', scope: 'project', confidence: 0.9, rationale: '命中 BLOCKED/安全拦截' }
  }
  if (s?.verify_command_ok === false) {
    return { category: 'defect', scope: 'project', confidence: 0.95, rationale: '验证命令失败（硬信号）' }
  }
  if (s && s.verify_command_seen === false && (s.tool_calls > 0 || input.evidence?.status === 'completed')) {
    return { category: 'defect', scope: 'project', confidence: 0.85, rationale: '缺少硬验证即宣称完成（过程缺陷）' }
  }
  if (s && s.tool_failures > s.tool_successes && s.tool_calls > 0) {
    return { category: 'defect', scope: 'project', confidence: 0.8, rationale: '工具失败多于成功' }
  }

  if (CONVENTION_RE.test(text)) {
    return { category: 'convention', scope: 'project', confidence: 0.75, rationale: '文本匹配项目规范类关键词' }
  }
  if (STYLE_RE.test(text)) {
    return { category: 'style', scope: 'user', confidence: 0.7, rationale: '文本匹配用户风格类关键词' }
  }
  if (LOGIC_RE.test(text)) {
    return { category: 'logic', scope: 'project', confidence: 0.7, rationale: '文本匹配逻辑/边界类关键词' }
  }
  if (DEFECT_RE.test(text)) {
    return { category: 'defect', scope: 'project', confidence: 0.75, rationale: '文本匹配缺陷类关键词' }
  }

  return {
    category: 'defect',
    scope: 'project',
    confidence: 0.5,
    rationale: '默认归为缺陷（保守，避免把未知问题学成风格）'
  }
}

export function buildFailureCaseFromEvidence(opts: {
  evidence: TaskEvidence
  family?: TaskFamily
}): Omit<FailureCase, 'id' | 'created_at'> {
  const attr = classifyAttribution({ evidence: opts.evidence })
  const reasons = opts.evidence.verdict?.reasons?.join('; ') || 'Verifier 未通过'
  const verifyFailed = opts.evidence.signals.verify_command_ok === false
  return {
    family: opts.family || opts.evidence.family || 'T1',
    attribution: attr.category,
    scope: attr.scope,
    confidence: attr.confidence,
    enabled: true,
    symptom: reasons,
    root_cause: attr.rationale,
    fix_hint:
      attr.category === 'defect'
        ? '结束前必须跑测试/编译；失败时先读报错再改最小范围'
        : attr.category === 'convention'
          ? '对照项目规范库修正分层/错误处理/命名约定后再验证'
          : attr.category === 'style'
            ? '按用户偏好库调整命名/注释/拆分粒度，勿改业务语义'
            : '核对需求边界与调用链，补齐遗漏分支后再验证',
    trigger_tags: ['t1', 'verify', 'test', attr.category],
    verify_hint: 'shell 跑项目测试或 tsc/build',
    source_task_id: opts.evidence.task_id,
    rationale: attr.rationale
  }
}

export function attributionLabel(category: AttributionCategory): string {
  return ATTRIBUTION_LABEL[category]
}
