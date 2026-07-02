import { createInterface } from 'node:readline'
import type { StdinMessage, StdoutMessage, AgentMessage } from './protocol.js'
import { send } from './protocol.js'
import { runReact } from './loop/react.js'
import { resolveApproval } from './approval.js'

// Agent 子进程入口：读 stdin JSON Lines，写 stdout JSON Lines
// 不依赖任何 Electron API（依据 docs/03 第四章进程边界）
const rl = createInterface({ input: process.stdin })

const sessionHistory = new Map<string, AgentMessage[]>()

rl.on('line', (line) => {
  if (!line.trim()) return
  let msg: StdinMessage
  try {
    msg = JSON.parse(line)
  } catch {
    send({ type: 'error', message: 'stdin 消息不是合法 JSON' })
    return
  }
  handleStdin(msg).catch((e) => {
    send({ type: 'error', message: e instanceof Error ? e.message : String(e) })
  })
})

async function handleStdin(msg: StdinMessage): Promise<void> {
  if (msg.type === 'chat_request') {
    const { session_id, message, config, history, workspace_dir, attachments } = msg
    const onEvent = (ev: StdoutMessage) => send(ev)

    onEvent({ type: 'status', status: 'EXECUTING', message: '开始执行任务' })

    try {
      const result = await runReact(
        message,
        config,
        history || sessionHistory.get(session_id) || [],
        onEvent,
        workspace_dir,
        'work',
        session_id,
        attachments
      )
      sessionHistory.set(session_id, result.messages.slice(1))

      // 产出报告产物
      onEvent({
        type: 'artifact',
        artifact_type: 'report',
        file_path: 'inline'
      })

      onEvent({ type: 'completed', task_id: session_id, summary: result.finalText })
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      onEvent({ type: 'error', message: errMsg })
      onEvent({ type: 'completed', task_id: session_id, summary: `任务失败：${errMsg}` })
    }
    return
  }

  if (msg.type === 'task_control') {
    // 一期 Work 不实现暂停/恢复/回滚的运行时，仅回执
    send({ type: 'status', status: msg.action.toUpperCase(), message: `任务 ${msg.action} 已收到` })
    return
  }

  if (msg.type === 'approval_response') {
    resolveApproval(msg.request_id, msg.approved)
    return
  }

  if (msg.type === 'append_input') {
    send({ type: 'thinking', text: '追加输入已收到，一期暂不支持任务中追加' })
    return
  }
}

process.stderr.write('小蓝鲸 Agent 子进程已启动\n')
