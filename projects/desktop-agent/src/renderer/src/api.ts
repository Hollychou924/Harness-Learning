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
  openExternal: async () => {}
}

export const api: Api = (globalThis as { api?: Api }).api ?? empty
