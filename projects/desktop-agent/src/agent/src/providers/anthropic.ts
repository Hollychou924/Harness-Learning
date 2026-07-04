import Anthropic from '@anthropic-ai/sdk'
import type { AgentConfig, AgentMessage } from '../protocol.js'
import type { AgentTool } from '../tools/index.js'

export interface StreamEvent {
  type: 'text' | 'tool_use' | 'message_stop' | 'usage' | 'thinking'
  text?: string
  toolUse?: { id: string; name: string; args: Record<string, unknown> }
  usage?: { inputTokens: number; outputTokens: number }
  /** 思考内容（流式增量） */
  thinking?: string
  /** Anthropic 扩展思考的签名，回传给下一轮请求必须带上，否则 API 报 400 */
  thinkingSignature?: string
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
        // thinking block 必须在最前面（Anthropic 要求 thinking 在 text/tool_use 之前）
        if (m.thinkingBlocks) {
          for (const tb of m.thinkingBlocks) {
            blocks.push({ type: 'thinking', thinking: tb.thinking, signature: tb.signature })
          }
        }
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
      // 有 thinking 但无 tool_calls 的纯文本回复（思考后直接回答）
      if (m.role === 'assistant' && m.thinkingBlocks && m.thinkingBlocks.length > 0) {
        const blocks: Record<string, unknown>[] = []
        for (const tb of m.thinkingBlocks) {
          blocks.push({ type: 'thinking', thinking: tb.thinking, signature: tb.signature })
        }
        if (m.content) blocks.push({ type: 'text', text: m.content })
        return { role: 'assistant', content: blocks }
      }
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: m.tool_call_id || '', content: m.content }]
        }
      }
      // 用户消息含图片附件：组装多模态 content（Anthropic 格式）
      if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
        const blocks: Record<string, unknown>[] = []
        if (m.content) {
          blocks.push({ type: 'text', text: m.content })
        }
        for (const att of m.attachments) {
          if (att.type === 'image' && att.dataUrl) {
            const parsed = parseDataUrl(att.dataUrl)
            if (parsed) {
              blocks.push({
                type: 'image',
                source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data }
              })
            }
          }
        }
        return { role: 'user', content: blocks }
      }
      return { role: m.role, content: m.content }
    })

    const apiTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: { type: 'object', ...t.parameters }
    }))

    // 思考参数注入：thinkingLevel !== 'off' 且模型有 thinkingConfig 时开启
    const wantThinking = config.thinkingLevel !== 'off' && !!config.thinkingConfig
    const thinkingParams = wantThinking ? (config.thinkingConfig?.bodyParams || {}) : {}
    const forceTemp = wantThinking ? config.thinkingConfig?.forceTemperature : undefined

    const buildParams = (withThinking: boolean): Record<string, unknown> => {
      const params: Record<string, unknown> = {
        model: config.model,
        max_tokens: withThinking ? 16000 : 8192,
        system,
        messages: formatted as unknown as Anthropic.MessageParam[],
        stream: true
      }
      if (apiTools.length > 0) params.tools = apiTools as unknown as Anthropic.Tool[]
      if (withThinking) {
        // 注入思考参数（thinking/enable_thinking/reasoning_effort 等）
        Object.assign(params, thinkingParams)
        if (forceTemp !== undefined) params.temperature = forceTemp
      }
      return params
    }

    // 执行流式：采集 text/tool_use/thinking_delta
    async function* runStream(this: AnthropicProvider, params: Record<string, unknown>): AsyncGenerator<StreamEvent> {
      const stream = this.client.messages.stream(params as unknown as Anthropic.MessageCreateParamsStreaming)
      let currentTool: { id: string; name: string; args: string } | null = null
      // thinking block 状态：累积内容 + 签名，block 结束时一次性 yield
      let thinkingBlock: { text: string; signature: string } | null = null
      for await (const event of stream as AsyncIterable<Record<string, unknown>>) {
        const t = String(event.type || '')
        if (t === 'content_block_start') {
          const cb = event.content_block as Record<string, unknown> | undefined
          if (cb && cb.type === 'tool_use') {
            currentTool = { id: String(cb.id || ''), name: String(cb.name || ''), args: '' }
          } else if (cb && (cb.type === 'thinking' || cb.type === 'redacted_thinking')) {
            // 记录 thinking block，signature 在 start 时给出（redacted_thinking 只有 signature 无内容）
            thinkingBlock = { text: '', signature: String(cb.signature || '') }
          }
        } else if (t === 'content_block_delta') {
          const delta = event.delta as Record<string, unknown> | undefined
          if (!delta) continue
          if (delta.type === 'text_delta' && typeof delta.text === 'string') {
            yield { type: 'text', text: delta.text }
          } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
            // 累积到 thinkingBlock，block 结束时统一 yield（需带 signature）
            if (thinkingBlock) {
              thinkingBlock.text += delta.thinking
            } else {
              // 兜底：未收到 content_block_start 也输出增量
              yield { type: 'thinking', thinking: delta.thinking }
            }
          } else if (delta.type === 'input_json_delta' && currentTool && typeof delta.partial_json === 'string') {
            currentTool.args += delta.partial_json
          }
        } else if (t === 'content_block_stop') {
          // thinking block 结束：yield 带 signature 的完整思考
          if (thinkingBlock) {
            yield { type: 'thinking', thinking: thinkingBlock.text, thinkingSignature: thinkingBlock.signature }
            thinkingBlock = null
          }
          if (currentTool) {
            yield {
              type: 'tool_use',
              toolUse: { id: currentTool.id, name: currentTool.name, args: safeParse(currentTool.args) }
            }
            currentTool = null
          }
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

    // 三级降级：带思考 → 不带思考
    try {
      if (wantThinking) {
        yield* runStream.call(this, buildParams(true))
      } else {
        yield* runStream.call(this, buildParams(false))
      }
    } catch (err) {
      // 带思考失败（端点不支持 thinking 参数）→ 降级为不带思考重试
      if (wantThinking) {
        yield* runStream.call(this, buildParams(false))
      } else {
        throw err
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


// 解析 data URL：data:image/png;base64,xxxx -> { mediaType, data }
function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { mediaType: match[1], data: match[2] }
}
