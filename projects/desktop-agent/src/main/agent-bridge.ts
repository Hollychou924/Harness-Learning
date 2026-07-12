import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline'
import { app } from 'electron'
import type { StdoutMessage, StdinMessage, AgentConfig, AgentMessage, MessageAttachment } from '../agent/src/protocol.js'

// Agent 子进程管理：启动、stdio 收发（依据 docs/09 第三章）
export class AgentBridge {
  private proc: ChildProcessWithoutNullStreams | null = null
  private listeners = new Set<(msg: StdoutMessage) => void>()
  private exitListeners = new Set<() => void>()
  /** 当前运行的 turn_id，用于 cancel 时补发 stopped 状态 */
  private currentTurnId: string | null = null

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
        // 追踪当前 turn_id，cancel 时补发 stopped
        if (msg.type === 'turn_started') this.currentTurnId = msg.turn_id
        else if (msg.type === 'turn_completed') this.currentTurnId = null
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
      this.currentTurnId = null
      this.exitListeners.forEach((fn) => fn())
    })
  }

  onMessage(fn: (msg: StdoutMessage) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  onExit(fn: () => void): () => void {
    this.exitListeners.add(fn)
    return () => this.exitListeners.delete(fn)
  }

  send(msg: StdinMessage): void {
    if (!this.proc) this.start()
    this.proc?.stdin.write(JSON.stringify(msg) + '\n')
  }

  startTask(session_id: string, message: string, config: AgentConfig, workspace_dir?: string, history?: unknown[], attachments?: MessageAttachment[], mode?: 'work' | 'code'): void {
    this.send({ type: 'chat_request', session_id, message, config, workspace_dir, history: history as AgentMessage[] | undefined, attachments, mode })
  }

  /** 取消当前任务：kill 前补发 stopped + turn_completed: cancelled，让 UI 立即反映停止态 */
  cancelAndNotify(): void {
    if (this.currentTurnId) {
      const turnId = this.currentTurnId
      this.currentTurnId = null
      // 补发 turn_completed: cancelled，渲染层 turns reducer 会把 currentTurn 收尾
      const fakeMsg = { type: 'turn_completed' as const, turn_id: turnId, status: 'cancelled' as const }
      this.listeners.forEach((fn) => fn(fakeMsg))
    }
    this.proc?.kill()
    this.proc = null
  }

  stop(): void {
    this.proc?.kill()
    this.proc = null
  }

  // 测试连接：把待测配置发给 agent 子进程，复用真实 provider 跑一次最小流式探测
  testModel(config: AgentConfig): Promise<{ success: boolean; error?: string; message?: string; latencyMs?: number }> {
    const requestId = randomUUID()
    return new Promise((resolveP) => {
      const onResult = (msg: StdoutMessage) => {
        if (msg.type === 'test_result' && msg.request_id === requestId) {
          clearTimeout(guard)
          this.listeners.delete(onResult)
          resolveP({ success: msg.success, error: msg.error, message: msg.message, latencyMs: msg.latencyMs })
        }
      }
      // 兜底：30s 内若 agent 无响应，主动释放监听并返回失败（agent 侧已有 15s 墙钟）
      const guard = setTimeout(() => {
        this.listeners.delete(onResult)
        resolveP({ success: false, error: '测试连接超时，agent 未响应，请重试' })
      }, 30_000)
      this.listeners.add(onResult)
      this.send({ type: 'test_request', request_id: requestId, config })
    })
  }

  // 标题总结：把首条 query + 助手回复发给 agent，复用真实 provider 跑一次无工具一次性调用，回传 ≤10 字短标题
  summarizeTitle(config: AgentConfig, userQuery: string, assistantReply: string): Promise<{ success: boolean; title?: string; error?: string }> {
    const requestId = randomUUID()
    return new Promise((resolveP) => {
      const onResult = (msg: StdoutMessage) => {
        if (msg.type === 'summarize_title_result' && msg.request_id === requestId) {
          clearTimeout(guard)
          this.listeners.delete(onResult)
          resolveP({ success: msg.success, title: msg.title, error: msg.error })
        }
      }
      const guard = setTimeout(() => {
        this.listeners.delete(onResult)
        resolveP({ success: false, error: '标题总结超时，agent 未响应' })
      }, 30_000)
      this.listeners.add(onResult)
      this.send({ type: 'summarize_title_request', request_id: requestId, config, user_query: userQuery, assistant_reply: assistantReply })
    })
  }
}

export const agentBridge = new AgentBridge()
