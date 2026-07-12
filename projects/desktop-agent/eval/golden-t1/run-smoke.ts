#!/usr/bin/env tsx
/**
 * Golden-T1 schema smoke：校验 cases/*.json 字段齐全，不跑 Agent。
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), 'cases')
const required = ['case_id', 'family', 'subtype', 'difficulty', 'input', 'ground_truth', 'scoring_dims'] as const
const subtypes = new Set(['t1-fix', 't1-add', 't1-refactor-safe', 't1-verify-only'])

let failed = 0
const files = readdirSync(root).filter((f) => f.endsWith('.json')).sort()
if (files.length < 20) {
  console.error(`期望至少 20 条用例，实际 ${files.length}`)
  failed += 1
}

for (const file of files) {
  const path = join(root, file)
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  for (const key of required) {
    if (raw[key] === undefined) {
      console.error(`${file}: 缺少字段 ${key}`)
      failed += 1
    }
  }
  if (raw.family !== 'T1') {
    console.error(`${file}: family 必须为 T1`)
    failed += 1
  }
  if (!subtypes.has(String(raw.subtype))) {
    console.error(`${file}: subtype 非法 ${raw.subtype}`)
    failed += 1
  }
  const gt = raw.ground_truth as Record<string, unknown> | undefined
  if (!gt || !Array.isArray(gt.must_not_do)) {
    console.error(`${file}: ground_truth.must_not_do 必填`)
    failed += 1
  }
}

if (failed > 0) {
  console.error(`Golden-T1 smoke 失败：${failed} 项`)
  process.exit(1)
}
console.log(`Golden-T1 smoke 通过：${files.length} cases`)
