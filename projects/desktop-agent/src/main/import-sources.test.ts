import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { countPending, parseClaudeFile, parseCodexFile, parseCursorTranscript, scanKnownSources } from './import-sources.js'
import type { ImportCatalog } from './import-types.js'

function temp(): string {
  return mkdtempSync(join(tmpdir(), 'xiaolanjing-source-'))
}

function jsonLines(path: string, records: unknown[]): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, records.map((record) => JSON.stringify(record)).join('\n') + '\n')
}

test('Codex 对话保留项目、用户正文和助手正文', () => {
  const path = join(temp(), 'codex.jsonl')
  jsonLines(path, [
    { type: 'session_meta', payload: { id: 'codex-1', cwd: '/work/demo', timestamp: '2026-01-01T00:00:00Z' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '做一个设置页' }] } },
    { type: 'response_item', payload: { type: 'function_call', name: 'read_file' } },
    { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '已经完成' }] } }
  ])
  const result = parseCodexFile(path)
  assert.equal(result.project.name, 'demo')
  assert.equal(result.session.title, '做一个设置页')
  assert.deepEqual(result.session.messages.map((message) => message.content), ['做一个设置页', '已经完成'])
  assert.equal(result.session.compatibility, 'view-only')
  assert.equal(result.unavailable.length, 1)
})

test('Claude Code 使用自定义标题并跳过操作结果和支线', () => {
  const path = join(temp(), 'claude.jsonl')
  jsonLines(path, [
    { type: 'user', sessionId: 'claude-1', uuid: 'u1', cwd: '/work/claude', timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: '检查项目' } },
    { type: 'assistant', sessionId: 'claude-1', uuid: 'a1', cwd: '/work/claude', timestamp: '2026-01-01T00:00:01Z', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Read' }] } },
    { type: 'user', sessionId: 'claude-1', uuid: 'u2', cwd: '/work/claude', timestamp: '2026-01-01T00:00:02Z', message: { role: 'user', content: [{ type: 'tool_result', content: 'secret' }] } },
    { type: 'assistant', sessionId: 'claude-1', uuid: 'a2', cwd: '/work/claude', timestamp: '2026-01-01T00:00:03Z', isSidechain: true, message: { role: 'assistant', content: [{ type: 'text', text: '支线内容' }] } },
    { type: 'assistant', sessionId: 'claude-1', uuid: 'a3', cwd: '/work/claude', timestamp: '2026-01-01T00:00:04Z', message: { role: 'assistant', content: [{ type: 'text', text: '检查完成' }] } },
    { type: 'custom-title', sessionId: 'claude-1', customTitle: '项目检查' }
  ])
  const result = parseClaudeFile(path)
  assert.equal(result.session.title, '项目检查')
  assert.deepEqual(result.session.messages.map((message) => message.content), ['检查项目', '检查完成'])
  assert.equal(result.session.compatibility, 'view-only')
  assert.equal(result.unavailable.length, 1)
})

test('Claude Code 正文和操作记录混在同一条消息时仍标记部分缺失', () => {
  const path = join(temp(), 'claude-mixed.jsonl')
  jsonLines(path, [
    { type: 'user', sessionId: 'claude-mixed', cwd: '/work/claude', message: { role: 'user', content: '开始' } },
    { type: 'assistant', sessionId: 'claude-mixed', cwd: '/work/claude', message: { role: 'assistant', content: [
      { type: 'text', text: '已完成' },
      { type: 'tool_use', name: 'Read' }
    ] } }
  ])
  const result = parseClaudeFile(path)
  assert.equal(result.session.compatibility, 'view-only')
  assert.deepEqual(result.session.messages.map((message) => message.content), ['开始', '已完成'])
})

test('扫描结果包含说明、记忆和能力扩展且全部默认不生效', () => {
  const home = temp()
  jsonLines(join(home, '.codex/sessions/2026/01/a.jsonl'), [
    { type: 'session_meta', payload: { id: 'c1', cwd: '/work/a', timestamp: '2026-01-01T00:00:00Z' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '你好' }] } }
  ])
  mkdirSync(join(home, '.codex/memories'), { recursive: true })
  mkdirSync(join(home, '.codex/skills/demo'), { recursive: true })
  writeFileSync(join(home, '.codex/AGENTS.md'), '全局说明\napi_key=should-not-import')
  writeFileSync(join(home, '.codex/memories/MEMORY.md'), '记忆')
  mkdirSync(join(home, '.codex/memories/rollout_summaries'), { recursive: true })
  writeFileSync(join(home, '.codex/memories/rollout_summaries/old.md'), '自动历史摘要')
  writeFileSync(join(home, '.codex/skills/demo/SKILL.md'), '能力')

  const { preview, candidates } = scanKnownSources(home, undefined)
  assert.equal(preview.sources[0].detected, true)
  assert.equal(preview.sources[0].conversations, 1)
  assert.equal(preview.sources[0].instructions, 1)
  assert.equal(preview.sources[0].memories, 1)
  assert.equal(preview.sources[0].historySummaries, 1)
  assert.equal(preview.sources[0].extensions, 1)
  assert.equal(candidates[0].resources.every((item) => item.enabled === false), true)
  assert.doesNotMatch(candidates[0].resources.map((item) => item.content).join('\n'), /should-not-import/)
  assert.equal(preview.sources[1].detected, false)
})

test('Codex 归档对话进入清单且对话正文隐藏敏感内容', () => {
  const home = temp()
  jsonLines(join(home, '.codex/archived_sessions/archived.jsonl'), [
    { type: 'session_meta', payload: { id: 'archived-1', cwd: '/work/archive', timestamp: '2026-01-01T00:00:00Z' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'api_key=should-not-survive' }] } },
    { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Bearer private-token-value' }] } }
  ])

  const { preview, candidates } = scanKnownSources(home, undefined)
  assert.equal(preview.sources[0].conversations, 1)
  assert.equal(candidates[0].sessions[0].archived, true)
  assert.doesNotMatch(candidates[0].sessions[0].messages.map((message) => message.content).join('\n'), /should-not-survive|private-token-value/)
})

test('对话名称和归档状态变化会被识别为增量更新', () => {
  const path = join(temp(), 'cursor-metadata.jsonl')
  jsonLines(path, [{ role: 'user', message: { content: [{ type: 'text', text: '相同正文' }] } }])
  const first = parseCursorTranscript(path, {
    composerId: 'cursor-metadata', name: '旧名称', isArchived: false,
    workspaceIdentifier: { uri: { fsPath: '/work/cursor' } }
  }).session
  const second = parseCursorTranscript(path, {
    composerId: 'cursor-metadata', name: '新名称', isArchived: true,
    workspaceIdentifier: { uri: { fsPath: '/work/cursor' } }
  }).session
  assert.notEqual(first.fingerprint, second.fingerprint)
})

test('带引号的命令参数会完整隐藏', () => {
  const path = join(temp(), 'quoted-secret.jsonl')
  jsonLines(path, [
    { type: 'session_meta', payload: { id: 'quoted-secret', cwd: '/work/secret' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'run --token "private value" --password\'another value\'' }] } }
  ])
  const content = parseCodexFile(path).session.messages[0].content
  assert.doesNotMatch(content, /private value|another value/)
  assert.match(content, /--token \[已隐藏\]|--password\[已隐藏\]/)
})

test('部分缺失和完全无法读取分开统计', () => {
  const home = temp()
  jsonLines(join(home, '.codex/sessions/partial.jsonl'), [
    { type: 'session_meta', payload: { id: 'partial-1', cwd: '/work/partial' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '正文' }] } },
    { type: 'response_item', payload: { type: 'function_call', name: 'read_file' } }
  ])
  jsonLines(join(home, '.codex/sessions/failed.jsonl'), [
    { type: 'session_meta', payload: { id: 'failed-1', cwd: '/work/failed' } }
  ])

  const { preview } = scanKnownSources(home, undefined)
  assert.equal(preview.sources[0].viewOnlyConversations, 1)
  assert.equal(preview.sources[0].failedConversations, 1)
  assert.equal(preview.sources[0].unavailable, 2)
})

test('个性化资料覆盖分层说明、外部连接和自动动作且默认关闭', () => {
  const home = temp()
  const projectRoot = join(home, 'work/demo')
  const workingFolder = join(projectRoot, 'packages/app')
  jsonLines(join(home, '.claude/projects/demo/session.jsonl'), [
    { type: 'user', sessionId: 'claude-settings', cwd: workingFolder, message: { role: 'user', content: '开始' } }
  ])
  mkdirSync(join(projectRoot, '.git'), { recursive: true })
  mkdirSync(workingFolder, { recursive: true })
  writeFileSync(join(projectRoot, 'CLAUDE.md'), '根说明')
  writeFileSync(join(workingFolder, 'AGENTS.md'), '分层说明')
  mkdirSync(join(home, '.claude/commands'), { recursive: true })
  writeFileSync(join(home, '.claude/commands/review.md'), '自动动作')
  mkdirSync(join(home, '.claude/mcp-configs'), { recursive: true })
  writeFileSync(join(home, '.claude/mcp-configs/mcp-servers.json'), JSON.stringify({
    mcpServers: { demo: { command: 'demo', env: { API_KEY: 'private-value' } } }
  }))

  const { candidates } = scanKnownSources(home, undefined)
  const resources = candidates[1].resources
  assert.equal(resources.filter((item) => item.kind === 'instruction').length, 2)
  assert.equal(resources.some((item) => item.kind === 'automation'), true)
  assert.equal(resources.some((item) => item.kind === 'mcp'), true)
  assert.equal(resources.every((item) => item.enabled === false), true)
  assert.doesNotMatch(resources.map((item) => item.content).join('\n'), /private-value/)
})

test('新增资料判断区分首次、完全重复和内容变化', () => {
  const home = temp()
  jsonLines(join(home, '.codex/sessions/2026/01/a.jsonl'), [
    { type: 'session_meta', payload: { id: 'c1', cwd: '/work/a', timestamp: '2026-01-01T00:00:00Z' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '第一版' }] } }
  ])
  const candidate = scanKnownSources(home, undefined).candidates[0]
  const empty: ImportCatalog = { version: 1, projects: [], sessions: [], resources: [], batches: [] }
  assert.equal(countPending(candidate, empty), 2)

  const imported: ImportCatalog = {
    ...empty,
    projects: candidate.projects,
    sessions: candidate.sessions.map(({ messages: _messages, turns: _turns, ...session }) => ({ ...session, storageBatchId: 'old' }))
  }
  assert.equal(countPending(candidate, imported), 0)
  imported.sessions[0].fingerprint = 'older-content'
  assert.equal(countPending(candidate, imported), 1)
})

test('缺少稳定编号或项目位置的对话明确拒绝', () => {
  const path = join(temp(), 'broken.jsonl')
  jsonLines(path, [{ type: 'session_meta', payload: { id: 'missing-workspace' } }])
  assert.throws(() => parseCodexFile(path), /缺少对话编号或项目位置/)
})

test('Cursor 3.10 对话副本可还原项目、标题和正文', () => {
  const path = join(temp(), 'cursor-1.jsonl')
  jsonLines(path, [
    { role: 'user', message: { content: [{ type: 'text', text: '检查设置页' }] } },
    { role: 'assistant', message: { content: [{ type: 'text', text: '检查完成' }] } }
  ])
  const result = parseCursorTranscript(path, {
    composerId: 'cursor-1', name: '设置页检查', createdAt: 10, lastUpdatedAt: 20,
    workspaceIdentifier: { uri: { fsPath: '/work/cursor' } }
  })
  assert.equal(result.project.name, 'cursor')
  assert.equal(result.session.title, '设置页检查')
  assert.deepEqual(result.session.messages.map((message) => message.content), ['检查设置页', '检查完成'])
  assert.equal(result.session.compatibility, 'view-only')
})

test('Cursor 只保留真实提问并提取用户图片', () => {
  const root = temp()
  const imagePath = join(root, 'question.png')
  writeFileSync(imagePath, Buffer.from('image-content'))
  const path = join(root, 'cursor-wrapped.jsonl')
  jsonLines(path, [{
    role: 'user', message: { content: [{ type: 'text', text: `[Image]\n<image_files>\nThe following images were provided by the user:\n1. ${imagePath}\n</image_files>\n<timestamp>today</timestamp>\n<user_query>\n把这个项目拉下来\n</user_query>` }] }
  }])

  const result = parseCursorTranscript(path, {
    composerId: 'cursor-wrapped', workspaceIdentifier: { uri: { fsPath: '/work/cursor' } }
  })
  assert.equal(result.session.messages[0].content, '把这个项目拉下来')
  assert.doesNotMatch(result.session.title, /user_query|timestamp|image_files/)
  assert.equal(result.session.assets.length, 1)
  assert.equal(result.session.turns[0].items[0].type, 'userMessage')
  assert.equal(result.session.turns[0].items[0].content[1].type, 'image')
})

test('Cursor 图片原文件丢失时保留明确提示', () => {
  const path = join(temp(), 'cursor-missing-image.jsonl')
  jsonLines(path, [{ role: 'user', message: { content: `<image_files>\n1. /missing/question.png\n</image_files>\n<user_query>看图</user_query>` } }])
  const result = parseCursorTranscript(path, {
    composerId: 'cursor-missing-image', workspaceIdentifier: { uri: { fsPath: '/work/cursor' } }
  })
  assert.equal(result.session.assets[0].unavailableReason, '原图已不存在')
})

test('Codex 和 Claude Code 的内嵌用户图片进入对应提问', () => {
  const root = temp()
  const data = Buffer.from('embedded-image').toString('base64')
  const codexPath = join(root, 'codex-image.jsonl')
  jsonLines(codexPath, [
    { type: 'session_meta', payload: { id: 'codex-image', cwd: '/work/codex' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [
      { type: 'input_image', image_url: `data:image/png;base64,${data}` },
      { type: 'input_text', text: '看这张图' }
    ] } }
  ])
  const claudePath = join(root, 'claude-image.jsonl')
  jsonLines(claudePath, [{
    type: 'user', sessionId: 'claude-image', cwd: '/work/claude', message: { content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data } },
      { type: 'text', text: '分析图片' }
    ] }
  }])

  const codex = parseCodexFile(codexPath).session
  const claude = parseClaudeFile(claudePath).session
  assert.equal(codex.assets.length, 1)
  assert.equal(claude.assets.length, 1)
  assert.equal(codex.turns[0].items[0].content.some((item) => item.type === 'image'), true)
  assert.equal(claude.turns[0].items[0].content.some((item) => item.type === 'image'), true)
})

test('三个来源指向同一文件夹时使用同一个项目身份', () => {
  const root = temp()
  const codexPath = join(root, 'codex.jsonl')
  const claudePath = join(root, 'claude.jsonl')
  const cursorPath = join(root, 'cursor.jsonl')
  jsonLines(codexPath, [
    { type: 'session_meta', payload: { id: 'codex-shared', cwd: '/work/shared/' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: 'Codex' } }
  ])
  jsonLines(claudePath, [
    { type: 'user', sessionId: 'claude-shared', cwd: '/work/shared', message: { content: 'Claude' } }
  ])
  jsonLines(cursorPath, [{ role: 'user', message: { content: 'Cursor' } }])

  const codex = parseCodexFile(codexPath)
  const claude = parseClaudeFile(claudePath)
  const cursor = parseCursorTranscript(cursorPath, {
    composerId: 'cursor', workspaceIdentifier: { uri: { fsPath: '/work/shared' } }
  })
  assert.equal(codex.project.id, claude.project.id)
  assert.equal(claude.project.id, cursor.project.id)
})

test('Cursor 对话无法确认所属项目时拒绝猜测', () => {
  const path = join(temp(), 'cursor-2.jsonl')
  jsonLines(path, [{ role: 'user', message: { content: [{ type: 'text', text: '你好' }] } }])
  assert.throws(() => parseCursorTranscript(path, { composerId: 'cursor-2' }), /无法确认对话所属项目/)
})

test('未知 Cursor 版本只能预览，不能正式导入对话', () => {
  const home = temp()
  jsonLines(join(home, '.cursor/projects/demo/agent-transcripts/cursor-3/cursor-3.jsonl'), [
    { role: 'user', message: { content: [{ type: 'text', text: '你好' }] } }
  ])
  const { preview, candidates } = scanKnownSources(home, '99.0.0')
  assert.equal(preview.sources[2].compatibility, 'unsupported')
  assert.equal(candidates[2].sessions.length, 0)
  assert.equal(candidates[2].unavailable.length, 1)
})

test('缺少 Cursor 资料读取条件时明确停止完整导入', () => {
  const home = temp()
  mkdirSync(join(home, 'Library/Application Support/Cursor/User/globalStorage'), { recursive: true })
  writeFileSync(join(home, 'Library/Application Support/Cursor/User/globalStorage/state.vscdb'), '')
  const { preview } = scanKnownSources(home, '3.10.15', false)
  assert.equal(preview.sources[2].compatibility, 'unsupported')
  assert.match(preview.sources[2].note || '', /无法可靠读取/)
})
