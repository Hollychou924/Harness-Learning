import { contextBridge, ipcRenderer } from 'electron'

type StdoutMessage = Record<string, unknown>

const api = {
  startTask: (args: { mode: 'work' | 'code'; message: string; workspaceDir?: string }) =>
    ipcRenderer.invoke('agent:startTask', args) as Promise<{ taskId: string; error?: string }>,
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
  appendInput: (taskId: string, message: string) =>
    ipcRenderer.invoke('agent:appendInput', { taskId, message }) as Promise<void>,
  configGet: (key: string) => ipcRenderer.invoke('config:get', key) as Promise<unknown>,
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
