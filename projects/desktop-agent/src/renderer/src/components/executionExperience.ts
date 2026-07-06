import type { ReasoningItem, ToolCallItem, Turn } from '../../../agent/src/items'
import type { TodoItem } from '../store/task'
import { describeToolCall } from './toolActivityText'

export interface ExecutionSummary {
  mode: 'idle' | 'thinking' | 'processed'
  label: string
  elapsedLabel: string
  hasFirstResult: boolean
}

export interface ProgressStepView {
  id: string
  label: string
  status: 'running' | 'pending' | 'completed'
}

export interface FileChangeProgress {
  fileCount: number
  addedChars: number
  deletedChars: number
}

const DONE_STATUSES = new Set(['completed', 'failed', 'stopped', 'canceled'])
const FILE_CHANGE_KINDS = new Set(['write_file', 'create_docx', 'create_xlsx'])

export function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000))
  if (sec < 60) return `${sec} 秒`
  const minute = Math.floor(sec / 60)
  const rest = sec % 60
  return rest > 0 ? `${minute} 分 ${rest} 秒` : `${minute} 分`
}

export function formatCompactDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000))
  if (sec < 60) return `${sec} 秒`
  const minute = Math.floor(sec / 60)
  const rest = sec % 60
  return rest > 0 ? `${minute} 分 ${rest} 秒` : `${minute} 分`
}

export function trimStepLabel(value: string): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (!clean) return '处理中'
  return clean.length > 15 ? `${clean.slice(0, 14)}…` : clean
}

export function getToolItems(turn: Turn | null): ToolCallItem[] {
  return (turn?.items ?? []).filter((item): item is ToolCallItem => item.type === 'toolCall')
}

export function getReasoningItems(turn: Turn | null): ReasoningItem[] {
  return (turn?.items ?? []).filter((item): item is ReasoningItem => item.type === 'reasoning')
}

function countVisibleChars(value: string): number {
  return Array.from(value.replace(/\s/g, '')).length
}

function parseResultObject(item: ToolCallItem): Record<string, unknown> | null {
  if (!item.result) return null
  try {
    const parsed = JSON.parse(item.result)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

function getNumberField(source: Record<string, unknown> | null, key: string): number | null {
  const value = source?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function estimateDocxChars(args: Record<string, unknown>): number {
  const parts: string[] = []
  if (typeof args.title === 'string') parts.push(args.title)
  const sections = Array.isArray(args.sections) ? args.sections : []
  for (const rawSection of sections) {
    const section = rawSection as Record<string, unknown>
    if (typeof section.heading === 'string') parts.push(section.heading)
    if (Array.isArray(section.paragraphs)) {
      parts.push(...section.paragraphs.filter((item): item is string => typeof item === 'string'))
    }
  }
  const tables = Array.isArray(args.tables) ? args.tables : []
  for (const rawTable of tables) {
    const table = rawTable as Record<string, unknown>
    if (Array.isArray(table.rows)) {
      for (const rawRow of table.rows) {
        if (Array.isArray(rawRow)) parts.push(...rawRow.map((cell) => String(cell ?? '')))
      }
    }
  }
  return countVisibleChars(parts.join(''))
}

function estimateXlsxChars(args: Record<string, unknown>): number {
  const parts: string[] = []
  const sheets = Array.isArray(args.sheets) ? args.sheets : []
  for (const rawSheet of sheets) {
    const sheet = rawSheet as Record<string, unknown>
    if (typeof sheet.name === 'string') parts.push(sheet.name)
    if (Array.isArray(sheet.rows)) {
      for (const rawRow of sheet.rows) {
        if (Array.isArray(rawRow)) parts.push(...rawRow.map((cell) => String(cell ?? '')))
      }
    }
  }
  return countVisibleChars(parts.join(''))
}

function getChangePath(item: ToolCallItem): string | null {
  return typeof item.args.path === 'string' && item.args.path.trim() ? item.args.path : null
}

function getChangeChars(item: ToolCallItem): { addedChars: number; deletedChars: number } {
  const result = parseResultObject(item)
  const resultAdded = getNumberField(result, 'addedChars')
  const resultDeleted = getNumberField(result, 'deletedChars')
  if (resultAdded !== null || resultDeleted !== null) {
    return { addedChars: resultAdded ?? 0, deletedChars: resultDeleted ?? 0 }
  }
  if (item.kind === 'write_file') {
    const content = typeof item.args.content === 'string' ? item.args.content : ''
    return { addedChars: countVisibleChars(content), deletedChars: 0 }
  }
  if (item.kind === 'create_docx') return { addedChars: estimateDocxChars(item.args), deletedChars: 0 }
  if (item.kind === 'create_xlsx') return { addedChars: estimateXlsxChars(item.args), deletedChars: 0 }
  return { addedChars: 0, deletedChars: 0 }
}

export function deriveFileChangeProgress(turn: Turn | null): FileChangeProgress {
  const files = new Set<string>()
  let addedChars = 0
  let deletedChars = 0
  for (const item of getToolItems(turn)) {
    if (!FILE_CHANGE_KINDS.has(item.kind) || item.status === 'failed' || item.status === 'stopped' || item.status === 'canceled') continue
    const path = getChangePath(item)
    if (!path) continue
    files.add(path)
    const chars = getChangeChars(item)
    addedChars += chars.addedChars
    deletedChars += chars.deletedChars
  }
  return { fileCount: files.size, addedChars, deletedChars }
}

export function deriveExecutionSummary(status: string, turn: Turn | null, now: number): ExecutionSummary {
  if (status !== 'executing' || !turn) {
    return { mode: 'idle', label: '', elapsedLabel: '', hasFirstResult: false }
  }
  const tools = getToolItems(turn)
  const reasonings = getReasoningItems(turn)
  const hasFirstResult = tools.some((item) => DONE_STATUSES.has(item.status)) ||
    reasonings.some((item) => item.status === 'completed' || Boolean(item.finishedAt)) ||
    turn.items.some((item) => item.type === 'agentMessage' && item.text.trim().length > 0)
  const elapsedLabel = formatDuration(now - turn.startedAt)
  if (!hasFirstResult) {
    return { mode: 'thinking', label: `思考中 · ${elapsedLabel}`, elapsedLabel, hasFirstResult }
  }
  return { mode: 'processed', label: `执行中 · ${elapsedLabel}`, elapsedLabel, hasFirstResult }
}

export function deriveProgressSteps(turn: Turn | null, todos: TodoItem[]): ProgressStepView[] {
  if (todos.length > 0) {
    return todos.map((todo) => ({
      id: todo.id,
      label: trimStepLabel(todo.content),
      status: todo.status === 'completed' ? 'completed' : todo.status === 'in_progress' ? 'running' : 'pending'
    }))
  }

  return getToolItems(turn).map((item): ProgressStepView => ({
    id: item.id,
    label: trimStepLabel(describeToolCall(item).replace(/^正在/, '').replace(/^已/, '')),
    status: item.status === 'running' || item.status === 'pending'
      ? 'running'
      : DONE_STATUSES.has(item.status)
        ? 'completed'
        : 'pending'
  })).map((step, index, all): ProgressStepView => {
    if (step.status === 'running') return step
    const hasRunning = all.some((item) => item.status === 'running')
    if (!hasRunning && step.status === 'pending' && index === 0) return { ...step, status: 'running' }
    return step
  })
}

export function countCompletedSteps(steps: ProgressStepView[]): number {
  return steps.filter((step) => step.status === 'completed').length
}
