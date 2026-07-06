import assert from 'node:assert/strict'
import { buildCompletedSessionMessages, sanitizeContinuationMessages } from './sessionHistory'
import type { AgentMessage } from '../../../agent/src/protocol'

const corruptHistory: AgentMessage[] = [
  { role: 'user', content: '你是哪个模型' },
  { role: 'assistant', content: '我是 Codex。' },
  { role: 'user', content: '你读一下当前这个项目' },
  { role: 'user', content: '你是哪个模型' },
  { role: 'assistant', content: '我是 Codex。' },
  { role: 'user', content: '你读一下当前这个项目' },
  {
    role: 'assistant',
    content: '这是项目总结。',
    tool_calls: [
      { id: 'toolCall-bad-display-id', type: 'function', function: { name: 'read_file', arguments: '{}' } }
    ]
  },
  { role: 'tool', tool_call_id: 'toolCall-bad-display-id', content: '{"content":"README"}' }
]

const sanitized = sanitizeContinuationMessages(corruptHistory)
assert.deepEqual(sanitized, [
  { role: 'user', content: '你是哪个模型' },
  { role: 'assistant', content: '我是 Codex。' },
  { role: 'user', content: '你读一下当前这个项目' },
  { role: 'assistant', content: '这是项目总结。' }
])

const currentMessages: AgentMessage[] = [{ role: 'user', content: '你好' }]
const trustedCompletedMessages: AgentMessage[] = [
  { role: 'user', content: '你好' },
  { role: 'assistant', content: '你好呀，我在。' }
]
const displayDerivedMessages: AgentMessage[] = [
  { role: 'user', content: '你好' },
  {
    role: 'assistant',
    content: '展示记录生成的内容',
    tool_calls: [
      { id: 'toolCall-display-only', type: 'function', function: { name: 'read_file', arguments: '{}' } }
    ]
  },
  { role: 'tool', tool_call_id: 'toolCall-display-only', content: '{"content":"README"}' }
]

assert.deepEqual(
  buildCompletedSessionMessages(currentMessages, trustedCompletedMessages, displayDerivedMessages),
  trustedCompletedMessages
)

assert.deepEqual(
  buildCompletedSessionMessages(
    [
      { role: 'user', content: '第一句' },
      { role: 'assistant', content: '第一答' }
    ],
    undefined,
    [
      { role: 'user', content: '第一句' },
      { role: 'assistant', content: '第一答' },
      { role: 'user', content: '第二句' },
      { role: 'assistant', content: '第二答' }
    ]
  ),
  [
    { role: 'user', content: '第一句' },
    { role: 'assistant', content: '第一答' },
    { role: 'user', content: '第二句' },
    { role: 'assistant', content: '第二答' }
  ]
)

console.log('session history checks passed')
