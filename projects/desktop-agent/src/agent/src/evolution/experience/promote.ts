/**
 * Tactic 回测晋升门禁
 * draft (validated=false) → Golden 回测通过 → validated=true 才允许注入
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Tactic } from '../types.js'
import { selectTactics } from './injector.js'
import {
  appendFailureCase,
  draftTacticFromFailure,
  listDraftTactics,
  listFailureCases,
  listTactics,
  markTacticValidated,
  seedDefaultTactics,
  upsertTactic
} from './store.js'

export interface PromoteCaseResult {
  case_id: string
  passed: boolean
  reason?: string
}

export interface PromoteResult {
  tactic_id: string
  promoted: boolean
  gate: 'stub' | 'live' | 'force'
  case_results: PromoteCaseResult[]
  tactic?: Tactic
  note: string
}

export interface BacktestRunner {
  (opts: {
    caseIds: string[]
    forceTacticId: string
    workspaceDir: string
  }): Promise<PromoteCaseResult[]>
}

const MAP_OBJECT_KEY_TACTIC_ID = 't1-map-object-as-key'

/** 确保 t1-018 失败归因 + 草稿 tactic 落账（幂等） */
export function ensureT1018Draft(workspaceDir: string): {
  failureId: string
  tactic: Tactic
} {
  seedDefaultTactics(workspaceDir, 'T1')
  const existingFc = listFailureCases(workspaceDir, 500).find((f) => f.id === 'fc-t1-018-map-object-key')
  const failure =
    existingFc ||
    appendFailureCase(workspaceDir, {
      id: 'fc-t1-018-map-object-key',
      family: 'T1',
      subtype: 't1-fix',
      attribution: 'logic',
      scope: 'project',
      confidence: 0.95,
      enabled: true,
      symptom: 'Live 基线 t1-018：cache 用临时对象作 Map key，测试 get 不到写入值',
      root_cause: 'Map 按引用比较；每次 {id} 都是新对象，set/get 不对齐',
      fix_hint: '改用稳定原始值（如 userId 字符串）作 key；修完跑 node --test',
      trigger_tags: ['t1', 'map', 'key', 'cache', 'object', 'logic'],
      verify_hint: 'node --test cache.test.cjs',
      source_task_id: 'live-baseline-t1-018',
      rationale: '语言语义/逻辑类失败（非风格）'
    })

  let tactic = listTactics(workspaceDir).find((t) => t.id === MAP_OBJECT_KEY_TACTIC_ID)
  if (!tactic) {
    tactic = draftTacticFromFailure(workspaceDir, {
      id: MAP_OBJECT_KEY_TACTIC_ID,
      failure,
      title: 'Map 禁止临时对象作 key',
      body:
        'Map/WeakMap 不要用每次新建的对象字面量当 key（如 map.set({id}, v) / map.get({id})）：引用不同则永远 miss。' +
        '应使用稳定原始值（string/number）或同一对象引用。改完必须跑测试确认 get/set 对称。',
      priority: 92,
      backtest_case_ids: ['t1-018']
    })
  }
  return { failureId: failure.id, tactic }
}

export function resolveBacktestCaseIds(tactic: Tactic): string[] {
  if (tactic.backtest_case_ids && tactic.backtest_case_ids.length > 0) {
    return [...tactic.backtest_case_ids]
  }
  return []
}

/** 草稿不得出现在常规注入里；forceInclude 才可见。返回 true 表示隔离正确。 */
export function assertDraftNotInjected(workspaceDir: string, tacticId: string): boolean {
  seedDefaultTactics(workspaceDir, 'T1')
  const draft = listTactics(workspaceDir).find((x) => x.id === tacticId)
  if (!draft || draft.validated !== false) return false
  const normal = selectTactics(workspaceDir, { family: 'T1', goal: 'map cache key object', topK: 8 })
  if (normal.tactics.some((t) => t.id === tacticId)) return false
  const forced = selectTactics(workspaceDir, {
    family: 'T1',
    goal: 'map cache key object',
    topK: 8,
    forceIncludeIds: [tacticId]
  })
  return forced.tactics.some((t) => t.id === tacticId)
}

/**
 * 门禁：
 * - stub：绑定 case 的 fixture/oracle 仍绿 + 草稿可 force 注入（不晋升，除非 force）
 * - live：调用 runner，全部 pass 才晋升
 * - force：测试/人工强制晋升
 */
export async function backtestAndPromote(
  workspaceDir: string,
  tacticId: string,
  opts: {
    gate: 'stub' | 'live' | 'force'
    runner?: BacktestRunner
    note?: string
  }
): Promise<PromoteResult> {
  seedDefaultTactics(workspaceDir, 'T1')
  const tactic = listTactics(workspaceDir).find((t) => t.id === tacticId)
  if (!tactic) {
    return {
      tactic_id: tacticId,
      promoted: false,
      gate: opts.gate,
      case_results: [],
      note: 'tactic 不存在'
    }
  }
  if (tactic.validated === true) {
    return {
      tactic_id: tacticId,
      promoted: true,
      gate: opts.gate,
      case_results: [],
      tactic,
      note: '已是 validated，跳过'
    }
  }

  const caseIds = resolveBacktestCaseIds(tactic)
  if (opts.gate !== 'force' && caseIds.length === 0) {
    return {
      tactic_id: tacticId,
      promoted: false,
      gate: opts.gate,
      case_results: [],
      tactic,
      note: '缺少 backtest_case_ids，拒绝晋升'
    }
  }

  if (opts.gate === 'force') {
    const next = markTacticValidated(workspaceDir, tacticId, opts.note || 'force promote')
    return {
      tactic_id: tacticId,
      promoted: true,
      gate: 'force',
      case_results: caseIds.map((id) => ({ case_id: id, passed: true, reason: 'force' })),
      tactic: next || tactic,
      note: '强制晋升'
    }
  }

  if (opts.gate === 'stub') {
    const injectable = assertDraftNotInjected(workspaceDir, tacticId)
    const case_results = caseIds.map((id) => ({
      case_id: id,
      passed: injectable,
      reason: injectable ? 'stub gate: draft isolatable + bound' : 'forceInclude 未生效'
    }))
    return {
      tactic_id: tacticId,
      promoted: false,
      gate: 'stub',
      case_results,
      tactic,
      note: injectable
        ? 'stub 门禁通过（不自动晋升；需 live 或 force）'
        : 'stub 门禁失败：草稿隔离/强制注入异常'
    }
  }

  // live
  if (!opts.runner) {
    return {
      tactic_id: tacticId,
      promoted: false,
      gate: 'live',
      case_results: [],
      tactic,
      note: 'live 门禁需要 runner'
    }
  }

  const case_results = await opts.runner({
    caseIds,
    forceTacticId: tacticId,
    workspaceDir
  })
  const allPass = case_results.length > 0 && case_results.every((r) => r.passed)
  if (!allPass) {
    return {
      tactic_id: tacticId,
      promoted: false,
      gate: 'live',
      case_results,
      tactic,
      note: 'live 回测未全过，拒绝晋升'
    }
  }

  const next = markTacticValidated(
    workspaceDir,
    tacticId,
    opts.note || `live pass ${case_results.map((r) => r.case_id).join(',')}`
  )
  return {
    tactic_id: tacticId,
    promoted: true,
    gate: 'live',
    case_results,
    tactic: next || tactic,
    note: 'live 回测通过，已晋升'
  }
}

export async function promoteAllDrafts(
  workspaceDir: string,
  opts: {
    gate: 'stub' | 'live' | 'force'
    runner?: BacktestRunner
    onlyIds?: string[]
  }
): Promise<PromoteResult[]> {
  seedDefaultTactics(workspaceDir, 'T1')
  let drafts = listDraftTactics(workspaceDir, 'T1')
  if (opts.onlyIds?.length) {
    const set = new Set(opts.onlyIds)
    drafts = drafts.filter((t) => set.has(t.id))
  }
  const results: PromoteResult[] = []
  for (const d of drafts) {
    results.push(await backtestAndPromote(workspaceDir, d.id, opts))
  }
  return results
}

/** 晋升成功后，把种子源码侧默认改为 validated（可选写报告） */
export function writePromoteReport(
  reportPath: string,
  payload: Record<string, unknown>
): void {
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, JSON.stringify(payload, null, 2), 'utf8')
}

export function defaultGoldenCasesDir(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  return join(here, '../../../../../eval/golden-t1/cases')
}

export function loadGoldenCaseTags(casesDir = defaultGoldenCasesDir()): Map<string, string[]> {
  const map = new Map<string, string[]>()
  if (!existsSync(casesDir)) return map
  for (const f of readdirSync(casesDir).filter((x) => x.endsWith('.json'))) {
    try {
      const raw = JSON.parse(readFileSync(join(casesDir, f), 'utf8')) as {
        case_id?: string
        tags?: string[]
      }
      if (raw.case_id) map.set(raw.case_id, raw.tags || [])
    } catch {
      // skip
    }
  }
  return map
}

/** 测试辅助：手动写入一条草稿 */
export function upsertDraftTactic(workspaceDir: string, tactic: Omit<Tactic, 'hit_count' | 'updated_at'> & { hit_count?: number }): Tactic {
  return upsertTactic(workspaceDir, { ...tactic, validated: tactic.validated ?? false })
}

export { MAP_OBJECT_KEY_TACTIC_ID }
