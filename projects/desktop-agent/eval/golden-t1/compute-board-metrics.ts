#!/usr/bin/env tsx
/**
 * 看板粗算：HITL 负担（来自 live 报告若有）+ 重复错误率（来自 failure_cases）
 *
 *   pnpm exec tsx eval/golden-t1/compute-board-metrics.ts
 *   pnpm exec tsx eval/golden-t1/compute-board-metrics.ts --ledger=/path/to/workspace
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listFailureCases } from '../../src/agent/src/evolution/experience/store.ts'
import { computeRepeatFailureRate } from '../../src/agent/src/evolution/metrics.ts'

const here = dirname(fileURLToPath(import.meta.url))
const ledgerArg = process.argv.find((a) => a.startsWith('--ledger='))?.split('=')[1]
const ledgerDir = ledgerArg || join(here, '.promote-ledger')
const liveBaselinePath = join(here, 'last-live-baseline.json')
const liveReportPath = join(here, 'last-agent-batch-report.json')
const outPath = join(here, 'last-board-metrics.json')

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

const baseline = readJson(liveBaselinePath)
const report = readJson(liveReportPath)

let hitlMean: number | null = null
let hitlNote = '待首周采样（live 报告未含逐任务 hitl_burden）'
if (report && Array.isArray(report.results)) {
  const burdens: number[] = []
  for (const row of report.results as Array<Record<string, unknown>>) {
    if (typeof row.hitl_burden === 'number') burdens.push(row.hitl_burden)
  }
  if (burdens.length > 0) {
    hitlMean = burdens.reduce((a, b) => a + b, 0) / burdens.length
    hitlNote = `来自 last-agent-batch-report ${burdens.length} 条`
  }
}

const failures = existsSync(ledgerDir) ? listFailureCases(ledgerDir, 500) : []
const repeat = computeRepeatFailureRate(failures, 30)

const metrics = {
  generated_at: new Date().toISOString(),
  once_success_rate: baseline?.once_success_rate ?? null,
  once_success_pass: baseline?.pass ?? null,
  once_success_total: baseline?.fixture_cases ?? null,
  hitl_burden_mean: hitlMean,
  hitl_note: hitlNote,
  repeat_failure_rate: repeat.rate,
  repeat_failure_repeats: repeat.repeats,
  repeat_failure_total: repeat.total,
  repeat_note: failures.length
    ? `ledger=${ledgerDir} window=30`
    : '无 failure_cases（可先跑 promote/ledger 或真实任务）',
  sources: {
    live_baseline: existsSync(liveBaselinePath),
    live_report: existsSync(liveReportPath),
    ledger: existsSync(ledgerDir)
  }
}

writeFileSync(outPath, JSON.stringify(metrics, null, 2), 'utf8')
console.log(JSON.stringify(metrics, null, 2))
console.log(`board metrics → ${outPath}`)
