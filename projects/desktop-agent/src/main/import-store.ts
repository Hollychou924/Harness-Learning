import { createHash, randomUUID } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statfsSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  ImportBatch,
  ImportCandidate,
  ImportCatalog,
  ImportCategoryId,
  ImportResult,
  ImportSelection,
  ImportedResource,
  ImportedResourceRecord,
  ImportedSession,
  ImportedSessionRecord,
  ImportedAsset
} from './import-types.js'
import { normalizedProjectPath } from './import-project.js'
import { buildCategoryCounts } from './import-sources.js'
import { pickConflictAuthority } from '../import-conflict.js'

const EMPTY_CATALOG: ImportCatalog = { version: 1, projects: [], sessions: [], resources: [], batches: [] }

function resourceCategoryLocal(resource: ImportedResource): ImportCategoryId | undefined {
  if (resource.kind === 'instruction') return resource.projectId ? 'project-rules' : 'global-rules'
  if (resource.kind === 'memory' || resource.kind === 'history-summary') return resource.projectId ? 'project-memory' : 'global-memory'
  if (resource.kind === 'mcp') return resource.projectId ? 'project-mcp' : 'global-mcp'
  if (resource.kind === 'skill') return resource.projectId ? 'project-skills' : 'global-skills'
  return undefined
}

export function resolveImportCategories(selection: ImportSelection): Set<ImportCategoryId> {
  // 显式传了 categories（含空数组）就严格按它来，禁止再回退成「全选」
  if (selection.categories) return new Set(selection.categories)
  const categories = new Set<ImportCategoryId>()
  if (selection.includeProjectsAndConversations) categories.add('project-chats')
  if (selection.includeInstructionsAndMemory) {
    categories.add('global-rules')
    categories.add('global-memory')
    categories.add('project-rules')
    categories.add('project-memory')
  }
  if (selection.includeExtensions) {
    categories.add('global-mcp')
    categories.add('global-skills')
    categories.add('project-mcp')
    categories.add('project-skills')
  }
  return categories
}

export function resourceMatchesSelection(resource: ImportedResource, selection: ImportSelection): boolean {
  const category = resourceCategoryLocal(resource)
  if (!category) return false
  return resolveImportCategories(selection).has(category)
}

/** MCP / Skills 同名冲突：保留 conflictAuthority 来源；同内容去重 */
export function dedupeResourcesByAuthority(resources: ImportedResource[], selection: ImportSelection): ImportedResource[] {
  const authority = selection.conflictAuthority
  const byKey = new Map<string, ImportedResource>()
  const rank = (source: string) => {
    if (!authority) return 0
    return source === authority ? 2 : 1
  }
  for (const resource of resources) {
    if (resource.kind !== 'mcp' && resource.kind !== 'skill') {
      byKey.set(`${resource.id}`, resource)
      continue
    }
    const key = `${resource.kind}:${resource.projectId || 'global'}:${resource.name.toLowerCase()}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, resource)
      continue
    }
    if (existing.fingerprint === resource.fingerprint) continue
    if (rank(resource.source) >= rank(existing.source)) byKey.set(key, resource)
  }
  // 非 mcp/skill 用 id 键；mcp/skill 用 name 键 — 统一输出
  const seen = new Set<string>()
  const result: ImportedResource[] = []
  for (const resource of resources) {
    if (resource.kind === 'mcp' || resource.kind === 'skill') {
      const key = `${resource.kind}:${resource.projectId || 'global'}:${resource.name.toLowerCase()}`
      const chosen = byKey.get(key)
      if (!chosen || seen.has(key)) continue
      seen.add(key)
      result.push(chosen)
      continue
    }
    if (seen.has(resource.id)) continue
    seen.add(resource.id)
    result.push(resource)
  }
  return result
}

export function stableId(prefix: string, value: string): string {
  return `${prefix}-${createHash('sha256').update(value).digest('hex').slice(0, 24)}`
}

export function contentFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function safeImportError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/\/Users\/[^/]+/g, '~')
    .replace(/((?:api[_-]?key|token|secret|password)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[已隐藏]')
    .replace(/((?:--?(?:api[_-]?key|token|secret|password|authorization|credential))(?:(?:\s*=\s*)|\s+|(?=["'])))(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[已隐藏]')
    .slice(0, 300)
}

interface ImportStoreOptions {
  beforeCatalogWrite?: () => void
  availableBytes?: () => bigint
}

export class ImportStore {
  private busy = false

  constructor(private readonly rootDir: string, private readonly options: ImportStoreOptions = {}) {}

  private catalogPath(): string { return join(this.rootDir, 'catalog.json') }
  private versionsDir(): string { return join(this.rootDir, 'versions') }
  private assetsDir(): string { return join(this.rootDir, 'assets') }
  private stagingDir(batchId: string): string { return join(this.rootDir, 'staging', batchId) }
  private versionDir(batchId: string): string { return join(this.versionsDir(), batchId) }
  private failurePath(batchId: string): string { return join(this.rootDir, 'failures', `${batchId}.json`) }
  private lockPath(): string { return join(this.rootDir, 'import.lock') }

  loadCatalog(): ImportCatalog {
    if (!existsSync(this.catalogPath())) return structuredClone(EMPTY_CATALOG)
    try {
      const parsed = JSON.parse(readFileSync(this.catalogPath(), 'utf8')) as ImportCatalog
      if (parsed.version !== 1 || !Array.isArray(parsed.projects) || !Array.isArray(parsed.sessions) ||
        !Array.isArray(parsed.resources) || !Array.isArray(parsed.batches)) {
        throw new Error('导入记录格式无法识别')
      }
      return this.normalizeCatalogProjects(parsed)
    } catch {
      throw new Error('导入记录已损坏，请先恢复记录后重试')
    }
  }

  private normalizeCatalogProjects(catalog: ImportCatalog): ImportCatalog {
    const projectIds = new Map<string, string>()
    const projects = new Map<string, ImportCatalog['projects'][number]>()
    for (const item of catalog.projects) {
      if (!item.folderPath) {
        projects.set(item.id, item)
        continue
      }
      const folderPath = normalizedProjectPath(item.folderPath)
      const id = stableId('project', folderPath)
      projectIds.set(item.id, id)
      const existing = projects.get(id)
      if (!existing) projects.set(id, { ...item, id, folderPath })
      else projects.set(id, {
        ...existing,
        createdAt: Math.min(existing.createdAt, item.createdAt),
        updatedAt: Math.max(existing.updatedAt, item.updatedAt)
      })
    }
    const remapSession = <T extends ImportedSessionRecord>(item: T): T => {
      const projectId = projectIds.get(item.projectId) || item.projectId
      if (projectId === item.projectId) return item
      let fingerprint = item.fingerprint
      try {
        const messages = JSON.parse(readFileSync(join(this.versionDir(item.storageBatchId), `${item.id}.json`), 'utf8'))
        const turns = JSON.parse(readFileSync(join(this.versionDir(item.storageBatchId), `${item.id}.turns.json`), 'utf8'))
        fingerprint = contentFingerprint({ title: item.title, projectId, archived: item.archived, messages, turns })
      } catch {
        // Missing historical payloads must not prevent the catalog from being recovered.
      }
      return { ...item, projectId, fingerprint }
    }
    const remapResource = <T extends ImportedResourceRecord>(item: T): T => ({
      ...item,
      projectId: item.projectId ? projectIds.get(item.projectId) || item.projectId : undefined
    })
    const uniqueIds = (ids: string[]): string[] => [...new Set(ids.map((id) => projectIds.get(id) || id))]
    return {
      ...catalog,
      projects: [...projects.values()],
      sessions: catalog.sessions.map(remapSession),
      resources: catalog.resources.map(remapResource),
      batches: catalog.batches.map((batch) => ({
        ...batch,
        createdProjectIds: uniqueIds(batch.createdProjectIds),
        sessionChanges: batch.sessionChanges.map((change) => ({
          ...change,
          before: change.before ? remapSession(change.before) : undefined,
          after: remapSession(change.after)
        })),
        resourceChanges: batch.resourceChanges.map((change) => ({
          ...change,
          before: change.before ? remapResource(change.before) : undefined,
          after: remapResource(change.after)
        }))
      }))
    }
  }

  private acquireLock(): string {
    mkdirSync(this.rootDir, { recursive: true })
    const token = randomUUID()
    const create = (): string => {
      const handle = openSync(this.lockPath(), 'wx')
      try {
        writeFileSync(handle, JSON.stringify({ token, pid: process.pid, createdAt: Date.now() }), 'utf8')
      } finally {
        closeSync(handle)
      }
      return token
    }
    try {
      return create()
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : ''
      if (code !== 'EEXIST') throw error
      try {
        const lock = JSON.parse(readFileSync(this.lockPath(), 'utf8')) as { pid?: number }
        if (typeof lock.pid === 'number') process.kill(lock.pid, 0)
        throw new Error('已有导入正在进行')
      } catch (lockError) {
        if (lockError instanceof Error && lockError.message === '已有导入正在进行') throw lockError
        unlinkSync(this.lockPath())
        return create()
      }
    }
  }

  private releaseLock(token: string): void {
    try {
      const lock = JSON.parse(readFileSync(this.lockPath(), 'utf8')) as { token?: string }
      if (lock.token === token) unlinkSync(this.lockPath())
    } catch {
      // A missing or replaced lock must not remove another import's lock.
    }
  }

  private writeJsonAtomic(path: string, value: unknown): void {
    mkdirSync(dirname(path), { recursive: true })
    const temporary = `${path}.${randomUUID()}.tmp`
    writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8')
    renameSync(temporary, path)
  }

  async commit(candidates: ImportCandidate[], selection: ImportSelection): Promise<ImportResult> {
    if (this.busy) throw new Error('已有导入正在进行')
    if (selection.sources.length === 0) throw new Error('至少选择一个导入来源')
    const resolvedCategories = resolveImportCategories(selection)
    if (resolvedCategories.size === 0) throw new Error('请至少勾选一项导入内容')
    const selected = candidates.filter((candidate) => selection.sources.includes(candidate.source))
    const countsBySource = new Map(selected.map((candidate) => [candidate.source, buildCategoryCounts(candidate)]))
    const conflictAuthority = selection.sources.length > 1
      ? pickConflictAuthority(selection.sources, [...resolvedCategories], countsBySource)
      : undefined
    const normalizedSelection: ImportSelection = {
      ...selection,
      categories: [...resolvedCategories],
      conflictAuthority: conflictAuthority || selection.sources[selection.sources.length - 1]
    }
    this.busy = true
    let lockToken: string | undefined
    const batch: ImportBatch = {
      id: `import-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
      createdAt: Date.now(),
      status: 'preparing',
      sources: normalizedSelection.sources,
      createdProjectIds: [], createdSessionIds: [], updatedSessionIds: [], skippedSessionIds: [], resourceIds: [],
      sessionChanges: [], resourceChanges: [], failed: []
    }
    const staging = this.stagingDir(batch.id)
    const version = this.versionDir(batch.id)
    try {
      lockToken = this.acquireLock()
      const catalog = this.loadCatalog()
      mkdirSync(staging, { recursive: true })
      const selected = candidates.filter((candidate) => normalizedSelection.sources.includes(candidate.source))
      const incomingProjectIds = new Map<string, string>()
      const normalizedProjects = selected.flatMap((candidate) => candidate.projects).map((item) => {
        if (!item.folderPath) return item
        const folderPath = normalizedProjectPath(item.folderPath)
        const id = stableId('project', folderPath)
        incomingProjectIds.set(item.id, id)
        return { ...item, id, folderPath }
      })
      const categories = resolveImportCategories(normalizedSelection)
      const includeChats = categories.has('project-chats')
      const projects = includeChats
        ? [...new Map(normalizedProjects.map((item) => [item.id, item])).values()]
        : []
      const sessions = includeChats ? selected.flatMap((candidate) => candidate.sessions).map((item) => {
        const projectId = incomingProjectIds.get(item.projectId) || item.projectId
        return projectId === item.projectId ? item : {
          ...item,
          projectId,
          fingerprint: contentFingerprint({ title: item.title, projectId, archived: item.archived, messages: item.messages, turns: item.turns })
        }
      }) : []
      const resourceProjectIds = new Set(selected.flatMap((c) => c.resources).map((r) => r.projectId).filter(Boolean) as string[])
      const projectsForCatalog = includeChats
        ? projects
        : [...new Map(normalizedProjects.filter((p) => resourceProjectIds.has(p.id) || resourceProjectIds.has(incomingProjectIds.get(p.id) || '')).map((item) => {
            const id = incomingProjectIds.get(item.id) || item.id
            return [id, { ...item, id }]
          })).values()]
      const catalogProjects = includeChats ? projects : projectsForCatalog

      const resources = selected.flatMap((candidate) => candidate.resources).map((item) => ({
        ...item,
        projectId: item.projectId ? incomingProjectIds.get(item.projectId) || item.projectId : undefined
      })).filter((resource) => resourceMatchesSelection(resource, normalizedSelection))
      const dedupedResources = dedupeResourcesByAuthority(resources, normalizedSelection)
      batch.failed.push(...selected.flatMap((candidate) => candidate.unavailable))

      const uniqueIncomingAssets = [...new Map(sessions.flatMap((session) => session.assets || []).map((asset) => [asset.id, asset])).values()]
      const newAssetBytes = uniqueIncomingAssets.reduce((total, asset) =>
        total + (!asset.unavailableReason && !existsSync(join(this.assetsDir(), asset.id)) && asset.base64
          ? Buffer.byteLength(asset.base64, 'base64') : 0), 0)
      const estimatedBytes = sessions.reduce((total, session) => total + Buffer.byteLength(JSON.stringify(session.messages)) + Buffer.byteLength(JSON.stringify(session.turns)), 0) +
        newAssetBytes +
        dedupedResources.reduce((total, item) => total + Buffer.byteLength(item.content || ''), 0)
      const filesystem = this.options.availableBytes ? undefined : statfsSync(this.rootDir, { bigint: true })
      const availableBytes = this.options.availableBytes
        ? this.options.availableBytes()
        : filesystem!.bavail * filesystem!.bsize
      const requiredBytes = BigInt(Math.max(16 * 1024 * 1024, estimatedBytes * 2))
      if (availableBytes < requiredBytes) throw new Error('本机可用空间不足，无法安全完成导入')

      for (const project of catalogProjects) {
        if (!catalog.projects.some((item) => item.id === project.id)) {
          catalog.projects.push(project)
          batch.createdProjectIds.push(project.id)
        }
      }
      mkdirSync(this.assetsDir(), { recursive: true })
      for (const asset of uniqueIncomingAssets) {
        if (asset.unavailableReason || !asset.base64) continue
        const assetPath = join(this.assetsDir(), asset.id)
        if (existsSync(assetPath)) continue
        const temporary = `${assetPath}.${batch.id}.tmp`
        writeFileSync(temporary, Buffer.from(asset.base64, 'base64'))
        renameSync(temporary, assetPath)
      }
      for (const session of sessions) {
        const existingIndex = catalog.sessions.findIndex((item) => item.id === session.id)
        if (existingIndex >= 0 && catalog.sessions[existingIndex].fingerprint === session.fingerprint) {
          batch.skippedSessionIds.push(session.id)
          continue
        }
        this.writeJsonAtomic(join(staging, `${session.id}.json`), session.messages)
        this.writeJsonAtomic(join(staging, `${session.id}.turns.json`), session.turns)
        const { messages: _messages, turns: _turns, assets: _assets, ...metadata } = session
        const record: ImportedSessionRecord = { ...metadata, storageBatchId: batch.id, assetIds: (session.assets || []).map((asset) => asset.id) }
        if (existingIndex >= 0) {
          batch.sessionChanges.push({ id: session.id, before: catalog.sessions[existingIndex], after: record })
          catalog.sessions[existingIndex] = record
          batch.updatedSessionIds.push(session.id)
        } else {
          batch.sessionChanges.push({ id: session.id, after: record })
          catalog.sessions.push(record)
          batch.createdSessionIds.push(session.id)
        }
      }
      for (const resource of dedupedResources) {
        const index = catalog.resources.findIndex((item) => item.id === resource.id)
        if (index >= 0 && catalog.resources[index].fingerprint === resource.fingerprint) continue
        const record: ImportedResourceRecord = { ...resource, enabled: false, importedBatchId: batch.id }
        batch.resourceChanges.push({ id: resource.id, before: index >= 0 ? catalog.resources[index] : undefined, after: record })
        if (index >= 0) catalog.resources[index] = record
        else catalog.resources.push(record)
        batch.resourceIds.push(resource.id)
      }

      mkdirSync(this.versionsDir(), { recursive: true })
      renameSync(staging, version)
      batch.status = 'completed'
      batch.completedAt = Date.now()
      catalog.batches.unshift(batch)
      this.options.beforeCatalogWrite?.()
      this.writeJsonAtomic(this.catalogPath(), catalog)
      return { batch, projects: catalog.projects, sessions: catalog.sessions }
    } catch (error) {
      batch.status = 'failed'
      batch.failed.push({ sourceId: 'batch', reason: safeImportError(error) })
      rmSync(staging, { recursive: true, force: true })
      rmSync(version, { recursive: true, force: true })
      try {
        this.writeJsonAtomic(this.failurePath(batch.id), batch)
      } catch {
        // Keep the original failure as the user-facing cause.
      }
      throw error
    } finally {
      if (lockToken) this.releaseLock(lockToken)
      this.busy = false
    }
  }

  revert(batchId: string, protectedSessionIds: string[] = []): ImportResult {
    if (this.busy) throw new Error('已有导入正在进行')
    this.busy = true
    const lockToken = this.acquireLock()
    try {
      const catalog = this.loadCatalog()
      const batch = catalog.batches.find((item) => item.id === batchId)
      if (!batch || batch.status !== 'completed') throw new Error('找不到可撤回的导入记录')
      const protectedSet = new Set(protectedSessionIds)
      const removableSessions: string[] = []
      for (const change of batch.sessionChanges) {
        const index = catalog.sessions.findIndex((session) => session.id === change.id)
        if (index < 0 || catalog.sessions[index].storageBatchId !== batch.id || protectedSet.has(change.id)) continue
        if (change.before) catalog.sessions[index] = change.before
        else {
          catalog.sessions.splice(index, 1)
          removableSessions.push(change.id)
        }
      }
      for (const change of batch.resourceChanges) {
        const index = catalog.resources.findIndex((resource) => resource.id === change.id)
        if (index < 0 || catalog.resources[index].importedBatchId !== batch.id) continue
        if (change.before) catalog.resources[index] = change.before
        else catalog.resources.splice(index, 1)
      }
      const removableProjects = batch.createdProjectIds.filter((projectId) =>
        !catalog.sessions.some((session) => session.projectId === projectId))
      catalog.projects = catalog.projects.filter((project) => !removableProjects.includes(project.id))
      batch.status = 'reverted'
      batch.createdSessionIds = removableSessions
      batch.createdProjectIds = removableProjects
      this.writeJsonAtomic(this.catalogPath(), catalog)
      return { batch, projects: catalog.projects, sessions: catalog.sessions }
    } finally {
      this.releaseLock(lockToken)
      this.busy = false
    }
  }

  /** 删除单个导入会话：从 catalog 移除该 session，并清理所有 batch 里对它的引用。
   *  返回孤儿项目 id 列表（该 session 所属项目在 catalog 里已无其他会话时），
   *  调用方可据此决定是否顺带删除空项目。非导入会话不在 catalog 里时返回 removed=false。
   *  与 revert 的区别：revert 按 batch 整批回滚，removeSession 按单条精准移除，
   *  用于用户在侧边栏直接删除某条导入对话时，避免重启后 mergeImportedData 又把它加回来。 */
  removeSession(sessionId: string): { removed: boolean; orphanProjectIds: string[] } {
    if (this.busy) throw new Error('已有导入正在进行')
    this.busy = true
    const lockToken = this.acquireLock()
    try {
      const catalog = this.loadCatalog()
      const idx = catalog.sessions.findIndex((s) => s.id === sessionId)
      if (idx < 0) return { removed: false, orphanProjectIds: [] }
      const removed = catalog.sessions.splice(idx, 1)[0]
      for (const batch of catalog.batches) {
        if (Array.isArray(batch.sessionChanges)) batch.sessionChanges = batch.sessionChanges.filter((c) => c.id !== sessionId)
        if (Array.isArray(batch.createdSessionIds)) batch.createdSessionIds = batch.createdSessionIds.filter((id) => id !== sessionId)
        if (Array.isArray(batch.updatedSessionIds)) batch.updatedSessionIds = batch.updatedSessionIds.filter((id) => id !== sessionId)
        if (Array.isArray(batch.skippedSessionIds)) batch.skippedSessionIds = batch.skippedSessionIds.filter((id) => id !== sessionId)
      }
      const orphanProjectIds = removed.projectId && !catalog.sessions.some((s) => s.projectId === removed.projectId)
        ? [removed.projectId]
        : []
      this.writeJsonAtomic(this.catalogPath(), catalog)
      return { removed: true, orphanProjectIds }
    } finally {
      this.releaseLock(lockToken)
      this.busy = false
    }
  }

  copySessionTo(session: Pick<ImportedSession, 'id'>, destinationDir: string): void {
    const record = this.loadCatalog().sessions.find((item) => item.id === session.id)
    if (!record) return
    mkdirSync(destinationDir, { recursive: true })
    for (const suffix of ['.json', '.turns.json']) {
      const source = join(this.versionDir(record.storageBatchId), `${session.id}${suffix}`)
      if (existsSync(source)) this.writeJsonAtomic(join(destinationDir, `${session.id}${suffix}`), JSON.parse(readFileSync(source, 'utf8')))
    }
  }

  // 早期解析器遗留的脏数据修复：就地重洗已落盘的 messages/turns，剥除 <user_query> 等 UI 包裹标签、
  // 补提图片资源并改写为 imported-asset://。幂等：已是干净内容时 changed=false 直接跳过。
  // visibleSessionsDir 传当前侧边栏使用的 sessions 目录。
  // 修复范围：
  // - 版本目录里仍带 <user_query> 等包裹标签或漏提图片的会话 → 就地重洗并更新指纹/assetIds。
  // - 可见副本里仍带包裹标签的会话 → 就地清理（只剥标签、补图片，不增删消息），保留用户在侧边栏里做过的一切其他改动。
  // 幂等：已是干净内容时 changed=false 直接跳过。
  repairLegacySessions(visibleSessionsDir: string): { repaired: number; assets: number; protectedVisible: number; skipped: number } {
    if (this.busy) throw new Error('已有导入正在进行')
    this.busy = true
    const lockToken = this.acquireLock()
    let repaired = 0, assetsCount = 0, protectedVisible = 0, skipped = 0
    const writtenAssets = new Set<string>()
    const writeAssets = (assets: ImportedAsset[]) => {
      mkdirSync(this.assetsDir(), { recursive: true })
      for (const asset of assets) {
        if (asset.unavailableReason || !asset.base64 || writtenAssets.has(asset.id)) continue
        const assetPath = join(this.assetsDir(), asset.id)
        writtenAssets.add(asset.id)
        if (existsSync(assetPath)) continue
        const temporary = `${assetPath}.repair-${randomUUID().slice(0, 8)}.tmp`
        writeFileSync(temporary, Buffer.from(asset.base64, 'base64'))
        renameSync(temporary, assetPath)
        assetsCount += 1
      }
    }
    try {
      const catalog = this.loadCatalog()
      let catalogDirty = false
      for (const record of catalog.sessions) {
        const versionMessagesPath = join(this.versionDir(record.storageBatchId), `${record.id}.json`)
        const versionTurnsPath = join(this.versionDir(record.storageBatchId), `${record.id}.turns.json`)
        const visibleMessagesPath = join(visibleSessionsDir, `${record.id}.json`)
        const visibleTurnsPath = join(visibleSessionsDir, `${record.id}.turns.json`)
        const versionExists = existsSync(versionMessagesPath)
        const visibleExists = existsSync(visibleMessagesPath)
        if (!versionExists && !visibleExists) { skipped += 1; continue }

        let versionRepaired = false
        if (versionExists) {
          try {
            const messages = JSON.parse(readFileSync(versionMessagesPath, 'utf8'))
            const turns = existsSync(versionTurnsPath) ? JSON.parse(readFileSync(versionTurnsPath, 'utf8')) : []
            const result = repairStoredSession(record.source, messages, turns || [], record.sourceProjectId || '')
            if (result.changed) {
              writeAssets(result.assets)
              this.writeJsonAtomic(versionMessagesPath, result.messages)
              if (existsSync(versionTurnsPath)) this.writeJsonAtomic(versionTurnsPath, result.turns)
              const assetIds = [...new Map((record.assetIds || []).map((id) => [id, id])).values()]
              for (const asset of result.assets) if (!assetIds.includes(asset.id)) assetIds.push(asset.id)
              record.assetIds = assetIds
              record.fingerprint = contentFingerprint({ title: record.title, projectId: record.projectId, archived: record.archived, messages: result.messages, turns: result.turns, assets: assetIds })
              versionRepaired = true
              catalogDirty = true
              repaired += 1
            }
          } catch { /* 版本副本读取失败不阻塞可见副本的清理 */ }
        }

        // 可见副本：只要仍带包裹标签就就地清理，保留用户的其他改动；不带标签但与版本不同 = 用户改过，保护。
        if (visibleExists) {
          try {
            const vMessages = JSON.parse(readFileSync(visibleMessagesPath, 'utf8'))
            const vTurns = existsSync(visibleTurnsPath) ? JSON.parse(readFileSync(visibleTurnsPath, 'utf8')) : []
            const visibleResult = repairStoredSession(record.source, vMessages, vTurns || [], record.sourceProjectId || '')
            if (visibleResult.changed) {
              writeAssets(visibleResult.assets)
              this.writeJsonAtomic(visibleMessagesPath, visibleResult.messages)
              if (existsSync(visibleTurnsPath)) this.writeJsonAtomic(visibleTurnsPath, visibleResult.turns)
              if (!versionRepaired) repaired += 1
            } else if (!versionRepaired) {
              // 版本和可见都已干净：如果可见与版本不一致，说明用户改过可见副本，统计为受保护。
              if (this.hasVisibleSessionChanged(record.id, visibleSessionsDir)) protectedVisible += 1
              else skipped += 1
            }
          } catch { /* 可见副本读取失败忽略 */ }
        } else if (!versionRepaired) {
          skipped += 1
        }
      }
      if (catalogDirty) {
        this.options.beforeCatalogWrite?.()
        this.writeJsonAtomic(this.catalogPath(), catalog)
      }
      return { repaired, assets: assetsCount, protectedVisible, skipped }
    } finally {
      this.releaseLock(lockToken)
      this.busy = false
    }
  }

  assetPath(assetId: string): string | undefined {
    if (!/^asset-[a-f0-9]{24}$/.test(assetId)) return undefined
    const path = join(this.assetsDir(), assetId)
    return existsSync(path) ? path : undefined
  }

  hasVisibleSessionChanged(sessionId: string, destinationDir: string): boolean {
    const record = this.loadCatalog().sessions.find((item) => item.id === sessionId)
    if (!record) return false
    for (const suffix of ['.json', '.turns.json']) {
      const importedPath = join(this.versionDir(record.storageBatchId), `${sessionId}${suffix}`)
      const visiblePath = join(destinationDir, `${sessionId}${suffix}`)
      if (!existsSync(importedPath)) continue
      if (!existsSync(visiblePath)) return false
      try {
        const imported = JSON.parse(readFileSync(importedPath, 'utf8'))
        const visible = JSON.parse(readFileSync(visiblePath, 'utf8'))
        if (contentFingerprint(imported) !== contentFingerprint(visible)) return true
      } catch {
        return true
      }
    }
    return false
  }
}
