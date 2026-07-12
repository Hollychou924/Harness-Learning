/**
 * 用户结果反馈 → L1 经验账本（适配环输入）
 * accept：只记正向日志，不造 failure_case（避免噪声）
 * edit / reject：归因后写入 failure_cases；风格/规范可沉淀为待回测 tactic
 *
 * 纠正落点分流（见 docs/18「纠正落点分流」）：
 * Memory/tactic · Gate 候选 · Skill 候选 · Golden 候选 —— 本轮只分类记账，不写 Hook/Skill 文件
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { AttributionCategory, FailureCase, Tactic, TaskFamily } from './types.js'
import { classifyAttribution } from './attribution.js'
import { appendFailureCase, experiencePaths, listFailureCases, listTactics, upsertTactic } from './experience/store.js'

export type OutcomeKind = 'accept' | 'edit' | 'reject'

/** 纠正应落到的学习目标（可多选，主目标取第一个） */
export type LearningTarget =
  | 'memory'
  | 'gate_candidate'
  | 'skill_candidate'
  | 'golden_candidate'
  | 'none'

export interface LearningRoute {
  primary: LearningTarget
  targets: LearningTarget[]
  rationale: string
}

export interface OutcomeFeedbackInput {
  outcome: OutcomeKind
  taskId?: string
  note?: string
  family?: TaskFamily
  sourceTaskId?: string
}

export interface OutcomeFeedbackRecord {
  id: string
  at: number
  outcome: OutcomeKind
  task_id?: string
  note?: string
  attribution?: AttributionCategory
  scope?: string
  failure_case_id?: string
  tactic_id?: string
  /** 纠正落点分流结果 */
  learning_target?: LearningTarget
  learning_targets?: LearningTarget[]
  learning_route_rationale?: string
}

export interface RecordOutcomeResult {
  success: boolean
  record?: OutcomeFeedbackRecord
  failureCase?: FailureCase
  tactic?: Tactic
  learningRoute?: LearningRoute
  error?: string
}

const GATE_RE = /禁止|必须先|不允许|黑名单|白名单|pretool|hook|拦截|不可直接|强制/
const SKILL_RE = /流程|步骤固定|每次都要|工作流|runbook|SOP|skill|先启动|再运行/
const GOLDEN_RE = /复现|回归|评测|golden|必过|用例|下次别再|再犯/

/**
 * 纠正落点分流：不是所有经验都进 Memory。
 * 主目标优先级：gate > golden（非风格/规范）> skill（无 memory）> memory > none
 */
export function routeLearningTarget(input: {
  outcome: OutcomeKind
  note?: string
  attribution?: AttributionCategory
}): LearningRoute {
  if (input.outcome === 'accept') {
    return { primary: 'none', targets: ['none'], rationale: '接受交付，不沉淀纠正' }
  }
  const note = (input.note || '').trim()
  const attr = input.attribution
  const targets: LearningTarget[] = []

  if (note && GATE_RE.test(note)) {
    targets.push('gate_candidate')
  }
  if (note && GOLDEN_RE.test(note)) {
    targets.push('golden_candidate')
  }
  if (note && SKILL_RE.test(note)) {
    targets.push('skill_candidate')
  }
  if (attr === 'style' || attr === 'convention') {
    targets.push('memory')
  } else if (note.length >= 4) {
    targets.push('memory')
    if (!targets.includes('golden_candidate') && (attr === 'defect' || attr === 'logic')) {
      targets.push('golden_candidate')
    }
  } else {
    targets.push('memory')
  }

  const unique = [...new Set(targets)]
  if (unique.length === 0) unique.push('memory')

  let primary: LearningTarget = unique[0]
  if (unique.includes('gate_candidate')) primary = 'gate_candidate'
  else if (unique.includes('golden_candidate') && attr !== 'style' && attr !== 'convention') {
    primary = 'golden_candidate'
  } else if (unique.includes('memory')) primary = 'memory'
  else if (unique.includes('skill_candidate')) primary = 'skill_candidate'

  const rationale =
    primary === 'gate_candidate'
      ? '含强制约束关键词 → PreTool Gate/Hook 候选（本轮仅记账）'
      : primary === 'golden_candidate'
        ? '可复现/回归类 → Golden Badcase 候选'
        : primary === 'skill_candidate'
          ? '固定流程表述 → Skill 候选（需人工确认）'
          : primary === 'memory'
            ? '风格/规范/一般纠正 → Memory 或待回测 tactic'
            : '无需沉淀'

  return { primary, targets: unique, rationale }
}

function appendOutcomeLog(workspaceDir: string, record: OutcomeFeedbackRecord): void {
  const paths = experiencePaths(workspaceDir)
  mkdirSync(paths.root, { recursive: true })
  const file = `${paths.root}/outcome_feedback.jsonl`
  appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8')
}

export function listOutcomeFeedback(workspaceDir: string, limit = 50): OutcomeFeedbackRecord[] {
  const file = `${experiencePaths(workspaceDir).root}/outcome_feedback.jsonl`
  if (!existsSync(file)) return []
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean)
  const rows: OutcomeFeedbackRecord[] = []
  for (const line of lines.slice(-limit)) {
    try {
      rows.push(JSON.parse(line) as OutcomeFeedbackRecord)
    } catch {
      // skip
    }
  }
  return rows
}

export function recordOutcomeFeedback(workspaceDir: string, input: OutcomeFeedbackInput): RecordOutcomeResult {
  if (!workspaceDir) return { success: false, error: '未指定工作区，无法写入经验账本' }

  const note = (input.note || '').trim()
  const family = input.family || 'T1'

  if (input.outcome === 'accept') {
    const route = routeLearningTarget({ outcome: 'accept', note })
    const record: OutcomeFeedbackRecord = {
      id: `of-${randomUUID().slice(0, 8)}`,
      at: Date.now(),
      outcome: 'accept',
      task_id: input.taskId,
      note: note || undefined,
      learning_target: route.primary,
      learning_targets: route.targets,
      learning_route_rationale: route.rationale
    }
    try {
      appendOutcomeLog(workspaceDir, record)
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
    return { success: true, record, learningRoute: route }
  }

  const attr = classifyAttribution({
    userFeedback: note,
    symptom: input.outcome === 'reject' ? '用户拒绝本次交付' : '用户局部修改了交付结果',
    rootCause: note
  })

  const category = note ? attr.category : 'defect'
  const scope = note ? attr.scope : 'project'
  const route = routeLearningTarget({ outcome: input.outcome, note, attribution: category })

  try {
    const failureCase = appendFailureCase(workspaceDir, {
      family,
      attribution: category,
      scope,
      confidence: note ? attr.confidence : 0.6,
      enabled: true,
      symptom: input.outcome === 'reject' ? `用户拒绝：${note || '未填写原因'}` : `用户改写：${note || '未填写说明'}`,
      root_cause: attr.rationale,
      fix_hint:
        category === 'style'
          ? '按用户偏好调整命名/注释/拆分，勿改业务语义'
          : category === 'convention'
            ? '对齐项目规范后再交付'
            : category === 'logic'
              ? '核对需求边界与调用链后再改'
              : '先跑验证、读报错，再做最小修复',
      trigger_tags: ['feedback', input.outcome, category, route.primary],
      verify_hint: '必要时 shell 跑测试/编译确认',
      source_task_id: input.sourceTaskId || input.taskId,
      rationale: attr.rationale
    })

    let tactic: Tactic | undefined
    if (route.targets.includes('memory') && (category === 'style' || category === 'convention') && note.length >= 4) {
      const id = `fb-${category}-${randomUUID().slice(0, 6)}`
      tactic = upsertTactic(workspaceDir, {
        id,
        family,
        title: category === 'style' ? '用户风格反馈' : '项目规范反馈',
        body: note.slice(0, 240),
        trigger_tags: [category, 'feedback', family.toLowerCase()],
        priority: category === 'convention' ? 88 : 70,
        enabled: true,
        attribution: category,
        scope,
        validated: false
      })
    }

    if (route.targets.some((t) => t === 'gate_candidate' || t === 'skill_candidate' || t === 'golden_candidate')) {
      const paths = experiencePaths(workspaceDir)
      mkdirSync(paths.root, { recursive: true })
      appendFileSync(
        `${paths.root}/learning_candidates.jsonl`,
        `${JSON.stringify({
          id: `lc-${randomUUID().slice(0, 8)}`,
          at: Date.now(),
          targets: route.targets.filter((t) => t !== 'memory' && t !== 'none'),
          note: note.slice(0, 400),
          attribution: category,
          failure_case_id: failureCase.id,
          rationale: route.rationale
        })}\n`,
        'utf8'
      )
    }

    const record: OutcomeFeedbackRecord = {
      id: `of-${randomUUID().slice(0, 8)}`,
      at: Date.now(),
      outcome: input.outcome,
      task_id: input.taskId,
      note: note || undefined,
      attribution: category,
      scope,
      failure_case_id: failureCase.id,
      tactic_id: tactic?.id,
      learning_target: route.primary,
      learning_targets: route.targets,
      learning_route_rationale: route.rationale
    }
    appendOutcomeLog(workspaceDir, record)
    return { success: true, record, failureCase, tactic, learningRoute: route }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function readExperienceLedger(workspaceDir: string): {
  tactics: Tactic[]
  failureCases: FailureCase[]
  outcomes: OutcomeFeedbackRecord[]
} {
  if (!workspaceDir) return { tactics: [], failureCases: [], outcomes: [] }
  return {
    tactics: listTactics(workspaceDir),
    // 设置页需要看到已禁用条目以便重新启用
    failureCases: listFailureCases(workspaceDir, 100, { includeDisabled: true }),
    outcomes: listOutcomeFeedback(workspaceDir, 50)
  }
}

/** 读取 Gate/Skill/Golden 候选账本（本轮仅记账） */
export function listLearningCandidates(workspaceDir: string, limit = 50): Array<Record<string, unknown>> {
  const file = `${experiencePaths(workspaceDir).root}/learning_candidates.jsonl`
  if (!existsSync(file)) return []
  const rows: Array<Record<string, unknown>> = []
  for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-limit)) {
    try {
      rows.push(JSON.parse(line) as Record<string, unknown>)
    } catch {
      // skip
    }
  }
  return rows
}
