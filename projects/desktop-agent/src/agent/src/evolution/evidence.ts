import { mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { StdoutMessage } from '../protocol.js'
import {
  EVIDENCE_SCHEMA_VERSION,
  HARNESS_VERSION,
  emptySignals,
  type TaskEvidence,
  type TaskFamily,
  type ItemEvidenceRow,
  type UserIntervention
} from './types.js'
import { scoreEvidence } from './verifier.js'

function looksLikeVerifyCommand(command: string): boolean {
  const c = command.toLowerCase()
  return (
    /\b(test|pytest|jest|vitest|mocha|npm test|pnpm test|yarn test|cargo test|go test|mvn test|gradle test)\b/.test(c) ||
    /\b(tsc|compile|build|cargo check|dotnet build)\b/.test(c)
  )
}

function summarizeItem(msg: StdoutMessage): ItemEvidenceRow | null {
  const ts = Date.now()
  if (msg.type === 'item_started' || msg.type === 'item_completed') {
    const item = msg.item
    const row: ItemEvidenceRow = {
      ts,
      event: msg.type,
      item_id: item.id,
      item_type: item.type
    }
    if (item.type === 'toolCall') {
      row.tool_name = item.toolName
      row.status = item.status
      row.summary = item.resultSummary?.slice(0, 200)
    }
    if (item.type === 'agentMessage') {
      row.summary = item.text?.slice(0, 200)
      row.status = item.phase
    }
    return row
  }
  if (msg.type === 'approval_request') {
    return { ts, event: msg.type, tool_name: msg.tool_name, summary: msg.impact?.slice(0, 200) }
  }
  if (msg.type === 'continuation_request') {
    return { ts, event: msg.type, summary: msg.hint?.slice(0, 200) }
  }
  if (msg.type === 'error') {
    return { ts, event: msg.type, summary: msg.message.slice(0, 200) }
  }
  return null
}

export class EvidenceRecorder {
  readonly evidence: TaskEvidence
  private readonly workspaceDir?: string

  constructor(opts: {
    taskId: string
    turnId: string
    mode: 'work' | 'code'
    userGoal: string
    workspaceDir?: string
    family?: TaskFamily
    sessionId?: string
  }) {
    this.workspaceDir = opts.workspaceDir
    this.evidence = {
      schema_version: EVIDENCE_SCHEMA_VERSION,
      harness_version: HARNESS_VERSION,
      task_id: opts.taskId,
      turn_id: opts.turnId,
      session_id: opts.sessionId,
      mode: opts.mode,
      family: opts.family || (opts.mode === 'code' ? 'T1' : 'other'),
      user_goal: opts.userGoal.slice(0, 2000),
      started_at: Date.now(),
      status: 'running',
      signals: emptySignals(),
      interventions: [],
      items: [],
      critic_rounds: []
    }
  }

  /** 包装 onEvent：先记证据，再转发 */
  wrap(onEvent: (msg: StdoutMessage) => void): (msg: StdoutMessage) => void {
    return (msg) => {
      this.ingest(msg)
      onEvent(msg)
    }
  }

  ingest(msg: StdoutMessage): void {
    const s = this.evidence.signals
    const row = summarizeItem(msg)
    if (row) this.evidence.items.push(row)

    switch (msg.type) {
      case 'usage':
        s.input_tokens += msg.inputTokens
        s.output_tokens += msg.outputTokens
        break
      case 'approval_request':
        s.approval_requests += 1
        break
      case 'question_proposed':
        s.question_prompts += 1
        break
      case 'continuation_request':
        s.continuation_count += 1
        break
      case 'item_completed': {
        const item = msg.item
        if (item.type === 'toolCall') {
          s.tool_calls += 1
          if (item.status === 'failed') s.tool_failures += 1
          if (item.status === 'completed') s.tool_successes += 1
          if (item.toolName === 'shell' || item.kind === 'shell') {
            const cmd = typeof item.args?.command === 'string' ? item.args.command : ''
            if (cmd && looksLikeVerifyCommand(cmd)) {
              s.verify_command_seen = true
              if (item.status === 'completed') s.verify_command_ok = true
              if (item.status === 'failed') s.verify_command_ok = false
            }
          }
        }
        if (item.type === 'approval' && item.decision === 'rejected') {
          s.approval_rejects += 1
          this.addIntervention({ at: Date.now(), kind: 'approval', decision: 'rejected' })
        }
        if (item.type === 'plan' && (item.decision === 'rejected' || item.decision === 'revise_requested')) {
          s.plan_rejects += 1
          this.addIntervention({ at: Date.now(), kind: 'plan', decision: item.decision })
        }
        break
      }
      case 'error':
        if (/blocked|禁止|拒绝执行/i.test(msg.message)) s.blocked_hits += 1
        break
      default:
        break
    }
  }

  markIteration(): void {
    this.evidence.signals.iterations += 1
  }

  setTacticsInjected(n: number): void {
    this.evidence.signals.tactics_injected = n
  }

  setGoalContract(contract: {
    user_goal: string
    do_not: string[]
    acceptance_criteria: string[]
    verify_hint?: string
  }): void {
    this.evidence.goal_contract = {
      user_goal: contract.user_goal.slice(0, 2000),
      do_not: contract.do_not.slice(0, 12),
      acceptance_criteria: contract.acceptance_criteria.slice(0, 12),
      verify_hint: contract.verify_hint
    }
  }

  markShortFailRound(): void {
    this.evidence.signals.short_fail_rounds = (this.evidence.signals.short_fail_rounds || 0) + 1
  }

  addIntervention(iv: UserIntervention): void {
    this.evidence.interventions.push(iv)
  }

  finalize(status: 'completed' | 'failed' | 'cancelled'): TaskEvidence {
    this.evidence.status = status
    this.evidence.finished_at = Date.now()
    this.evidence.verdict = scoreEvidence(this.evidence)
    this.persist()
    return this.evidence
  }

  evidenceDir(): string | null {
    if (!this.workspaceDir) return null
    return join(this.workspaceDir, '.xiaolanjing', 'evidence', this.evidence.task_id)
  }

  private persist(): void {
    const dir = this.evidenceDir()
    if (!dir) return
    try {
      mkdirSync(dir, { recursive: true })
      mkdirSync(join(dir, 'turns'), { recursive: true })
      writeFileSync(join(dir, 'meta.json'), JSON.stringify(this.evidence, null, 2), 'utf8')
      writeFileSync(join(dir, 'verdict.json'), JSON.stringify(this.evidence.verdict, null, 2), 'utf8')
      writeFileSync(join(dir, 'interventions.json'), JSON.stringify(this.evidence.interventions, null, 2), 'utf8')
      const turnPath = join(dir, 'turns', `${this.evidence.turn_id}.jsonl`)
      for (const row of this.evidence.items) {
        appendFileSync(turnPath, `${JSON.stringify(row)}\n`, 'utf8')
      }
    } catch {
      // 落盘失败不阻断主任务
    }
  }
}

export function evidenceArtifactPath(recorder: EvidenceRecorder): string | null {
  const dir = recorder.evidenceDir()
  if (!dir || !existsSync(dir)) return null
  return join(dir, 'meta.json')
}
