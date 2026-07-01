import { create } from 'zustand'
import { api } from '../api'
import type { StdoutMessage } from '../../../agent/src/protocol'

export type TaskStatus = 'idle' | 'executing' | 'completed' | 'failed'

export interface ToolLogEntry {
  name: string
  args: Record<string, unknown>
  result?: string
  id: string
}

export interface StepEntry {
  step: number
  total: number
  summary: string
  done: boolean
}

export interface ArtifactEntry {
  type: 'diff' | 'report' | 'file' | 'preview' | 'evidence' | 'task_summary'
  filePath: string
  added?: number
  removed?: number
}

export interface HistoryEntry {
  id: string
  title: string
  mode: 'work' | 'code'
  status: TaskStatus
  finishedAt: number
  stepCount: number
  tokens: number
}

export interface TaskState {
  status: TaskStatus
  taskId: string | null
  mode: 'work' | 'code'
  message: string
  goal: string
  chunks: string
  summary: string
  thinking: string[]
  toolLogs: ToolLogEntry[]
  steps: StepEntry[]
  artifacts: ArtifactEntry[]
  usage: { inputTokens: number; outputTokens: number }
  error: string | null
  startedAt: number | null
  finishedAt: number | null
  history: HistoryEntry[]
  setMode: (m: 'work' | 'code') => void
  setMessage: (s: string) => void
  setGoal: (s: string) => void
  startTask: () => Promise<void>
  reset: () => void
  loadHistory: () => void
  appendEvent: (msg: StdoutMessage) => void
}

const HISTORY_KEY = 'xld.history.v1'
const HISTORY_MAX = 20

function loadHistoryFromStorage(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as HistoryEntry[]
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : []
  } catch {
    return []
  }
}

function saveHistoryToStorage(h: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX)))
  } catch {
    /* ignore quota errors */
  }
}

const initial = {
  status: 'idle' as TaskStatus,
  taskId: null as string | null,
  mode: 'work' as 'work' | 'code',
  message: '',
  goal: '',
  chunks: '',
  summary: '',
  thinking: [] as string[],
  toolLogs: [] as ToolLogEntry[],
  steps: [] as StepEntry[],
  artifacts: [] as ArtifactEntry[],
  usage: { inputTokens: 0, outputTokens: 0 },
  error: null as string | null,
  startedAt: null as number | null,
  finishedAt: null as number | null
}

export const useTaskStore = create<TaskState>((set, get) => ({
  ...initial,
  history: loadHistoryFromStorage(),
  setMode: (m) => set({ mode: m }),
  setMessage: (s) => set({ message: s }),
  setGoal: (s) => set({ goal: s }),
  loadHistory: () => set({ history: loadHistoryFromStorage() }),
  reset: () => set({ ...initial }),
  appendEvent: (msg) => {
    switch (msg.type) {
      case 'chunk':
        set((s) => ({ chunks: s.chunks + msg.text, status: 'executing' }))
        break
      case 'thinking':
        set((s) => ({ thinking: [...s.thinking, msg.text], status: 'executing' }))
        break
      case 'tool_call':
        set((s) => ({
          toolLogs: [...s.toolLogs, { name: msg.name, args: msg.args, id: msg.id }],
          status: 'executing'
        }))
        break
      case 'tool_result':
        set((s) => ({
          toolLogs: s.toolLogs.map((t) =>
            t.id === msg.name && !t.result ? { ...t, result: msg.result } : t
          )
        }))
        break
      case 'step_progress':
        set((s) => {
          const existing = s.steps.findIndex((e) => e.step === msg.step && e.total === msg.total)
          const next = [...s.steps]
          if (existing >= 0) {
            next[existing] = { ...next[existing], summary: msg.summary, done: true }
          } else {
            next.push({ step: msg.step, total: msg.total, summary: msg.summary, done: true })
            // 补齐前面未显式完成的步骤为已完成态，避免 checklist 卡住
            for (let i = 1; i < msg.step; i++) {
              if (!next.find((e) => e.step === i)) {
                next.push({ step: i, total: msg.total, summary: '', done: true })
              }
            }
          }
          return { steps: next.sort((a, b) => a.step - b.step) }
        })
        break
      case 'artifact':
        set((s) => ({
          artifacts: [...s.artifacts, { type: msg.artifact_type, filePath: msg.file_path }]
        }))
        break
      case 'usage':
        set((s) => ({
          usage: {
            inputTokens: s.usage.inputTokens + msg.inputTokens,
            outputTokens: s.usage.outputTokens + msg.outputTokens
          }
        }))
        break
      case 'error':
        set({ error: msg.message, status: 'failed', finishedAt: Date.now() })
        break
      case 'completed':
        set({ status: 'completed', summary: msg.summary, finishedAt: Date.now() })
        pushHistory(set, get)
        break
      case 'status':
        if (msg.status === 'EXECUTING') set({ status: 'executing' })
        break
      default:
        break
    }
  },
  startTask: async () => {
    const { mode, message, goal } = get()
    if (!message.trim()) return
    set({
      status: 'executing',
      chunks: '',
      summary: '',
      thinking: [],
      toolLogs: [],
      steps: [],
      artifacts: [],
      error: null,
      usage: { inputTokens: 0, outputTokens: 0 },
      startedAt: Date.now(),
      finishedAt: null,
      goal: goal || message
    })
    const res = await api.startTask({ mode, message })
    if (res.error) {
      set({ status: 'failed', error: res.error })
    } else {
      set({ taskId: res.taskId })
    }
  }
}))

function pushHistory(
  set: (partial: Partial<TaskState> | ((s: TaskState) => Partial<TaskState>)) => void,
  get: () => TaskState
) {
  const s = get()
  if (!s.startedAt) return
  const entry: HistoryEntry = {
    id: s.taskId || `t-${Date.now()}`,
    title: s.goal || s.message.slice(0, 40),
    mode: s.mode,
    status: s.status,
    finishedAt: s.finishedAt || Date.now(),
    stepCount: s.steps.length,
    tokens: s.usage.inputTokens + s.usage.outputTokens
  }
  const next = [entry, ...s.history.filter((h) => h.id !== entry.id)].slice(0, HISTORY_MAX)
  saveHistoryToStorage(next)
  set({ history: next })
}
