import type { StdoutMessage } from '../../agent/src/protocol'

declare global {
  interface Window {
    api: {
      startTask: (args: { mode: 'work' | 'code'; message: string; workspaceDir?: string }) =>
        Promise<{ taskId: string; error?: string }>
      onAgentEvent: (fn: (msg: StdoutMessage) => void) => () => void
      configGet: (key: string) => Promise<unknown>
      openExternal: (url: string) => Promise<void>
    }
  }
}

declare module '*.png' {
  const src: string
  export default src
}

export {}
