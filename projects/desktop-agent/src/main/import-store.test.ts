import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ImportStore, contentFingerprint, safeImportError, stableId } from './import-store.js'
import type { ImportCandidate, ImportCatalog, ImportedSession, ImportSelection } from './import-types.js'

const selection: ImportSelection = {
  sources: ['codex'],
  includeProjectsAndConversations: true,
  includeInstructionsAndMemory: true,
  includeExtensions: false
}

function session(content: string): ImportedSession {
  return {
    id: stableId('session', 'codex:session-1'),
    source: 'codex',
    sourceSessionId: 'session-1',
    sourceProjectId: 'project-1',
    projectId: stableId('project', 'codex:project-1'),
    title: '测试对话',
    createdAt: 1,
    updatedAt: content.length,
    archived: false,
    compatibility: 'full',
    fingerprint: contentFingerprint(content),
    messages: [{ role: 'user', content }],
    turns: [{
      id: 'turn-1', status: 'completed', startedAt: 1, finishedAt: 2,
      items: [{ type: 'userMessage', id: 'message-1', content: [{ type: 'text', text: content }] }]
    }]
  }
}

function candidate(content: string): ImportCandidate {
  const importedSession = session(content)
  return {
    source: 'codex',
    projects: [{
      id: importedSession.projectId,
      source: 'codex',
      sourceProjectId: 'project-1',
      name: '测试项目',
      folderPath: '/Users/private/work',
      createdAt: 1,
      updatedAt: 1
    }],
    sessions: [importedSession],
    resources: [{
      id: stableId('resource', 'codex:instruction-1'),
      source: 'codex',
      sourceId: 'instruction-1',
      projectId: importedSession.projectId,
      kind: 'instruction',
      name: 'AGENTS.md',
      sourcePath: '/Users/private/work/AGENTS.md',
      enabled: false,
      fingerprint: contentFingerprint('instruction')
    }],
    unavailable: []
  }
}

function root(): string {
  return mkdtempSync(join(tmpdir(), 'xiaolanjing-import-'))
}

test('同一资料重复导入不会产生重复项目和对话', async () => {
  const store = new ImportStore(root())
  const first = await store.commit([candidate('第一版')], selection)
  const second = await store.commit([candidate('第一版')], selection)

  assert.equal(second.projects.length, 1)
  assert.equal(second.sessions.length, 1)
  assert.deepEqual(second.batch.skippedSessionIds, [first.sessions[0].id])
  assert.equal(store.loadCatalog().resources.length, 1)
})

test('已有记录中同一文件夹的跨来源项目会安全合并', () => {
  const workspace = root()
  const catalog: ImportCatalog = {
    version: 1,
    projects: [
      { id: 'codex-project', source: 'codex', sourceProjectId: '/work/demo', name: 'demo', folderPath: '/work/demo', createdAt: 2, updatedAt: 3 },
      { id: 'claude-project', source: 'claude-code', sourceProjectId: '/work/demo/', name: 'demo', folderPath: '/work/demo/', createdAt: 1, updatedAt: 4 }
    ],
    sessions: [
      { ...session('Codex 对话'), id: 'codex-session', projectId: 'codex-project', storageBatchId: 'old' },
      { ...session('Claude 对话'), id: 'claude-session', source: 'claude-code', projectId: 'claude-project', storageBatchId: 'old' }
    ].map(({ messages: _messages, turns: _turns, ...item }) => item),
    resources: [{
      id: 'resource-1', source: 'claude-code', sourceId: 'instruction', projectId: 'claude-project', kind: 'instruction',
      name: 'CLAUDE.md', enabled: false, fingerprint: 'resource', importedBatchId: 'old'
    }],
    batches: [{
      id: 'old', createdAt: 1, completedAt: 2, status: 'completed', sources: ['codex', 'claude-code'],
      createdProjectIds: ['codex-project', 'claude-project'], createdSessionIds: ['codex-session', 'claude-session'],
      updatedSessionIds: [], skippedSessionIds: [], resourceIds: ['resource-1'], sessionChanges: [], resourceChanges: [], failed: []
    }]
  }
  writeFileSync(join(workspace, 'catalog.json'), JSON.stringify(catalog))

  const migrated = new ImportStore(workspace).loadCatalog()
  assert.equal(migrated.projects.length, 1)
  assert.equal(new Set(migrated.sessions.map((item) => item.projectId)).size, 1)
  assert.equal(migrated.resources[0].projectId, migrated.projects[0].id)
  assert.deepEqual(migrated.batches[0].createdProjectIds, [migrated.projects[0].id])
})

test('同名但文件夹不同的项目不会合并', () => {
  const workspace = root()
  const first = candidate('第一份')
  const second = candidate('第二份')
  second.source = 'claude-code'
  second.projects[0] = { ...second.projects[0], id: 'other-project', source: 'claude-code', folderPath: '/work/another' }
  second.sessions[0] = { ...second.sessions[0], id: 'other-session', source: 'claude-code', projectId: 'other-project' }
  const catalog: ImportCatalog = { version: 1, projects: [...first.projects, ...second.projects], sessions: [], resources: [], batches: [] }
  writeFileSync(join(workspace, 'catalog.json'), JSON.stringify(catalog))
  assert.equal(new ImportStore(workspace).loadCatalog().projects.length, 2)
})

test('更新后撤回会恢复更新前的对话正文', async () => {
  const workspace = root()
  const store = new ImportStore(workspace)
  const first = await store.commit([candidate('第一版')], selection)
  const second = await store.commit([candidate('第二版')], selection)
  assert.notEqual(second.sessions[0].storageBatchId, first.sessions[0].storageBatchId)

  store.revert(second.batch.id)
  const destination = join(workspace, 'copied')
  store.copySessionTo({ id: first.sessions[0].id }, destination)
  const messages = JSON.parse(readFileSync(join(destination, `${first.sessions[0].id}.json`), 'utf8'))
  assert.equal(messages[0].content, '第一版')
})

test('撤回较早批次不会破坏后续更新', async () => {
  const workspace = root()
  const store = new ImportStore(workspace)
  const first = await store.commit([candidate('第一版')], selection)
  const second = await store.commit([candidate('第二版')], selection)

  store.revert(first.batch.id)
  assert.equal(store.loadCatalog().sessions[0].storageBatchId, second.batch.id)
})

test('写入清单前失败时保留原清单和原对话', async () => {
  const workspace = root()
  const original = new ImportStore(workspace)
  const first = await original.commit([candidate('第一版')], selection)
  const failing = new ImportStore(workspace, { beforeCatalogWrite: () => { throw new Error('模拟中断') } })

  await assert.rejects(() => failing.commit([candidate('第二版')], selection), /模拟中断/)
  assert.equal(original.loadCatalog().sessions[0].storageBatchId, first.batch.id)
  const destination = join(workspace, 'copied-after-failure')
  original.copySessionTo({ id: first.sessions[0].id }, destination)
  const messages = JSON.parse(readFileSync(join(destination, `${first.sessions[0].id}.json`), 'utf8'))
  assert.equal(messages[0].content, '第一版')
  assert.equal(existsSync(join(workspace, 'failures')), true)
})

test('受保护的新对话和后续更新的资源不会被早期撤回删除', async () => {
  const workspace = root()
  const store = new ImportStore(workspace)
  const first = await store.commit([candidate('第一版')], selection)
  const changed = candidate('第二版')
  changed.resources[0].fingerprint = contentFingerprint('new instruction')
  const second = await store.commit([changed], selection)

  store.revert(first.batch.id, [first.sessions[0].id])
  const catalog = store.loadCatalog()
  assert.equal(catalog.sessions[0].storageBatchId, second.batch.id)
  assert.equal(catalog.resources[0].importedBatchId, second.batch.id)
})

test('错误记录会隐藏用户目录和敏感内容', () => {
  const message = safeImportError(new Error('/Users/zhouhao/private api_key=abc123 token:xyz --token "private value"'))
  assert.doesNotMatch(message, /zhouhao|abc123|xyz|private value/)
  assert.match(message, /已隐藏/)
})

test('未选择来源时拒绝导入', async () => {
  const store = new ImportStore(root())
  await assert.rejects(() => store.commit([candidate('第一版')], { ...selection, sources: [] }), /至少选择一个/)
})

test('另一处正在导入时拒绝同时写入', async () => {
  const workspace = root()
  writeFileSync(join(workspace, 'import.lock'), JSON.stringify({ token: 'other', pid: process.pid, createdAt: Date.now() }))
  await assert.rejects(() => new ImportStore(workspace).commit([candidate('第一版')], selection), /已有导入正在进行/)
})

test('损坏的导入记录不会被当成空记录覆盖', async () => {
  const workspace = root()
  writeFileSync(join(workspace, 'catalog.json'), '{broken')
  const store = new ImportStore(workspace)
  await assert.rejects(() => store.commit([candidate('第一版')], selection), /导入记录已损坏/)
  assert.equal(readFileSync(join(workspace, 'catalog.json'), 'utf8'), '{broken')
})

test('空间不足时在写入正式记录前停止', async () => {
  const workspace = root()
  const store = new ImportStore(workspace, { availableBytes: () => 1n })
  await assert.rejects(() => store.commit([candidate('需要保存的正文')], selection), /可用空间不足/)
  assert.equal(existsSync(join(workspace, 'catalog.json')), false)
  assert.equal(existsSync(join(workspace, 'versions')), false)
})

test('能识别导入后被用户继续过的对话正文', async () => {
  const workspace = root()
  const visible = join(workspace, 'visible')
  const store = new ImportStore(workspace)
  const first = await store.commit([candidate('第一版')], selection)
  store.copySessionTo({ id: first.sessions[0].id }, visible)
  assert.equal(store.hasVisibleSessionChanged(first.sessions[0].id, visible), false)

  mkdirSync(visible, { recursive: true })
  writeFileSync(join(visible, `${first.sessions[0].id}.json`), JSON.stringify([{ role: 'user', content: '用户继续的新内容' }]))
  assert.equal(store.hasVisibleSessionChanged(first.sessions[0].id, visible), true)
})
