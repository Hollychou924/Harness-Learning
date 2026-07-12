#!/usr/bin/env tsx
/**
 * Golden-T1 批跑雏形（不调模型）：
 * - schema 校验
 * - 有 fixture：跑 verify_command，对照 expected_baseline
 * - 有 oracle：打补丁后再验，证明「修好能绿」
 * 输出：last-batch-report.json
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { EvidenceRecorder } from '../../src/agent/src/evolution/evidence.ts'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const casesDir = join(here, 'cases')
const reportPath = join(here, 'last-batch-report.json')

interface GoldenCase {
  case_id: string
  family: string
  subtype: string
  input: string
  workspace_fixture?: string
  expected_baseline?: 'fail' | 'pass'
  ground_truth: {
    verify_command?: string
    must_not_do: string[]
  }
}

function loadCases(): GoldenCase[] {
  return readdirSync(casesDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(casesDir, f), 'utf8')) as GoldenCase)
}

function runVerify(cwd: string, command: string): { ok: boolean; output: string } {
  try {
    const output = execFileSync('bash', ['-lc', command], {
      cwd,
      encoding: 'utf8',
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    return { ok: true, output: String(output).slice(0, 2000) }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string }
    return {
      ok: false,
      output: `${err.stdout || ''}${err.stderr || err.message || ''}`.slice(0, 2000)
    }
  }
}

function simulateEvidence(taskId: string, workspaceDir: string, command: string, ok: boolean) {
  const recorder = new EvidenceRecorder({
    taskId,
    turnId: `turn-${taskId}`,
    mode: 'code',
    userGoal: 'golden batch',
    workspaceDir,
    family: 'T1'
  })
  recorder.ingest({
    type: 'item_completed',
    turn_id: `turn-${taskId}`,
    item: {
      type: 'toolCall',
      id: `tool-${taskId}`,
      kind: 'shell',
      toolName: 'shell',
      args: { command },
      status: ok ? 'completed' : 'failed',
      startedAt: Date.now(),
      resultSummary: ok ? 'verify ok' : 'verify failed'
    }
  })
  return recorder.finalize(ok ? 'completed' : 'failed')
}

const cases = loadCases()
const results: Array<Record<string, unknown>> = []
let schemaOk = 0
let baselineMatch = 0
let baselineMismatch = 0
let oraclePass = 0
let oracleSkip = 0

for (const c of cases) {
  const row: Record<string, unknown> = {
    case_id: c.case_id,
    subtype: c.subtype,
    has_fixture: Boolean(c.workspace_fixture),
    expected_baseline: c.expected_baseline || null,
    verify_command: c.ground_truth.verify_command || null
  }

  if (c.family === 'T1' && Array.isArray(c.ground_truth.must_not_do)) schemaOk += 1

  if (c.workspace_fixture && c.ground_truth.verify_command) {
    const src = join(here, c.workspace_fixture)
    if (!existsSync(src)) {
      row.baseline = { skipped: true, reason: 'fixture missing' }
    } else {
      const work = mkdtempSync(join(tmpdir(), `${c.case_id}-`))
      cpSync(src, work, { recursive: true })
      const baseline = runVerify(work, c.ground_truth.verify_command)
      const evidence = simulateEvidence(`${c.case_id}-baseline`, work, c.ground_truth.verify_command, baseline.ok)
      const expectedFail = (c.expected_baseline || 'fail') === 'fail'
      const match = expectedFail ? !baseline.ok : baseline.ok
      if (match) baselineMatch += 1
      else baselineMismatch += 1
      row.baseline = {
        verify_ok: baseline.ok,
        verifier_passed: evidence.verdict?.passed === true,
        expected: c.expected_baseline || 'fail',
        match,
        output_head: baseline.output.slice(0, 240)
      }

      const oraclePath = join(here, 'oracles', `${c.case_id}.cjs`)
      if (existsSync(oraclePath)) {
        const apply = require(oraclePath) as (workdir: string) => void
        apply(work)
        const oracle = runVerify(work, c.ground_truth.verify_command)
        const oracleEvidence = simulateEvidence(`${c.case_id}-oracle`, work, c.ground_truth.verify_command, oracle.ok)
        row.oracle = {
          verify_ok: oracle.ok,
          verifier_passed: oracleEvidence.verdict?.passed === true
        }
        if (oracleEvidence.verdict?.passed) oraclePass += 1
      } else if ((c.expected_baseline || 'fail') === 'pass') {
        row.oracle = { skipped: true, reason: 'baseline already pass; no oracle needed' }
        oracleSkip += 1
      } else {
        row.oracle = { skipped: true, reason: 'no oracle' }
        oracleSkip += 1
      }
      rmSync(work, { recursive: true, force: true })
    }
  } else {
    row.baseline = { skipped: true, reason: 'no fixture or verify_command' }
  }

  results.push(row)
}

const withBaseline = results.filter((r) => r.baseline && typeof r.baseline === 'object' && !(r.baseline as { skipped?: boolean }).skipped)

const report = {
  generated_at: new Date().toISOString(),
  suite: 'Golden-T1',
  case_count: cases.length,
  schema_ok: schemaOk,
  fixture_baseline_runs: withBaseline.length,
  baseline_expectation_match: baselineMatch,
  baseline_expectation_mismatch: baselineMismatch,
  oracle_pass_count: oraclePass,
  oracle_skip_count: oracleSkip,
  note: '不调用模型。stub Agent 见 run-agent-batch.ts；live Agent 需 API Key。',
  results
}

mkdirSync(here, { recursive: true })
writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
console.log(
  `Golden-T1 batch: cases=${cases.length} fixtures=${withBaseline.length} baseline_match=${baselineMatch}/${withBaseline.length} oracle_pass=${oraclePass}`
)
console.log(`report → ${reportPath}`)

if (cases.length < 20) {
  console.error(`期望 ≥20 cases，实际 ${cases.length}`)
  process.exit(1)
}
if (baselineMismatch > 0) {
  console.error(`baseline 期望不匹配：${baselineMismatch}`)
  process.exit(1)
}
if (withBaseline.length < 8) {
  console.error(`期望至少 8 个可跑 fixture，实际 ${withBaseline.length}`)
  process.exit(1)
}
