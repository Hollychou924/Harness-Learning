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

const DONE_STATUSES = new Set(['completed', 'failed', 'stopped', 'canceled'])

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
    return { mode: 'thinking', label: '正在思考', elapsedLabel, hasFirstResult }
  }
  return { mode: 'processed', label: `已处理 ${elapsedLabel}`, elapsedLabel, hasFirstResult }
}

export function deriveProgressSteps(turn: Turn | null, todos: TodoItem[]): ProgressStepView[] {
  if (todos.length > 0) {
    return todos.map((todo) => ({
      id: todo.id,
      label: trimStepLabel(todo.content),
      status: todo.status === 'completed' ? 'completed' : todo.status === 'in_progress' ? 'running' : 'pending'
    }))
  }

  return getToolItems(turn).map((item) => ({
    id: item.id,
    label: trimStepLabel(describeToolCall(item).replace(/^正在/, '').replace(/^已/, '')),
    status: item.status === 'running' || item.status === 'pending'
      ? 'running'
      : DONE_STATUSES.has(item.status)
        ? 'completed'
        : 'pending'
  })).map((step, index, all) => {
    if (step.status === 'running') return step
    const hasRunning = all.some((item) => item.status === 'running')
    if (!hasRunning && step.status === 'pending' && index === 0) return { ...step, status: 'running' }
    return step
  })
}

export function countCompletedSteps(steps: ProgressStepView[]): number {
  return steps.filter((step) => step.status === 'completed').length
}
