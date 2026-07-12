import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EvidenceRecorder } from './evidence.js'
import { scoreEvidence } from './verifier.js'
import { ReflectionGovernor } from './reflection-governor.js'
import { selectTactics, appendFailureCase, listFailureCases, seedDefaultTactics, listDraftTactics, listTactics, ensureT1018Draft, backtestAndPromote, MAP_OBJECT_KEY_TACTIC_ID, assertDraftNotInjected } from './experience/index.js'
import { emptySignals, EVIDENCE_SCHEMA_VERSION } from './types.js'
import { shouldShortFail, buildShortFailNudge, SHORT_FAIL_MAX_ROUNDS } from './short-fail-loop.js'
import { LoopGuard } from './loop-guard.js'
import { classifyAttribution, buildFailureCaseFromEvidence } from './attribution.js'

test('Verifier：验证命令成功则通过', () => {
  const evidence = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    harness_version: 'test',
    task_id: 't1',
    turn_id: 'turn-1',
    mode: 'code' as const,
    family: 'T1' as const,
    user_goal: 'fix and test',
    started_at: Date.now(),
    status: 'completed' as const,
    signals: {
      ...emptySignals(),
      tool_calls: 2,
      tool_successes: 2,
      verify_command_seen: true,
      verify_command_ok: true
    },
    interventions: [],
    items: [],
    critic_rounds: []
  }
  const verdict = scoreEvidence(evidence)
  assert.equal(verdict.passed, true)
  assert.equal(verdict.score.goal_achieved, 1)
})

test('Verifier：验证命令失败则不通过', () => {
  const evidence = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    harness_version: 'test',
    task_id: 't1',
    turn_id: 'turn-1',
    mode: 'code' as const,
    family: 'T1' as const,
    user_goal: 'fix',
    started_at: Date.now(),
    status: 'completed' as const,
    signals: {
      ...emptySignals(),
      tool_calls: 1,
      tool_failures: 1,
      verify_command_seen: true,
      verify_command_ok: false
    },
    interventions: [],
    items: [],
    critic_rounds: []
  }
  const verdict = scoreEvidence(evidence)
  assert.equal(verdict.passed, false)
  assert.equal(verdict.score.goal_achieved, 0)
})

test('EvidenceRecorder 落盘 meta.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'evidence-'))
  const recorder = new EvidenceRecorder({
    taskId: 'task-a',
    turnId: 'turn-a',
    mode: 'code',
    userGoal: '跑 npm test',
    workspaceDir: dir,
    family: 'T1'
  })
  recorder.ingest({
    type: 'item_completed',
    turn_id: 'turn-a',
    item: {
      type: 'toolCall',
      id: 'tool-1',
      kind: 'shell',
      toolName: 'shell',
      args: { command: 'npm test' },
      status: 'completed',
      startedAt: Date.now()
    }
  })
  recorder.markIteration()
  const evidence = recorder.finalize('completed')
  assert.equal(evidence.signals.verify_command_seen, true)
  assert.equal(evidence.signals.verify_command_ok, true)
  assert.ok(evidence.verdict?.passed)
  const meta = join(dir, '.xiaolanjing', 'evidence', 'task-a', 'meta.json')
  assert.ok(existsSync(meta))
  const parsed = JSON.parse(readFileSync(meta, 'utf8'))
  assert.equal(parsed.schema_version, EVIDENCE_SCHEMA_VERSION)
})

test('ReflectionGovernor：无证据禁止 Critic', () => {
  const gov = new ReflectionGovernor(2)
  const evidence = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    harness_version: 'test',
    task_id: 't1',
    turn_id: 'turn-1',
    mode: 'code' as const,
    family: 'T1' as const,
    user_goal: 'hi',
    started_at: Date.now(),
    status: 'failed' as const,
    signals: emptySignals(),
    interventions: [],
    items: [],
    critic_rounds: []
  }
  const d = gov.decide(evidence)
  assert.equal(d.allow, false)
  assert.match(d.reason, /无外部证据/)
})

test('ReflectionGovernor：失败且有工具证据允许 Critic', () => {
  const gov = new ReflectionGovernor(2)
  const evidence = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    harness_version: 'test',
    task_id: 't1',
    turn_id: 'turn-1',
    mode: 'code' as const,
    family: 'T1' as const,
    user_goal: 'fix',
    started_at: Date.now(),
    finished_at: Date.now(),
    status: 'failed' as const,
    signals: {
      ...emptySignals(),
      tool_calls: 2,
      tool_failures: 2,
      verify_command_seen: true,
      verify_command_ok: false
    },
    interventions: [],
    items: [],
    critic_rounds: [],
    verdict: {
      passed: false,
      family: 'T1' as const,
      reasons: ['验证失败'],
      score: {
        goal_achieved: 0 as const,
        tool_success_rate: 0,
        safety: 1 as const,
        hitl_burden: 0,
        cost_tokens: 0,
        overall: 0
      },
      scored_at: Date.now()
    }
  }
  const d = gov.decide(evidence)
  assert.equal(d.allow, true)
})

test('Experience：种子 tactics 可注入', () => {
  const dir = mkdtempSync(join(tmpdir(), 'exp-'))
  seedDefaultTactics(dir, 'T1')
  const plan = selectTactics(dir, { family: 'T1', goal: '请修 bug 并跑 test 验证', topK: 2 })
  assert.ok(plan.tactics.length >= 1)
  assert.match(plan.promptBlock, /经验策略/)
  appendFailureCase(dir, {
    family: 'T1',
    symptom: '忘了跑测试',
    root_cause: '无硬验证',
    fix_hint: '结束前 npm test',
    trigger_tags: ['test']
  })
  assert.equal(listFailureCases(dir).length, 1)
})

test('短失败环：缺验证时允许催促', () => {
  const evidence = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    harness_version: 'test',
    task_id: 't1',
    turn_id: 'turn-1',
    mode: 'code' as const,
    family: 'T1' as const,
    user_goal: 'fix',
    started_at: Date.now(),
    status: 'running' as const,
    signals: { ...emptySignals(), tool_calls: 1, tool_successes: 1 },
    interventions: [],
    items: [],
    critic_rounds: []
  }
  const d = shouldShortFail({ family: 'T1', mode: 'code', round: 0, evidence })
  assert.equal(d.allow, true)
  assert.match(d.reason, /硬验证|Verifier/)
})

test('短失败环：用尽预算后拒绝', () => {
  const evidence = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    harness_version: 'test',
    task_id: 't1',
    turn_id: 'turn-1',
    mode: 'code' as const,
    family: 'T1' as const,
    user_goal: 'fix',
    started_at: Date.now(),
    status: 'running' as const,
    signals: {
      ...emptySignals(),
      verify_command_seen: true,
      verify_command_ok: false,
      tool_calls: 1,
      tool_failures: 1
    },
    interventions: [],
    items: [],
    critic_rounds: []
  }
  const d = shouldShortFail({ family: 'T1', mode: 'code', round: SHORT_FAIL_MAX_ROUNDS, evidence })
  assert.equal(d.allow, false)
  const nudge = buildShortFailNudge({
    round: 0,
    maxRounds: SHORT_FAIL_MAX_ROUNDS,
    verdict: scoreEvidence({ ...evidence, status: 'completed' }),
    workspaceDir: undefined
  })
  assert.match(nudge, /短失败环/)
})

test('LoopGuard：相同调用重复三次熔断', () => {
  const guard = new LoopGuard(8, 3)
  assert.equal(guard.observe('shell', { command: 'npm test' }).trip, false)
  assert.equal(guard.observe('shell', { command: 'npm test' }).trip, false)
  const third = guard.observe('shell', { command: 'npm test' })
  assert.equal(third.trip, true)
  assert.match(third.reason, /重复/)
})

test('LoopGuard：乒乓模式熔断', () => {
  const guard = new LoopGuard(8, 5)
  const steps = [
    { path: 'a.js' },
    { path: 'b.js' },
    { path: 'a.js' },
    { path: 'b.js' },
    { path: 'a.js' },
    { path: 'b.js' }
  ]
  let tripped = false
  for (const args of steps) {
    const v = guard.observe('read_file', args)
    if (v.trip) {
      tripped = true
      assert.match(v.reason, /乒乓/)
      break
    }
  }
  assert.equal(tripped, true)
})

test('归因：验证失败 → 缺陷/项目', () => {
  const evidence = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    harness_version: 'test',
    task_id: 't1',
    turn_id: 'turn-1',
    mode: 'code' as const,
    family: 'T1' as const,
    user_goal: 'fix',
    started_at: Date.now(),
    status: 'completed' as const,
    signals: {
      ...emptySignals(),
      tool_calls: 1,
      tool_failures: 1,
      verify_command_seen: true,
      verify_command_ok: false as boolean | null
    },
    interventions: [],
    items: [],
    critic_rounds: []
  }
  const attr = classifyAttribution({ evidence })
  assert.equal(attr.category, 'defect')
  assert.equal(attr.scope, 'project')
  const fc = buildFailureCaseFromEvidence({ evidence })
  assert.equal(fc.attribution, 'defect')
})

test('归因：规范关键词 → convention', () => {
  const attr = classifyAttribution({
    symptom: '用户要求接口层用统一 Result 错误码，不要直接抛异常'
  })
  assert.equal(attr.category, 'convention')
  assert.equal(attr.scope, 'project')
})

test('归因：风格关键词 → style/user', () => {
  const attr = classifyAttribution({
    userFeedback: '把变量名改成缩写 usrInfo，注释写短一点'
  })
  assert.equal(attr.category, 'style')
  assert.equal(attr.scope, 'user')
})

test('注入块含四类归因标签', () => {
  const dir = mkdtempSync(join(tmpdir(), 'attr-inj-'))
  seedDefaultTactics(dir, 'T1')
  const plan = selectTactics(dir, { family: 'T1', goal: '修 bug 并按项目规范验证', topK: 4 })
  assert.match(plan.promptBlock, /规范|缺陷|逻辑/)
  assert.match(plan.promptBlock, /项目规范 > 用户风格/)
})

test('用户反馈：拒绝写入缺陷案例', async () => {
  const { recordOutcomeFeedback, readExperienceLedger } = await import('./feedback.js')
  const dir = mkdtempSync(join(tmpdir(), 'fb-'))
  const res = recordOutcomeFeedback(dir, {
    outcome: 'reject',
    note: '接口层必须用统一 Result 错误码',
    taskId: 't-1',
    family: 'T1'
  })
  assert.equal(res.success, true)
  assert.equal(res.failureCase?.attribution, 'convention')
  assert.equal(res.tactic?.validated, false)
  const ledger = readExperienceLedger(dir)
  assert.ok(ledger.failureCases.length >= 1)
  assert.ok(ledger.outcomes.some((o) => o.outcome === 'reject'))
})

test('用户反馈：接受只记日志不造失败案例', async () => {
  const { recordOutcomeFeedback, readExperienceLedger } = await import('./feedback.js')
  const dir = mkdtempSync(join(tmpdir(), 'fb-ok-'))
  const res = recordOutcomeFeedback(dir, { outcome: 'accept', taskId: 't-2' })
  assert.equal(res.success, true)
  assert.equal(res.failureCase, undefined)
  assert.equal(res.record?.learning_target, 'none')
  const ledger = readExperienceLedger(dir)
  assert.equal(ledger.failureCases.length, 0)
  assert.equal(ledger.outcomes.length, 1)
})

test('纠正分流：强制约束 → gate_candidate', async () => {
  const { routeLearningTarget, recordOutcomeFeedback, listLearningCandidates } = await import('./feedback.js')
  const route = routeLearningTarget({
    outcome: 'reject',
    note: '禁止直接改数据库 Schema，必须先生成 migration',
    attribution: 'convention'
  })
  assert.equal(route.primary, 'gate_candidate')
  assert.ok(route.targets.includes('gate_candidate'))
  assert.ok(route.targets.includes('memory'))

  const dir = mkdtempSync(join(tmpdir(), 'route-gate-'))
  const res = recordOutcomeFeedback(dir, {
    outcome: 'reject',
    note: '禁止直接改 Schema，必须先 migration',
    taskId: 't-gate'
  })
  assert.equal(res.success, true)
  assert.equal(res.record?.learning_target, 'gate_candidate')
  assert.ok(listLearningCandidates(dir).length >= 1)
})

test('纠正分流：风格 → memory', async () => {
  const { routeLearningTarget } = await import('./feedback.js')
  const route = routeLearningTarget({
    outcome: 'edit',
    note: '变量名改成缩写，注释写短一点',
    attribution: 'style'
  })
  assert.equal(route.primary, 'memory')
})

test('账本控制：禁用 tactic 后不再注入；撤销草稿可删除', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-ctl-'))
  const { upsertTactic, setTacticEnabled, rollbackTactic, selectTactics, seedDefaultTactics, listTactics } =
    await import('./experience/index.js')
  seedDefaultTactics(dir, 'T1')
  upsertTactic(dir, {
    id: 'fb-style-test01',
    family: 'T1',
    title: '用户风格草稿',
    body: '偏好短注释',
    trigger_tags: ['style', 'feedback'],
    priority: 99,
    enabled: true,
    attribution: 'style',
    scope: 'user',
    validated: true
  })
  let plan = selectTactics(dir, { family: 'T1', goal: 'style feedback 短注释', topK: 8 })
  assert.ok(plan.tactics.some((t) => t.id === 'fb-style-test01'))

  setTacticEnabled(dir, 'fb-style-test01', false)
  plan = selectTactics(dir, { family: 'T1', goal: 'style feedback 短注释', topK: 8 })
  assert.equal(plan.tactics.some((t) => t.id === 'fb-style-test01'), false)

  const rolled = rollbackTactic(dir, 'fb-style-test01')
  assert.equal(rolled.success, true)
  assert.equal(rolled.deleted, true)
  assert.equal(listTactics(dir).some((t) => t.id === 'fb-style-test01'), false)

  const seedRoll = rollbackTactic(dir, 't1-verify-before-done')
  assert.equal(seedRoll.success, true)
  assert.equal(seedRoll.deleted, false)
  assert.equal(listTactics(dir).find((t) => t.id === 't1-verify-before-done')?.enabled, false)
})

test('重复错误率：同 attribution 计重复', async () => {
  const { computeRepeatFailureRate } = await import('./metrics.js')
  const stats = computeRepeatFailureRate([
    {
      id: 'a',
      family: 'T1',
      created_at: 1,
      symptom: 'x',
      root_cause: 'r',
      fix_hint: 'f',
      trigger_tags: ['map'],
      attribution: 'logic'
    },
    {
      id: 'b',
      family: 'T1',
      created_at: 2,
      symptom: 'y',
      root_cause: 'r',
      fix_hint: 'f',
      trigger_tags: ['cache'],
      attribution: 'logic'
    }
  ])
  assert.equal(stats.total, 2)
  assert.equal(stats.repeats, 1)
  assert.equal(stats.rate, 0.5)
})

test('Goal Contract：code 模式含验收与 Stop Gate', async () => {
  const { buildGoalContract, evaluateStopGate, formatGoalContractBlock, GOAL_CONTRACT_MARKER } =
    await import('./goal-contract.js')
  const c = buildGoalContract('修复登录 bug 并跑测试', 'code')
  assert.ok(c.acceptance_criteria.length >= 1)
  assert.ok(c.verify_hint)
  assert.match(formatGoalContractBlock(c), new RegExp(GOAL_CONTRACT_MARKER))
  const blocked = evaluateStopGate({ mode: 'code', contract: c, verifySeen: false, verifyOk: null })
  assert.equal(blocked.ok, false)
  const ok = evaluateStopGate({ mode: 'code', contract: c, verifySeen: true, verifyOk: true })
  assert.equal(ok.ok, true)
})

test('打断策略：安全问题 ask_user；连续失败 escalate', async () => {
  const { decideInterrupt } = await import('./interrupt-policy.js')
  assert.equal(decideInterrupt({ kind: 'question', text: '是否删除生产数据？' }).action, 'ask_user')
  assert.equal(
    decideInterrupt({ kind: 'technical_error', consecutiveFailures: 3 }).action,
    'escalate_stop'
  )
  assert.equal(decideInterrupt({ kind: 'technical_error', riskLevel: 'low' }).action, 'auto')
})

test('Agent compact：保留 Goal Contract', async () => {
  const { compactMessagesForAgent } = await import('../loop/compact.js')
  const { formatGoalContractBlock, buildGoalContract } = await import('./goal-contract.js')
  const block = formatGoalContractBlock(buildGoalContract('修 bug', 'code'))
  const messages = [
    { role: 'system' as const, content: `系统提示${block}` },
    ...Array.from({ length: 40 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `消息 ${i} `.repeat(80)
    }))
  ]
  const out = compactMessagesForAgent(messages, { threshold: 1000, keepTail: 4 })
  assert.equal(out.compacted, true)
  assert.ok(out.messages.some((m) => typeof m.content === 'string' && m.content.includes('任务契约')))
})

test('协作取消：清空挂起审批', async () => {
  const { waitForApproval } = await import('../approval.js')
  const { requestTaskCancel, resetTaskControl, isTaskAborted } = await import('../task-control.js')
  resetTaskControl()
  const p = waitForApproval('test-cancel-1')
  const { resolved } = requestTaskCancel()
  assert.ok(resolved >= 1)
  assert.equal(isTaskAborted(), true)
  const d = await p
  assert.equal(d.approved, false)
  resetTaskControl()
})

test('t1-018 草稿：不注入；force 可注入；live 模拟晋升', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'promote-'))
  const { upsertTactic } = await import('./experience/store.js')
  // 不走已晋升种子：直接写入草稿模拟晋升前门禁
  upsertTactic(dir, {
    id: MAP_OBJECT_KEY_TACTIC_ID,
    family: 'T1',
    title: 'Map 禁止临时对象作 key',
    body: 'Map 不要用临时对象作 key',
    trigger_tags: ['map', 'key', 'cache'],
    priority: 92,
    enabled: true,
    attribution: 'logic',
    scope: 'project',
    validated: false,
    backtest_case_ids: ['t1-018']
  })
  const { failureId } = ensureT1018Draft(dir)
  // ensure 会 seed 其它默认 tactic，但不得把本草稿抬成 validated
  assert.equal(listTactics(dir).find((t) => t.id === MAP_OBJECT_KEY_TACTIC_ID)?.validated, false)
  assert.ok(failureId)
  assert.ok(listDraftTactics(dir).some((t) => t.id === MAP_OBJECT_KEY_TACTIC_ID))
  assert.equal(assertDraftNotInjected(dir, MAP_OBJECT_KEY_TACTIC_ID), true)

  const stub = await backtestAndPromote(dir, MAP_OBJECT_KEY_TACTIC_ID, { gate: 'stub' })
  assert.equal(stub.promoted, false)
  assert.ok(stub.case_results.every((r) => r.passed))

  const liveFail = await backtestAndPromote(dir, MAP_OBJECT_KEY_TACTIC_ID, {
    gate: 'live',
    runner: async () => [{ case_id: 't1-018', passed: false, reason: 'mock fail' }]
  })
  assert.equal(liveFail.promoted, false)
  assert.equal(listTactics(dir).find((t) => t.id === MAP_OBJECT_KEY_TACTIC_ID)?.validated, false)

  const liveOk = await backtestAndPromote(dir, MAP_OBJECT_KEY_TACTIC_ID, {
    gate: 'live',
    runner: async () => [{ case_id: 't1-018', passed: true, reason: 'mock ok' }]
  })
  assert.equal(liveOk.promoted, true)
  assert.equal(listTactics(dir).find((t) => t.id === MAP_OBJECT_KEY_TACTIC_ID)?.validated, true)
  const after = selectTactics(dir, { family: 'T1', goal: '修复 cache map key', topK: 8 })
  assert.ok(after.tactics.some((t) => t.id === MAP_OBJECT_KEY_TACTIC_ID))
})
