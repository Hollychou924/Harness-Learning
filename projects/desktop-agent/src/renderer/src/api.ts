import type { StdoutMessage } from '../../agent/src/protocol'

export interface AttachmentFile {
  name: string
  type: 'image' | 'text' | 'file'
  size: number
  mime: string
  dataUrl?: string
  textContent?: string
}

export interface ModelConfig {
  providerId: string
  model: string
  apiKey: string
  apiBaseUrl: string
  apiFormat: 'openai' | 'anthropic'
  contextLimit: number
  customProviderId?: string
  autoApproveLow?: boolean
}

export interface TraceMeta {
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

export interface TraceEvent {
  ts: number
  phase: string
  type: string
  data: Record<string, unknown>
}

export interface TraceDetail {
  meta: TraceMeta | null
  events: TraceEvent[]
}

type Api = {
  startTask: (args: { mode: 'work' | 'code'; message: string; workspaceDir?: string; maxIterations?: number; autoApproveLow?: boolean; sessionId?: string; history?: unknown[] }) =>
    Promise<{ taskId: string; error?: string }>
  saveSessionMessages: (sessionId: string, messages: unknown[]) => Promise<{ success: boolean; error?: string }>
  loadSessionMessages: (sessionId: string) => Promise<unknown[]>
  deleteSessionMessages: (sessionId: string) => Promise<{ success: boolean; error?: string }>
  onAgentEvent: (fn: (msg: StdoutMessage) => void) => () => void
  pauseTask: (taskId: string) => Promise<void>
  resumeTask: (taskId: string) => Promise<void>
  cancelTask: (taskId: string) => Promise<void>
  rollbackTask: (taskId: string) => Promise<{ success: boolean }>
  sendApproval: (requestId: string, approved: boolean) => Promise<void>
  sendPlanResponse: (requestId: string, decision: 'approve' | 'reject_stop' | 'reject_revise', feedback?: string) => Promise<void>
  appendInput: (taskId: string, message: string, mode?: 'inject' | 'queue') => Promise<void>
  configGet: (key: string) => Promise<unknown>
  saveModelConfig: (cfg: ModelConfig) => Promise<{ success: boolean }>
  openExternal: (url: string) => Promise<void>
  openFiles: () => Promise<AttachmentFile[]>
  traceList: (limit?: number) => Promise<TraceMeta[]>
  traceGet: (traceId: string) => Promise<TraceDetail>
}

const noop = () => {}
const empty: Api = {
  startTask: async () => ({ taskId: '', error: 'preload 未就绪' }),
  saveSessionMessages: async () => ({ success: false }),
  loadSessionMessages: async () => [],
  deleteSessionMessages: async () => ({ success: false }),
  onAgentEvent: () => noop,
  pauseTask: async () => {},
  resumeTask: async () => {},
  cancelTask: async () => {},
  rollbackTask: async () => ({ success: false }),
  sendApproval: async () => {},
  sendPlanResponse: async () => {},
  appendInput: async () => {},
  configGet: async () => null,
  saveModelConfig: async () => ({ success: false }),
  openExternal: async () => {},
  openFiles: async () => [],
  traceList: async () => [],
  traceGet: async () => ({ meta: null, events: [] })
}

export const api: Api = (globalThis as { api?: Api }).api ?? empty
