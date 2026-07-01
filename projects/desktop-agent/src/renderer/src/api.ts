import type { StdoutMessage } from '../../agent/src/protocol'

type Api = {
  startTask: (args: { mode: 'work' | 'code'; message: string; workspaceDir?: string }) =>
    Promise<{ taskId: string; error?: string }>
  onAgentEvent: (fn: (msg: StdoutMessage) => void) => () => void
  pauseTask: (taskId: string) => Promise<void>
  resumeTask: (taskId: string) => Promise<void>
  cancelTask: (taskId: string) => Promise<void>
  rollbackTask: (taskId: string) => Promise<{ success: boolean }>
  sendApproval: (requestId: string, approved: boolean) => Promise<void>
  appendInput: (taskId: string, message: string) => Promise<void>
  configGet: (key: string) => Promise<unknown>
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
  appendInput: async () => {},
  configGet: async () => null,
  openExternal: async () => {}
}

export const api: Api = (globalThis as { api?: Api }).api ?? empty
