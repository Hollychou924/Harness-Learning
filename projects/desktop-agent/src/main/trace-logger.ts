import { app } from 'electron'
import { basename, join } from 'node:path'
import { mkdirSync, appendFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import type { StdoutMessage } from '../agent/src/protocol.js'

// 小蓝鲸本地诊断日志：每次任务单独生成一条排查记录，和长期对话分离。
// 所有写入磁盘的数据先做遮挡，避免模型配置、文件内容、联系方式等敏感信息裸写入日志。

export interface TraceEvent {
  ts: number
  seq?: number
  phase: string
  type: string
  traceId?: string
  taskId?: string
  sessionId?: string
  conversationId?: string
  runId?: string
  stepId?: string
  parentStepId?: string
  data: Record<string, unknown>
}

export interface TraceMeta {
  traceId: string
  runId: string
  taskId: string
  sessionId: string
  conversationId: string
  message: string
  mode: string
  model: string
  provider: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: number
  finishedAt?: number
  eventCount: number
}

interface TraceIdentity {
  traceId: string
  runId: string
  taskId: string
  sessionId: string
  conversationId: string
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
  if (key.length <= 10) return `${key.slice(0, 4)}***`
  return `${key.slice(0, 6)}***${key.slice(-4)}`
}

function safeTitle(value: string): string {
  const text = sanitizeText(value).replace(/\s+/g, ' ').trim()
  return text.slice(0, 120)
}

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
  taskId: string
  sessionId: string
  conversationId: string
  runId?: string
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
  attachmentCount?: number
  historyCount?: number
}): void {
  ensureDirs()
  const identity: TraceIdentity = {
    traceId,
    runId: opts.runId || traceId,
    taskId: opts.taskId,
    sessionId: opts.sessionId,
    conversationId: opts.conversationId
  }
  const meta: TraceMeta = {
    ...identity,
    message: safeTitle(opts.message),
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
  writeFileSync(traceFilePath(traceId), '', 'utf-8')

  appendEvent(traceId, {
    ts: Date.now(),
    phase: 'request',
    type: 'task_started',
    stepId: `task:${identity.taskId}`,
    data: {
      message: opts.message,
      messageLength: opts.message.length,
      mode: opts.mode,
      model: opts.model,
      provider: opts.provider,
      providerId: opts.providerId,
      customProviderId: opts.customProviderId,
      apiBaseUrl: opts.apiBaseUrl,
      apiKeyMasked: maskApiKey(opts.apiKey),
      maxIterations: opts.maxIterations,
      autoApproveLow: opts.autoApproveLow,
      attachmentCount: opts.attachmentCount || 0,
      historyCount: opts.historyCount || 0
    }
  })
  updateMeta(traceId, (m) => { m.eventCount++ })
}

export function appendEvent(traceId: string, event: TraceEvent): void {
  try {
    const normalized = normalizeEvent(traceId, event)
    appendFileSync(traceFilePath(traceId), `${JSON.stringify(normalized)}\n`, 'utf-8')
  } catch {
    // 磁盘写入失败不影响主流程
  }
}

function normalizeEvent(traceId: string, event: TraceEvent): TraceEvent {
  const meta = loadIndex().find((t) => t.traceId === traceId)
  const identity = meta ? {
    traceId: meta.traceId,
    runId: meta.runId,
    taskId: meta.taskId,
    sessionId: meta.sessionId,
    conversationId: meta.conversationId
  } : { traceId }
  return {
    ...event,
    ...identity,
    seq: meta ? meta.eventCount + 1 : event.seq,
    data: sanitizeTraceData(event.data)
  }
}

export function logAgentEvent(traceId: string, msg: StdoutMessage): void {
  const ts = Date.now()
  let phase = 'execution'
  const type = msg.type
  let data: Record<string, unknown> = {}
  let stepId: string | undefined
  let parentStepId: string | undefined

  switch (msg.type) {
    case 'turn_started':
      phase = 'turn'
      stepId = `turn:${msg.turn_id}`
      data = { turnId: msg.turn_id }
      break
    case 'turn_completed':
      phase = 'turn'
      stepId = `turn:${msg.turn_id}`
      data = { turnId: msg.turn_id, status: msg.status }
      updateMeta(traceId, (m) => {
        if (msg.status === 'failed') m.status = 'failed'
        if (msg.status === 'cancelled') m.status = 'cancelled'
        m.finishedAt = ts
      })
      break
    case 'item_started':
      phase = itemPhase(msg.item.type)
      stepId = `item:${msg.item.id}`
      parentStepId = `turn:${msg.turn_id}`
      data = { turnId: msg.turn_id, item: msg.item }
      break
    case 'item_delta':
      phase = 'stream'
      stepId = `item:${msg.item_id}:delta`
      parentStepId = `item:${msg.item_id}`
      data = { turnId: msg.turn_id, itemId: msg.item_id, target: msg.target, delta: msg.delta }
      break
    case 'item_completed':
      phase = itemPhase(msg.item.type)
      stepId = `item:${msg.item.id}`
      parentStepId = `turn:${msg.turn_id}`
      data = { turnId: msg.turn_id, item: msg.item }
      break
    case 'item_status_changed':
      phase = 'item'
      stepId = `item:${msg.item_id}`
      parentStepId = `turn:${msg.turn_id}`
      data = { turnId: msg.turn_id, itemId: msg.item_id, status: msg.status }
      break
    case 'approval_request':
      phase = 'permission'
      stepId = `approval:${msg.request_id}`
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
      stepId = `plan:${msg.request_id}`
      data = { requestId: msg.request_id, plan: msg.plan, steps: msg.steps }
      break
    case 'question_proposed':
      phase = 'question'
      stepId = `question:${msg.request_id}`
      data = { requestId: msg.request_id, question: msg.question, detail: msg.detail, options: msg.options, multiple: msg.multiple, allowCustom: msg.allow_custom, allowSkip: msg.allow_skip }
      break
    case 'todo_update':
      phase = 'todo'
      data = { todos: msg.todos }
      break
    case 'subtask_started':
      phase = 'subtask'
      stepId = `subtask:${msg.subtask_id}`
      data = { subtaskId: msg.subtask_id, title: msg.title, agentId: msg.agent_id }
      break
    case 'subtask_completed':
      phase = 'subtask'
      stepId = `subtask:${msg.subtask_id}`
      data = { subtaskId: msg.subtask_id, title: msg.title, durationMs: msg.duration_ms, toolCount: msg.tool_count, tokens: msg.tokens }
      break
    case 'subtask_failed':
      phase = 'subtask'
      stepId = `subtask:${msg.subtask_id}`
      data = { subtaskId: msg.subtask_id, title: msg.title, error: msg.error }
      break
    case 'usage':
      phase = 'model_call'
      data = { inputTokens: msg.inputTokens, outputTokens: msg.outputTokens }
      break
    case 'artifact':
      phase = 'artifact'
      data = { artifactType: msg.artifact_type, filePath: msg.file_path }
      break
    case 'error':
      phase = 'error'
      data = { message: msg.message }
      updateMeta(traceId, (m) => { m.status = 'failed'; m.finishedAt = ts })
      break
    case 'completed':
      phase = 'completion'
      data = { taskId: msg.task_id, summary: msg.summary, messageCount: msg.messages?.length || 0 }
      updateMeta(traceId, (m) => {
        if (m.status !== 'failed' && m.status !== 'cancelled') m.status = 'completed'
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

  appendEvent(traceId, { ts, phase, type, stepId, parentStepId, data })
  updateMeta(traceId, (m) => { m.eventCount++ })
}

function itemPhase(itemType: string): string {
  switch (itemType) {
    case 'reasoning': return 'thinking'
    case 'toolCall': return 'tool'
    case 'agentMessage': return 'model_output'
    case 'plan': return 'plan'
    case 'approval': return 'permission'
    default: return 'item'
  }
}

export function logUserAction(traceId: string, action: string, data: Record<string, unknown>): void {
  appendEvent(traceId, {
    ts: Date.now(),
    phase: 'user_action',
    type: action,
    stepId: `user:${action}`,
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

export function exportTracePackage(traceId?: string): { success: boolean; path?: string; error?: string } {
  try {
    ensureDirs()
    const traces = traceId ? [getTrace(traceId)] : listTraces(20).map((item) => getTrace(item.traceId))
    const exportedAt = new Date().toISOString()
    const payload = {
      exportedAt,
      app: {
        name: app.getName(),
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch
      },
      traces
    }
    const name = traceId ? `xiaolanjing-diagnostic-${traceId.slice(0, 8)}.json` : `xiaolanjing-diagnostic-${Date.now()}.json`
    const filePath = join(app.getPath('downloads'), name)
    writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    return { success: true, path: filePath }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

function sanitizeTraceData(data: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(data, 0) as Record<string, unknown>
}

function sanitizeValue(value: unknown, depth: number, key = ''): unknown {
  if (value == null) return value
  if (depth > 8) return '[层级过深，已省略]'
  if (typeof value === 'string') return sanitizeStringByKey(key, value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => sanitizeValue(item, depth + 1, key))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      out[childKey] = sanitizeValue(childValue, depth + 1, childKey)
    }
    return out
  }
  return String(value)
}

function sanitizeStringByKey(key: string, value: string): string {
  const lower = key.toLowerCase()
  if (/apikey|api_key|authorization|token|secret|password|cookie/.test(lower)) return '[敏感配置已隐藏]'
  if (/dataurl|base64/.test(lower)) return '[文件内容已隐藏]'
  if (/filepath|path$|workspace/.test(lower)) return maskPath(value)
  return sanitizeText(value)
}

function sanitizeText(value: string): string {
  let text = value
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [已隐藏]')
    .replace(/\b(?:sk|sk-ant|xai|AIza)[A-Za-z0-9_\-]{12,}\b/g, '[访问配置已隐藏]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[邮箱已隐藏]')
    .replace(/\b1[3-9]\d{9}\b/g, '[手机号已隐藏]')
    .replace(/\/Users\/[^\s'"`]+/g, (match) => maskPath(match))
    .replace(/[A-Za-z]:\\[^\s'"`]+/g, (match) => maskPath(match))
  if (text.length > 1500) text = `${text.slice(0, 1500)}…[已截断，共 ${value.length} 字]`
  return text
}

function maskPath(value: string): string {
  if (!value) return value
  return `[路径已隐藏]/${basename(value)}`
}
