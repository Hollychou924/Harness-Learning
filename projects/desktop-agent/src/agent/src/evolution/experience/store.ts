import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AttributionCategory, FailureCase, GapPattern, Tactic, TaskFamily } from '../types.js'

export interface ExperienceStorePaths {
  root: string
  failureCases: string
  gapPatterns: string
  tactics: string
}

export function experiencePaths(workspaceDir: string): ExperienceStorePaths {
  const root = join(workspaceDir, '.xiaolanjing', 'experience')
  return {
    root,
    failureCases: join(root, 'failure_cases.jsonl'),
    gapPatterns: join(root, 'gap_patterns.json'),
    tactics: join(root, 'tactics.json')
  }
}

function ensureRoot(paths: ExperienceStorePaths): void {
  mkdirSync(paths.root, { recursive: true })
  if (!existsSync(paths.gapPatterns)) writeFileSync(paths.gapPatterns, '[]\n', 'utf8')
  if (!existsSync(paths.tactics)) writeFileSync(paths.tactics, '[]\n', 'utf8')
  if (!existsSync(paths.failureCases)) writeFileSync(paths.failureCases, '', 'utf8')
}

function readJsonArray<T>(path: string): T[] {
  if (!existsSync(path)) return []
  try {
    const raw = readFileSync(path, 'utf8').trim()
    if (!raw) return []
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendFailureCase(workspaceDir: string, fc: Omit<FailureCase, 'id' | 'created_at'> & { id?: string }): FailureCase {
  const paths = experiencePaths(workspaceDir)
  ensureRoot(paths)
  const record: FailureCase = {
    id: fc.id || `fc-${randomUUID().slice(0, 8)}`,
    created_at: Date.now(),
    family: fc.family,
    subtype: fc.subtype,
    symptom: fc.symptom,
    root_cause: fc.root_cause,
    fix_hint: fc.fix_hint,
    trigger_tags: fc.trigger_tags,
    verify_hint: fc.verify_hint,
    source_task_id: fc.source_task_id,
    attribution: fc.attribution || 'defect',
    scope: fc.scope || 'project',
    confidence: fc.confidence ?? 0.7,
    enabled: fc.enabled !== false,
    rationale: fc.rationale
  }
  appendFileSync(paths.failureCases, `${JSON.stringify(record)}\n`, 'utf8')
  return record
}

export function listFailureCases(
  workspaceDir: string,
  limit = 100,
  opts?: { includeDisabled?: boolean }
): FailureCase[] {
  const paths = experiencePaths(workspaceDir)
  if (!existsSync(paths.failureCases)) return []
  const lines = readFileSync(paths.failureCases, 'utf8').split('\n').filter(Boolean)
  const rows: FailureCase[] = []
  for (const line of lines.slice(-limit)) {
    try {
      const row = JSON.parse(line) as FailureCase
      if (!opts?.includeDisabled && row.enabled === false) continue
      rows.push(row)
    } catch {
      // skip bad line
    }
  }
  return rows
}

export function listFailureCasesByAttribution(
  workspaceDir: string,
  attribution: AttributionCategory,
  limit = 20
): FailureCase[] {
  return listFailureCases(workspaceDir, 200)
    .filter((fc) => (fc.attribution || 'defect') === attribution)
    .slice(-limit)
}

export function upsertGapPattern(
  workspaceDir: string,
  pattern: Omit<GapPattern, 'count' | 'updated_at'> & { count?: number }
): GapPattern {
  const paths = experiencePaths(workspaceDir)
  ensureRoot(paths)
  const all = readJsonArray<GapPattern>(paths.gapPatterns)
  const idx = all.findIndex((p) => p.id === pattern.id)
  const next: GapPattern = {
    id: pattern.id,
    family: pattern.family,
    title: pattern.title,
    description: pattern.description,
    trigger_tags: pattern.trigger_tags,
    tactic_ids: pattern.tactic_ids,
    attribution: pattern.attribution,
    scope: pattern.scope,
    count: (idx >= 0 ? all[idx].count : 0) + (pattern.count ?? 1),
    updated_at: Date.now()
  }
  if (idx >= 0) all[idx] = next
  else all.push(next)
  writeFileSync(paths.gapPatterns, JSON.stringify(all, null, 2), 'utf8')
  return next
}

export function listTactics(workspaceDir: string): Tactic[] {
  const paths = experiencePaths(workspaceDir)
  return readJsonArray<Tactic>(paths.tactics)
}

export function upsertTactic(workspaceDir: string, tactic: Omit<Tactic, 'hit_count' | 'updated_at'> & { hit_count?: number }): Tactic {
  const paths = experiencePaths(workspaceDir)
  ensureRoot(paths)
  const all = readJsonArray<Tactic>(paths.tactics)
  const idx = all.findIndex((t) => t.id === tactic.id)
  const next: Tactic = {
    ...tactic,
    hit_count: idx >= 0 ? all[idx].hit_count : tactic.hit_count ?? 0,
    updated_at: Date.now()
  }
  if (idx >= 0) all[idx] = { ...all[idx], ...next, hit_count: all[idx].hit_count }
  else all.push(next)
  writeFileSync(paths.tactics, JSON.stringify(all, null, 2), 'utf8')
  return next
}

export function seedDefaultTactics(workspaceDir: string, family: TaskFamily = 'T1'): void {
  const existing = listTactics(workspaceDir)
  const now = Date.now()
  const seeds: Tactic[] = [
    {
      id: 't1-verify-before-done',
      family: 'T1',
      title: '改完必须跑验证',
      body: 'Code 小改动任务结束前，必须用 shell 跑项目约定的测试或编译命令；未看到验证成功结果前，不要宣称完成。',
      trigger_tags: ['t1', 'code', 'test', 'verify', 'defect'],
      priority: 100,
      enabled: true,
      hit_count: 0,
      updated_at: now,
      attribution: 'defect',
      scope: 'project',
      validated: true
    },
    {
      id: 't1-minimal-diff',
      family: 'T1',
      title: '最小改动面',
      body: '只改完成目标所需的最少文件；禁止顺手重构无关模块；写文件优先副本/草稿策略若与用户要求冲突，以用户明确指令为准。',
      trigger_tags: ['t1', 'diff', 'scope', 'convention'],
      priority: 90,
      enabled: true,
      hit_count: 0,
      updated_at: now,
      attribution: 'convention',
      scope: 'project',
      validated: true
    },
    {
      id: 't1-read-before-write',
      family: 'T1',
      title: '先读后写',
      body: '修改任何源文件前先 read_file 确认当前内容与调用点，避免凭记忆覆盖。',
      trigger_tags: ['t1', 'read', 'write', 'logic'],
      priority: 80,
      enabled: true,
      hit_count: 0,
      updated_at: now,
      attribution: 'logic',
      scope: 'project',
      validated: true
    },
    {
      id: 't1-project-over-style',
      family: 'T1',
      title: '规范优先于个人风格',
      body: '当用户风格偏好与项目强制规范冲突时，以项目规范为准；不要把偶发坏习惯学成默认风格。',
      trigger_tags: ['t1', 'convention', 'style'],
      priority: 95,
      enabled: true,
      hit_count: 0,
      updated_at: now,
      attribution: 'convention',
      scope: 'project',
      validated: true
    },
    {
      // Live 基线唯一失败 t1-018：Map 临时对象作 key → get miss
      // 默认 validated=false，须经 Golden 回测晋升后才注入
      id: 't1-map-object-as-key',
      family: 'T1',
      title: 'Map 禁止临时对象作 key',
      body:
        'Map/WeakMap 不要用每次新建的对象字面量当 key（如 map.set({id}, v) / map.get({id})）：引用不同则永远 miss。' +
        '应使用稳定原始值（string/number）或同一对象引用。改完必须跑测试确认 get/set 对称。',
      trigger_tags: ['t1', 'map', 'key', 'cache', 'object', 'logic'],
      priority: 92,
      enabled: true,
      hit_count: 0,
      updated_at: now,
      attribution: 'logic',
      scope: 'project',
      validated: true,
      validated_at: Date.parse('2026-07-12T00:00:00Z'),
      validation_note: 'live backtest t1-018 PASS (2026-07-12)',
      backtest_case_ids: ['t1-018']
    }
  ]
  const byId = new Map(existing.map((t) => [t.id, t]))
  let changed = false
  for (const seed of seeds) {
    if (seed.family !== family) continue
    const cur = byId.get(seed.id)
    if (!cur) {
      byId.set(seed.id, seed)
      changed = true
    } else if (!cur.attribution) {
      byId.set(seed.id, { ...cur, attribution: seed.attribution, scope: seed.scope, validated: cur.validated ?? true })
      changed = true
    } else if (cur.validated === true && seed.validated === false) {
      // 已晋升的本地 tactic 不被种子草稿覆盖
      continue
    } else if (
      cur.validated !== true &&
      (cur.body !== seed.body ||
        JSON.stringify(cur.backtest_case_ids || []) !== JSON.stringify(seed.backtest_case_ids || []))
    ) {
      byId.set(seed.id, {
        ...cur,
        title: seed.title,
        body: seed.body,
        trigger_tags: seed.trigger_tags,
        priority: seed.priority,
        attribution: seed.attribution,
        scope: seed.scope,
        backtest_case_ids: seed.backtest_case_ids,
        validated: cur.validated ?? seed.validated
      })
      changed = true
    }
  }
  if (!changed && existing.some((t) => t.family === family)) return
  const paths = experiencePaths(workspaceDir)
  ensureRoot(paths)
  writeFileSync(paths.tactics, JSON.stringify([...byId.values()], null, 2), 'utf8')
}

export function listDraftTactics(workspaceDir: string, family?: TaskFamily): Tactic[] {
  return listTactics(workspaceDir).filter(
    (t) => t.enabled && t.validated === false && (!family || t.family === family)
  )
}

export function markTacticValidated(
  workspaceDir: string,
  tacticId: string,
  note?: string
): Tactic | null {
  const all = listTactics(workspaceDir)
  const idx = all.findIndex((t) => t.id === tacticId)
  if (idx < 0) return null
  const next: Tactic = {
    ...all[idx],
    validated: true,
    validated_at: Date.now(),
    validation_note: note,
    updated_at: Date.now()
  }
  all[idx] = next
  const paths = experiencePaths(workspaceDir)
  ensureRoot(paths)
  writeFileSync(paths.tactics, JSON.stringify(all, null, 2), 'utf8')
  return next
}

/** 从失败案例沉淀待回测 tactic（默认 validated=false） */
export function draftTacticFromFailure(
  workspaceDir: string,
  opts: {
    failure: FailureCase
    title: string
    body: string
    id?: string
    priority?: number
    backtest_case_ids?: string[]
  }
): Tactic {
  const id = opts.id || `draft-${opts.failure.attribution || 'defect'}-${randomUUID().slice(0, 6)}`
  return upsertTactic(workspaceDir, {
    id,
    family: opts.failure.family,
    title: opts.title,
    body: opts.body.slice(0, 400),
    trigger_tags: [...new Set([...(opts.failure.trigger_tags || []), opts.failure.attribution || 'defect'])],
    priority: opts.priority ?? 85,
    enabled: true,
    attribution: opts.failure.attribution || 'defect',
    scope: opts.failure.scope || 'project',
    validated: false,
    backtest_case_ids: opts.backtest_case_ids,
    source_failure_id: opts.failure.id
  })
}

/** 种子 tactic：只可禁用，不可删除/撤销 */
export const SEED_TACTIC_IDS = new Set([
  't1-verify-before-done',
  't1-minimal-diff',
  't1-read-before-write',
  't1-project-over-style',
  't1-map-object-as-key'
])

export function isSeedTactic(id: string): boolean {
  return SEED_TACTIC_IDS.has(id) || id.startsWith('t1-')
}

export function setTacticEnabled(workspaceDir: string, tacticId: string, enabled: boolean): Tactic | null {
  const all = listTactics(workspaceDir)
  const idx = all.findIndex((t) => t.id === tacticId)
  if (idx < 0) return null
  all[idx] = { ...all[idx], enabled, updated_at: Date.now() }
  const paths = experiencePaths(workspaceDir)
  ensureRoot(paths)
  writeFileSync(paths.tactics, JSON.stringify(all, null, 2), 'utf8')
  return all[idx]
}

function rewriteFailureCases(workspaceDir: string, rows: FailureCase[]): void {
  const paths = experiencePaths(workspaceDir)
  ensureRoot(paths)
  writeFileSync(paths.failureCases, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''), 'utf8')
}

export function setFailureCaseEnabled(
  workspaceDir: string,
  failureId: string,
  enabled: boolean
): FailureCase | null {
  const paths = experiencePaths(workspaceDir)
  if (!existsSync(paths.failureCases)) return null
  const lines = readFileSync(paths.failureCases, 'utf8').split('\n').filter(Boolean)
  const rows: FailureCase[] = []
  let found: FailureCase | null = null
  for (const line of lines) {
    try {
      const row = JSON.parse(line) as FailureCase
      if (row.id === failureId) {
        found = { ...row, enabled }
        rows.push(found)
      } else {
        rows.push(row)
      }
    } catch {
      // keep raw? skip corrupt
    }
  }
  if (!found) return null
  rewriteFailureCases(workspaceDir, rows)
  return found
}

/**
 * 撤销 tactic：
 * - 用户反馈草稿（fb-* / draft-*）：从账本删除
 * - 种子：仅禁用，返回 { disabled: true, deleted: false }
 */
export function rollbackTactic(
  workspaceDir: string,
  tacticId: string
): { success: boolean; deleted: boolean; tactic?: Tactic | null; error?: string } {
  const all = listTactics(workspaceDir)
  const idx = all.findIndex((t) => t.id === tacticId)
  if (idx < 0) return { success: false, deleted: false, error: 'tactic 不存在' }

  if (isSeedTactic(tacticId)) {
    const tactic = setTacticEnabled(workspaceDir, tacticId, false)
    return { success: true, deleted: false, tactic }
  }

  const removed = all[idx]
  all.splice(idx, 1)
  const paths = experiencePaths(workspaceDir)
  ensureRoot(paths)
  writeFileSync(paths.tactics, JSON.stringify(all, null, 2), 'utf8')
  return { success: true, deleted: true, tactic: removed }
}

