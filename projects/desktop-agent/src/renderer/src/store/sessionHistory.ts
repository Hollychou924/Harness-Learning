import type { AgentMessage } from '../../../agent/src/protocol'

function plainMessageOf(message: AgentMessage): AgentMessage | null {
  if (message.role !== 'user' && message.role !== 'assistant') return null
  const content = typeof message.content === 'string' ? message.content : ''
  if (!content.trim()) return null
  return { role: message.role, content }
}

function sameMessage(a: AgentMessage, b: AgentMessage): boolean {
  return a.role === b.role && a.content === b.content
}

function sameRange(messages: AgentMessage[], leftStart: number, rightStart: number, length: number): boolean {
  for (let i = 0; i < length; i++) {
    if (!sameMessage(messages[leftStart + i], messages[rightStart + i])) return false
  }
  return true
}

function collapseRepeatedPrefix(messages: AgentMessage[]): AgentMessage[] {
  let next = messages
  let changed = true
  while (changed) {
    changed = false
    for (let length = Math.floor(next.length / 2); length > 0; length--) {
      if (sameRange(next, 0, length, length)) {
        next = next.slice(length)
        changed = true
        break
      }
    }
  }
  return next
}

export function sanitizeContinuationMessages(messages: AgentMessage[] = []): AgentMessage[] {
  const plain = messages
    .map(plainMessageOf)
    .filter((message): message is AgentMessage => Boolean(message))
  return collapseRepeatedPrefix(plain)
}

function overlapLength(left: AgentMessage[], right: AgentMessage[]): number {
  const max = Math.min(left.length, right.length)
  for (let length = max; length > 0; length--) {
    let matched = true
    for (let i = 0; i < length; i++) {
      if (!sameMessage(left[left.length - length + i], right[i])) {
        matched = false
        break
      }
    }
    if (matched) return length
  }
  return 0
}

function mergeWithoutReplay(existing: AgentMessage[], derived: AgentMessage[]): AgentMessage[] {
  const overlap = overlapLength(existing, derived)
  return [...existing, ...derived.slice(overlap)]
}

export function buildCompletedSessionMessages(
  existingMessages: AgentMessage[] = [],
  completedMessages?: AgentMessage[],
  derivedMessages: AgentMessage[] = []
): AgentMessage[] {
  const trusted = sanitizeContinuationMessages(completedMessages || [])
  if (trusted.length > 0) return trusted

  const existing = sanitizeContinuationMessages(existingMessages)
  const derived = sanitizeContinuationMessages(derivedMessages)
  return mergeWithoutReplay(existing, derived)
}
