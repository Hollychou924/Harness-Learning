import type { StdoutMessage } from '../../agent/src/protocol'

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
  startTask: (args: { mode: 'work' | 'code'; message: string; workspaceDir?: string; maxIterations?: number; autoApproveLow?: boolean }) =>
    Promise<{ taskId: string; error?: string }>
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
  traceList: (limit?: number) => Promise<TraceMeta[]>
  traceGet: (traceId: string) => Promise<TraceDetail>
}

const noop = () => {}
const empty: Api = {
  startTask: async () => ({ taskId: '', error: 'preload 未就绪' }),
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
  traceList: async () => [],
  traceGet: async () => ({ meta: null, events: [] })
}

export const api: Api = (globalThis as { api?: Api }).api ?? empty
