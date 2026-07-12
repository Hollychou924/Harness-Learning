/**
 * Agent 内上下文压缩（规则截断，非 LLM）
 * 保留 system + Goal Contract + 最近尾部消息
 */
import type { AgentMessage } from '../protocol.js'
import { GOAL_CONTRACT_MARKER } from '../evolution/goal-contract.js'

export const COMPACT_CHAR_THRESHOLD = 48_000
export const COMPACT_KEEP_TAIL = 10

export interface CompactResult {
  messages: AgentMessage[]
  compacted: boolean
  removedCount: number
  charBefore: number
  charAfter: number
}

function msgChars(m: AgentMessage): number {
  const c = m.content
  if (typeof c === 'string') return c.length
  if (Array.isArray(c)) {
    return c.reduce((n, part) => n + (typeof part === 'string' ? part.length : JSON.stringify(part).length), 0)
  }
  return JSON.stringify(c || '').length
}

function totalChars(messages: AgentMessage[]): number {
  return messages.reduce((n, m) => n + msgChars(m), 0)
}

function contentHasContract(content: unknown): boolean {
  if (typeof content === 'string') return content.includes(GOAL_CONTRACT_MARKER)
  return JSON.stringify(content || '').includes(GOAL_CONTRACT_MARKER)
}

/**
 * 超过阈值时折叠中间消息为一条摘要，强制保留含 Goal Contract 的 system
 */
export function compactMessagesForAgent(messages: AgentMessage[], opts?: {
  threshold?: number
  keepTail?: number
}): CompactResult {
  const threshold = opts?.threshold ?? COMPACT_CHAR_THRESHOLD
  const keepTail = opts?.keepTail ?? COMPACT_KEEP_TAIL
  const charBefore = totalChars(messages)
  if (charBefore < threshold || messages.length <= keepTail + 2) {
    return { messages, compacted: false, removedCount: 0, charBefore, charAfter: charBefore }
  }

  const system = messages.filter((m) => m.role === 'system')
  const rest = messages.filter((m) => m.role !== 'system')
  if (rest.length <= keepTail) {
    return { messages, compacted: false, removedCount: 0, charBefore, charAfter: charBefore }
  }

  const head = rest.slice(0, Math.max(0, rest.length - keepTail))
  const tail = rest.slice(-keepTail)
  const summaryLines = head.slice(0, 12).map((m, i) => {
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    return `${i + 1}. [${m.role}] ${text.replace(/\s+/g, ' ').slice(0, 160)}`
  })
  const summary: AgentMessage = {
    role: 'user',
    content:
      `【上下文压缩】已折叠此前 ${head.length} 条消息。任务契约与目标不得丢弃。\n` +
      summaryLines.join('\n') +
      (head.length > 12 ? `\n…另有 ${head.length - 12} 条已省略` : '')
  }

  // 确保 system 仍含契约；若被截坏则从原 system 拼回
  const nextSystem = system.map((s) => {
    if (contentHasContract(s.content)) return s
    const original = messages.find((m) => m.role === 'system' && contentHasContract(m.content))
    return original || s
  })

  const next = [...nextSystem, summary, ...tail]
  const charAfter = totalChars(next)
  return {
    messages: next,
    compacted: true,
    removedCount: head.length,
    charBefore,
    charAfter
  }
}

/** 压缩循环：连续多次 compact 且无工具成功 → 应告警 */
export function shouldWarnCompactLoop(compactCount: number, toolSuccessesSinceCompact: number): boolean {
  return compactCount >= 3 && toolSuccessesSinceCompact === 0
}
