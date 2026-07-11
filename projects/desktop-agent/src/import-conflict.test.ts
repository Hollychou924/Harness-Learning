import test from 'node:test'
import assert from 'node:assert/strict'
import { pickConflictAuthority } from './import-conflict.js'
import type { ImportCategoryCounts, ImportCategoryId, ImportSourceId } from './main/import-types.js'

function counts(partial: Partial<ImportCategoryCounts>): ImportCategoryCounts {
  return {
    globalRules: 0, globalMemory: 0, globalMcp: 0, globalSkills: 0,
    projectRules: 0, projectMemory: 0, projectChatProjects: 0, projectChatConversations: 0,
    projectMcp: 0, projectSkills: 0,
    ...partial
  }
}

test('冲突裁决选已勾选项数量最多的来源', () => {
  const sources: ImportSourceId[] = ['codex', 'claude-code', 'cursor']
  const categories: ImportCategoryId[] = ['global-mcp', 'global-skills']
  const map = new Map<ImportSourceId, ImportCategoryCounts>([
    ['codex', counts({ globalMcp: 5, globalSkills: 10 })],
    ['claude-code', counts({ globalMcp: 28, globalSkills: 50 })],
    ['cursor', counts({ globalMcp: 7, globalSkills: 21 })]
  ])
  assert.equal(pickConflictAuthority(sources, categories, map), 'claude-code')
})

test('数量相同则优先较后注册的来源', () => {
  const sources: ImportSourceId[] = ['codex', 'cursor']
  const categories: ImportCategoryId[] = ['global-skills']
  const map = new Map<ImportSourceId, ImportCategoryCounts>([
    ['codex', counts({ globalSkills: 10 })],
    ['cursor', counts({ globalSkills: 10 })]
  ])
  assert.equal(pickConflictAuthority(sources, categories, map), 'cursor')
})
