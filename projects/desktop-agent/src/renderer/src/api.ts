import type { StdoutMessage } from '../../agent/src/protocol'

// 安全的 api 访问层：preload 未就绪时返回 noop，避免渲染层崩溃
type Api = {
  startTask: (args: { mode: 'work' | 'code'; message: string; workspaceDir?: string }) =>
    Promise<{ taskId: string; error?: string }>
  onAgentEvent: (fn: (msg: StdoutMessage) => void) => () => void
  configGet: (key: string) => Promise<unknown>
  openExternal: (url: string) => Promise<void>
}

const noop = () => {}
const empty: Api = {
  startTask: async () => ({ taskId: '', error: 'preload 未就绪' }),
  onAgentEvent: () => noop,
  configGet: async () => null,
  openExternal: async () => {}
}

export const api: Api = (globalThis as { api?: Api }).api ?? empty
