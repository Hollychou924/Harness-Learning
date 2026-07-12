#!/usr/bin/env tsx
/**
 * Agent 批跑
 *
 * --mode=stub（默认）：oracle 补丁上界
 * --mode=live：真调 runReact（需显式开关 + API Key，避免误烧钱）
 *
 * 可选：
 *   --only=t1-001,t1-002
 *   --limit=3
 *
 * 环境变量（live）：
 *   XIAOLANJING_AGENT_BATCH=1
 *   XIAOLANJING_API_KEY=...（或 OPENAI_API_KEY / ANTHROPIC_API_KEY）
 *   XIAOLANJING_USE_APP_CONFIG=1  → 从本机「小蓝鲸」已保存模型配置读 Key（仍需 BATCH=1）
 *   XIAOLANJING_MODEL=...（可选）
 *   XIAOLANJING_API_BASE=...（可选）
 *   XIAOLANJING_API_FORMAT=openai|anthropic（默认 openai）
 *   XIAOLANJING_MAX_ITERATIONS=24（可选）
 *
 * 输出：last-agent-batch-report.json / last-live-baseline.json（--write-baseline 时）
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir, homedir } from 'node:os'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { EvidenceRecorder } from '../../src/agent/src/evolution/evidence.ts'
import { shouldShortFail, peekVerdict } from '../../src/agent/src/evolution/short-fail-loop.ts'
import type { AgentConfig, StdoutMessage } from '../../src/agent/src/protocol.ts'
import { runReact } from '../../src/agent/src/loop/react.ts'
import { resolveApproval } from '../../src/agent/src/approval.ts'
import { resolvePlanResponse } from '../../src/agent/src/tools/plan.ts'
import { resolveQuestion, resolveContinuation } from '../../src/agent/src/question.ts'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const mode = (process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1] || 'stub') as 'stub' | 'live'
const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]
const limitArg = process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1]
const writeBaseline = process.argv.includes('--write-baseline')
const onlySet = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim()).filter(Boolean)) : null
const limit = limitArg ? Number(limitArg) : Infinity
const reportPath = join(here, 'last-agent-batch-report.json')
const baselinePath = join(here, 'last-live-baseline.json')

interface GoldenCase {
  case_id: string
  input: string
  workspace_fixture?: string
  expected_baseline?: 'fail' | 'pass'
  ground_truth: { verify_command?: string; must_not_do: string[] }
}

function loadCases(): GoldenCase[] {
  const dir = join(here, 'cases')
  let cases = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as GoldenCase)
    .filter((c) => c.workspace_fixture && c.ground_truth.verify_command)
  if (onlySet) cases = cases.filter((c) => onlySet.has(c.case_id))
  if (Number.isFinite(limit)) cases = cases.slice(0, limit)
  return cases
}

function runVerify(cwd: string, command: string): boolean {
  try {
    execFileSync('bash', ['-lc', command], { cwd, timeout: 60_000, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function scoreAfterVerify(caseId: string, work: string, command: string, ok: boolean) {
  const recorder = new EvidenceRecorder({
    taskId: `agent-${caseId}`,
    turnId: `turn-${caseId}`,
    mode: 'code',
    userGoal: caseId,
    workspaceDir: work,
    family: 'T1'
  })
  recorder.ingest({
    type: 'item_completed',
    turn_id: `turn-${caseId}`,
    item: {
      type: 'toolCall',
      id: `tool-${caseId}`,
      kind: 'shell',
      toolName: 'shell',
      args: { command },
      status: ok ? 'completed' : 'failed',
      startedAt: Date.now()
    }
  })
  const evidence = recorder.finalize(ok ? 'completed' : 'failed')
  const shortFail = shouldShortFail({
    family: 'T1',
    mode: 'code',
    round: 0,
    evidence: { ...evidence, status: 'running' }
  })
  return { passed: evidence.verdict?.passed === true, shortFailWouldTrigger: shortFail.allow, verdict: peekVerdict(evidence) }
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
      // try next
    }
  }
  return null
}

function loadLiveConfig(): AgentConfig | { error: string } {
  if (process.env.XIAOLANJING_AGENT_BATCH !== '1') {
    return { error: '未设置 XIAOLANJING_AGENT_BATCH=1，拒绝 live 跑（防误烧钱）' }
  }
  const envKey = (process.env.XIAOLANJING_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '').trim()
  if (!envKey && process.env.XIAOLANJING_USE_APP_CONFIG === '1') {
    const appCfg = loadAppModelConfig()
    if (!appCfg) return { error: 'XIAOLANJING_USE_APP_CONFIG=1 但未找到可用的小蓝鲸模型配置' }
    return {
      ...appCfg,
      model: process.env.XIAOLANJING_MODEL || appCfg.model,
      apiBaseUrl: process.env.XIAOLANJING_API_BASE || appCfg.apiBaseUrl,
      maxIterations: Number(process.env.XIAOLANJING_MAX_ITERATIONS || appCfg.maxIterations || 24)
    }
  }
  if (!envKey) {
    return {
      error:
        '缺少 API Key。可设 XIAOLANJING_API_KEY，或 XIAOLANJING_USE_APP_CONFIG=1 读取本机小蓝鲸已保存配置'
    }
  }
  const apiFormat = (process.env.XIAOLANJING_API_FORMAT || 'openai') as 'openai' | 'anthropic'
  return {
    provider: apiFormat === 'anthropic' ? 'anthropic' : 'openai',
    model: process.env.XIAOLANJING_MODEL || (apiFormat === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini'),
    apiBaseUrl: process.env.XIAOLANJING_API_BASE,
    apiKey: envKey,
    maxIterations: Number(process.env.XIAOLANJING_MAX_ITERATIONS || 24),
    apiFormat,
    approvalMode: 'auto',
    autoApproveLow: true
  }
}

/** 批跑无 UI：自动批准计划/审批、跳过反问、续跑则 continue */
function makeBatchEventHandler(taskId: string): (msg: StdoutMessage) => void {
  return (msg) => {
    if (msg.type === 'approval_request') {
      resolveApproval(msg.request_id, true, 'task')
    } else if (msg.type === 'plan_proposed') {
      resolvePlanResponse(msg.request_id, 'approve', '')
    } else if (msg.type === 'question_proposed') {
      resolveQuestion(msg.request_id, { skipped: true })
    } else if (msg.type === 'continuation_request') {
      resolveContinuation(msg.task_id || taskId, 'continue')
    }
  }
}

async function runStub(cases: GoldenCase[]) {
  const results: Array<Record<string, unknown>> = []
  let pass = 0
  let fail = 0
  for (const c of cases) {
    const src = join(here, c.workspace_fixture!)
    if (!existsSync(src)) {
      results.push({ case_id: c.case_id, skipped: true, reason: 'fixture missing' })
      continue
    }
    const work = mkdtempSync(join(tmpdir(), `agent-${c.case_id}-`))
    cpSync(src, work, { recursive: true })
    const command = c.ground_truth.verify_command!
    const oraclePath = join(here, 'oracles', `${c.case_id}.cjs`)
    let strategy = 'noop'
    if (existsSync(oraclePath)) {
      const apply = require(oraclePath) as (workdir: string) => void
      apply(work)
      strategy = 'oracle-patch'
    }
    const ok = runVerify(work, command)
    const scored = scoreAfterVerify(c.case_id, work, command, ok)
    if (scored.passed) pass += 1
    else fail += 1
    results.push({
      case_id: c.case_id,
      strategy,
      verify_ok: ok,
      verifier_passed: scored.passed,
      short_fail_would_trigger: scored.shortFailWouldTrigger,
      reasons: scored.verdict.reasons
    })
    rmSync(work, { recursive: true, force: true })
  }
  return { pass, fail, results, once_success_rate: cases.length ? pass / cases.length : 0 }
}

async function runLive(cases: GoldenCase[], config: AgentConfig) {
  const results: Array<Record<string, unknown>> = []
  let pass = 0
  let fail = 0
  for (const c of cases) {
    const src = join(here, c.workspace_fixture!)
    if (!existsSync(src)) {
      results.push({ case_id: c.case_id, skipped: true, reason: 'fixture missing' })
      continue
    }
    const work = mkdtempSync(join(tmpdir(), `live-${c.case_id}-`))
    cpSync(src, work, { recursive: true })
    const taskId = `live-${c.case_id}-${Date.now()}`
    const onEvent = makeBatchEventHandler(taskId)
    const started = Date.now()
    let error: string | undefined
    let finalText = ''
    // 批跑强制锚定工作区：shell 默认 cwd 可能是用户主目录
    const prompt = [
      c.input,
      '',
      `【批跑约束】工作区绝对路径：${work}`,
      '所有文件读写与 shell 命令必须在该目录下执行（shell 请显式传 cwd 为上述路径）。',
      '完成后直接结束，不要反问用户。'
    ].join('\n')
    try {
      const result = await runReact(prompt, config, [], onEvent, work, 'code', taskId)
      finalText = result.finalText
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
    const command = c.ground_truth.verify_command!
    const ok = runVerify(work, command)
    const scored = scoreAfterVerify(c.case_id, work, command, ok)
    let hitl_burden: number | null = scored.verdict.score?.hitl_burden ?? null
    try {
      const evidenceRoot = join(work, '.xiaolanjing', 'evidence')
      if (existsSync(evidenceRoot)) {
        const dirs = readdirSync(evidenceRoot)
        for (const d of dirs) {
          const metaPath = join(evidenceRoot, d, 'meta.json')
          if (!existsSync(metaPath)) continue
          const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
            verdict?: { score?: { hitl_burden?: number } }
            signals?: Record<string, number>
          }
          if (typeof meta.verdict?.score?.hitl_burden === 'number') {
            hitl_burden = meta.verdict.score.hitl_burden
            break
          }
          if (meta.signals) {
            hitl_burden =
              (meta.signals.approval_requests || 0) +
              (meta.signals.plan_rejects || 0) +
              (meta.signals.question_prompts || 0) +
              (meta.signals.continuation_count || 0)
            break
          }
        }
      }
    } catch {
      // ignore
    }
    if (scored.passed) pass += 1
    else fail += 1
    results.push({
      case_id: c.case_id,
      strategy: 'runReact-live',
      duration_ms: Date.now() - started,
      verify_ok: ok,
      verifier_passed: scored.passed,
      hitl_burden,
      error,
      final_text_head: finalText.slice(0, 200),
      reasons: scored.verdict.reasons
    })
    rmSync(work, { recursive: true, force: true })
    console.log(`${c.case_id}: ${scored.passed ? 'PASS' : 'FAIL'}${error ? ` (${error})` : ''}`)
  }
  return { pass, fail, results, once_success_rate: cases.length ? pass / cases.length : 0 }
}

function writeLiveBaseline(report: Record<string, unknown>) {
  const baseline = {
    generated_at: report.generated_at,
    mode: 'live',
    model: report.model,
    fixture_cases: report.fixture_cases,
    pass: report.pass,
    fail: report.fail,
    once_success_rate: report.once_success_rate,
    note: 'T1 一次交付成功率（Live）。写入 docs/20-m0-execution-baseline.md §3.3 看板。'
  }
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2))
  const docPath = join(here, '../../docs/20-m0-execution-baseline.md')
  if (!existsSync(docPath)) {
    console.log(`baseline → ${baselinePath}（文档不存在，跳过看板更新）`)
    return
  }
  let doc = readFileSync(docPath, 'utf8')
  const rate = typeof report.once_success_rate === 'number' ? report.once_success_rate : 0
  const pct = `${(rate * 100).toFixed(0)}%`
  const day = String(report.generated_at).slice(0, 10)
  const boardRow = `| 基线周（Live） | **${pct}**（${report.pass}/${report.fixture_cases}） | 见 \`last-live-baseline.json\` | model=\`${report.model}\` · ${day} · 报告 \`eval/golden-t1/last-agent-batch-report.json\` |`
  if (/\| 基线周（Live） \|/.test(doc)) {
    doc = doc.replace(/\| 基线周（Live） \|[^\n]*/, boardRow)
  } else if (/\| 基线周 \|/.test(doc)) {
    doc = doc.replace(/\| 基线周 \|[^\n]*/, boardRow)
  } else {
    doc += `\n\n### 3.3 M0 看板\n\n| 周次 | T1 一次成功率 | Golden 失败 | 备注 |\n|------|---------------|-------------|------|\n${boardRow}\n`
  }
  writeFileSync(docPath, doc)
  console.log(`baseline → ${baselinePath}`)
  console.log(`board   → ${docPath}`)
}

const cases = loadCases()
mkdirSync(here, { recursive: true })

if (mode === 'live') {
  const cfg = loadLiveConfig()
  if ('error' in cfg) {
    const report = {
      generated_at: new Date().toISOString(),
      mode: 'live',
      enabled: false,
      note: cfg.error,
      hint: '示例：XIAOLANJING_AGENT_BATCH=1 XIAOLANJING_API_KEY=sk-... pnpm exec tsx eval/golden-t1/run-agent-batch.ts --mode=live --limit=1',
      results: []
    }
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(cfg.error)
    console.log(report.hint)
    console.log(`report → ${reportPath}`)
    process.exit(0)
  }
  console.log(`live batch: ${cases.length} cases, model=${cfg.model}`)
  const out = await runLive(cases, cfg)
  const report = {
    generated_at: new Date().toISOString(),
    mode: 'live',
    model: cfg.model,
    fixture_cases: cases.length,
    ...out,
    note: 'live = 真实模型一次交付率，可填入 M0 看板北极星。'
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  if (writeBaseline) writeLiveBaseline(report)
  console.log(`Agent live batch: ${out.pass}/${cases.length} pass (rate=${out.once_success_rate.toFixed(2)})`)
  console.log(`report → ${reportPath}`)
  process.exit(0)
}

const out = await runStub(cases)
const report = {
  generated_at: new Date().toISOString(),
  mode: 'stub',
  fixture_cases: cases.length,
  ...out,
  note: 'stub = oracle 上界，不是真实模型能力。'
}
writeFileSync(reportPath, JSON.stringify(report, null, 2))
console.log(`Agent stub batch: ${out.pass}/${cases.length} pass (rate=${out.once_success_rate.toFixed(2)})`)
console.log(`report → ${reportPath}`)
if (out.fail > 0) {
  const unexpected = out.results.filter((r) => r.verifier_passed === false)
  if (unexpected.length > 0) {
    console.error('stub 未通过：', unexpected.map((r) => r.case_id).join(', '))
    process.exit(1)
  }
}
