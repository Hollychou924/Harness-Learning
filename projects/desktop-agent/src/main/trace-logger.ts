import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync, appendFileSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import type { StdoutMessage } from '../agent/src/protocol.js'

// 全链路 trace 日志：每条请求一个 traceId（复用 session_id），写入磁盘 JSONL
// 集中在主进程收集，agent 子进程事件 + 用户操作全部记录

export interface TraceEvent {
  ts: number
  phase: string
  type: string
  data: Record<string, unknown>
}

interface TraceMeta {
  traceId: string
  message: string
  mode: string
  model: string
  provider: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: number
  finishedAt?: number
  eventCount: number
}

const tracesDir = () => join(app.getPath('userData'), 'logs', 'traces')
const indexFile = () => join(tracesDir(), 'index.json')

function ensureDirs(): void {
  const dir = tracesDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (!existsSync(indexFile())) writeFileSync(indexFile(), '[]', 'utf-8')
}

function maskApiKey(key: string): string {
  if (!key) return ''
  if (key.length <= 10) return key.slice(0, 4) + '***'
  return key.slice(0, 6) + '***' + key.slice(-4)
}

// 内存索引，避免频繁读磁盘
let indexCache: TraceMeta[] | null = null

function loadIndex(): TraceMeta[] {
  if (indexCache) return indexCache
  try {
    ensureDirs()
    const raw = readFileSync(indexFile(), 'utf-8')
    indexCache = JSON.parse(raw)
    if (!Array.isArray(indexCache)) indexCache = []
  } catch {
    indexCache = []
  }
  return indexCache!
}

function saveIndex(list: TraceMeta[]): void {
  indexCache = list
  ensureDirs()
  writeFileSync(indexFile(), JSON.stringify(list.slice(0, 200), null, 2), 'utf-8')
}

function traceFilePath(traceId: string): string {
  return join(tracesDir(), `${traceId}.jsonl`)
}

export function startTrace(traceId: string, opts: {
  message: string
  mode: string
  model: string
  provider: string
  maxIterations: number
  autoApproveLow: boolean
  apiKey: string
  apiBaseUrl?: string
  providerId?: string
  customProviderId?: string
}): void {
  ensureDirs()
  const meta: TraceMeta = {
    traceId,
    message: opts.message.slice(0, 200),
    mode: opts.mode,
    model: opts.model,
    provider: opts.provider,
    status: 'running',
    startedAt: Date.now(),
    eventCount: 0
  }

  const list = loadIndex().filter((t) => t.traceId !== traceId)
  list.unshift(meta)
  saveIndex(list)

  // 写入第一条事件：请求发起
  appendEvent(traceId, {
    ts: Date.now(),
    phase: 'request',
    type: 'task_started',
    data: {
      message: opts.message,
      mode: opts.mode,
      model: opts.model,
      provider: opts.provider,
      providerId: opts.providerId,
      customProviderId: opts.customProviderId,
      apiBaseUrl: opts.apiBaseUrl,
      apiKeyMasked: maskApiKey(opts.apiKey),
      maxIterations: opts.maxIterations,
      autoApproveLow: opts.autoApproveLow
    }
  })
  updateMeta(traceId, (m) => { m.eventCount++ })
}

export function appendEvent(traceId: string, event: TraceEvent): void {
  try {
    appendFileSync(traceFilePath(traceId), JSON.stringify(event) + '\n', 'utf-8')
  } catch {
    // 磁盘写入失败不影响主流程
  }
}

// 将 agent stdout 事件映射为 trace 事件
export function logAgentEvent(traceId: string, msg: StdoutMessage): void {
  const ts = Date.now()
  let phase = 'execution'
  let type = msg.type
  let data: Record<string, unknown> = {}

  switch (msg.type) {
    case 'thinking':
      phase = 'thinking'
      data = { text: msg.text }
      break
    case 'chunk':
      phase = 'model_output'
      data = { text: msg.text }
      break
    case 'tool_call':
      phase = 'tool'
      data = { name: msg.name, args: msg.args, id: msg.id }
      break
    case 'tool_result':
      phase = 'tool'
      data = { name: msg.name, result: msg.result.slice(0, 2000) }
      break
    case 'approval_request':
      phase = 'permission'
      data = {
        requestId: msg.request_id,
        toolName: msg.tool_name,
        args: msg.args,
        riskLevel: msg.risk_level,
        impact: msg.impact,
        canRollback: msg.can_rollback
      }
      break
    case 'plan_proposed':
      phase = 'plan'
      data = { requestId: msg.request_id, plan: msg.plan, steps: msg.steps }
      break
    case 'todo_update':
      phase = 'todo'
      data = { todos: msg.todos }
      break
    case 'subtask_started':
      phase = 'subtask'
      data = { subtaskId: msg.subtask_id, title: msg.title, agentId: msg.agent_id }
      break
    case 'subtask_completed':
      phase = 'subtask'
      data = { subtaskId: msg.subtask_id, title: msg.title, durationMs: msg.duration_ms, toolCount: msg.tool_count, tokens: msg.tokens }
      break
    case 'subtask_failed':
      phase = 'subtask'
      data = { subtaskId: msg.subtask_id, title: msg.title, error: msg.error }
      break
    case 'usage':
      phase = 'model_call'
      data = { inputTokens: msg.inputTokens, outputTokens: msg.outputTokens }
      break
    case 'step_progress':
      phase = 'progress'
      data = { step: msg.step, total: msg.total, summary: msg.summary }
      break
    case 'artifact':
      phase = 'artifact'
      data = { artifactType: msg.artifact_type, filePath: msg.file_path }
      break
    case 'error':
      phase = 'error'
      data = { message: msg.message }
      updateMeta(traceId, (m) => { m.status = 'failed' })
      break
    case 'completed':
      phase = 'completion'
      data = { summary: msg.summary }
      updateMeta(traceId, (m) => {
        m.status = 'completed'
        m.finishedAt = ts
      })
      break
    case 'status':
      phase = 'status'
      data = { status: msg.status, message: msg.message }
      if (msg.status === 'CANCELLED') {
        updateMeta(traceId, (m) => { m.status = 'cancelled'; m.finishedAt = ts })
      }
      break
  }

  appendEvent(traceId, { ts, phase, type, data })
  updateMeta(traceId, (m) => { m.eventCount++ })
}

export function logUserAction(traceId: string, action: string, data: Record<string, unknown>): void {
  appendEvent(traceId, {
    ts: Date.now(),
    phase: 'user_action',
    type: action,
    data
  })
  updateMeta(traceId, (m) => { m.eventCount++ })
}

function updateMeta(traceId: string, fn: (m: TraceMeta) => void): void {
  const list = loadIndex()
  const meta = list.find((t) => t.traceId === traceId)
  if (meta) {
    fn(meta)
    saveIndex(list)
  }
}

export function listTraces(limit = 50): TraceMeta[] {
  return loadIndex().slice(0, limit)
}

export function getTrace(traceId: string): { meta: TraceMeta | null; events: TraceEvent[] } {
  const list = loadIndex()
  const meta = list.find((t) => t.traceId === traceId) || null
  const events: TraceEvent[] = []
  try {
    const raw = readFileSync(traceFilePath(traceId), 'utf-8')
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try { events.push(JSON.parse(line)) } catch { /* skip */ }
    }
  } catch {
    // 文件不存在
  }
  return { meta, events }
}
