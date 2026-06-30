import Anthropic from '@anthropic-ai/sdk'
import type { AgentConfig, AgentMessage } from '../protocol.js'
import type { AgentTool } from '../tools/index.js'

export interface StreamEvent {
  type: 'text' | 'tool_use' | 'message_stop' | 'usage'
  text?: string
  toolUse?: { id: string; name: string; args: Record<string, unknown> }
  usage?: { inputTokens: number; outputTokens: number }
}

export interface LlmProvider {
  stream(messages: AgentMessage[], config: AgentConfig, tools: AgentTool[]): AsyncGenerator<StreamEvent>
}

export class AnthropicProvider implements LlmProvider {
  private client: Anthropic

  constructor(config: AgentConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey, baseURL: config.apiBaseUrl })
  }

  async *stream(messages: AgentMessage[], config: AgentConfig, tools: AgentTool[]): AsyncGenerator<StreamEvent> {
    const system = messages.find((m) => m.role === 'system')?.content || ''
    const conv = messages.filter((m) => m.role !== 'system')

    // 用 any 局部放宽 SDK 的字面量联合，避免版本间类型名差异；结构上严格匹配 Anthropic API
    const formatted = conv.map((m): Record<string, unknown> => {
      if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
        const blocks: Record<string, unknown>[] = []
        if (m.content) blocks.push({ type: 'text', text: m.content })
        for (const tc of m.tool_calls) {
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: safeParse(tc.function.arguments)
          })
        }
        return { role: 'assistant', content: blocks }
      }
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: m.tool_call_id || '', content: m.content }]
        }
      }
      return { role: m.role, content: m.content }
    })

    const apiTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: { type: 'object', ...t.parameters }
    }))

    const stream = this.client.messages.stream({
      model: config.model,
      max_tokens: 8192,
      system,
      messages: formatted as unknown as Anthropic.MessageParam[],
      tools: apiTools.length > 0 ? (apiTools as unknown as Anthropic.Tool[]) : undefined
    })

    let currentTool: { id: string; name: string; args: string } | null = null
    for await (const event of stream as AsyncIterable<Record<string, unknown>>) {
      const t = String(event.type || '')
      if (t === 'content_block_start') {
        const cb = event.content_block as Record<string, unknown> | undefined
        if (cb && cb.type === 'tool_use') {
          currentTool = { id: String(cb.id || ''), name: String(cb.name || ''), args: '' }
        }
      } else if (t === 'content_block_delta') {
        const delta = event.delta as Record<string, unknown> | undefined
        if (!delta) continue
        if (delta.type === 'text_delta' && typeof delta.text === 'string') {
          yield { type: 'text', text: delta.text }
        } else if (delta.type === 'input_json_delta' && currentTool && typeof delta.partial_json === 'string') {
          currentTool.args += delta.partial_json
        }
      } else if (t === 'content_block_stop' && currentTool) {
        yield {
          type: 'tool_use',
          toolUse: { id: currentTool.id, name: currentTool.name, args: safeParse(currentTool.args) }
        }
        currentTool = null
      } else if (t === 'message_delta') {
        const usage = event.usage as Record<string, unknown> | undefined
        if (usage && typeof usage.output_tokens === 'number') {
          yield { type: 'usage', usage: { inputTokens: 0, outputTokens: usage.output_tokens } }
        }
      } else if (t === 'message_stop') {
        const final = await stream.finalMessage()
        yield {
          type: 'usage',
          usage: { inputTokens: final.usage.input_tokens || 0, outputTokens: final.usage.output_tokens || 0 }
        }
        yield { type: 'message_stop' }
      }
    }
  }
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>
  } catch {
    return {}
  }
}
