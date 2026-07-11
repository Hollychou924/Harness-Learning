import type { ImportCategoryCounts, ImportCategoryId, ImportSourceId } from './main/import-types.js'

export const IMPORT_SOURCE_ORDER: ImportSourceId[] = ['codex', 'claude-code', 'cursor']

export function categoryImportScore(counts: ImportCategoryCounts, category: ImportCategoryId): number {
  switch (category) {
    case 'global-rules': return counts.globalRules
    case 'global-memory': return counts.globalMemory
    case 'global-mcp': return counts.globalMcp
    case 'global-skills': return counts.globalSkills
    case 'project-rules': return counts.projectRules
    case 'project-memory': return counts.projectMemory
    case 'project-chats': return counts.projectChatProjects + counts.projectChatConversations
    case 'project-mcp': return counts.projectMcp
    case 'project-skills': return counts.projectSkills
  }
}

/** 多来源导入时：在已勾选项里，选扫描数量合计最多的来源作为 MCP/Skills 冲突裁决方 */
export function pickConflictAuthority(
  sources: ImportSourceId[],
  categories: ImportCategoryId[],
  countsBySource: Map<ImportSourceId, ImportCategoryCounts>
): ImportSourceId | undefined {
  if (sources.length <= 1 || categories.length === 0) return undefined

  let best = sources[0]
  let bestScore = -1
  for (const sourceId of sources) {
    const counts = countsBySource.get(sourceId)
    if (!counts) continue
    const score = categories.reduce((sum, category) => sum + categoryImportScore(counts, category), 0)
    const order = IMPORT_SOURCE_ORDER.indexOf(sourceId)
    const bestOrder = IMPORT_SOURCE_ORDER.indexOf(best)
    if (score > bestScore || (score === bestScore && order > bestOrder)) {
      best = sourceId
      bestScore = score
    }
  }
  return best
}
