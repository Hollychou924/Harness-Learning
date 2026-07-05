import { app } from 'electron'
import { basename, join } from 'node:path'
import { mkdirSync, appendFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
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
  appVersion?: string
  platform?: string
  arch?: string
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

export type DiagnosticPackageLevel = 'basic' | 'enhanced' | 'full'

export interface DiagnosticExportOptions {
  traceId?: string
  feedbackId?: string
  packageLevel?: DiagnosticPackageLevel
  includeConversation?: boolean
  includeFileSummary?: boolean
}

export interface FeedbackTicket {
  feedbackId: string
  traceId?: string
  taskId?: string
  category: string
  description: string
  contact?: string
  packageLevel: DiagnosticPackageLevel
  includeConversation: boolean
  includeFileSummary: boolean
  allowDiagnosticPackage: boolean
  packagePath?: string
  createdAt: number
}

export interface FeedbackInput {
  traceId?: string
  category: string
  description: string
  contact?: string
  packageLevel?: DiagnosticPackageLevel
  includeConversation?: boolean
  includeFileSummary?: boolean
  allowDiagnosticPackage?: boolean
}

export interface DiagnosticsOverview {
  total: number
  completed: number
  failed: number
  cancelled: number
  running: number
  failureRate: number
  feedbackCount: number
  failureCategories: Array<{ category: string; count: number }>
  models: Array<{ name: string; total: number; failed: number; inputTokens: number; outputTokens: number }>
  tools: Array<{ name: string; total: number; failed: number }>
  versions: Array<{ name: string; total: number; failed: number }>
}

const tracesDir = () => join(app.getPath('userData'), 'logs', 'traces')
const indexFile = () => join(tracesDir(), 'index.json')
const feedbackDir = () => join(app.getPath('userData'), 'logs', 'feedback')
const feedbackIndexFile = () => join(feedbackDir(), 'index.json')

function ensureDirs(): void {
  const dir = tracesDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (!existsSync(indexFile())) writeFileSync(indexFile(), '[]', 'utf-8')
  const fbDir = feedbackDir()
  if (!existsSync(fbDir)) mkdirSync(fbDir, { recursive: true })
  if (!existsSync(feedbackIndexFile())) writeFileSync(feedbackIndexFile(), '[]', 'utf-8')
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
let feedbackCache: FeedbackTicket[] | null = null

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

function loadFeedbackIndex(): FeedbackTicket[] {
  if (feedbackCache) return feedbackCache
  try {
    ensureDirs()
    const raw = readFileSync(feedbackIndexFile(), 'utf-8')
    feedbackCache = JSON.parse(raw)
    if (!Array.isArray(feedbackCache)) feedbackCache = []
  } catch {
    feedbackCache = []
  }
  return feedbackCache!
}

function saveFeedbackIndex(list: FeedbackTicket[]): void {
  feedbackCache = list
  ensureDirs()
  writeFileSync(feedbackIndexFile(), JSON.stringify(list.slice(0, 200), null, 2), 'utf-8')
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
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
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

export function exportTracePackage(input?: string | DiagnosticExportOptions): { success: boolean; path?: string; error?: string } {
  try {
    ensureDirs()
    const options = normalizeExportOptions(input)
    const traces = options.traceId ? [getTrace(options.traceId)] : listTraces(20).map((item) => getTrace(item.traceId))
    const exportedAt = new Date().toISOString()
    const payload = {
      exportedAt,
      feedbackId: options.feedbackId,
      packageLevel: options.packageLevel,
      includeConversation: options.includeConversation,
      includeFileSummary: options.includeFileSummary,
      app: {
        name: app.getName(),
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch
      },
      traces: traces.map((trace) => shapeTraceForPackage(trace, options))
    }
    const nameBase = options.feedbackId || (options.traceId ? options.traceId.slice(0, 8) : String(Date.now()))
    const name = `xiaolanjing-diagnostic-${nameBase}.json`
    const filePath = join(app.getPath('downloads'), name)
    writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    return { success: true, path: filePath }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function createFeedbackTicket(input: FeedbackInput): { success: boolean; feedback?: FeedbackTicket; packagePath?: string; error?: string } {
  try {
    ensureDirs()
    const trace = input.traceId ? getTrace(input.traceId) : { meta: listTraces(1)[0] || null, events: [] }
    const traceId = input.traceId || trace.meta?.traceId
    const feedbackId = `fb_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`
    const packageLevel = input.packageLevel || 'basic'
    const allowDiagnosticPackage = input.allowDiagnosticPackage !== false
    const ticket: FeedbackTicket = {
      feedbackId,
      traceId,
      taskId: trace.meta?.taskId,
      category: sanitizeText(input.category || '其他'),
      description: sanitizeText(input.description || ''),
      contact: input.contact ? sanitizeText(input.contact) : undefined,
      packageLevel,
      includeConversation: Boolean(input.includeConversation),
      includeFileSummary: Boolean(input.includeFileSummary),
      allowDiagnosticPackage,
      createdAt: Date.now()
    }

    if (allowDiagnosticPackage) {
      const exported = exportTracePackage({
        traceId,
        feedbackId,
        packageLevel,
        includeConversation: ticket.includeConversation,
        includeFileSummary: ticket.includeFileSummary
      })
      if (exported.success) ticket.packagePath = exported.path
    }

    const list = loadFeedbackIndex().filter((item) => item.feedbackId !== feedbackId)
    list.unshift(ticket)
    saveFeedbackIndex(list)
    writeFileSync(join(feedbackDir(), `${feedbackId}.json`), JSON.stringify(ticket, null, 2), 'utf-8')

    if (traceId) {
      logUserAction(traceId, 'feedback_submitted', {
        feedbackId,
        category: ticket.category,
        packageLevel,
        includeConversation: ticket.includeConversation,
        includeFileSummary: ticket.includeFileSummary,
        allowDiagnosticPackage
      })
    }

    return { success: true, feedback: ticket, packagePath: ticket.packagePath }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function listFeedbackTickets(limit = 50): FeedbackTicket[] {
  return loadFeedbackIndex().slice(0, limit)
}

export function getDiagnosticsOverview(limit = 200): DiagnosticsOverview {
  const traces = listTraces(limit)
  const details = traces.map((trace) => ({ meta: trace, events: getTrace(trace.traceId).events }))
  const statusCounts = {
    completed: traces.filter((trace) => trace.status === 'completed').length,
    failed: traces.filter((trace) => trace.status === 'failed').length,
    cancelled: traces.filter((trace) => trace.status === 'cancelled').length,
    running: traces.filter((trace) => trace.status === 'running').length
  }
  const failureCategories = countBy(
    details.filter((detail) => detail.meta.status === 'failed').map((detail) => classifyFailure(detail.events))
  ).map(([category, count]) => ({ category, count }))

  const models = Array.from(details.reduce((map, detail) => {
    const key = `${detail.meta.provider} / ${detail.meta.model}`
    const item = map.get(key) || { name: key, total: 0, failed: 0, inputTokens: 0, outputTokens: 0 }
    item.total++
    if (detail.meta.status === 'failed') item.failed++
    for (const event of detail.events) {
      if (event.type === 'usage') {
        item.inputTokens += Number(event.data.inputTokens || 0)
        item.outputTokens += Number(event.data.outputTokens || 0)
      }
    }
    map.set(key, item)
    return map
  }, new Map<string, { name: string; total: number; failed: number; inputTokens: number; outputTokens: number }>()).values())
    .sort((a, b) => b.total - a.total)

  const tools = Array.from(details.reduce((map, detail) => {
    for (const event of detail.events) {
      if (event.phase !== 'tool' || event.type !== 'item_completed') continue
      const item = event.data.item as Record<string, unknown> | undefined
      const name = String(item?.toolName || item?.toolKind || '未知工具')
      const stat = map.get(name) || { name, total: 0, failed: 0 }
      stat.total++
      if (item?.status === 'failed' || item?.error) stat.failed++
      map.set(name, stat)
    }
    return map
  }, new Map<string, { name: string; total: number; failed: number }>()).values())
    .sort((a, b) => b.total - a.total)

  const versions = Array.from(traces.reduce((map, trace) => {
    const name = `${trace.appVersion || app.getVersion()} / ${trace.platform || process.platform}`
    const item = map.get(name) || { name, total: 0, failed: 0 }
    item.total++
    if (trace.status === 'failed') item.failed++
    map.set(name, item)
    return map
  }, new Map<string, { name: string; total: number; failed: number }>()).values())
    .sort((a, b) => b.total - a.total)

  return {
    total: traces.length,
    ...statusCounts,
    failureRate: traces.length ? Math.round((statusCounts.failed / traces.length) * 1000) / 10 : 0,
    feedbackCount: listFeedbackTickets(limit).length,
    failureCategories,
    models,
    tools,
    versions
  }
}

function classifyFailure(events: TraceEvent[]): string {
  const text = events
    .filter((event) => event.phase === 'error' || event.type === 'item_completed' || event.type === 'status')
    .map((event) => JSON.stringify(event.data))
    .join(' ')
    .toLowerCase()
  if (/apikey|api key|401|403|unauthorized|模型访问|model|provider|rate limit|timeout/.test(text)) return '模型问题'
  if (/approval|permission|denied|拒绝|权限/.test(text)) return '权限问题'
  if (/tool|shell|file|workspace|mcp|工具/.test(text)) return '工具问题'
  if (/cancel|cancelled|用户取消|停止/.test(text)) return '用户取消'
  if (/crash|exit|spawn|econn|程序|进程/.test(text)) return '程序异常'
  return '未知问题'
}

function countBy(values: string[]): Array<[string, number]> {
  const map = new Map<string, number>()
  for (const value of values) map.set(value, (map.get(value) || 0) + 1)
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
}

function normalizeExportOptions(input?: string | DiagnosticExportOptions): Required<DiagnosticExportOptions> {
  const options = typeof input === 'string' ? { traceId: input } : (input || {})
  return {
    traceId: options.traceId || '',
    feedbackId: options.feedbackId || '',
    packageLevel: options.packageLevel || 'enhanced',
    includeConversation: Boolean(options.includeConversation),
    includeFileSummary: Boolean(options.includeFileSummary)
  }
}

function shapeTraceForPackage(trace: { meta: TraceMeta | null; events: TraceEvent[] }, options: Required<DiagnosticExportOptions>): Record<string, unknown> {
  if (options.packageLevel === 'basic') {
    return {
      meta: trace.meta,
      summary: summarizeTrace(trace.events),
      errors: trace.events.filter((event) => event.phase === 'error').map((event) => ({
        ts: event.ts,
        type: event.type,
        message: event.data.message
      }))
    }
  }
  const events = trace.events
    .filter((event) => shouldKeepEventForPackage(event, options))
    .map((event) => trimEventForPackage(event, options))
  return { meta: trace.meta, summary: summarizeTrace(trace.events), events }
}

function summarizeTrace(events: TraceEvent[]): Record<string, unknown> {
  const toolEvents = events.filter((event) => event.phase === 'tool' && event.type === 'item_completed')
  return {
    eventCount: events.length,
    phases: Array.from(new Set(events.map((event) => event.phase))),
    errorCount: events.filter((event) => event.phase === 'error').length,
    toolCount: toolEvents.length,
    lastEvent: events[events.length - 1]?.type
  }
}

function shouldKeepEventForPackage(event: TraceEvent, options: Required<DiagnosticExportOptions>): boolean {
  if (options.packageLevel === 'full') return true
  if (!options.includeConversation && (event.phase === 'stream' || event.phase === 'model_output')) return false
  return true
}

function trimEventForPackage(event: TraceEvent, options: Required<DiagnosticExportOptions>): TraceEvent {
  const data = { ...event.data }
  if (!options.includeConversation) {
    if ('delta' in data) data.delta = '[对话内容未包含]'
    if ('message' in data) data.message = '[对话内容未包含]'
    if ('summary' in data) data.summary = '[对话内容未包含]'
    if (isItemLike(data.item)) {
      data.item = { ...data.item, text: data.item.text ? '[对话内容未包含]' : data.item.text, content: '[对话内容未包含]' }
    }
  }
  if (!options.includeFileSummary) {
    if ('filePath' in data) data.filePath = '[文件路径未包含]'
    if (isItemLike(data.item) && data.item.resultSummary) {
      data.item = { ...data.item, resultSummary: '[文件摘要未包含]' }
    }
  }
  return { ...event, data }
}

function isItemLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
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
