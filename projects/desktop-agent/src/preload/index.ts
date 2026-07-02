import { contextBridge, ipcRenderer } from 'electron'

type StdoutMessage = Record<string, unknown>

const api = {
  startTask: (args: { mode: 'work' | 'code'; message: string; workspaceDir?: string; maxIterations?: number; autoApproveLow?: boolean; sessionId?: string; history?: unknown[] }) =>
    ipcRenderer.invoke('agent:startTask', args) as Promise<{ taskId: string; error?: string }>,
  saveSessionMessages: (sessionId: string, messages: unknown[]) =>
    ipcRenderer.invoke('session:saveMessages', { sessionId, messages }) as Promise<{ success: boolean; error?: string }>,
  loadSessionMessages: (sessionId: string) =>
    ipcRenderer.invoke('session:loadMessages', sessionId) as Promise<unknown[]>,
  deleteSessionMessages: (sessionId: string) =>
    ipcRenderer.invoke('session:deleteMessages', sessionId) as Promise<{ success: boolean; error?: string }>,
  onAgentEvent: (fn: (msg: StdoutMessage) => void) => {
    const listener = (_e: unknown, msg: StdoutMessage) => fn(msg)
    ipcRenderer.on('agent:event', listener)
    return () => ipcRenderer.removeListener('agent:event', listener)
  },
  pauseTask: (taskId: string) =>
    ipcRenderer.invoke('agent:pause', { taskId }) as Promise<void>,
  resumeTask: (taskId: string) =>
    ipcRenderer.invoke('agent:resume', { taskId }) as Promise<void>,
  cancelTask: (taskId: string) =>
    ipcRenderer.invoke('agent:cancel', { taskId }) as Promise<void>,
  rollbackTask: (taskId: string) =>
    ipcRenderer.invoke('agent:rollback', { taskId }) as Promise<{ success: boolean }>,
  sendApproval: (requestId: string, approved: boolean) =>
    ipcRenderer.invoke('agent:approval', { requestId, approved }) as Promise<void>,
  sendPlanResponse: (requestId: string, decision: 'approve' | 'reject_stop' | 'reject_revise', feedback?: string) =>
    ipcRenderer.invoke('agent:planResponse', { requestId, decision, feedback }) as Promise<void>,
  appendInput: (taskId: string, message: string, mode?: 'inject' | 'queue') =>
    ipcRenderer.invoke('agent:appendInput', { taskId, message, mode }) as Promise<void>,
  configGet: (key: string) => ipcRenderer.invoke('config:get', key) as Promise<unknown>,
  saveModelConfig: (cfg: { providerId: string; model: string; apiKey: string; apiBaseUrl: string; apiFormat: 'openai' | 'anthropic'; contextLimit: number; customProviderId?: string; autoApproveLow?: boolean }) =>
    ipcRenderer.invoke('config:saveModel', cfg) as Promise<{ success: boolean }>,
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
  traceList: (limit?: number) => ipcRenderer.invoke('trace:list', limit) as Promise<unknown[]>,
  traceGet: (traceId: string) => ipcRenderer.invoke('trace:get', traceId) as Promise<unknown>,
  openFiles: () => ipcRenderer.invoke('dialog:openFiles') as Promise<unknown[]>
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
