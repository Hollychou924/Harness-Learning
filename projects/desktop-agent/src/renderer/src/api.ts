import type { StdoutMessage } from '../../agent/src/protocol'

export interface AttachmentFile {
  name: string
  type: 'image' | 'text' | 'file'
  size: number
  mime: string
  dataUrl?: string
  textContent?: string
  sourcePath?: string
  error?: string
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
  hasSavedApiKey?: boolean
}

export interface TraceMeta {
  traceId: string
  runId: string
  taskId: string
  sessionId: string
  conversationId: string
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
  seq?: number
  phase: string
  type: string
  traceId?: string
  taskId?: string
  sessionId?: string
  conversationId?: string
  runId?: string
  stepId?: string
  parentStepId?: string
  data: Record<string, unknown>
}

export interface TraceDetail {
  meta: TraceMeta | null
  events: TraceEvent[]
}

export type DiagnosticPackageLevel = 'basic' | 'enhanced' | 'full'

export interface FeedbackTicket {
  feedbackId: string
  traceId?: string
  taskId?: string
  category: string
  description: string
  contact?: string
  packageLevel: DiagnosticPackageLevel
  includeConversation: boolean
  includeFileSummary: boolean
  allowDiagnosticPackage: boolean
  packagePath?: string
  createdAt: number
}

export interface DiagnosticsOverview {
  total: number
  completed: number
  failed: number
  cancelled: number
  running: number
  failureRate: number
  feedbackCount: number
  failureCategories: Array<{ category: string; count: number }>
  models: Array<{ name: string; total: number; failed: number; inputTokens: number; outputTokens: number }>
  tools: Array<{ name: string; total: number; failed: number }>
  versions: Array<{ name: string; total: number; failed: number }>
}

export interface ReplayStep {
  ts: number
  offsetMs: number
  title: string
  kind: 'user' | 'model' | 'tool' | 'approval' | 'plan' | 'question' | 'file' | 'system' | 'error'
  status?: string
  detail?: string
}

export interface ReplayBundle {
  traceId: string
  generatedAt: string
  privacy: {
    includeConversation: boolean
    includeFileSummary: boolean
  }
  meta: TraceMeta | null
  steps: ReplayStep[]
}

type Api = {
  startTask: (args: { mode: 'work' | 'code'; message: string; workspaceDir?: string; maxIterations?: number; approvalMode?: 'always_ask' | 'risk_only' | 'auto'; autoApproveLow?: boolean; sessionId?: string; history?: unknown[]; attachments?: unknown[] }) =>
    Promise<{ taskId: string; traceId?: string; error?: string }>
  saveSessionMessages: (sessionId: string, messages: unknown[]) => Promise<{ success: boolean; error?: string }>
  loadSessionMessages: (sessionId: string) => Promise<unknown[]>
  deleteSessionMessages: (sessionId: string) => Promise<{ success: boolean; error?: string }>
  saveSessionTurns: (sessionId: string, turns: unknown[]) => Promise<{ success: boolean; error?: string }>
  loadSessionTurns: (sessionId: string) => Promise<unknown[]>
  onAgentEvent: (fn: (msg: StdoutMessage) => void) => () => void
  pauseTask: (taskId: string) => Promise<void>
  resumeTask: (taskId: string) => Promise<void>
  cancelTask: (taskId: string) => Promise<void>
  rollbackTask: (taskId: string) => Promise<{ success: boolean }>
  sendApproval: (requestId: string, approved: boolean, scope?: 'once' | 'task' | 'always') => Promise<void>
  sendQuestionResponse: (requestId: string, selectedOptionIds?: string[], customAnswer?: string, skipped?: boolean) => Promise<void>
  sendPlanResponse: (requestId: string, decision: 'approve' | 'reject_stop' | 'reject_revise', feedback?: string) => Promise<void>
  appendInput: (taskId: string, message: string, mode?: 'inject' | 'queue') => Promise<void>
  configGet: (key: string) => Promise<unknown>
  setThemeMode: (themeMode: 'system' | 'light' | 'dark') => Promise<{ success: boolean; themeMode: 'system' | 'light' | 'dark' }>
  saveModelConfig: (cfg: ModelConfig) => Promise<{ success: boolean; error?: string }>
  getModelList: () => Promise<{ configs: Array<ModelConfig & { _id?: string }>; activeId: string | null }>
  setActiveModel: (modelId: string) => Promise<{ success: boolean }>
  deleteModel: (modelId: string) => Promise<{ success: boolean }>
  openExternal: (url: string) => Promise<void>
  openPath: (filePath: string) => Promise<void>
  openFiles: () => Promise<AttachmentFile[]>
  readAttachmentFile: (filePath: string) => Promise<AttachmentFile>
  pickFolder: () => Promise<string | null>
  createProjectFolder: (name: string) => Promise<string | null>
  workspaceListFiles: (workspaceDir?: string, subDir?: string) => Promise<{ items: Array<{ name: string; type: string; size: number; path: string }>; error?: string }>
  workspaceReadFile: (relPath: string, workspaceDir?: string) => Promise<{ content?: string; truncated?: boolean; error?: string }>
  workspacePreviewFile: (filePath: string, workspaceDir?: string) => Promise<{ kind?: string; content?: string; dataUrl?: string; truncated?: boolean; error?: string }>
  traceList: (limit?: number) => Promise<TraceMeta[]>
  traceGet: (traceId: string) => Promise<TraceDetail>
  traceExport: (traceId?: string) => Promise<{ success: boolean; path?: string; error?: string }>
  feedbackCreate: (input: { traceId?: string; category: string; description: string; contact?: string; packageLevel?: DiagnosticPackageLevel; includeConversation?: boolean; includeFileSummary?: boolean; allowDiagnosticPackage?: boolean }) => Promise<{ success: boolean; feedback?: FeedbackTicket; packagePath?: string; error?: string }>
  feedbackList: (limit?: number) => Promise<FeedbackTicket[]>
  diagnosticsOverview: (limit?: number) => Promise<DiagnosticsOverview>
  replayGet: (input: { traceId: string; includeConversation?: boolean; includeFileSummary?: boolean }) => Promise<ReplayBundle>
  replayExport: (input: { traceId: string; includeConversation?: boolean; includeFileSummary?: boolean }) => Promise<{ success: boolean; path?: string; error?: string }>
}

const noop = () => {}
const empty: Api = {
  startTask: async () => ({ taskId: '', error: 'preload 未就绪' }),
  saveSessionMessages: async () => ({ success: false }),
  loadSessionMessages: async () => [],
  deleteSessionMessages: async () => ({ success: false }),
  saveSessionTurns: async () => ({ success: false }),
  loadSessionTurns: async () => [],
  onAgentEvent: () => noop,
  pauseTask: async () => {},
  resumeTask: async () => {},
  cancelTask: async () => {},
  rollbackTask: async () => ({ success: false }),
  sendApproval: async () => {},
  sendQuestionResponse: async () => {},
  sendPlanResponse: async () => {},
  appendInput: async () => {},
  configGet: async () => null,
  setThemeMode: async (themeMode) => ({ success: false, themeMode }),
  saveModelConfig: async () => ({ success: false }),
  getModelList: async () => ({ configs: [], activeId: null }),
  setActiveModel: async () => ({ success: false }),
  deleteModel: async () => ({ success: false }),
  openExternal: async () => {},
  openPath: async () => {},
  openFiles: async () => [],
  readAttachmentFile: async (filePath: string) => ({
    name: filePath.split('/').pop() || filePath,
    type: 'file',
    size: 0,
    mime: 'application/octet-stream',
    sourcePath: filePath,
    error: 'preload 未就绪'
  }),
  pickFolder: async () => null,
  createProjectFolder: async () => null,
  workspaceListFiles: async () => ({ items: [] }),
  workspaceReadFile: async () => ({}),
  workspacePreviewFile: async () => ({}),
  traceList: async () => [],
  traceGet: async () => ({ meta: null, events: [] }),
  traceExport: async () => ({ success: false, error: 'preload 未就绪' }),
  feedbackCreate: async () => ({ success: false, error: 'preload 未就绪' }),
  feedbackList: async () => [],
  diagnosticsOverview: async () => ({
    total: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    running: 0,
    failureRate: 0,
    feedbackCount: 0,
    failureCategories: [],
    models: [],
    tools: [],
    versions: []
  }),
  replayGet: async (input) => ({
    traceId: input.traceId,
    generatedAt: new Date().toISOString(),
    privacy: { includeConversation: false, includeFileSummary: false },
    meta: null,
    steps: []
  }),
  replayExport: async () => ({ success: false, error: 'preload 未就绪' })
}

export const api: Api = (globalThis as { api?: Api }).api ?? empty
