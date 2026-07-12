import type { AgentConfig, AgentMessage, StdoutMessage, MessageAttachment } from '../protocol.js'
import type { Item, ItemStatus, ToolCallItem, ToolKind } from '../items.js'
import { isSafe, isBlocked } from '../tools/index.js'
import { shellRiskLevel } from '../tools/shell.js'
import { parsePlanArgs, clearPendingPlanRequestId, waitForPlanResponse } from '../tools/plan.js'
import { parseQuestionArgs } from '../tools/question.js'
import { makeTodoExecuteHandler } from '../tools/todo.js'
import { hasRememberedApproval, rememberApproval, waitForApproval } from '../approval.js'
import { waitForQuestion, waitForContinuation, type ContinuationDecision } from '../question.js'
import { randomUUID } from 'node:crypto'
import { AnthropicProvider, type LlmProvider } from '../providers/anthropic.js'
import { OpenAIProvider } from '../providers/openai.js'
import { buildSystemPrompt } from '../prompt/system.js'
import { summarizeToolResult } from './tool-summary.js'
import {
  EvidenceRecorder,
  evidenceArtifactPath,
  ReflectionGovernor,
  selectTactics,
  appendFailureCase,
  shouldShortFail,
  peekVerdict,
  buildShortFailNudge,
  SHORT_FAIL_MAX_ROUNDS,
  LoopGuard,
  buildFailureCaseFromEvidence,
  upsertGapPattern
} from '../evolution/index.js'
import {
  buildGoalContract,
  formatGoalContractBlock,
  evaluateStopGate
} from '../evolution/goal-contract.js'
import { decideInterrupt } from '../evolution/interrupt-policy.js'
import { compactMessagesForAgent, shouldWarnCompactLoop } from './compact.js'
import { isTaskAborted, resetTaskControl } from '../task-control.js'

// ReAct 引擎（依据 docs/01 第三章，参考已验证实现）
// maxIterations 硬上限，到顶后先询问用户是否继续/停止/拆分，禁止无限转
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
  attachments?: MessageAttachment[]
): Promise<ReactResult> {
  const configIssue = validateModelAccess(config.apiKey)
  if (configIssue) {
    const turnId = `turn-${randomUUID()}`
    const userMessageItemId = `userMessage-${randomUUID()}`
    const agentMessageItemId = `agentMessage-${randomUUID()}`
    const failureText = `模型调用失败：${configIssue}`
    onEvent({ type: 'turn_started', turn_id: turnId })
    onEvent({
      type: 'item_started',
      turn_id: turnId,
      item: {
        type: 'userMessage',
        id: userMessageItemId,
        content: userMessage ? [{ type: 'text', text: userMessage }] : []
      }
    })
    onEvent({
      type: 'item_completed',
      turn_id: turnId,
      item: {
        type: 'userMessage',
        id: userMessageItemId,
        content: userMessage ? [{ type: 'text', text: userMessage }] : []
      }
    })
    onEvent({
      type: 'item_started',
      turn_id: turnId,
      item: { type: 'agentMessage', id: agentMessageItemId, text: failureText, phase: 'final_answer' }
    })
    onEvent({
      type: 'item_completed',
      turn_id: turnId,
      item: { type: 'agentMessage', id: agentMessageItemId, text: failureText, phase: 'final_answer' }
    })
    onEvent({ type: 'turn_completed', turn_id: turnId, status: 'failed' })
    onEvent({ type: 'error', message: failureText })
    return { messages: [], finalText: failureText }
  }

  const provider: LlmProvider = config.apiFormat === 'openai'
    ? new OpenAIProvider(config)
    : new AnthropicProvider(config)

  const { getAvailableTools } = await import('../tools/index.js')
  const tools = await getAvailableTools(workspaceDir)

  const family = mode === 'code' ? 'T1' as const : 'other' as const
  const goalContract = buildGoalContract(userMessage, mode)
  const inject = selectTactics(workspaceDir, { family, goal: userMessage, topK: 3 })
  const system = buildSystemPrompt(mode, workspaceDir, inject.promptBlock) + formatGoalContractBlock(goalContract)

  resetTaskControl()

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
  const evidenceTaskId = taskId || turnId
  const recorder = new EvidenceRecorder({
    taskId: evidenceTaskId,
    turnId,
    mode,
    userGoal: userMessage,
    workspaceDir,
    family,
    sessionId: taskId
  })
  recorder.setTacticsInjected(inject.tactics.length)
  recorder.setGoalContract(goalContract)
  const emit = recorder.wrap(onEvent)
  const governor = new ReflectionGovernor(2)
  const todoExecute = makeTodoExecuteHandler((todos) => {
    emit({ type: 'todo_update', todos })
  })

  emit({
    type: 'status',
    status: 'INFO',
    message: `任务契约已建立：验收 ${goalContract.acceptance_criteria.length} 条`
  })

  const finishTurn = (status: 'completed' | 'failed' | 'cancelled') => {
    if (recorder.evidence.status !== 'running') {
      emit({ type: 'turn_completed', turn_id: turnId, status })
      return
    }
    const evidence = recorder.finalize(status)
    const decision = governor.decide(evidence)
    emit({
      type: 'status',
      status: 'INFO',
      message: decision.allow
        ? `ReflectionGovernor：允许复查（${decision.reason}）`
        : `ReflectionGovernor：跳过复查（${decision.reason}）`
    })
    if (!evidence.verdict?.passed && workspaceDir && (family === 'T1' || mode === 'code')) {
      try {
        const fc = buildFailureCaseFromEvidence({ evidence, family: 'T1' })
        const saved = appendFailureCase(workspaceDir, fc)
        const tag = (fc.trigger_tags || []).find((t) => !['t1', 'feedback', 'verify', 'test'].includes(t)) || fc.attribution || 'defect'
        upsertGapPattern(workspaceDir, {
          id: `gap-${fc.attribution || 'defect'}-${tag}`.slice(0, 64),
          family: 'T1',
          title: `${fc.attribution || 'defect'}:${tag}`,
          description: fc.symptom.slice(0, 200),
          trigger_tags: fc.trigger_tags.slice(0, 8),
          tactic_ids: [],
          attribution: fc.attribution,
          scope: fc.scope
        })
        emit({
          type: 'status',
          status: 'INFO',
          message: `经验归因已写入：${saved.attribution}/${saved.scope}（${saved.rationale}）`
        })
      } catch {
        // ignore
      }
    }
    const artifact = evidenceArtifactPath(recorder)
    if (artifact) {
      emit({ type: 'artifact', artifact_type: 'evidence', file_path: artifact })
    }
    emit({ type: 'turn_completed', turn_id: turnId, status })
  }

  emit({ type: 'turn_started', turn_id: turnId })
  if (inject.tactics.length > 0) {
    emit({
      type: 'status',
      status: 'INFO',
      message: `已注入 ${inject.tactics.length} 条经验策略`
    })
  }

  // 每一轮自包含：把用户本次的输入也作为条目发出，历史翻看/时间轴回放时知道"这一轮问了什么"
  const userMessageItemId = `userMessage-${randomUUID()}`
  const userMessageItem: Item = {
    type: 'userMessage',
    id: userMessageItemId,
    content: [
      ...(userMessage ? [{ type: 'text' as const, text: userMessage }] : []),
      ...(attachments || []).map((a) => ({
        type: a.type === 'image' ? 'image' as const : 'file' as const,
        name: a.name,
        mime: a.mime,
        size: a.size,
        url: a.type === 'image' ? a.dataUrl || '' : undefined,
        textContent: a.type !== 'image' ? a.textContent : undefined
      }))
    ]
  }
  emit({ type: 'item_started', turn_id: turnId, item: userMessageItem })
  emit({ type: 'item_completed', turn_id: turnId, item: userMessageItem })

  // 标记本轮用户消息是否含图片（用于不支持图片时的退回重试）
  const hasImages = imageAttachments.length > 0

  let finalText = ''
  let emptyRetried = false
  let imagesDisabled = false
  /** 上一个失败的工具调用条目 id，用于把下一次同名重试串成"失败→重试→成功"链条 */
  let lastFailedToolItemId: string | null = null
  let shortFailRounds = 0
  const loopGuard = new LoopGuard()
  let compactCount = 0
  let toolSuccessesAtLastCompact = 0
  let consecutiveToolFails = 0

  const tryEnterShortFailLoop = (): boolean => {
    const gate = shouldShortFail({
      family,
      mode,
      round: shortFailRounds,
      evidence: recorder.evidence
    })
    if (!gate.allow) return false

    const verdict = peekVerdict(recorder.evidence)
    const nudge = buildShortFailNudge({
      round: shortFailRounds,
      maxRounds: SHORT_FAIL_MAX_ROUNDS,
      verdict,
      workspaceDir,
      evidence: recorder.evidence
    })
    shortFailRounds += 1
    recorder.markShortFailRound()
    messages.push({ role: 'user', content: nudge })
    // 给短失败环留执行预算，避免卡在步数上限
    if (iter >= maxIterations - 3) maxIterations += 8
    emptyRetried = false
    finalText = ''
    emit({
      type: 'status',
      status: 'INFO',
      message: `短失败环 ${shortFailRounds}/${SHORT_FAIL_MAX_ROUNDS}：${gate.reason}`
    })
    const nudgeItemId = `userMessage-shortfail-${randomUUID()}`
    emit({
      type: 'item_started',
      turn_id: turnId,
      item: { type: 'userMessage', id: nudgeItemId, content: [{ type: 'text', text: nudge }] }
    })
    emit({
      type: 'item_completed',
      turn_id: turnId,
      item: { type: 'userMessage', id: nudgeItemId, content: [{ type: 'text', text: nudge }] }
    })
    return true
  }

  let maxIterations = config.maxIterations
  let continuationCount = 0
  let iter = 0
  while (iter < maxIterations) {
    if (isTaskAborted()) {
      finalText = finalText || '任务已取消。'
      finishTurn('cancelled')
      break
    }
    recorder.markIteration()

    // Agent 内压缩：保留 Goal Contract
    const compacted = compactMessagesForAgent(messages)
    if (compacted.compacted) {
      messages.length = 0
      messages.push(...compacted.messages)
      compactCount += 1
      const successes = recorder.evidence.signals.tool_successes
      if (shouldWarnCompactLoop(compactCount, successes - toolSuccessesAtLastCompact)) {
        emit({
          type: 'status',
          status: 'WARNING',
          message: '压缩循环检测：多次压缩后仍无工具进展，建议拆分任务或停止'
        })
      }
      toolSuccessesAtLastCompact = successes
      emit({
        type: 'status',
        status: 'INFO',
        message: `上下文已压缩（-${compacted.removedCount} 条，${compacted.charBefore}→${compacted.charAfter} 字）`
      })
    }

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
            emit({
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
          emit({
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
          emit({
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
            emit({
              type: 'item_started',
              turn_id: turnId,
              item: { type: 'agentMessage', id: agentMessageItemId, text: '', phase: 'final_answer' }
            })
          }
          assistantText += ev.text
          emit({
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
      emit({ type: 'error', message: `模型调用失败：${msg}` })
      // 工具后报错兜底：合成收尾，不让对话悬空
      if (finalText) {
        finishTurn('completed')
        emit({ type: 'completed', task_id: taskId || '', summary: finalText })
        return { messages, finalText }
      }
      const failureText = `模型调用失败：${msg}`
      const failureItemId = agentMessageItemId || `agentMessage-${randomUUID()}`
      if (!agentMessageItemId) {
        emit({
          type: 'item_started',
          turn_id: turnId,
          item: { type: 'agentMessage', id: failureItemId, text: failureText, phase: 'final_answer' }
        })
      }
      emit({
        type: 'item_completed',
        turn_id: turnId,
        item: { type: 'agentMessage', id: failureItemId, text: failureText, phase: 'final_answer' }
      })
      finishTurn('failed')
      throw e
    }

    // 兜底：若本轮有 reasoning item 但未在收到 text/tool_use 时完成（模型只输出思考无后续），在此完成
    if (reasoningItemId && !reasoningCompleted) {
      reasoningCompleted = true
      const summaryText = turnThinkingText.slice(0, 80) + (turnThinkingText.length > 80 ? '…' : '')
      emit({
        type: 'item_completed',
        turn_id: turnId,
        item: { type: 'reasoning', id: reasoningItemId, summary: summaryText ? [summaryText] : [], content: turnThinkingText ? [turnThinkingText] : [], status: 'completed', startedAt: reasoningStartedAt || Date.now(), finishedAt: Date.now() }
      })
    }

    if (agentMessageItemId) {
      emit({
        type: 'item_completed',
        turn_id: turnId,
        item: { type: 'agentMessage', id: agentMessageItemId, text: assistantText, phase: 'final_answer' }
      })
    }

    if (inputTokens || outputTokens) {
      emit({ type: 'usage', inputTokens, outputTokens })
    }

    // 空回复重试一次（防卡死）
    if (!assistantText && !toolUse) {
      if (!emptyRetried) {
        emptyRetried = true
        // 空回复重试，不输出假思考
        continue
      }
      // 空回复二次失败：若 Verifier 未过，先进短失败环再放弃
      if (tryEnterShortFailLoop()) {
        iter++
        continue
      }
      break
    }

    emptyRetried = false

    if (assistantText) {
      finalText = assistantText
    }

    // 如果没有工具调用，说明模型给出最终回复；先过短失败环 / Stop Gate 再结束
    if (!toolUse) {
      if (assistantText) {
        messages.push({
          role: 'assistant',
          content: assistantText,
          ...(turnThinkingText && turnThinkingSignature ? { thinkingBlocks: [{ type: 'thinking' as const, thinking: turnThinkingText, signature: turnThinkingSignature }] } : {})
        })
      }
      if (tryEnterShortFailLoop()) {
        iter++
        continue
      }
      const stop = evaluateStopGate({
        mode,
        contract: goalContract,
        verifySeen: recorder.evidence.signals.verify_command_seen,
        verifyOk: recorder.evidence.signals.verify_command_ok
      })
      if (!stop.ok) {
        // 契约未满足：强制进入短失败环一次（若预算仍在）
        if (tryEnterShortFailLoop()) {
          iter++
          continue
        }
        emit({ type: 'status', status: 'WARNING', message: `Stop Gate：${stop.reason}` })
      }
      break
    }

    // 有工具调用，执行工具
    const tool = tools.find((t) => t.name === toolUse.name)

    // LoopGuard：重复 / 乒乓空转熔断
    const guard = loopGuard.observe(toolUse.name, toolUse.args)
    if (guard.trip) {
      emit({ type: 'status', status: 'WARN', message: guard.reason })
      messages.push({
        role: 'assistant',
        content: assistantText,
        ...(turnThinkingText && turnThinkingSignature
          ? { thinkingBlocks: [{ type: 'thinking' as const, thinking: turnThinkingText, signature: turnThinkingSignature }] }
          : {}),
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
        content: JSON.stringify({ error: guard.reason, loop_guard: true })
      })
      finalText =
        finalText ||
        `${guard.reason}。建议：停止当前空转，把任务拆成更小的子任务后重试。`
      const stopId = `agentMessage-${randomUUID()}`
      emit({
        type: 'item_started',
        turn_id: turnId,
        item: { type: 'agentMessage', id: stopId, text: finalText, phase: 'final_answer' }
      })
      emit({
        type: 'item_completed',
        turn_id: turnId,
        item: { type: 'agentMessage', id: stopId, text: finalText, phase: 'final_answer' }
      })
      break
    }

    if (toolUse.name === 'ask_question') {
      const parsedQuestion = parseQuestionArgs(toolUse.args)
      const irq = decideInterrupt({
        kind: 'question',
        text: `${parsedQuestion.question} ${parsedQuestion.detail || ''}`,
        consecutiveFailures: consecutiveToolFails
      })
      if (irq.action === 'escalate_stop') {
        finalText = `已停止：${irq.reason}`
        messages.push({
          role: 'assistant',
          content: assistantText,
          tool_calls: [{ id: toolUse.id, type: 'function', function: { name: toolUse.name, arguments: JSON.stringify(toolUse.args) } }]
        })
        messages.push({
          role: 'tool',
          tool_call_id: toolUse.id,
          content: JSON.stringify({ skipped: true, auto: true, reason: irq.reason, action: irq.action })
        })
        finishTurn('failed')
        break
      }
      if (irq.action === 'auto' || irq.action === 'record_and_auto') {
        emit({ type: 'status', status: 'INFO', message: `打断策略：${irq.action}（${irq.reason}）` })
        const result = JSON.stringify({
          skipped: true,
          auto: true,
          action: irq.action,
          reason: irq.reason,
          selected_option_ids: parsedQuestion.options[0] ? [parsedQuestion.options[0].id] : [],
          selected_options: parsedQuestion.options[0] ? [parsedQuestion.options[0].label] : [],
          custom_answer: ''
        })
        messages.push({
          role: 'assistant',
          content: assistantText,
          ...(turnThinkingText && turnThinkingSignature ? { thinkingBlocks: [{ type: 'thinking' as const, thinking: turnThinkingText, signature: turnThinkingSignature }] } : {}),
          tool_calls: [{ id: toolUse.id, type: 'function', function: { name: toolUse.name, arguments: JSON.stringify(toolUse.args) } }]
        })
        messages.push({ role: 'tool', tool_call_id: toolUse.id, content: result })
        continue
      }

      const questionRequestId = `question-${randomUUID()}`
      const questionItemId = `questionItem-${randomUUID()}`
      const questionItem: Item = {
        type: 'question',
        id: questionItemId,
        requestId: questionRequestId,
        question: parsedQuestion.question,
        detail: parsedQuestion.detail,
        options: parsedQuestion.options,
        multiple: parsedQuestion.multiple,
        allowCustom: parsedQuestion.allowCustom,
        allowSkip: parsedQuestion.allowSkip,
        prompts: parsedQuestion.prompts,
        decision: 'pending'
      }
      emit({ type: 'item_started', turn_id: turnId, item: questionItem })
      emit({
        type: 'question_proposed',
        request_id: questionRequestId,
        question: parsedQuestion.question,
        detail: parsedQuestion.detail,
        options: parsedQuestion.options,
        multiple: parsedQuestion.multiple,
        allow_custom: parsedQuestion.allowCustom,
        allow_skip: parsedQuestion.allowSkip,
        prompts: parsedQuestion.prompts
      })

      const answer = await waitForQuestion(questionRequestId)
      if (isTaskAborted()) {
        finishTurn('cancelled')
        break
      }
      const completedQuestion: Item = {
        ...questionItem,
        decision: answer.skipped ? 'skipped' : 'answered',
        selectedOptionIds: answer.selectedOptionIds,
        customAnswer: answer.customAnswer
      }
      emit({ type: 'item_completed', turn_id: turnId, item: completedQuestion })

      const selectedLabels = parsedQuestion.options
        .filter((option) => answer.selectedOptionIds.includes(option.id))
        .map((option) => option.label)
      const result = JSON.stringify({
        skipped: answer.skipped,
        selected_option_ids: answer.selectedOptionIds,
        selected_options: selectedLabels,
        custom_answer: answer.customAnswer
      })
      messages.push({
        role: 'assistant',
        content: assistantText,
        ...(turnThinkingText && turnThinkingSignature ? { thinkingBlocks: [{ type: 'thinking' as const, thinking: turnThinkingText, signature: turnThinkingSignature }] } : {}),
        tool_calls: [{ id: toolUse.id, type: 'function', function: { name: toolUse.name, arguments: JSON.stringify(toolUse.args) } }]
      })
      messages.push({ role: 'tool', tool_call_id: toolUse.id, content: result })
      continue
    }
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
    emit({ type: 'item_started', turn_id: turnId, item: startingToolItem })

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
      emit({ type: 'item_completed', turn_id: turnId, item })
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

    // 权限判定：根据用户在输入框选择的模式和工具风险等级决定是否需要审批
    // shell 工具的风险按命令内容动态判定（只读查询=low，写操作=medium，高风险=high）
    const effectiveRisk = toolUse.name === 'shell' && typeof toolUse.args.command === 'string'
      ? shellRiskLevel(toolUse.args.command)
      : tool.riskLevel
    const approvalMode = config.approvalMode ?? (config.autoApproveLow === false ? 'always_ask' : 'risk_only')
    const rememberedApproval = taskId ? hasRememberedApproval(taskId, toolUse.name, toolUse.args) : false
    const needsApproval = !rememberedApproval && (
      approvalMode === 'always_ask'
        ? !isSafe(toolUse.name) && effectiveRisk !== 'low'
        : approvalMode === 'risk_only'
          ? effectiveRisk === 'high' || effectiveRisk === 'critical'
          : false
    )

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
      emit({ type: 'item_started', turn_id: turnId, item: approvalItem })
      emit({
        type: 'approval_request',
        request_id: approvalId,
        tool_name: toolUse.name,
        args: toolUse.args,
        risk_level: effectiveRisk,
        impact: tool.description.slice(0, 120),
        can_rollback: effectiveRisk !== 'critical'
      })

      const approval = await waitForApproval(approvalId)
      if (isTaskAborted()) {
        finishTurn('cancelled')
        break
      }
      if (approval.approved && taskId) rememberApproval(taskId, toolUse.name, toolUse.args, approval.scope)
      emit({
        type: 'item_completed',
        turn_id: turnId,
        item: { ...approvalItem, decision: approval.approved ? 'approved' : 'rejected' }
      })

      if (!approval.approved) {
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
        const planItem: Item = { type: 'plan', id: planItemId, plan, steps, decision: 'pending', requestId }
        const planResponse = waitForPlanResponse(requestId)
        emit({
          type: 'item_started',
          turn_id: turnId,
          item: planItem
        })
        emit({ type: 'plan_proposed', request_id: requestId, plan, steps })
        const response = await planResponse
        if (isTaskAborted()) {
          finishTurn('cancelled')
          break
        }
        const decision = response.decision === 'approve'
          ? 'approved'
          : response.decision === 'reject_revise'
            ? 'revise_requested'
            : 'rejected'
        emit({
          type: 'item_completed',
          turn_id: turnId,
          item: { ...planItem, decision, feedback: response.feedback }
        })
        if (response.decision === 'reject_stop') {
          result = JSON.stringify({ status: 'rejected', feedback: response.feedback })
          finalText = response.feedback || '已按你的要求停止执行。'
        } else {
          result = JSON.stringify({
            status: response.decision === 'approve' ? 'approved' : 'revise_requested',
            feedback: response.feedback
          })
        }
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
    if (toolFailed) consecutiveToolFails += 1
    else consecutiveToolFails = 0

    let stopAfterTool = false
    if (toolUse.name === 'propose_plan') {
      try {
        const parsed = JSON.parse(result)
        stopAfterTool = parsed?.status === 'rejected'
      } catch {
        // 非 JSON 结果继续交给模型处理
      }
    }

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

    if (stopAfterTool) break

    // 到达当前预算上限，且任务未自然结束：询问用户是否继续/停止/拆分
    if (iter >= maxIterations - 1 && taskId) {
      const hint =
        continuationCount >= 2
          ? '任务已连续续跑 2 次，建议拆分为更小的子任务继续。'
          : '当前任务已执行到步数上限，是否继续执行、停止并查看结果，或拆成更小的子任务？'
      emit({ type: 'continuation_request', task_id: taskId, current_step: iter + 1, hint })
      const decision: ContinuationDecision = await waitForContinuation(taskId)
      if (isTaskAborted() || decision === 'stop') {
        finishTurn(isTaskAborted() ? 'cancelled' : 'completed')
        break
      }
      if (decision === 'continue') {
        continuationCount += 1
        maxIterations += 30
        iter++
        emit({
          type: 'status',
          status: 'INFO',
          message: `已续跑第 ${continuationCount} 次，追加 30 步执行预算`
        })
        continue
      } else if (decision === 'split') {
        if (!finalText) {
          finalText = '任务已达到复杂度上限，建议拆分为更明确、更小的子任务继续。'
        }
        break
      } else {
        // stop or timeout fallback: fall through to finalization
        break
      }
    }

    iter++
  }

  // 到达迭代上限，兜底收尾
  if (!finalText) {
    finalText = '任务已执行完毕，但未生成最终文本。请查看上方工具日志了解执行详情。'
  }

  clearPendingPlanRequestId()
  finishTurn('completed')
  return { messages, finalText }
}

function validateModelAccess(value: string): string | null {
  if (!value.trim()) return '未检测到模型访问配置，请在模型设置里重新选择或配置模型'
  if (/[\u0100-\uFFFF]/.test(value)) return '模型访问配置里包含中文或特殊字符，请重新配置模型'
  if (/[\r\n\t]/.test(value)) return '模型访问配置里包含换行，请重新配置模型'
  return null
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
