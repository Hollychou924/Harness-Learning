// Turn/Item 状态机：把 agent 吐出的 turn_started/item_started/item_delta/item_completed/turn_completed
// 事件序列，转成渲染层可用的 Turn[] 数据，并派生出给 LLM 用的精简对话历史(AgentMessage[])
// 依据 2026-07-02 复刻并超越 Codex 展示逻辑方案 · 阶段1
import type { StdoutMessage, AgentMessage, MessageAttachment } from '../../../agent/src/protocol'
import type { Item, ReasoningItem, AgentMessageItem, ToolCallItem, Turn, UserMessageItem } from '../../../agent/src/items'

/** 把一条 item_delta 应用到条目上，按 target.field 精确拼接到对应字段/分段 */
export function applyItemDelta(item: Item, target: { field: string; index?: number }, delta: string): Item {
  if (item.type === 'agentMessage' && target.field === 'agentMessageText') {
    const next: AgentMessageItem = { ...item, text: item.text + delta }
    return next
  }
  if (item.type === 'reasoning' && target.field === 'reasoningSummary') {
    const idx = target.index ?? 0
    const summary = [...item.summary]
    summary[idx] = (summary[idx] || '') + delta
    return { ...item, summary } as ReasoningItem
  }
  if (item.type === 'reasoning' && target.field === 'reasoningContent') {
    const idx = target.index ?? 0
    const content = [...item.content]
    content[idx] = (content[idx] || '') + delta
    return { ...item, content } as ReasoningItem
  }
  if (item.type === 'toolCall' && target.field === 'toolOutput') {
    const next: ToolCallItem = { ...item, result: (item.result || '') + delta }
    return next
  }
  return item
}

export interface TurnsReducerState {
  turns: Turn[]
  currentTurn: Turn | null
}

/** 单条 stdout 事件对 turns 状态的增量更新，纯函数，不含副作用 */
export function reduceTurnsEvent(state: TurnsReducerState, msg: StdoutMessage): TurnsReducerState {
  switch (msg.type) {
    case 'turn_started':
      return { ...state, currentTurn: { id: msg.turn_id, status: 'running', startedAt: Date.now(), items: [] } }
    case 'item_started': {
      if (!state.currentTurn || state.currentTurn.id !== msg.turn_id) return state
      return {
        ...state,
        currentTurn: { ...state.currentTurn, items: [...state.currentTurn.items, msg.item] }
      }
    }
    case 'item_delta': {
      if (!state.currentTurn || state.currentTurn.id !== msg.turn_id) return state
      const items = state.currentTurn.items.map((it) =>
        it.id === msg.item_id ? applyItemDelta(it, msg.target as { field: string; index?: number }, msg.delta) : it
      )
      return { ...state, currentTurn: { ...state.currentTurn, items } }
    }
    case 'item_completed': {
      if (!state.currentTurn || state.currentTurn.id !== msg.turn_id) return state
      const items = state.currentTurn.items.map((it) => (it.id === msg.item.id ? msg.item : it))
      return { ...state, currentTurn: { ...state.currentTurn, items } }
    }
    case 'turn_completed': {
      if (!state.currentTurn || state.currentTurn.id !== msg.turn_id) return state
      // 取消时把正在运行的工具标记为 stopped（来自综合方案：用户主动停止用 stopped 态）
      const items = msg.status === 'cancelled'
        ? state.currentTurn.items.map((it) => {
            if (it.type === 'toolCall' && (it.status === 'running' || it.status === 'pending')) {
              return { ...it, status: 'stopped' as const, finishedAt: Date.now() }
            }
            if (it.type === 'reasoning' && it.status === 'running') {
              return { ...it, status: 'stopped' as const, finishedAt: Date.now() }
            }
            return it
          })
        : state.currentTurn.items
      const finished: Turn = { ...state.currentTurn, items, status: msg.status, finishedAt: Date.now() }
      return { turns: [...state.turns, finished], currentTurn: null }
    }
    default:
      return state
  }
}

/** 找到某一轮里最后一个 agentMessage(final_answer) 的正文，作为该轮的"最终回复" */
export function getFinalAnswerOfTurn(turn: Turn | null): string {
  if (!turn) return ''
  for (let i = turn.items.length - 1; i >= 0; i--) {
    const it = turn.items[i]
    if (it.type === 'agentMessage' && it.phase === 'final_answer') return it.text
  }
  return ''
}

function userContentToMessage(item: UserMessageItem): AgentMessage {
  const text = item.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '')
    .join('')
  const attachments: MessageAttachment[] = item.content
    .filter((c) => c.type === 'image' || c.type === 'file')
    .map((c, index) => ({
      type: c.type === 'image' ? 'image' : 'text',
      name: c.name || (c.type === 'image' ? `图片${index + 1}` : `文档${index + 1}`),
      mime: c.mime || (c.type === 'image' ? 'image/png' : 'text/plain'),
      size: c.size || 0,
      dataUrl: c.type === 'image' ? c.url : undefined,
      textContent: c.type === 'file' ? c.textContent : undefined
    }))

  return {
    role: 'user',
    content: text,
    ...(attachments.length > 0 ? { attachments } : {})
  }
}

/** 从完整的 turns 序列派生出给 LLM 用的精简对话历史，不含思考/审批等展示专用条目 */
export function deriveAgentMessages(turns: Turn[]): AgentMessage[] {
  const messages: AgentMessage[] = []
  for (const turn of turns) {
    let assistantText = ''
    const pendingToolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = []
    const toolResults: Array<{ id: string; content: string }> = []
    for (const item of turn.items) {
      if (item.type === 'userMessage') {
        messages.push(userContentToMessage(item))
      } else if (item.type === 'agentMessage' && item.phase === 'final_answer') {
        assistantText = item.text
      } else if (item.type === 'toolCall') {
        pendingToolCalls.push({
          id: item.id,
          type: 'function',
          function: { name: item.toolName, arguments: JSON.stringify(item.args) }
        })
        toolResults.push({ id: item.id, content: item.result || JSON.stringify({ error: item.error || 'unknown' }) })
      }
    }
    if (pendingToolCalls.length > 0 || assistantText) {
      messages.push({
        role: 'assistant',
        content: assistantText,
        ...(pendingToolCalls.length > 0 ? { tool_calls: pendingToolCalls } : {})
      })
      for (const tr of toolResults) {
        messages.push({ role: 'tool', tool_call_id: tr.id, content: tr.content })
      }
    }
  }
  return messages
}
