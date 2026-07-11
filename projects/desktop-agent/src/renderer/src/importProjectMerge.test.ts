import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeImportedLists, removeImportedLists, type VisibleProject, type VisibleSession } from './importProjectMerge.js'

function project(id: string, imported: boolean, folderPath = '/work/逆向'): VisibleProject {
  return {
    id, name: imported ? '逆向' : '用户改名', icon: imported ? '📁' : '⭐', createdAt: imported ? 2 : 1,
    updatedAt: 2, pinned: !imported, order: imported ? 2 : 0, folderPath,
    ...(imported ? { importedSourceName: '逆向', importedSourceFolderPath: folderPath } : {})
  }
}

function session(id: string, projectId: string): VisibleSession {
  return { id, title: id, projectId, createdAt: 1, updatedAt: 1, archived: false }
}

test('同一文件夹优先复用用户原有项目并保留全部对话', () => {
  const result = mergeImportedLists(
    [project('manual', false), project('codex-old', true), project('claude-old', true)],
    [session('manual-session', 'manual'), session('codex-session', 'codex-old'), session('claude-session', 'claude-old')],
    [{ id: 'shared-new', name: '逆向', folderPath: '/work/逆向/', createdAt: 1, updatedAt: 3 }],
    [
      { id: 'codex-session', title: 'Codex', projectId: 'shared-new', createdAt: 1, updatedAt: 2, archived: false },
      { id: 'claude-session', title: 'Claude', projectId: 'shared-new', createdAt: 1, updatedAt: 2, archived: false }
    ]
  )
  assert.equal(result.projects.length, 1)
  assert.equal(result.projects[0].id, 'manual')
  assert.equal(result.projects[0].name, '用户改名')
  assert.equal(result.projects[0].icon, '⭐')
  assert.equal(result.projects[0].pinned, true)
  assert.equal(result.sessions.length, 3)
  assert.equal(result.sessions.every((item) => item.projectId === 'manual'), true)
  assert.equal(result.projectIdChanges.get('codex-old'), 'manual')
  assert.equal(result.projectIdChanges.get('claude-old'), 'manual')
  assert.equal(result.projectIdChanges.get('shared-new'), 'manual')
})

test('同名但不同文件夹的项目保持分开', () => {
  const result = mergeImportedLists(
    [project('manual', false, '/work/one')], [],
    [{ id: 'incoming', name: '用户改名', folderPath: '/work/two', createdAt: 1, updatedAt: 1 }], []
  )
  assert.equal(result.projects.length, 2)
})

test('用户手动移到其他项目的导入对话不会被移回', () => {
  const moved = { ...session('imported-session', 'other'), title: '旧标题', importedSourceTitle: '旧标题', importedSourceProjectId: 'old-import', importedSourceArchived: false }
  const result = mergeImportedLists(
    [project('old-import', true), project('other', false, '/work/other')], [moved],
    [{ id: 'new-import', name: '逆向', folderPath: '/work/逆向', createdAt: 1, updatedAt: 2 }],
    [{ id: 'imported-session', title: '新标题', projectId: 'new-import', createdAt: 1, updatedAt: 2, archived: false }]
  )
  assert.equal(result.sessions[0].projectId, 'other')
  assert.equal(result.sessions[0].title, '新标题')
})

test('撤回导入只删除导入创建的空项目，不删除复用的用户项目', () => {
  const result = removeImportedLists(
    [project('manual', false), project('imported', true)],
    [session('manual-session', 'manual'), session('imported-session', 'imported')],
    ['manual', 'imported'],
    ['manual-session', 'imported-session']
  )
  assert.deepEqual(result.projects.map((item) => item.id), ['manual'])
  assert.equal(result.sessions.length, 0)
})
