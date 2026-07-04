import type { AgentConfig, AgentMessage, StdoutMessage, MessageAttachment } from '../protocol.js'
import type { Item, ItemStatus, ToolCallItem, ToolKind } from '../items.js'
import { isSafe, isBlocked } from '../tools/index.js'
import { shellRiskLevel } from '../tools/shell.js'
import { parsePlanArgs, clearPendingPlanRequestId } from '../tools/plan.js'
import { makeTodoExecuteHandler } from '../tools/todo.js'
import { waitForApproval } from '../approval.js'
import { randomUUID } from 'node:crypto'
import { AnthropicProvider, type LlmProvider } from '../providers/anthropic.js'
import { OpenAIProvider } from '../providers/openai.js'
import { buildSystemPrompt } from '../prompt/system.js'
import { summarizeToolResult } from './tool-summary.js'

// ReAct 引擎（依据 docs/01 第三章，参考已验证实现）
// maxIterations 硬上限，到顶兜底收尾，禁止无限转
// 空回复重试一次，工具后报错合成收尾
// 2026-07-02 起改为 Turn/Item 事件模型：本轮内每个思考/工具调用/审批都是独立条目，带 id 可追溯
export interface ReactResult {
  messages: AgentMessage[]
  finalText: string
}

const TOOL_KIND_MAP: Record<string, ToolKind> = {
  fetch_page: 'fetch_page',
  parse_page: 'parse_page',
  list_files: 'list_files',
  read_file: 'read_file',
  write_file: 'write_file',
  create_docx: 'create_docx',
  create_xlsx: 'create_xlsx',
  shell: 'shell'
}

function toolKindOf(name: string): ToolKind {
  return TOOL_KIND_MAP[name] || (name.startsWith('mcp__') ? 'mcp' : 'unknown')
}

export async function runReact(
  userMessage: string,
  config: AgentConfig,
  history: AgentMessage[],
  onEvent: (msg: StdoutMessage) => void,
  workspaceDir?: string,
  mode: 'work' | 'code' = 'work',
  taskId?: string,
  attachments?: MessageAttachment[],
  consumeAppendedInput?: () => string[]
): Promise<ReactResult> {
  const provider: LlmProvider = config.apiFormat === 'openai'
    ? new OpenAIProvider(config)
    : new AnthropicProvider(config)

  const todoExecute = makeTodoExecuteHandler((todos) => {
    onEvent({ type: 'todo_update', todos })
  })
  const { getAvailableTools } = await import('../tools/index.js')
  const tools = await getAvailableTools(workspaceDir)

  const system = buildSystemPrompt(mode, workspaceDir)

  // 文本类附件内容拼入用户消息文字，图片类附件走多模态 content
  const textParts: string[] = [userMessage]
  const imageAttachments: MessageAttachment[] = []
  for (const att of attachments || []) {
    if (att.type === 'image' && att.dataUrl) {
      imageAttachments.push(att)
    } else if (att.textContent) {
      textParts.push(`\n\n--- 附件：${att.name} ---\n${att.textContent}`)
    }
  }
  const userContent = textParts.join('')

  const messages: AgentMessage[] = [
    { role: 'system', content: system },
    ...history,
    {
      role: 'user',
      content: userContent,
      ...(imageAttachments.length > 0 ? { attachments: imageAttachments } : {})
    }
  ]

  const turnId = `turn-${randomUUID()}`
  onEvent({ type: 'turn_started', turn_id: turnId })

  // 每一轮自包含：把用户本次的输入也作为条目发出，历史翻看/时间轴回放时知道"这一轮问了什么"
  const userMessageItemId = `userMessage-${randomUUID()}`
  const userMessageItem: Item = {
    type: 'userMessage',
    id: userMessageItemId,
    content: [
      { type: 'text', text: userMessage },
      ...imageAttachments.map((a) => ({ type: 'image' as const, url: a.dataUrl || '' }))
    ]
  }
  onEvent({ type: 'item_started', turn_id: turnId, item: userMessageItem })
  onEvent({ type: 'item_completed', turn_id: turnId, item: userMessageItem })

  // 标记本轮用户消息是否含图片（用于不支持图片时的退回重试）
  const hasImages = imageAttachments.length > 0

  let finalText = ''
  let emptyRetried = false
  let imagesDisabled = false
  /** 上一个失败的工具调用条目 id，用于把下一次同名重试串成"失败→重试→成功"链条 */
  let lastFailedToolItemId: string | null = null

  function appendRuntimeInputs(appended: string[]): boolean {
    const entries = appended.map((text) => text.trim()).filter(Boolean)
    if (entries.length === 0) return false
    const displayText = entries.length === 1
      ? `\n\n补充要求：${entries[0]}`
      : `\n\n补充要求：\n${entries.map((text, index) => `${index + 1}. ${text}`).join('\n')}`
    const promptText = `用户在任务执行中补充了要求，请从现在开始遵守，并在后续动作和最终答复中体现：\n${entries.map((text, index) => `${index + 1}. ${text}`).join('\n')}`
    messages.push({ role: 'user', content: promptText })

    const appendedItem: Item = {
      type: 'userMessage',
      id: `userMessage-${randomUUID()}`,
      content: [{ type: 'text', text: displayText }]
    }
    onEvent({ type: 'item_started', turn_id: turnId, item: appendedItem })
    onEvent({ type: 'item_completed', turn_id: turnId, item: appendedItem })
    onEvent({ type: 'status', status: 'INFO', message: '补充要求已并入当前任务' })
    return true
  }

  function takeAppendedInputs(): string[] {
    return consumeAppendedInput ? consumeAppendedInput() : []
  }

  for (let iter = 0; iter < config.maxIterations; iter++) {
    appendRuntimeInputs(takeAppendedInputs())

    let assistantText = ''
    let toolUse: { id: string; name: string; args: Record<string, unknown> } | null = null
    let inputTokens = 0
    let outputTokens = 0
    let agentMessageItemId: string | null = null
    let reasoningItemId: string | null = null
    let reasoningStartedAt = 0
    let reasoningCompleted = false
    let reasoningContentIndex = 0
    // 累积本轮思考内容 + signature，回传给下一轮 Anthropic 请求
    let turnThinkingText = ''
    let turnThinkingSignature = ''

    try {
      for await (const ev of provider.stream(messages, config, tools)) {
        if (ev.type === 'thinking' && ev.thinking) {
          if (!reasoningItemId) {
            reasoningItemId = `reasoning-${randomUUID()}`
            reasoningStartedAt = Date.now()
            onEvent({
              type: 'item_started',
              turn_id: turnId,
              item: {
                type: 'reasoning',
                id: reasoningItemId,
                summary: [],
                content: [],
                status: 'running',
                startedAt: reasoningStartedAt
              }
            })
          }
          turnThinkingText += ev.thinking
          if (ev.thinkingSignature) turnThinkingSignature = ev.thinkingSignature
          onEvent({
            type: 'item_delta',
            turn_id: turnId,
            item_id: reasoningItemId,
            target: { field: 'reasoningContent', index: reasoningContentIndex },
            delta: ev.thinking
          })
          reasoningContentIndex++
          continue
        }
        // 第一个 text/tool_use 到来时，把思考条目标记为完成
        // summary = 截断版（前80字），content = 完整原文，保证点开有增量
        if (reasoningItemId && !reasoningCompleted && (ev.type === 'text' || ev.type === 'tool_use')) {
          reasoningCompleted = true
          const summaryText = turnThinkingText.slice(0, 80) + (turnThinkingText.length > 80 ? '…' : '')
          onEvent({
            type: 'item_completed',
            turn_id: turnId,
            item: {
              type: 'reasoning',
              id: reasoningItemId,
              summary: summaryText ? [summaryText] : [],
              content: turnThinkingText ? [turnThinkingText] : [],
              status: 'completed',
              startedAt: reasoningStartedAt || Date.now(),
              finishedAt: Date.now()
            }
          })
        }
        if (ev.type === 'text' && ev.text) {
          if (!agentMessageItemId) {
            agentMessageItemId = `agentMessage-${randomUUID()}`
            onEvent({
              type: 'item_started',
              turn_id: turnId,
              item: { type: 'agentMessage', id: agentMessageItemId, text: '', phase: 'final_answer' }
            })
          }
          assistantText += ev.text
          onEvent({
            type: 'item_delta',
            turn_id: turnId,
            item_id: agentMessageItemId,
            target: { field: 'agentMessageText' },
            delta: ev.text
          })
        } else if (ev.type === 'tool_use' && ev.toolUse) {
          toolUse = ev.toolUse
        } else if (ev.type === 'usage' && ev.usage) {
          inputTokens += ev.usage.inputTokens
          outputTokens += ev.usage.outputTokens
        } else if (ev.type === 'message_stop') {
          // 结束本轮
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // 图片兼容退回：模型不支持图片时，移除图片后重试一次本轮
      if (hasImages && !imagesDisabled && isImageUnsupportedError(msg)) {
        imagesDisabled = true
        // 图片退回提示走系统消息，不用假思考占位
        const lastUser = messages.slice().reverse().find((m: AgentMessage) => m.role === 'user')
        if (lastUser) {
          lastUser.attachments = undefined
          if (!lastUser.content) {
            lastUser.content = userContent
          }
        }
        iter-- // 不消耗本轮次数，重新执行
        continue
      }
      onEvent({ type: 'error', message: `模型调用失败：${msg}` })
      // 工具后报错兜底：合成收尾，不让对话悬空
      if (finalText) {
        onEvent({ type: 'turn_completed', turn_id: turnId, status: 'completed' })
        onEvent({ type: 'completed', task_id: taskId || '', summary: finalText })
        return { messages, finalText }
      }
      onEvent({ type: 'turn_completed', turn_id: turnId, status: 'failed' })
      throw e
    }

    // 兜底：若本轮有 reasoning item 但未在收到 text/tool_use 时完成（模型只输出思考无后续），在此完成
    if (reasoningItemId && !reasoningCompleted) {
      reasoningCompleted = true
      const summaryText = turnThinkingText.slice(0, 80) + (turnThinkingText.length > 80 ? '…' : '')
      onEvent({
        type: 'item_completed',
        turn_id: turnId,
        item: { type: 'reasoning', id: reasoningItemId, summary: summaryText ? [summaryText] : [], content: turnThinkingText ? [turnThinkingText] : [], status: 'completed', startedAt: reasoningStartedAt || Date.now(), finishedAt: Date.now() }
      })
    }

    if (agentMessageItemId) {
      onEvent({
        type: 'item_completed',
        turn_id: turnId,
        item: { type: 'agentMessage', id: agentMessageItemId, text: assistantText, phase: 'final_answer' }
      })
    }

    if (inputTokens || outputTokens) {
      onEvent({ type: 'usage', inputTokens, outputTokens })
    }

    // 空回复重试一次（防卡死）
    if (!assistantText && !toolUse) {
      if (!emptyRetried) {
        emptyRetried = true
        // 空回复重试，不输出假思考
        continue
      }
      // 空回复二次失败，结束
      break
    }

    emptyRetried = false

    if (assistantText) {
      finalText = assistantText
    }

    // 如果没有工具调用，说明模型给出最终回复，结束
    if (!toolUse) {
      const appendedAfterAnswer = takeAppendedInputs()
      if (appendedAfterAnswer.length > 0) {
        messages.push({
          role: 'assistant',
          content: assistantText,
          ...(turnThinkingText && turnThinkingSignature ? { thinkingBlocks: [{ type: 'thinking' as const, thinking: turnThinkingText, signature: turnThinkingSignature }] } : {})
        })
        appendRuntimeInputs(appendedAfterAnswer)
        continue
      }
      break
    }

    // 有工具调用，执行工具
    const tool = tools.find((t) => t.name === toolUse.name)
    const toolItemId = `toolCall-${randomUUID()}`
    const toolKind = toolKindOf(toolUse.name)
    const toolStartedAt = Date.now()

    const startingToolItem: ToolCallItem = {
      type: 'toolCall',
      id: toolItemId,
      kind: toolKind,
      toolName: toolUse.name,
      args: toolUse.args,
      status: 'running',
      startedAt: toolStartedAt,
      ...(lastFailedToolItemId ? { retryOfItemId: lastFailedToolItemId } : {})
    }
    onEvent({ type: 'item_started', turn_id: turnId, item: startingToolItem })

    function finishToolItem(status: ItemStatus, result?: string, errorMsg?: string): void {
      const finishedAt = Date.now()
      const item: ToolCallItem = {
        ...startingToolItem,
        status,
        result,
        error: errorMsg,
        resultSummary: result ? summarizeToolResult(toolUse!.name, toolUse!.args, result) : undefined,
        finishedAt
      }
      onEvent({ type: 'item_completed', turn_id: turnId, item })
      lastFailedToolItemId = status === 'failed' ? toolItemId : null
    }

    if (!tool) {
      const errMsg = `工具 ${toolUse.name} 不存在`
      finishToolItem('failed', undefined, errMsg)
      messages.push({
        role: 'assistant',
        content: assistantText,
        ...(turnThinkingText && turnThinkingSignature ? { thinkingBlocks: [{ type: 'thinking' as const, thinking: turnThinkingText, signature: turnThinkingSignature }] } : {}),
        tool_calls: [
          {
            id: toolUse.id,
            type: 'function',
            function: { name: toolUse.name, arguments: JSON.stringify(toolUse.args) }
          }
        ]
      })
      messages.push({
        role: 'tool',
        tool_call_id: toolUse.id,
        content: JSON.stringify({ error: errMsg })
      })
      continue
    }

    // 权限判定：根据 autoApproveLow 开关和工具风险等级决定是否需要审批
    // shell 工具的风险按命令内容动态判定（只读查询=low，写操作=medium，高风险=high）
    const effectiveRisk = toolUse.name === 'shell' && typeof toolUse.args.command === 'string'
      ? shellRiskLevel(toolUse.args.command)
      : tool.riskLevel
    const autoApprove = config.autoApproveLow !== false
    const needsApproval = !autoApprove
      ? !isSafe(toolUse.name) && effectiveRisk !== 'low'
      : effectiveRisk === 'high' || effectiveRisk === 'critical'

    if (needsApproval) {
      const approvalId = `approval-${randomUUID()}`
      const approvalItemId = `approvalItem-${randomUUID()}`
      const approvalItem: Item = {
        type: 'approval',
        id: approvalItemId,
        requestId: approvalId,
        toolName: toolUse.name,
        args: toolUse.args,
        riskLevel: effectiveRisk,
        impact: tool.description.slice(0, 120),
        canRollback: effectiveRisk !== 'critical',
        decision: 'pending'
      }
      onEvent({ type: 'item_started', turn_id: turnId, item: approvalItem })
      onEvent({
        type: 'approval_request',
        request_id: approvalId,
        tool_name: toolUse.name,
        args: toolUse.args,
        risk_level: effectiveRisk,
        impact: tool.description.slice(0, 120),
        can_rollback: effectiveRisk !== 'critical'
      })

      const approved = await waitForApproval(approvalId)
      onEvent({
        type: 'item_completed',
        turn_id: turnId,
        item: { ...approvalItem, decision: approved ? 'approved' : 'rejected' }
      })

      if (!approved) {
        finishToolItem('failed', undefined, '用户拒绝执行此操作')
        messages.push({
          role: 'assistant',
          content: assistantText,
          ...(turnThinkingText && turnThinkingSignature ? { thinkingBlocks: [{ type: 'thinking' as const, thinking: turnThinkingText, signature: turnThinkingSignature }] } : {}),
          tool_calls: [{ id: toolUse.id, type: 'function', function: { name: toolUse.name, arguments: JSON.stringify(toolUse.args) } }]
        })
        messages.push({ role: 'tool', tool_call_id: toolUse.id, content: JSON.stringify({ error: '用户拒绝执行此操作' }) })
        continue
      }
    }

    let result: string
    let toolFailed = false
    try {
      if (toolUse.name === 'shell' && typeof toolUse.args.command === 'string' && isBlocked(toolUse.args.command)) {
        result = JSON.stringify({ error: '危险命令已拒绝' })
        toolFailed = true
      } else if (toolUse.name === 'propose_plan') {
        const { plan, steps, requestId } = parsePlanArgs(toolUse.args)
        const planItemId = `planItem-${randomUUID()}`
        onEvent({
          type: 'item_started',
          turn_id: turnId,
          item: { type: 'plan', id: planItemId, plan, steps, decision: 'pending', requestId }
        })
        onEvent({ type: 'plan_proposed', request_id: requestId, plan, steps })
        result = JSON.stringify({ status: 'submitted', request_id: requestId })
      } else if (toolUse.name === 'update_todo') {
        result = todoExecute(toolUse.args)
      } else {
        result = await tool.execute(toolUse.args)
      }
    } catch (e) {
      result = JSON.stringify({ error: e instanceof Error ? e.message : String(e) })
      toolFailed = true
    }

    if (!toolFailed) {
      try {
        const parsed = JSON.parse(result)
        toolFailed = Boolean(parsed && typeof parsed === 'object' && 'error' in parsed)
      } catch {
        // 非 JSON 结果视为成功
      }
    }

    finishToolItem(toolFailed ? 'failed' : 'completed', result)

    messages.push({
      role: 'assistant',
      content: assistantText,
      ...(turnThinkingText && turnThinkingSignature ? { thinkingBlocks: [{ type: 'thinking' as const, thinking: turnThinkingText, signature: turnThinkingSignature }] } : {}),
      tool_calls: [
        {
          id: toolUse.id,
          type: 'function',
          function: { name: toolUse.name, arguments: JSON.stringify(toolUse.args) }
        }
      ]
    })
    messages.push({
      role: 'tool',
      tool_call_id: toolUse.id,
      content: result
    })
  }

  // 到达迭代上限，兜底收尾
  if (!finalText) {
    finalText = '任务已执行完毕，但未生成最终文本。请查看上方工具日志了解执行详情。'
  }

  clearPendingPlanRequestId()
  onEvent({ type: 'turn_completed', turn_id: turnId, status: 'completed' })
  return { messages, finalText }
}

// 判断错误是否因为模型不支持图片输入
function isImageUnsupportedError(msg: string): boolean {
  const lower = msg.toLowerCase()
  return (
    lower.includes('image') && (lower.includes('not support') || lower.includes('unsupported')) ||
    lower.includes('does not support image') ||
    lower.includes('unsupported content type') ||
    lower.includes('invalid content type') ||
    lower.includes('image input is not supported') ||
    lower.includes('multimodal') && lower.includes('not support') ||
    lower.includes('vision') && lower.includes('not') ||
    lower.includes('400') && lower.includes('image')
  )
}
