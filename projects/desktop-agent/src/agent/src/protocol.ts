// 小蓝鲸 Agent 子进程与主进程的 stdio JSON Lines 协议
// 2026-07-02 起改为 Turn/Item 事件模型（复刻并超越 Codex 展示逻辑 · 阶段1）
// 每轮对话(Turn)由一串条目(Item)组成，条目独立带 id/状态/时间戳，流式增量精确定位到条目的具体字段/分段

import type { Item, ItemStatus, DeltaTarget, Turn } from './items.js'

export type TaskMode = 'work' | 'code'

export interface AgentConfig {
  provider: 'anthropic' | 'openai' | 'deepseek'
  model: string
  apiBaseUrl?: string
  apiKey: string
  maxIterations: number
  workspaceDir?: string
  providerId?: string
  apiFormat?: 'openai' | 'anthropic'
  contextLimit?: number
  customProviderId?: string
  approvalMode?: 'always_ask' | 'risk_only' | 'auto'
  autoApproveLow?: boolean
  /** 思考深度：auto=按模型能力自动、off=关闭。默认 auto */
  thinkingLevel?: 'auto' | 'off'
  /** 思考配置（由 preset 注入，agent 层读取用于请求参数） */
  thinkingConfig?: {
    bodyParams: Record<string, unknown>
    disabledBodyParams?: Record<string, unknown>
    forceTemperature?: number
  }
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
  attachments?: MessageAttachment[]
  /** Anthropic 扩展思考块：回传给下一轮请求必须带 thinking + signature，否则 API 报 400 */
  thinkingBlocks?: Array<{ type: 'thinking'; thinking: string; signature: string }>
}

// 多模态附件：图片/文本，随用户消息一起传给模型
export interface MessageAttachment {
  type: 'image' | 'text' | 'file'
  name: string
  mime: string
  size: number
  /** 图片：data URL（data:image/png;base64,...） */
  dataUrl?: string
  /** 文本类文件：提取的纯文本内容 */
  textContent?: string
}

// 主进程 -> Agent (stdin)
export type StdinMessage =
  | { type: 'chat_request'; session_id: string; message: string; config: AgentConfig; history?: AgentMessage[]; workspace_dir?: string; attachments?: MessageAttachment[] }
  | { type: 'task_control'; task_id: string; action: 'pause' | 'resume' | 'cancel' | 'rollback' }
  | { type: 'approval_response'; request_id: string; approved: boolean; scope?: 'once' | 'task' | 'always' }
  | { type: 'question_response'; request_id: string; selected_option_ids?: string[]; custom_answer?: string; skipped?: boolean }
  | { type: 'append_input'; task_id: string; message: string; mode?: 'inject' | 'queue' }
  | { type: 'plan_response'; request_id: string; decision: 'approve' | 'reject_stop' | 'reject_revise'; feedback?: string }
  | { type: 'continuation_response'; task_id: string; decision: 'continue' | 'stop' | 'split' }
  // 测试连接：主进程把一份待测 AgentConfig 发给 agent，让 agent 用真实 provider 跑一次最小流式探测，
  // 保证"测试连接"与"真实对话"走同一条请求路径（同样的 client、鉴权、baseURL、stream:true、字段构造）
  | { type: 'test_request'; request_id: string; config: AgentConfig }
  // 标题总结：把首条 query + 助手回复发给 agent，用真实 provider 跑一次无工具的一次性调用，回传 ≤10 字短标题
  | { type: 'summarize_title_request'; request_id: string; config: AgentConfig; user_query: string; assistant_reply: string }

// Agent -> 主进程 (stdout)：Turn/Item 事件模型
export type StdoutMessage =
  // 一轮对话开始/结束
  | { type: 'turn_started'; turn_id: string }
  | { type: 'turn_completed'; turn_id: string; status: 'completed' | 'failed' | 'cancelled' }
  // 条目生命周期：出现 -> (流式增量)* -> 定稿
  | { type: 'item_started'; turn_id: string; item: Item }
  | { type: 'item_delta'; turn_id: string; item_id: string; target: DeltaTarget; delta: string }
  | { type: 'item_completed'; turn_id: string; item: Item }
  | { type: 'item_status_changed'; turn_id: string; item_id: string; status: ItemStatus }
  // 审批/计划的用户决策结果（决策本身也会同步进对应 item，这里额外发一份用于旧组件兼容）
  | { type: 'approval_request'; request_id: string; tool_name: string; args: Record<string, unknown>; risk_level: 'low' | 'medium' | 'high' | 'critical'; impact: string; can_rollback: boolean }
  | { type: 'plan_proposed'; request_id: string; plan: string; steps: PlanStep[] }
  | { type: 'question_proposed'; request_id: string; question: string; detail?: string; options: QuestionOption[]; multiple: boolean; allow_custom: boolean; allow_skip: boolean; prompts?: QuestionPrompt[] }
  | { type: 'continuation_request'; task_id: string; current_step: number; hint: string }
  | { type: 'todo_update'; todos: TodoItem[] }
  // 用量与产物
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'status'; status: string; message?: string }
  | { type: 'artifact'; artifact_type: 'diff' | 'report' | 'file' | 'preview' | 'evidence' | 'task_summary'; file_path: string }
  | { type: 'error'; message: string }
  | { type: 'completed'; task_id: string; summary: string; messages?: AgentMessage[] }
  | { type: 'subtask_started'; subtask_id: string; title: string; agent_id?: string }
  | { type: 'subtask_completed'; subtask_id: string; title: string; duration_ms: number; tool_count: number; tokens: number }
  | { type: 'subtask_failed'; subtask_id: string; title: string; error: string }
  // 测试连接结果：success=true 表示首个流式分片已到达，端点可用；error 为面向用户的可操作提示
  | { type: 'test_result'; request_id: string; success: boolean; error?: string; message?: string; latencyMs?: number }
  // 标题总结结果：title 为 ≤10 字短标题；失败时 error 给出原因，调用方保留原标题
  | { type: 'summarize_title_result'; request_id: string; success: boolean; title?: string; error?: string }

export interface QuestionOption {
  id: string
  label: string
  description?: string
}

export interface QuestionPrompt {
  id: string
  question: string
  detail?: string
  options: QuestionOption[]
  multiple: boolean
  allowCustom: boolean
  allowSkip: boolean
}

export interface PlanStep {
  step: number
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'removed'
}

export interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}

export function send(msg: StdoutMessage): void {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

export type { Item, ItemStatus, DeltaTarget, Turn }
