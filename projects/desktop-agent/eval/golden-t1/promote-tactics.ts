#!/usr/bin/env tsx
/**
 * Tactic 回测晋升 CLI
 *
 *   # stub 门禁（不晋升，只检查草稿隔离）
 *   pnpm exec tsx eval/golden-t1/promote-tactics.ts --gate=stub
 *
 *   # live 门禁（通过后 validated=true）
 *   XIAOLANJING_AGENT_BATCH=1 XIAOLANJING_USE_APP_CONFIG=1 \
 *     pnpm exec tsx eval/golden-t1/promote-tactics.ts --gate=live --only=t1-map-object-as-key
 *
 *   # 强制晋升（仅人工/测试）
 *   pnpm exec tsx eval/golden-t1/promote-tactics.ts --gate=force --only=t1-map-object-as-key
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir, homedir } from 'node:os'
import { execFileSync } from 'node:child_process'
import {
  ensureT1018Draft,
  writePromoteReport,
  MAP_OBJECT_KEY_TACTIC_ID,
  seedDefaultTactics,
  listTactics,
  backtestAndPromote
} from '../../src/agent/src/evolution/index.ts'
import type { AgentConfig, StdoutMessage } from '../../src/agent/src/protocol.ts'
import { runReact } from '../../src/agent/src/loop/react.ts'
import { resolveApproval } from '../../src/agent/src/approval.ts'
import { resolvePlanResponse } from '../../src/agent/src/tools/plan.ts'
import { resolveQuestion, resolveContinuation } from '../../src/agent/src/question.ts'

const here = dirname(fileURLToPath(import.meta.url))
const gate = (process.argv.find((a) => a.startsWith('--gate='))?.split('=')[1] || 'stub') as
  | 'stub'
  | 'live'
  | 'force'
const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]
const onlyIds = onlyArg ? onlyArg.split(',').map((s) => s.trim()).filter(Boolean) : [MAP_OBJECT_KEY_TACTIC_ID]
const ledgerDir = join(here, '.promote-ledger')
const reportPath = join(here, 'last-promote-report.json')

interface GoldenCase {
  case_id: string
  input: string
  workspace_fixture?: string
  ground_truth: { verify_command?: string }
}

function loadCases(ids: string[]): GoldenCase[] {
  const dir = join(here, 'cases')
  const set = new Set(ids)
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as GoldenCase)
    .filter((c) => set.has(c.case_id) && c.workspace_fixture && c.ground_truth.verify_command)
}

function loadAppModelConfig(): AgentConfig | null {
  const candidates = [
    join(homedir(), 'Library/Application Support/xiaolanjing-desktop/model-configs.json'),
    join(homedir(), 'Library/Application Support/xiaolanjing-desktop/model-config.json')
  ]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
      let cfg: Record<string, unknown> | null = null
      if (Array.isArray(raw.configs) && raw.configs.length > 0) {
        const activeId = raw.activeId
        cfg =
          (raw.configs as Array<Record<string, unknown>>).find((c) => c._id === activeId) ||
          (raw.configs as Array<Record<string, unknown>>)[0]
      } else if (typeof raw.apiKey === 'string') {
        cfg = raw
      }
      if (!cfg || typeof cfg.apiKey !== 'string' || !String(cfg.apiKey).trim()) continue
      const apiFormat = (cfg.apiFormat === 'anthropic' ? 'anthropic' : 'openai') as 'openai' | 'anthropic'
      return {
        provider: apiFormat === 'anthropic' ? 'anthropic' : 'openai',
        model: String(cfg.model || 'gpt-4o-mini'),
        apiBaseUrl: typeof cfg.apiBaseUrl === 'string' ? cfg.apiBaseUrl : undefined,
        apiKey: String(cfg.apiKey).trim(),
        maxIterations: Number(process.env.XIAOLANJING_MAX_ITERATIONS || 24),
        apiFormat,
        approvalMode: 'auto',
        autoApproveLow: true
      }
    } catch {
      // next
    }
  }
  return null
}

function loadLiveConfig(): AgentConfig | { error: string } {
  if (process.env.XIAOLANJING_AGENT_BATCH !== '1') {
    return { error: '未设置 XIAOLANJING_AGENT_BATCH=1' }
  }
  const envKey = (process.env.XIAOLANJING_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '').trim()
  if (!envKey && process.env.XIAOLANJING_USE_APP_CONFIG === '1') {
    const app = loadAppModelConfig()
    if (!app) return { error: 'USE_APP_CONFIG=1 但无可用模型配置' }
    return app
  }
  if (!envKey) return { error: '缺少 API Key' }
  const apiFormat = (process.env.XIAOLANJING_API_FORMAT || 'openai') as 'openai' | 'anthropic'
  return {
    provider: apiFormat === 'anthropic' ? 'anthropic' : 'openai',
    model: process.env.XIAOLANJING_MODEL || 'gpt-4o-mini',
    apiBaseUrl: process.env.XIAOLANJING_API_BASE,
    apiKey: envKey,
    maxIterations: Number(process.env.XIAOLANJING_MAX_ITERATIONS || 24),
    apiFormat,
    approvalMode: 'auto',
    autoApproveLow: true
  }
}

function makeBatchEventHandler(taskId: string): (msg: StdoutMessage) => void {
  return (msg) => {
    if (msg.type === 'approval_request') resolveApproval(msg.request_id, true, 'task')
    else if (msg.type === 'plan_proposed') resolvePlanResponse(msg.request_id, 'approve', '')
    else if (msg.type === 'question_proposed') resolveQuestion(msg.request_id, { skipped: true })
    else if (msg.type === 'continuation_request') resolveContinuation(msg.task_id || taskId, 'continue')
  }
}

function runVerify(cwd: string, command: string): boolean {
  try {
    execFileSync('bash', ['-lc', command], { cwd, timeout: 60_000, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

mkdirSync(ledgerDir, { recursive: true })
const seeded = ensureT1018Draft(ledgerDir)
console.log(`t1-018 draft ready: tactic=${seeded.tactic.id} validated=${seeded.tactic.validated} failure=${seeded.failureId}`)

const results = []
for (const tacticId of onlyIds) {
  if (gate === 'live') {
    const cfg = loadLiveConfig()
    if ('error' in cfg) {
      console.error(cfg.error)
      process.exit(1)
    }
    const tactic = listTactics(ledgerDir).find((t) => t.id === tacticId)
    const caseIds = tactic?.backtest_case_ids || []
    const out = await backtestAndPromote(ledgerDir, tacticId, {
      gate: 'live',
      runner: async ({ caseIds: ids, forceTacticId, workspaceDir }) => {
        const cases = loadCases(ids)
        const rows = []
        for (const c of cases) {
          const src = join(here, c.workspace_fixture!)
          if (!existsSync(src)) {
            rows.push({ case_id: c.case_id, passed: false, reason: 'fixture missing' })
            continue
          }
          const work = mkdtempSync(join(tmpdir(), `promote-${c.case_id}-`))
          cpSync(src, work, { recursive: true })
          // 把待测 tactic 复制进 case 工作区经验账本，并用 env 强制注入
          seedDefaultTactics(work, 'T1')
          const draft = listTactics(workspaceDir).find((t) => t.id === forceTacticId)
          if (draft) {
            writeFileSync(
              join(work, '.xiaolanjing', 'experience', 'tactics.json'),
              JSON.stringify(
                listTactics(work)
                  .filter((t) => t.id !== forceTacticId)
                  .concat([{ ...draft, validated: false }]),
                null,
                2
              ),
              'utf8'
            )
          }
          const prevForce = process.env.XIAOLANJING_FORCE_TACTIC_IDS
          process.env.XIAOLANJING_FORCE_TACTIC_IDS = forceTacticId
          const taskId = `promote-${c.case_id}-${Date.now()}`
          const prompt = [
            c.input,
            '',
            `【批跑约束】工作区绝对路径：${work}`,
            '所有文件读写与 shell 命令必须在该目录下执行（shell 请显式传 cwd 为上述路径）。',
            '完成后直接结束，不要反问用户。'
          ].join('\n')
          try {
            await runReact(prompt, cfg, [], makeBatchEventHandler(taskId), work, 'code', taskId)
          } catch (e) {
            rows.push({
              case_id: c.case_id,
              passed: false,
              reason: e instanceof Error ? e.message : String(e)
            })
            if (prevForce === undefined) delete process.env.XIAOLANJING_FORCE_TACTIC_IDS
            else process.env.XIAOLANJING_FORCE_TACTIC_IDS = prevForce
            rmSync(work, { recursive: true, force: true })
            continue
          }
          if (prevForce === undefined) delete process.env.XIAOLANJING_FORCE_TACTIC_IDS
          else process.env.XIAOLANJING_FORCE_TACTIC_IDS = prevForce
          const ok = runVerify(work, c.ground_truth.verify_command!)
          rows.push({ case_id: c.case_id, passed: ok, reason: ok ? 'verify ok' : 'verify failed' })
          console.log(`backtest ${c.case_id}: ${ok ? 'PASS' : 'FAIL'}`)
          rmSync(work, { recursive: true, force: true })
        }
        return rows
      }
    })
    results.push(out)
    console.log(`${tacticId}: ${out.promoted ? 'PROMOTED' : 'HELD'} — ${out.note}`)
  } else {
    const out = await backtestAndPromote(ledgerDir, tacticId, { gate })
    results.push(out)
    console.log(`${tacticId}: ${out.promoted ? 'PROMOTED' : 'HELD'} — ${out.note}`)
  }
}

// 若晋升成功，同步更新「默认种子」侧：写一个标记文件，并把 ledger 里的 validated 固化到报告
const promoted = results.filter((r) => r.promoted && r.gate !== 'stub')
if (promoted.length > 0) {
  const seedPatchPath = join(here, 'promoted-tactics.json')
  const patch = listTactics(ledgerDir).filter((t) => t.validated === true && promoted.some((p) => p.tactic_id === t.id))
  writeFileSync(seedPatchPath, JSON.stringify(patch, null, 2), 'utf8')
  console.log(`promoted patch → ${seedPatchPath}`)
}

writePromoteReport(reportPath, {
  generated_at: new Date().toISOString(),
  gate,
  only_ids: onlyIds,
  results,
  ledger: ledgerDir
})
console.log(`report → ${reportPath}`)

if (gate === 'live' && results.some((r) => !r.promoted)) process.exit(1)
if (gate === 'stub' && results.some((r) => r.case_results.some((c) => !c.passed))) process.exit(1)
