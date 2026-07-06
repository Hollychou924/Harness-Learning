import OpenAI from 'openai'
import type { AgentConfig, AgentMessage } from '../protocol.js'
import type { AgentTool } from '../tools/index.js'
import type { StreamEvent, LlmProvider } from './anthropic.js'

function getProviderHeaders(config: AgentConfig): Record<string, string> | undefined {
  const customProviderId = config.customProviderId?.trim()
  if (customProviderId) {
    return { 'X-Model-Provider-Id': customProviderId }
  }
  return undefined
}

function isMifyProvider(config: AgentConfig): boolean {
  return config.providerId === 'mify' || Boolean(config.customProviderId?.trim())
}

function sanitizeSchemaForMify(schema: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...schema }
  delete cleaned['$schema']
  if (cleaned.type === 'object' && cleaned.properties) {
    const props = cleaned.properties as Record<string, unknown>
    for (const key of Object.keys(props)) {
      const prop = props[key] as Record<string, unknown>
      if (prop && typeof prop === 'object') {
        delete prop['$ref']
      }
    }
  }
  return cleaned
}

// think 标签剥离：MiniMax 等模型把思考用 <think...> 标签混在正文里。
// 从流式正文里分离出思考内容和净文本。
// 状态机：outside(正文) → inside(思考标签内)
class ThinkTagStripper {
  private inside = false
  private pending = ''

  /** 喂入一段流式文本，返回 {text: 净正文, thinking: 思考内容} */
  feed(chunk: string): { text: string; thinking: string } {
    let text = ''
    let thinking = ''
    this.pending += chunk

    while (this.pending.length > 0) {
      if (!this.inside) {
        const openIdx = this.pending.search(/<think(?:ing)?>/i)
        if (openIdx === -1) {
          // 没有开标签：保留末尾可能是不完整标签的部分，其余作为正文
          const safeLen = this.findSafeCut(this.pending, '<think')
          if (safeLen < this.pending.length) {
            text += this.pending.slice(0, safeLen)
            this.pending = this.pending.slice(safeLen)
            break
          }
          text += this.pending
          this.pending = ''
        } else {
          text += this.pending.slice(0, openIdx)
          this.pending = this.pending.slice(openIdx)
          const match = this.pending.match(/<think(?:ing)?>/i)
          if (match) {
            this.pending = this.pending.slice(match[0].length)
            this.inside = true
          }
        }
      } else {
        const closeIdx = this.pending.search(/<\/think(?:ing)?>/i)
        if (closeIdx === -1) {
          const safeLen = this.findSafeCut(this.pending, '</think')
          if (safeLen < this.pending.length) {
            thinking += this.pending.slice(0, safeLen)
            this.pending = this.pending.slice(safeLen)
            break
          }
          thinking += this.pending
          this.pending = ''
        } else {
          thinking += this.pending.slice(0, closeIdx)
          this.pending = this.pending.slice(closeIdx)
          const match = this.pending.match(/<\/think(?:ing)?>/i)
          if (match) {
            this.pending = this.pending.slice(match[0].length)
            this.inside = false
          }
        }
      }
    }
    return { text, thinking }
  }

  /** 找到一个安全截断点：不在潜在标签中间截断 */
  private findSafeCut(s: string, tagStart: string): number {
    const lastTagStart = s.lastIndexOf(tagStart)
    if (lastTagStart >= 0 && lastTagStart > s.length - tagStart.length) {
      return lastTagStart
    }
    return s.length
  }

  /** 流结束，刷出剩余内容 */
  flush(): { text: string; thinking: string } {
    const remaining = this.pending
    this.pending = ''
    if (this.inside) {
      // 未闭合的 think 标签：当作思考内容
      return { text: '', thinking: remaining }
    }
    return { text: remaining, thinking: '' }
  }
}

export class OpenAIProvider implements LlmProvider {
  private client: OpenAI

  constructor(config: AgentConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.apiBaseUrl,
      defaultHeaders: getProviderHeaders(config),
      timeout: 120_000,
      maxRetries: 2
    })
  }

  async *stream(messages: AgentMessage[], config: AgentConfig, tools: AgentTool[]): AsyncGenerator<StreamEvent> {
    const system = messages.find((m) => m.role === 'system')?.content || ''
    const conv = messages.filter((m) => m.role !== 'system')

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      ...conv.map((m): OpenAI.Chat.ChatCompletionMessageParam => {
        if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
          return {
            role: 'assistant',
            content: m.content || null,
            tool_calls: m.tool_calls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.function.name, arguments: tc.function.arguments }
            }))
          }
        }
        if (m.role === 'tool') {
          return { role: 'tool', tool_call_id: m.tool_call_id || '', content: m.content }
        }
        if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
          const content: OpenAI.Chat.ChatCompletionContentPart[] = []
          if (m.content) {
            content.push({ type: 'text', text: m.content })
          }
          for (const att of m.attachments) {
            if (att.type === 'image' && att.dataUrl) {
              content.push({ type: 'image_url', image_url: { url: att.dataUrl } })
            }
          }
          return { role: 'user', content }
        }
        return { role: m.role as 'user' | 'assistant', content: m.content }
      })
    ]

    const mify = isMifyProvider(config)
    const apiTools = tools.length > 0
      ? tools.map((t) => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: mify
              ? sanitizeSchemaForMify({ type: 'object', ...t.parameters })
              : { type: 'object', ...t.parameters }
          }
        }))
      : undefined

    // 思考参数注入：thinkingLevel !== 'off' 且模型有 thinkingConfig 时开启
    const wantThinking = config.thinkingLevel !== 'off' && !!config.thinkingConfig
    const thinkingParams = wantThinking ? (config.thinkingConfig?.bodyParams || {}) : {}
    // max_tokens 地板：思考模型需更高上限（mify 实战不得低于 16000）
    const thinkingMaxTokens = 16000
    const baseMaxTokens = 8192

    const buildParams = (withThinking: boolean): Record<string, unknown> => {
      const params: Record<string, unknown> = {
        model: config.model,
        messages: openaiMessages,
        max_tokens: withThinking ? thinkingMaxTokens : baseMaxTokens,
        stream: true,
        stream_options: { include_usage: true }
      }
      if (apiTools && apiTools.length > 0) {
        params.tools = apiTools
      }
      if (withThinking) {
        Object.assign(params, thinkingParams)
        if (config.thinkingConfig?.forceTemperature !== undefined) {
          params.temperature = config.thinkingConfig.forceTemperature
        }
      } else if (config.thinkingConfig?.disabledBodyParams) {
        Object.assign(params, config.thinkingConfig.disabledBodyParams)
      }
      return params
    }

    async function* runStream(this: OpenAIProvider, params: Record<string, unknown>): AsyncGenerator<StreamEvent> {
      const resp = await this.client.chat.completions.create(
        params as unknown as OpenAI.Chat.ChatCompletionCreateParamsStreaming
      )
      let inputTokens = 0
      let outputTokens = 0
      const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>()
      const tagStripper = new ThinkTagStripper()
      let hadReasoningField = false

      for await (const chunk of resp) {
        const delta = chunk.choices?.[0]?.delta as Record<string, unknown> | undefined
        if (!delta) {
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens || 0
            outputTokens = chunk.usage.completion_tokens || 0
          }
          continue
        }

        // 路径1：reasoning_content（DeepSeek/通义/智谱等）
        const reasoningContent = delta.reasoning_content
        if (typeof reasoningContent === 'string' && reasoningContent) {
          hadReasoningField = true
          yield { type: 'thinking', thinking: reasoningContent }
        }

        // 路径2：reasoning（OpenAI o系/部分兼容端点）
        const reasoning = delta.reasoning
        if (typeof reasoning === 'string' && reasoning) {
          hadReasoningField = true
          yield { type: 'thinking', thinking: reasoning }
        }

        // 正文：若无专用 reasoning 字段，走 think 标签剥离兜底
        const content = delta.content
        if (typeof content === 'string' && content) {
          if (hadReasoningField) {
            // 已有专用字段，正文直接输出
            yield { type: 'text', text: content }
          } else {
            const { text, thinking } = tagStripper.feed(content)
            if (thinking) yield { type: 'thinking', thinking }
            if (text) yield { type: 'text', text }
          }
        }

        // 工具调用
        const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined
        if (toolCalls) {
          for (const tc of toolCalls) {
            const idx = (tc.index as number) ?? 0
            if (!toolCallBuffers.has(idx)) {
              toolCallBuffers.set(idx, { id: '', name: '', args: '' })
            }
            const buf = toolCallBuffers.get(idx)!
            const tcId = tc.id as string | undefined
            const fn = tc.function as Record<string, unknown> | undefined
            if (tcId) buf.id = tcId
            if (fn?.name) buf.name = fn.name as string
            if (fn?.arguments) buf.args += fn.arguments as string
          }
        }
      }

      // 刷出 think 标签剥离器的剩余内容
      if (!hadReasoningField) {
        const { text, thinking } = tagStripper.flush()
        if (thinking) yield { type: 'thinking', thinking }
        if (text) yield { type: 'text', text }
      }

      for (const [, buf] of toolCallBuffers) {
        let parsedArgs: Record<string, unknown> = {}
        try {
          parsedArgs = JSON.parse(buf.args) as Record<string, unknown>
        } catch { /* empty args */ }
        yield { type: 'tool_use', toolUse: { id: buf.id, name: buf.name, args: parsedArgs } }
      }

      if (inputTokens || outputTokens) {
        yield { type: 'usage', usage: { inputTokens, outputTokens } }
      }
      yield { type: 'message_stop' }
    }

    // 三级降级：带思考 → 去思考重试
    try {
      if (wantThinking) {
        yield* runStream.call(this, buildParams(true))
      } else {
        yield* runStream.call(this, buildParams(false))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isThinkingError = wantThinking && /thinking|reasoning|enable_thinking|unsupported.*parameter|400|invalid_request/i.test(msg)
      if (isThinkingError) {
        yield* runStream.call(this, buildParams(false))
      } else {
        throw err
      }
    }
  }
}
