// Turn / Item 数据模型：一轮对话由一串条目(Item)组成，每个条目独立带 id、状态、时间戳
// 替代旧版扁平消息事件(chunk/thinking/tool_call...)，让历史可回看每一步的完整过程
// 依据 2026-07-02 复刻 Codex 展示逻辑方案 · 阶段1

export type ItemStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface UserMessageContent {
  type: 'text' | 'image'
  text?: string
  url?: string
}

export interface UserMessageItem {
  type: 'userMessage'
  id: string
  content: UserMessageContent[]
}

/** phase 区分这条助手消息的角色：final_answer 是要展示给用户的正式回复 */
export type AgentMessagePhase = 'final_answer' | 'commentary'

export interface AgentMessageItem {
  type: 'agentMessage'
  id: string
  text: string
  phase: AgentMessagePhase
}

/**
 * 思考条目：summary 是模型自己总结的要点(默认展示)，content 是完整原文(用户主动展开才看)
 * 两者都是字符串数组，流式追加时按数组末项拼接
 */
export interface ReasoningItem {
  type: 'reasoning'
  id: string
  summary: string[]
  content: string[]
  status: ItemStatus
  startedAt: number
  finishedAt?: number
}

/** 工具调用的具体种类，用于渲染层挑选对应的语义化文案 */
export type ToolKind =
  | 'fetch_page'
  | 'parse_page'
  | 'list_files'
  | 'read_file'
  | 'write_file'
  | 'create_docx'
  | 'create_xlsx'
  | 'shell'
  | 'mcp'
  | 'unknown'

export interface ToolCallItem {
  type: 'toolCall'
  id: string
  kind: ToolKind
  toolName: string
  args: Record<string, unknown>
  status: ItemStatus
  result?: string
  /** 提炼出的一句话结果摘要，用于折叠态展示，不用点开详情就知道"有没有用" */
  resultSummary?: string
  error?: string
  /** 本次调用之前是否发生过失败重试，用于渲染"失败→重试→成功"链条 */
  retryOfItemId?: string
  startedAt: number
  finishedAt?: number
}

export interface PlanStepItem {
  step: number
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'removed'
}

export interface PlanItem {
  type: 'plan'
  id: string
  plan: string
  steps: PlanStepItem[]
  decision: 'pending' | 'approved' | 'rejected' | 'revise_requested'
  requestId: string
}

export interface ApprovalItem {
  type: 'approval'
  id: string
  requestId: string
  toolName: string
  args: Record<string, unknown>
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  impact: string
  canRollback: boolean
  decision: 'pending' | 'approved' | 'rejected' | 'timeout'
}

export type Item =
  | UserMessageItem
  | AgentMessageItem
  | ReasoningItem
  | ToolCallItem
  | PlanItem
  | ApprovalItem

export type TurnStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export interface Turn {
  id: string
  status: TurnStatus
  startedAt: number
  finishedAt?: number
  items: Item[]
}

// ---- 流式增量的定位目标：告诉前端"这段文字该拼到条目的哪个字段/哪一段" ----
export type DeltaTarget =
  | { field: 'agentMessageText' }
  | { field: 'reasoningSummary'; index: number }
  | { field: 'reasoningContent'; index: number }
  | { field: 'toolOutput' }
