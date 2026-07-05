import { contextBridge, ipcRenderer } from 'electron'

type StdoutMessage = Record<string, unknown>

const api = {
  startTask: (args: { mode: 'work' | 'code'; message: string; workspaceDir?: string; maxIterations?: number; approvalMode?: 'always_ask' | 'risk_only' | 'auto'; autoApproveLow?: boolean; sessionId?: string; history?: unknown[]; attachments?: unknown[] }) =>
    ipcRenderer.invoke('agent:startTask', args) as Promise<{ taskId: string; traceId?: string; error?: string }>,
  saveSessionMessages: (sessionId: string, messages: unknown[]) =>
    ipcRenderer.invoke('session:saveMessages', { sessionId, messages }) as Promise<{ success: boolean; error?: string }>,
  loadSessionMessages: (sessionId: string) =>
    ipcRenderer.invoke('session:loadMessages', sessionId) as Promise<unknown[]>,
  deleteSessionMessages: (sessionId: string) =>
    ipcRenderer.invoke('session:deleteMessages', sessionId) as Promise<{ success: boolean; error?: string }>,
  saveSessionTurns: (sessionId: string, turns: unknown[]) =>
    ipcRenderer.invoke('session:saveTurns', { sessionId, turns }) as Promise<{ success: boolean; error?: string }>,
  loadSessionTurns: (sessionId: string) =>
    ipcRenderer.invoke('session:loadTurns', sessionId) as Promise<unknown[]>,
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
  sendApproval: (requestId: string, approved: boolean, scope?: 'once' | 'task' | 'always') =>
    ipcRenderer.invoke('agent:approval', { requestId, approved, scope }) as Promise<void>,
  sendQuestionResponse: (requestId: string, selectedOptionIds?: string[], customAnswer?: string, skipped?: boolean) =>
    ipcRenderer.invoke('agent:questionResponse', { requestId, selectedOptionIds, customAnswer, skipped }) as Promise<void>,
  sendPlanResponse: (requestId: string, decision: 'approve' | 'reject_stop' | 'reject_revise', feedback?: string) =>
    ipcRenderer.invoke('agent:planResponse', { requestId, decision, feedback }) as Promise<void>,
  appendInput: (taskId: string, message: string, mode?: 'inject' | 'queue') =>
    ipcRenderer.invoke('agent:appendInput', { taskId, message, mode }) as Promise<void>,
  configGet: (key: string) => ipcRenderer.invoke('config:get', key) as Promise<unknown>,
  setThemeMode: (themeMode: 'system' | 'light' | 'dark') =>
    ipcRenderer.invoke('appearance:setThemeMode', themeMode) as Promise<{ success: boolean; themeMode: 'system' | 'light' | 'dark' }>,
  saveModelConfig: (cfg: { providerId: string; model: string; apiKey: string; apiBaseUrl: string; apiFormat: 'openai' | 'anthropic'; contextLimit: number; customProviderId?: string; autoApproveLow?: boolean }) =>
    ipcRenderer.invoke('config:saveModel', cfg) as Promise<{ success: boolean; error?: string }>,
  getModelList: () => ipcRenderer.invoke('config:getModelList') as Promise<{ configs: Array<Record<string, unknown>>; activeId: string | null }>,
  setActiveModel: (modelId: string) => ipcRenderer.invoke('config:setActiveModel', modelId) as Promise<{ success: boolean }>,
  deleteModel: (modelId: string) => ipcRenderer.invoke('config:deleteModel', modelId) as Promise<{ success: boolean }>,
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,
  openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath) as Promise<void>,
  traceList: (limit?: number) => ipcRenderer.invoke('trace:list', limit) as Promise<unknown[]>,
  traceGet: (traceId: string) => ipcRenderer.invoke('trace:get', traceId) as Promise<unknown>,
  traceExport: (traceId?: string) => ipcRenderer.invoke('trace:export', traceId) as Promise<{ success: boolean; path?: string; error?: string }>,
  feedbackCreate: (input: { traceId?: string; category: string; description: string; contact?: string; packageLevel?: 'basic' | 'enhanced' | 'full'; includeConversation?: boolean; includeFileSummary?: boolean; allowDiagnosticPackage?: boolean }) =>
    ipcRenderer.invoke('feedback:create', input) as Promise<{ success: boolean; feedback?: unknown; packagePath?: string; error?: string }>,
  feedbackList: (limit?: number) => ipcRenderer.invoke('feedback:list', limit) as Promise<unknown[]>,
  diagnosticsOverview: (limit?: number) => ipcRenderer.invoke('diagnostics:overview', limit) as Promise<unknown>,
  replayGet: (input: { traceId: string; includeConversation?: boolean; includeFileSummary?: boolean }) =>
    ipcRenderer.invoke('replay:get', input) as Promise<unknown>,
  replayExport: (input: { traceId: string; includeConversation?: boolean; includeFileSummary?: boolean }) =>
    ipcRenderer.invoke('replay:export', input) as Promise<{ success: boolean; path?: string; error?: string }>,
  openFiles: () => ipcRenderer.invoke('dialog:openFiles') as Promise<unknown[]>,
  readAttachmentFile: (filePath: string) => ipcRenderer.invoke('dialog:readAttachmentFile', filePath) as Promise<unknown>,
  pickFolder: () => ipcRenderer.invoke('project:select') as Promise<string | null>,
  createProjectFolder: (name: string) => ipcRenderer.invoke('project:create', name) as Promise<string | null>,
  workspaceListFiles: (workspaceDir?: string, subDir?: string) =>
    ipcRenderer.invoke('workspace:listFiles', { workspaceDir, subDir }) as Promise<{ items: Array<{ name: string; type: string; size: number; path: string }>; error?: string }>,
  workspaceReadFile: (relPath: string, workspaceDir?: string) =>
    ipcRenderer.invoke('workspace:readFile', { relPath, workspaceDir }) as Promise<{ content?: string; truncated?: boolean; error?: string }>,
  workspacePreviewFile: (filePath: string, workspaceDir?: string) =>
    ipcRenderer.invoke('workspace:previewFile', { filePath, workspaceDir }) as Promise<{ kind?: string; content?: string; dataUrl?: string; truncated?: boolean; error?: string }>
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
