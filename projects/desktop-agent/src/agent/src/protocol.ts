// 小蓝鲸 Agent 子进程与主进程的 stdio JSON Lines 协议
// 与 docs/09-electron-ipc-contract.md 第三章对应

export type TaskMode = 'work' | 'code'

export interface AgentConfig {
  provider: 'anthropic' | 'openai' | 'deepseek'
  model: string
  apiBaseUrl?: string
  apiKey: string
  maxIterations: number
  workspaceDir?: string
  embedding?: {
    apiBaseUrl: string
    model: string
  }
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
}

// 主进程 -> Agent (stdin)
export type StdinMessage =
  | { type: 'chat_request'; session_id: string; message: string; config: AgentConfig; history?: AgentMessage[]; workspace_dir?: string }
  | { type: 'task_control'; task_id: string; action: 'pause' | 'resume' | 'cancel' | 'rollback' }
  | { type: 'approval_response'; request_id: string; approved: boolean }
  | { type: 'append_input'; task_id: string; message: string }

// Agent -> 主进程 (stdout)
export type StdoutMessage =
  | { type: 'chunk'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown>; id: string }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'approval_request'; request_id: string; tool_name: string; args: Record<string, unknown>; risk_level: 'low' | 'medium' | 'high' | 'critical'; impact: string; can_rollback: boolean }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'status'; status: string; message?: string }
  | { type: 'step_progress'; task_id: string; step: number; total: number; summary: string }
  | { type: 'artifact'; artifact_type: 'diff' | 'report' | 'file' | 'preview' | 'evidence' | 'task_summary'; file_path: string }
  | { type: 'error'; message: string }
  | { type: 'completed'; task_id: string; summary: string }

export function send(msg: StdoutMessage): void {
  process.stdout.write(JSON.stringify(msg) + '\n')
}
