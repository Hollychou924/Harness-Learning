import type { AgentConfig, AgentMessage, StdoutMessage, MessageAttachment } from '../protocol.js'
import { send } from '../protocol.js'
import type { AgentTool } from '../tools/index.js'
import { isSafe, isBlocked } from '../tools/index.js'
import { makePlanExecuteHandler, clearPendingPlanRequestId } from '../tools/plan.js'
import { makeTodoExecuteHandler } from '../tools/todo.js'
import { requestApproval } from '../approval.js'
import { randomUUID } from 'node:crypto'
import { AnthropicProvider, type LlmProvider } from '../providers/anthropic.js'
import { OpenAIProvider } from '../providers/openai.js'
import { buildSystemPrompt } from '../prompt/system.js'

// ReAct 引擎（依据 docs/01 第三章，参考已验证实现）
// maxIterations 硬上限，到顶兜底收尾，禁止无限转
// 空回复重试一次，工具后报错合成收尾
export interface ReactResult {
  messages: AgentMessage[]
  finalText: string
}

export async function runReact(
  userMessage: string,
  config: AgentConfig,
  history: AgentMessage[],
  onEvent: (msg: StdoutMessage) => void,
  workspaceDir?: string,
  mode: 'work' | 'code' = 'work',
  taskId?: string,
  attachments?: MessageAttachment[]
): Promise<ReactResult> {
  const provider: LlmProvider = config.apiFormat === 'openai'
    ? new OpenAIProvider(config)
    : new AnthropicProvider(config)

  // plan/todo 元工具：拦截执行，发出前端事件
  const planExecute = makePlanExecuteHandler((plan, steps) => {
    const requestId = `plan-${Date.now()}`
    onEvent({
      type: 'plan_proposed',
      request_id: requestId,
      plan,
      steps
    })
  })
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

  // 标记本轮用户消息是否含图片（用于不支持图片时的退回重试）
  const hasImages = imageAttachments.length > 0

  let finalText = ''
  let emptyRetried = false
  let imagesDisabled = false

  for (let iter = 0; iter < config.maxIterations; iter++) {
    onEvent({ type: 'thinking', text: `第 ${iter + 1} 轮思考` })

    let assistantText = ''
    let toolUse: { id: string; name: string; args: Record<string, unknown> } | null = null
    let inputTokens = 0
    let outputTokens = 0

    try {
      for await (const ev of provider.stream(messages, config, tools)) {
        if (ev.type === 'text' && ev.text) {
          assistantText += ev.text
          onEvent({ type: 'chunk', text: ev.text })
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
        onEvent({ type: 'thinking', text: '当前模型不支持图片，已自动移除图片并用纯文字重试' })
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
        onEvent({ type: 'completed', task_id: taskId || '', summary: finalText })
        return { messages, finalText }
      }
      throw e
    }

    if (inputTokens || outputTokens) {
      onEvent({ type: 'usage', inputTokens, outputTokens })
    }

    // 空回复重试一次（防卡死）
    if (!assistantText && !toolUse) {
      if (!emptyRetried) {
        emptyRetried = true
        onEvent({ type: 'thinking', text: '模型返回空，重试一次' })
        continue
      }
      onEvent({ type: 'thinking', text: '模型再次返回空，结束' })
      break
    }

    emptyRetried = false

    if (assistantText) {
      finalText = assistantText
    }

    // 如果没有工具调用，说明模型给出最终回复，结束
    if (!toolUse) {
      break
    }

    // 有工具调用，执行工具
    const tool = tools.find((t) => t.name === toolUse.name)
    if (!tool) {
      const errMsg = `工具 ${toolUse.name} 不存在`
      onEvent({ type: 'tool_result', name: toolUse.name, result: JSON.stringify({ error: errMsg }), id: toolUse.id })
      messages.push({
        role: 'assistant',
        content: assistantText,
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

    onEvent({ type: 'tool_call', name: toolUse.name, args: toolUse.args, id: toolUse.id })

    // 权限判定：根据 autoApproveLow 开关和工具风险等级决定是否需要审批
    const autoApprove = config.autoApproveLow !== false
    const needsApproval = !autoApprove
      ? !isSafe(toolUse.name)
      : tool.riskLevel === 'high' || tool.riskLevel === 'critical'

    if (needsApproval) {
      const approvalId = `approval-${randomUUID()}`
      const approved = await requestApproval({
        requestId: approvalId,
        toolName: toolUse.name,
        args: toolUse.args,
        riskLevel: tool.riskLevel,
        impact: tool.description.slice(0, 120),
        canRollback: tool.riskLevel !== 'critical'
      })
      if (!approved) {
        onEvent({ type: 'tool_result', name: toolUse.name, result: JSON.stringify({ error: '用户拒绝执行此操作' }), id: toolUse.id })
        messages.push({
          role: 'assistant',
          content: assistantText,
          tool_calls: [{ id: toolUse.id, type: 'function', function: { name: toolUse.name, arguments: JSON.stringify(toolUse.args) } }]
        })
        messages.push({ role: 'tool', tool_call_id: toolUse.id, content: JSON.stringify({ error: '用户拒绝执行此操作' }) })
        continue
      }
    }

    let result: string
    try {
      if (toolUse.name === 'shell' && typeof toolUse.args.command === 'string' && isBlocked(toolUse.args.command)) {
        result = JSON.stringify({ error: '危险命令已拒绝' })
      } else if (toolUse.name === 'propose_plan') {
        result = planExecute(toolUse.args)
      } else if (toolUse.name === 'update_todo') {
        result = todoExecute(toolUse.args)
      } else {
        result = await tool.execute(toolUse.args)
      }
    } catch (e) {
      result = JSON.stringify({ error: e instanceof Error ? e.message : String(e) })
    }

    onEvent({ type: 'tool_result', name: toolUse.name, result, id: toolUse.id })

    messages.push({
      role: 'assistant',
      content: assistantText,
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
