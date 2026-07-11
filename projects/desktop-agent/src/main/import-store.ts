import { createHash, randomUUID } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statfsSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  ImportBatch,
  ImportCandidate,
  ImportCatalog,
  ImportResult,
  ImportSelection,
  ImportedResourceRecord,
  ImportedSession,
  ImportedSessionRecord
} from './import-types.js'
import { normalizedProjectPath } from './import-project.js'

const EMPTY_CATALOG: ImportCatalog = { version: 1, projects: [], sessions: [], resources: [], batches: [] }

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
    this.busy = true
    let lockToken: string | undefined
    const batch: ImportBatch = {
      id: `import-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
      createdAt: Date.now(),
      status: 'preparing',
      sources: selection.sources,
      createdProjectIds: [], createdSessionIds: [], updatedSessionIds: [], skippedSessionIds: [], resourceIds: [],
      sessionChanges: [], resourceChanges: [], failed: []
    }
    const staging = this.stagingDir(batch.id)
    const version = this.versionDir(batch.id)
    try {
      lockToken = this.acquireLock()
      const catalog = this.loadCatalog()
      mkdirSync(staging, { recursive: true })
      const selected = candidates.filter((candidate) => selection.sources.includes(candidate.source))
      const incomingProjectIds = new Map<string, string>()
      const normalizedProjects = selected.flatMap((candidate) => candidate.projects).map((item) => {
        if (!item.folderPath) return item
        const folderPath = normalizedProjectPath(item.folderPath)
        const id = stableId('project', folderPath)
        incomingProjectIds.set(item.id, id)
        return { ...item, id, folderPath }
      })
      const projects = selection.includeProjectsAndConversations
        ? [...new Map(normalizedProjects.map((item) => [item.id, item])).values()]
        : []
      const sessions = selection.includeProjectsAndConversations ? selected.flatMap((candidate) => candidate.sessions).map((item) => {
        const projectId = incomingProjectIds.get(item.projectId) || item.projectId
        return projectId === item.projectId ? item : {
          ...item,
          projectId,
          fingerprint: contentFingerprint({ title: item.title, projectId, archived: item.archived, messages: item.messages, turns: item.turns })
        }
      }) : []
      const resources = selected.flatMap((candidate) => candidate.resources).map((item) => ({
        ...item,
        projectId: item.projectId ? incomingProjectIds.get(item.projectId) || item.projectId : undefined
      })).filter((resource) =>
        resource.kind === 'instruction' || resource.kind === 'memory' || resource.kind === 'history-summary'
          ? selection.includeInstructionsAndMemory
          : selection.includeExtensions)
      batch.failed.push(...selected.flatMap((candidate) => candidate.unavailable))

      const uniqueIncomingAssets = [...new Map(sessions.flatMap((session) => session.assets || []).map((asset) => [asset.id, asset])).values()]
      const newAssetBytes = uniqueIncomingAssets.reduce((total, asset) =>
        total + (!asset.unavailableReason && !existsSync(join(this.assetsDir(), asset.id)) && asset.base64
          ? Buffer.byteLength(asset.base64, 'base64') : 0), 0)
      const estimatedBytes = sessions.reduce((total, session) => total + Buffer.byteLength(JSON.stringify(session.messages)) + Buffer.byteLength(JSON.stringify(session.turns)), 0) +
        newAssetBytes +
        resources.reduce((total, item) => total + Buffer.byteLength(item.content || ''), 0)
      const filesystem = this.options.availableBytes ? undefined : statfsSync(this.rootDir, { bigint: true })
      const availableBytes = this.options.availableBytes
        ? this.options.availableBytes()
        : filesystem!.bavail * filesystem!.bsize
      const requiredBytes = BigInt(Math.max(16 * 1024 * 1024, estimatedBytes * 2))
      if (availableBytes < requiredBytes) throw new Error('本机可用空间不足，无法安全完成导入')

      for (const project of projects) {
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
      for (const resource of resources) {
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

  copySessionTo(session: Pick<ImportedSession, 'id'>, destinationDir: string): void {
    const record = this.loadCatalog().sessions.find((item) => item.id === session.id)
    if (!record) return
    mkdirSync(destinationDir, { recursive: true })
    for (const suffix of ['.json', '.turns.json']) {
      const source = join(this.versionDir(record.storageBatchId), `${session.id}${suffix}`)
      if (existsSync(source)) this.writeJsonAtomic(join(destinationDir, `${session.id}${suffix}`), JSON.parse(readFileSync(source, 'utf8')))
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
