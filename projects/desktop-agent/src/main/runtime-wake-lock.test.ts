import test from 'node:test'
import assert from 'node:assert/strict'
import { RuntimeWakeLock, type PowerSaveBlockerLike } from './runtime-wake-lock.js'

function createBlocker() {
  let nextId = 1
  const started = new Set<number>()
  const starts: string[] = []
  const stops: number[] = []
  const blocker: PowerSaveBlockerLike = {
    start: (type) => {
      const id = nextId++
      starts.push(type)
      started.add(id)
      return id
    },
    stop: (id) => {
      stops.push(id)
      started.delete(id)
    },
    isStarted: (id) => started.has(id)
  }
  return { blocker, starts, stops, started }
}

test('默认开启，首个任务开始时保持唤醒，最后一个任务结束后恢复', () => {
  const fake = createBlocker()
  const wakeLock = new RuntimeWakeLock(fake.blocker)

  wakeLock.taskStarted('task-1')
  wakeLock.taskStarted('task-2')
  assert.deepEqual(fake.starts, ['prevent-app-suspension'])

  wakeLock.taskFinished('task-1')
  assert.equal(fake.stops.length, 0)
  wakeLock.taskFinished('task-2')
  assert.deepEqual(fake.stops, [1])
})

test('运行中关闭立即恢复，重新开启立即保持唤醒', () => {
  const fake = createBlocker()
  const wakeLock = new RuntimeWakeLock(fake.blocker)

  wakeLock.taskStarted('task-1')
  wakeLock.setEnabled(false)
  assert.deepEqual(fake.stops, [1])

  wakeLock.setEnabled(true)
  assert.deepEqual(fake.starts, ['prevent-app-suspension', 'prevent-app-suspension'])
})

test('异常退出释放全部任务，重复释放不会重复停止', () => {
  const fake = createBlocker()
  const wakeLock = new RuntimeWakeLock(fake.blocker)

  wakeLock.taskStarted('task-1')
  wakeLock.taskStarted('task-2')
  wakeLock.releaseAll()
  wakeLock.releaseAll()

  assert.deepEqual(fake.stops, [1])
  assert.equal(fake.started.size, 0)
})

test('关闭状态下开始任务不会保持唤醒', () => {
  const fake = createBlocker()
  const wakeLock = new RuntimeWakeLock(fake.blocker)

  wakeLock.setEnabled(false)
  wakeLock.taskStarted('task-1')

  assert.equal(fake.starts.length, 0)
})
