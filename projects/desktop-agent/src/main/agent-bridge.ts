import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { app } from 'electron'
import type { StdoutMessage, StdinMessage, AgentConfig, AgentMessage } from '../agent/src/protocol.js'

// Agent 子进程管理：启动、stdio 收发（依据 docs/09 第三章）
export class AgentBridge {
  private proc: ChildProcessWithoutNullStreams | null = null
  private listeners = new Set<(msg: StdoutMessage) => void>()

  start(): void {
    if (this.proc) return
    const devEntry = resolve(process.env.XLJ_AGENT_DEV || 'src/agent/src/index.ts')
    const isProd = app.isPackaged
    if (isProd) {
      this.proc = spawn(process.execPath, [resolve(__dirname, '../agent/index.js')], {
        env: { ...process.env }
      })
    } else {
      // 开发期用 tsx 跑 TS，避免每次改代码都编译
      this.proc = spawn('pnpm', ['exec', 'tsx', devEntry], {
        env: { ...process.env },
        cwd: app.getAppPath()
      })
    }

    const rl = createInterface({ input: this.proc.stdout })
    rl.on('line', (line) => {
      if (!line.trim()) return
      try {
        const msg = JSON.parse(line) as StdoutMessage
        this.listeners.forEach((fn) => fn(msg))
      } catch {
        // 非 JSON 行忽略（可能为调试输出）
      }
    })

    const errRl = createInterface({ input: this.proc.stderr })
    errRl.on('line', (line) => {
      console.log('[agent]', line)
    })

    this.proc.on('exit', (code) => {
      console.log('[agent] exit', code)
      this.proc = null
    })
  }

  onMessage(fn: (msg: StdoutMessage) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  send(msg: StdinMessage): void {
    if (!this.proc) this.start()
    this.proc?.stdin.write(JSON.stringify(msg) + '\n')
  }

  startTask(session_id: string, message: string, config: AgentConfig, workspace_dir?: string, history?: unknown[]): void {
    this.send({ type: 'chat_request', session_id, message, config, workspace_dir, history: history as AgentMessage[] | undefined })
  }

  stop(): void {
    this.proc?.kill()
    this.proc = null
  }
}

export const agentBridge = new AgentBridge()
