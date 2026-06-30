import { contextBridge, ipcRenderer } from 'electron'

// preload 用 CJS 打包，不 import ESM 模块，类型内联声明避免解析问题
type StdoutMessage = Record<string, unknown>

const api = {
  startTask: (args: { mode: 'work' | 'code'; message: string; workspaceDir?: string }) =>
    ipcRenderer.invoke('agent:startTask', args) as Promise<{ taskId: string; error?: string }>,
  onAgentEvent: (fn: (msg: StdoutMessage) => void) => {
    const listener = (_e: unknown, msg: StdoutMessage) => fn(msg)
    ipcRenderer.on('agent:event', listener)
    return () => ipcRenderer.removeListener('agent:event', listener)
  },
  configGet: (key: string) => ipcRenderer.invoke('config:get', key) as Promise<unknown>,
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
