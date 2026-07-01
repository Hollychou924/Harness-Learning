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
  // Mify 经 Gemini/Vertex 时对 schema 有额外限制，移除可能不兼容的字段
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

    const stream = await this.client.chat.completions.create({
      model: config.model,
      messages: openaiMessages,
      tools: apiTools,
      max_tokens: 8192,
      stream: true,
      stream_options: { include_usage: true }
    })

    let inputTokens = 0
    let outputTokens = 0
    const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>()

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta
      if (!delta) {
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens || 0
          outputTokens = chunk.usage.completion_tokens || 0
        }
        continue
      }
      if (delta.content) {
        yield { type: 'text', text: delta.content }
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          if (!toolCallBuffers.has(idx)) {
            toolCallBuffers.set(idx, { id: tc.id || '', name: '', args: '' })
          }
          const buf = toolCallBuffers.get(idx)!
          if (tc.id) buf.id = tc.id
          if (tc.function?.name) buf.name = tc.function.name
          if (tc.function?.arguments) buf.args += tc.function.arguments
        }
      }
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
}
