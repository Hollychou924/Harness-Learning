import type { AgentMessage } from '../agent/src/protocol.js'
import type { Turn } from '../agent/src/items.js'

export type ImportSourceId = 'codex' | 'claude-code' | 'cursor'
export type ImportCompatibility = 'full' | 'view-only' | 'unsupported'

/** 导入清单矩阵行（V1） */
export type ImportCategoryId =
  | 'global-rules'
  | 'global-memory'
  | 'global-mcp'
  | 'global-skills'
  | 'project-rules'
  | 'project-memory'
  | 'project-chats'
  | 'project-mcp'
  | 'project-skills'

export const ALL_IMPORT_CATEGORIES: ImportCategoryId[] = [
  'global-rules', 'global-memory', 'global-mcp', 'global-skills',
  'project-rules', 'project-memory', 'project-chats', 'project-mcp', 'project-skills'
]

export interface ImportCategoryCounts {
  globalRules: number
  globalMemory: number
  globalMcp: number
  globalSkills: number
  projectRules: number
  projectMemory: number
  /** 项目数 */
  projectChatProjects: number
  /** 对话数 */
  projectChatConversations: number
  projectMcp: number
  projectSkills: number
}

export interface ImportSourceSummary {
  id: ImportSourceId
  name: string
  detected: boolean
  version?: string
  compatibility: ImportCompatibility
  projects: number
  conversations: number
  viewOnlyConversations: number
  failedConversations: number
  instructions: number
  memories: number
  historySummaries: number
  extensions: number
  unavailable: number
  pending: number
  importedConversations: number
  importedProjects: number
  /** 矩阵单元格计数 */
  categories: ImportCategoryCounts
  note?: string
}

export interface ImportPreview {
  scannedAt: number
  sources: ImportSourceSummary[]
}

export interface ImportedProject {
  id: string
  source: ImportSourceId
  sourceProjectId: string
  name: string
  folderPath?: string
  createdAt: number
  updatedAt: number
}

export interface ImportedSession {
  id: string
  source: ImportSourceId
  sourceSessionId: string
  sourceProjectId: string
  projectId: string
  title: string
  createdAt: number
  updatedAt: number
  archived: boolean
  compatibility: ImportCompatibility
  fingerprint: string
  messages: AgentMessage[]
  turns: Turn[]
  assets: ImportedAsset[]
}

export type ImportedSessionRecord = Omit<ImportedSession, 'messages' | 'turns' | 'assets'> & {
  storageBatchId: string
  assetIds?: string[]
}

export interface ImportedAsset {
  id: string
  name: string
  mime: string
  size: number
  sourcePath?: string
  base64?: string
  unavailableReason?: string
}

export interface ImportedResource {
  id: string
  source: ImportSourceId
  sourceId: string
  projectId?: string
  kind: 'instruction' | 'memory' | 'history-summary' | 'skill' | 'mcp' | 'automation' | 'agent'
  name: string
  sourcePath?: string
  content?: string
  enabled: false
  fingerprint: string
}

export type ImportedResourceRecord = ImportedResource & {
  importedBatchId: string
}

export interface ImportCandidate {
  source: ImportSourceId
  projects: ImportedProject[]
  sessions: ImportedSession[]
  resources: ImportedResource[]
  unavailable: Array<{ sourceId: string; reason: string; severity?: 'partial' | 'failed' }>
}

export interface ImportSelection {
  sources: ImportSourceId[]
  /** 勾选的矩阵行；缺省时按下方三个布尔开关兼容旧调用 */
  categories?: ImportCategoryId[]
  /** 多来源同配置冲突时保留哪一个 */
  conflictAuthority?: ImportSourceId
  /** @deprecated 兼容旧 UI；有 categories 时忽略 */
  includeProjectsAndConversations?: boolean
  /** @deprecated */
  includeInstructionsAndMemory?: boolean
  /** @deprecated */
  includeExtensions?: boolean
}

export interface ImportBatch {
  id: string
  createdAt: number
  completedAt?: number
  status: 'preparing' | 'completed' | 'failed' | 'reverted'
  sources: ImportSourceId[]
  createdProjectIds: string[]
  createdSessionIds: string[]
  updatedSessionIds: string[]
  skippedSessionIds: string[]
  resourceIds: string[]
  sessionChanges: Array<{
    id: string
    before?: ImportedSessionRecord
    after: ImportedSessionRecord
  }>
  resourceChanges: Array<{
    id: string
    before?: ImportedResourceRecord
    after: ImportedResourceRecord
  }>
  failed: Array<{ sourceId: string; reason: string; severity?: 'partial' | 'failed' }>
}

export interface ImportCatalog {
  version: 1
  projects: ImportedProject[]
  sessions: ImportedSessionRecord[]
  resources: ImportedResourceRecord[]
  batches: ImportBatch[]
}

export interface ImportResult {
  batch: ImportBatch
  projects: ImportedProject[]
  sessions: ImportedSessionRecord[]
}
