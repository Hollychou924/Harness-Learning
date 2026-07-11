import assert from 'node:assert/strict'
import {
  createQueuedMessage,
  enqueueQueuedMessage,
  parsePersistedQueues,
  requeueAtHead,
  removeQueuedMessage,
  takeQueuedMessage,
  updateQueuedMessage
} from './messageQueue'

const first = createQueuedMessage({
  id: 'queue-1',
  sessionId: 'session-1',
  text: '第一条',
  createdAt: 100,
  attachments: [{
    id: 'image-1',
    name: '界面.png',
    type: 'image',
    size: 12,
    mime: 'image/png',
    dataUrl: 'data:image/png;base64,abc',
    status: 'ready'
  }]
})
const second = createQueuedMessage({
  id: 'queue-2',
  sessionId: 'session-1',
  text: '第二条',
  createdAt: 200,
  attachments: []
})

let queues = enqueueQueuedMessage({}, first)
queues = enqueueQueuedMessage(queues, second)

assert.deepEqual(queues['session-1'].map((item) => item.id), ['queue-1', 'queue-2'])
assert.equal(queues['session-1'][0].attachments[0].dataUrl, 'data:image/png;base64,abc')

queues = updateQueuedMessage(queues, 'session-1', 'queue-1', '修改后的第一条', 300)
assert.equal(queues['session-1'][0].text, '修改后的第一条')
assert.equal(queues['session-1'][0].updatedAt, 300)
assert.equal(queues['session-1'][0].id, 'queue-1')
queues = updateQueuedMessage(queues, 'session-1', 'queue-1', '', 301)
assert.equal(queues['session-1'][0].text, '')
assert.equal(queues['session-1'][0].attachments.length, 1)

const selected = takeQueuedMessage(queues, 'session-1', 'queue-2')
assert.equal(selected.item?.id, 'queue-2')
assert.deepEqual(selected.queues['session-1'].map((item) => item.id), ['queue-1'])

const restored = requeueAtHead(selected.queues, selected.item!)
assert.deepEqual(restored['session-1'].map((item) => item.id), ['queue-2', 'queue-1'])
assert.equal(restored['session-1'][0].status, 'failed')

const fifo = takeQueuedMessage(restored, 'session-1')
assert.equal(fifo.item?.id, 'queue-2')

const removed = removeQueuedMessage(fifo.queues, 'session-1', 'queue-1')
assert.equal(removed['session-1'], undefined)

assert.deepEqual(parsePersistedQueues('not json'), {})
assert.equal(parsePersistedQueues(JSON.stringify({ 'session-1': [{ ...first, status: 'failed' }] }))['session-1'][0].status, 'failed')
assert.equal(parsePersistedQueues(JSON.stringify({ 'session-1': [{ ...first, status: 'dispatching' }] }))['session-1'][0].status, 'queued')
assert.deepEqual(parsePersistedQueues(JSON.stringify({
  'session-1': [
    first,
    { ...second, text: '', attachments: [] },
    { malformed: true }
  ]
})), {
  'session-1': [{
    ...first,
    attachments: first.attachments.map(({ sourceFile: _sourceFile, objectUrl: _objectUrl, ...attachment }) => attachment)
  }]
})

console.log('message queue checks passed')
