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

export interface TaskState {
  status: TaskStatus
  taskId: string | null
  mode: 'work' | 'code'
  message: string
  chunks: string
  thinking: string[]
  toolLogs: ToolLogEntry[]
  usage: { inputTokens: number; outputTokens: number }
  error: string | null
  setMode: (m: 'work' | 'code') => void
  setMessage: (s: string) => void
  startTask: () => Promise<void>
  reset: () => void
  appendEvent: (msg: StdoutMessage) => void
}

const initial = {
  status: 'idle' as TaskStatus,
  taskId: null as string | null,
  mode: 'work' as 'work' | 'code',
  message: '',
  chunks: '',
  thinking: [] as string[],
  toolLogs: [] as ToolLogEntry[],
  usage: { inputTokens: 0, outputTokens: 0 },
  error: null as string | null
}

export const useTaskStore = create<TaskState>((set, get) => ({
  ...initial,
  setMode: (m) => set({ mode: m }),
  setMessage: (s) => set({ message: s }),
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
      case 'usage':
        set((s) => ({ usage: { inputTokens: s.usage.inputTokens + msg.inputTokens, outputTokens: s.usage.outputTokens + msg.outputTokens } }))
        break
      case 'error':
        set({ error: msg.message, status: 'failed' })
        break
      case 'completed':
        set({ status: 'completed' })
        break
      case 'status':
        if (msg.status === 'EXECUTING') set({ status: 'executing' })
        break
      default:
        break
    }
  },
  startTask: async () => {
    const { mode, message } = get()
    if (!message.trim()) return
    set({ status: 'executing', chunks: '', thinking: [], toolLogs: [], error: null, usage: { inputTokens: 0, outputTokens: 0 } })
    const res = await api.startTask({ mode, message })
    if (res.error) {
      set({ status: 'failed', error: res.error })
    } else {
      set({ taskId: res.taskId })
    }
  }
}))
