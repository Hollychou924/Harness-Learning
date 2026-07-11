import type { Attachment } from './task'

export type QueuedMessageStatus = 'queued' | 'dispatching' | 'failed'

export interface QueuedMessage {
  id: string
  sessionId: string
  text: string
  attachments: Attachment[]
  createdAt: number
  updatedAt: number
  status: QueuedMessageStatus
}

export type MessageQueues = Record<string, QueuedMessage[]>

interface CreateQueuedMessageInput {
  id: string
  sessionId: string
  text: string
  attachments: Attachment[]
  createdAt?: number
}

function isPersistedAttachment(value: unknown): value is Attachment {
  if (!value || typeof value !== 'object') return false
  const attachment = value as Partial<Attachment>
  return (
    typeof attachment.id === 'string' &&
    typeof attachment.name === 'string' &&
    (attachment.type === 'image' || attachment.type === 'text' || attachment.type === 'file') &&
    typeof attachment.size === 'number' &&
    typeof attachment.mime === 'string'
  )
}

function isQueuedMessage(value: unknown): value is QueuedMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<QueuedMessage>
  return (
    typeof message.id === 'string' &&
    typeof message.sessionId === 'string' &&
    typeof message.text === 'string' &&
    (message.text.trim().length > 0 || (Array.isArray(message.attachments) && message.attachments.length > 0)) &&
    Array.isArray(message.attachments) &&
    message.attachments.every(isPersistedAttachment) &&
    typeof message.createdAt === 'number' &&
    typeof message.updatedAt === 'number' &&
    (message.status === 'queued' || message.status === 'dispatching' || message.status === 'failed')
  )
}

function withoutEmptyQueue(queues: MessageQueues, sessionId: string, nextQueue: QueuedMessage[]): MessageQueues {
  if (nextQueue.length > 0) return { ...queues, [sessionId]: nextQueue }
  const next = { ...queues }
  delete next[sessionId]
  return next
}

export function createQueuedMessage(input: CreateQueuedMessageInput): QueuedMessage {
  const now = input.createdAt ?? Date.now()
  return {
    id: input.id,
    sessionId: input.sessionId,
    text: input.text.trim(),
    attachments: input.attachments.map((attachment) => ({ ...attachment, sourceFile: undefined, objectUrl: undefined })),
    createdAt: now,
    updatedAt: now,
    status: 'queued'
  }
}

export function enqueueQueuedMessage(queues: MessageQueues, message: QueuedMessage): MessageQueues {
  return {
    ...queues,
    [message.sessionId]: [...(queues[message.sessionId] || []), message]
  }
}

export function updateQueuedMessage(
  queues: MessageQueues,
  sessionId: string,
  messageId: string,
  text: string,
  updatedAt = Date.now()
): MessageQueues {
  const queue = queues[sessionId]
  if (!queue) return queues
  const target = queue.find((message) => message.id === messageId)
  if (target && !text.trim() && target.attachments.length === 0) return queues
  return {
    ...queues,
    [sessionId]: queue.map((message) =>
      message.id === messageId
        ? { ...message, text: text.trim(), updatedAt, status: 'queued' }
        : message
    )
  }
}

export function removeQueuedMessage(
  queues: MessageQueues,
  sessionId: string,
  messageId: string
): MessageQueues {
  const queue = queues[sessionId]
  if (!queue) return queues
  return withoutEmptyQueue(queues, sessionId, queue.filter((message) => message.id !== messageId))
}

export function takeQueuedMessage(
  queues: MessageQueues,
  sessionId: string,
  messageId?: string
): { queues: MessageQueues; item: QueuedMessage | null } {
  const queue = queues[sessionId] || []
  const index = messageId ? queue.findIndex((message) => message.id === messageId) : 0
  if (index < 0 || index >= queue.length) return { queues, item: null }
  const item = { ...queue[index], status: 'dispatching' as const, updatedAt: Date.now() }
  return {
    queues: withoutEmptyQueue(queues, sessionId, queue.filter((_, itemIndex) => itemIndex !== index)),
    item
  }
}

export function requeueAtHead(queues: MessageQueues, message: QueuedMessage): MessageQueues {
  const failedMessage: QueuedMessage = {
    ...message,
    status: 'failed',
    updatedAt: Date.now()
  }
  return {
    ...queues,
    [message.sessionId]: [failedMessage, ...(queues[message.sessionId] || [])]
  }
}

export function parsePersistedQueues(raw: string | null): MessageQueues {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([sessionId, value]) => [
          sessionId,
          Array.isArray(value)
            ? value.filter(isQueuedMessage).map((message) => ({
              ...message,
              status: message.status === 'dispatching' ? 'queued' as const : message.status
            }))
            : []
        ] as const)
        .filter(([, queue]) => queue.length > 0)
    )
  } catch {
    return {}
  }
}
