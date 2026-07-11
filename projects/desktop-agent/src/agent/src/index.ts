import { createInterface } from 'node:readline'
import type { StdinMessage, StdoutMessage, AgentConfig, AgentMessage } from './protocol.js'
import { send } from './protocol.js'
import { runReact } from './loop/react.js'
import { clearTaskApprovalMemory, resolveApproval } from './approval.js'
import { resolveQuestion, resolveContinuation } from './question.js'
import { resolvePlanResponse } from './tools/plan.js'
import { OpenAIProvider } from './providers/openai.js'
import { AnthropicProvider } from './providers/anthropic.js'
import type { LlmProvider, StreamEvent } from './providers/anthropic.js'

// Agent 子进程入口：读 stdin JSON Lines，写 stdout JSON Lines
// 不依赖任何 Electron API（依据 docs/03 第四章进程边界）
const rl = createInterface({ input: process.stdin })

const sessionHistory = new Map<string, AgentMessage[]>()

rl.on('line', (line) => {
  if (!line.trim()) return
  let msg: StdinMessage
  try {
    msg = JSON.parse(line)
  } catch {
    send({ type: 'error', message: 'stdin 消息不是合法 JSON' })
    return
  }
  handleStdin(msg).catch((e) => {
    send({ type: 'error', message: e instanceof Error ? e.message : String(e) })
  })
})

async function handleStdin(msg: StdinMessage): Promise<void> {
  if (msg.type === 'chat_request') {
    const { session_id, message, config, history, workspace_dir, attachments } = msg
    const onEvent = (ev: StdoutMessage) => send(ev)

    onEvent({ type: 'status', status: 'EXECUTING', message: '开始执行任务' })

    try {
      const result = await runReact(
        message,
        config,
        history || sessionHistory.get(session_id) || [],
        onEvent,
        workspace_dir,
        'work',
        session_id,
        attachments
      )
      sessionHistory.set(session_id, result.messages.slice(1))
      clearTaskApprovalMemory(session_id)

      // 产出报告产物
      onEvent({
        type: 'artifact',
        artifact_type: 'report',
        file_path: 'inline'
      })

      onEvent({ type: 'completed', task_id: session_id, summary: result.finalText, messages: result.messages.slice(1) })
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      onEvent({ type: 'error', message: errMsg })
      onEvent({ type: 'completed', task_id: session_id, summary: `任务失败：${errMsg}` })
      clearTaskApprovalMemory(session_id)
    }
    return
  }

  if (msg.type === 'task_control') {
    // 一期 Work 不实现暂停/恢复/回滚的运行时，仅回执
    send({ type: 'status', status: msg.action.toUpperCase(), message: `任务 ${msg.action} 已收到` })
    return
  }

  if (msg.type === 'approval_response') {
    resolveApproval(msg.request_id, msg.approved, msg.scope)
    return
  }

  if (msg.type === 'question_response') {
    resolveQuestion(msg.request_id, {
      selectedOptionIds: msg.selected_option_ids,
      customAnswer: msg.custom_answer,
      skipped: msg.skipped
    })
    return
  }

  if (msg.type === 'plan_response') {
    resolvePlanResponse(msg.request_id, msg.decision, msg.feedback)
    return
  }

  if (msg.type === 'continuation_response') {
    resolveContinuation(msg.task_id, msg.decision)
    return
  }

  if (msg.type === 'test_request') {
    runConnectionTest(msg.request_id, msg.config).catch((e) => {
      send({ type: 'test_result', request_id: msg.request_id, success: false, error: e instanceof Error ? e.message : String(e) })
    })
    return
  }

  if (msg.type === 'summarize_title_request') {
    runTitleSummarize(msg.request_id, msg.config, msg.user_query, msg.assistant_reply).catch((e) => {
      send({ type: 'summarize_title_result', request_id: msg.request_id, success: false, error: e instanceof Error ? e.message : String(e) })
    })
    return
  }
}

// 测试连接：用真实 provider 跑一次最小流式探测，首个分片到达即判成功。
// 这样"测试"与"真实对话"共用同一条请求路径（client、鉴权、baseURL、stream:true、字段构造），从根上避免形状漂移。
async function runConnectionTest(requestId: string, config: AgentConfig): Promise<void> {
  const started = Date.now()
  const testConfig: AgentConfig = {
    ...config,
    // 测试时关闭思考，避免浪费思考配额；thinking 相关字段对兼容性探测无意义
    thinkingLevel: 'off',
    thinkingConfig: undefined
  }

  // 15s 墙钟超时：超过即判失败，避免用户长时间等待
  const timeoutMs = 15_000
  let timedOut = false
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      timedOut = true
      reject(new Error('__TIMEOUT__'))
    }, timeoutMs)
  })

  try {
    const provider: LlmProvider = testConfig.apiFormat === 'openai'
      ? new OpenAIProvider(testConfig)
      : new AnthropicProvider(testConfig)

    const probeMessages: AgentMessage[] = [
      { role: 'user', content: 'ping' }
    ]

    const firstEventPromise = (async () => {
      for await (const ev of provider.stream(probeMessages, testConfig, [])) {
        // 首个有意义分片（文本/用量/结束信号）即证明端到端通路可用
        if (ev.type === 'text' || ev.type === 'usage' || ev.type === 'message_stop') {
          return ev
        }
      }
      return null
    })()

    const ev = (await Promise.race([firstEventPromise, timeoutPromise])) as StreamEvent | null
    const latencyMs = Date.now() - started
    if (timedOut) {
      send({ type: 'test_result', request_id: requestId, success: false, error: '连接超时，请检查网络或连接地址', latencyMs })
      return
    }
    if (!ev) {
      send({ type: 'test_result', request_id: requestId, success: false, error: '服务端未返回任何内容，请检查模型 ID 是否正确', latencyMs })
      return
    }
    send({ type: 'test_result', request_id: requestId, success: true, message: `连接成功，用时 ${latencyMs}ms`, latencyMs })
  } catch (e) {
    const latencyMs = Date.now() - started
    if (timedOut) {
      send({ type: 'test_result', request_id: requestId, success: false, error: '连接超时，请检查网络或连接地址', latencyMs })
      return
    }
    send({ type: 'test_result', request_id: requestId, success: false, error: classifyConnectionError(e), latencyMs })
  }
}

// 把 SDK/网络错误归类成面向用户的可操作提示（P2：结构化错误诊断）
function classifyConnectionError(e: unknown): string {
  if (!(e instanceof Error) && typeof e !== 'object') {
    return e ? String(e) : '连接失败，请检查配置'
  }
  const err = e as { status?: number; message?: string; error?: { message?: string; detail?: string; error?: string } | string; code?: string; name?: string }
  const status = typeof err.status === 'number' ? err.status : undefined
  const rawBody = typeof err.error === 'string' ? err.error : (err.error?.message || err.error?.detail || err.error?.error || '')
  const msg = (err.message || '').trim()

  // 网络层
  if (err.code === 'ECONNREFUSED') return '无法连接到服务端：连接被拒绝，请检查连接地址和端口'
  if (err.code === 'ENOTFOUND') return '域名无法解析，请检查连接地址是否拼写正确'
  if (err.code === 'ECONNRESET') return '连接被服务端重置，可能是网络代理或服务端异常'
  if (err.name === 'AbortError' || /timeout/i.test(msg)) return '连接超时，请检查网络或连接地址'

  // HTTP 状态层
  if (status === 401 || status === 403) {
    return `鉴权失败（${status}）：密钥无效、过期或无权访问该模型${rawBody ? '；服务端返回：' + truncate(rawBody) : ''}`
  }
  if (status === 404) {
    return `端点不存在（404）：请检查连接地址路径是否正确（如是否需要 /v1）${rawBody ? '；服务端返回：' + truncate(rawBody) : ''}`
  }
  if (status === 429) {
    return `请求被限流或额度不足（429）${rawBody ? '；服务端返回：' + truncate(rawBody) : ''}`
  }
  if (status && status >= 500) {
    return `服务端错误（${status}）${rawBody ? '：' + truncate(rawBody) : ''}`
  }
  if (status === 400 || status === 422) {
    // 字段不兼容：stream、max_tokens、tools、stream_options 等
    const hint = /stream/i.test(rawBody) ? '（服务端对流式/字段有特殊要求）' : ''
    return `请求被服务端拒绝（${status}）${hint}：${truncate(rawBody) || truncate(msg)}`
  }

  // 兜底：优先用服务端正文，其次错误消息
  return truncate(rawBody) || truncate(msg) || '连接失败，请检查配置'
}

function truncate(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 200)
}

// 标题总结：用真实 provider 跑一次无工具的一次性调用，把首条 query + 助手回复浓缩成 ≤10 字短标题。
// 复用与正式对话同一条 provider 路径（client、鉴权、baseURL），失败时回传 error，调用方保留原标题。
async function runTitleSummarize(requestId: string, config: AgentConfig, userQuery: string, assistantReply: string): Promise<void> {
  const summaryConfig: AgentConfig = {
    ...config,
    thinkingLevel: 'off',
    thinkingConfig: undefined,
    maxIterations: 1
  }

  const timeoutMs = 20_000
  let timedOut = false
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      timedOut = true
      reject(new Error('__TIMEOUT__'))
    }, timeoutMs)
  })

  try {
    const provider: LlmProvider = summaryConfig.apiFormat === 'openai'
      ? new OpenAIProvider(summaryConfig)
      : new AnthropicProvider(summaryConfig)

    const systemPrompt = '你是对话标题总结器。根据用户问题和助手回答，生成一个不超过10个汉字的简短标题，概括这次对话的核心主题。只输出标题纯文本，不要加引号、标点、前缀或任何解释。'
    const messages: AgentMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `用户问题：${(userQuery || '').slice(0, 400)}\n\n助手回答：${(assistantReply || '').slice(0, 800)}` }
    ]

    let raw = ''
    const collectPromise = (async () => {
      for await (const ev of provider.stream(messages, summaryConfig, [])) {
        if (ev.type === 'text' && ev.text) raw += ev.text
        if (ev.type === 'message_stop') break
      }
      return raw
    })()

    const result = (await Promise.race([collectPromise, timeoutPromise])) as string
    if (timedOut) {
      send({ type: 'summarize_title_result', request_id: requestId, success: false, error: '标题总结超时' })
      return
    }

    const title = cleanTitle(result)
    if (!title) {
      send({ type: 'summarize_title_result', request_id: requestId, success: false, error: '模型返回为空' })
      return
    }
    send({ type: 'summarize_title_result', request_id: requestId, success: true, title })
  } catch (e) {
    if (timedOut) {
      send({ type: 'summarize_title_result', request_id: requestId, success: false, error: '标题总结超时' })
      return
    }
    send({ type: 'summarize_title_result', request_id: requestId, success: false, error: e instanceof Error ? e.message : String(e) })
  }
}

// 清洗模型返回的标题：去引号/标点/首尾空白/前缀冒号，按 unicode 码点截到 10 字
function cleanTitle(raw: string): string {
  const stripped = raw
    .replace(/^["'""''《【\[]+/, '')
    .replace(/["'""''》】\]]+$/, '')
    .replace(/^[标题：:]+\s*/, '')
    .trim()
  if (!stripped) return ''
  // 按码点切片，避免把一个汉字切成乱码
  const chars = Array.from(stripped)
  return chars.slice(0, 10).join('')
}

process.stderr.write('小蓝鲸 Agent 子进程已启动\n')
