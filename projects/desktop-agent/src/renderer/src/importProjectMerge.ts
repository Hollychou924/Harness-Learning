import type { ImportedProjectSummary, ImportedSessionSummary } from './api'

export interface VisibleProject {
  id: string
  name: string
  icon: string
  createdAt: number
  updatedAt: number
  pinned: boolean
  pinnedAt?: number
  order: number
  folderPath?: string
  importedSourceName?: string
  importedSourceFolderPath?: string
}

export interface VisibleSession {
  id: string
  title: string
  projectId: string
  createdAt: number
  updatedAt: number
  archived: boolean
  importedSourceTitle?: string
  importedSourceProjectId?: string
  importedSourceArchived?: boolean
}

function pathKey(path?: string): string | undefined {
  if (!path) return undefined
  const value = path.normalize('NFC').replace(/\\/g, '/').replace(/\/+$/, '')
  return value || '/'
}

export function mergeImportedLists<P extends VisibleProject, S extends VisibleSession>(
  currentProjects: P[],
  currentSessions: S[],
  importedProjects: ImportedProjectSummary[],
  importedSessions: ImportedSessionSummary[]
): { projects: P[]; sessions: S[]; projectIdChanges: Map<string, string> } {
  const projectsByPath = new Map<string, P[]>()
  for (const item of currentProjects) {
    const key = pathKey(item.folderPath)
    if (key) projectsByPath.set(key, [...(projectsByPath.get(key) || []), item])
  }

  const preferredByPath = new Map<string, P>()
  const replacedProjectIds = new Map<string, string>()
  for (const [key, items] of projectsByPath) {
    const preferred = [...items].sort((left, right) => {
      const leftImported = left.importedSourceName === undefined ? 0 : 1
      const rightImported = right.importedSourceName === undefined ? 0 : 1
      return leftImported - rightImported || left.order - right.order || left.createdAt - right.createdAt
    })[0]
    preferredByPath.set(key, preferred)
    for (const item of items) if (item.id !== preferred.id) replacedProjectIds.set(item.id, preferred.id)
  }

  const incomingProjectIds = new Map<string, string>()
  for (const item of importedProjects) {
    const existing = preferredByPath.get(pathKey(item.folderPath) || '')
    incomingProjectIds.set(item.id, existing?.id || item.id)
  }
  const projectIdChanges = new Map([...replacedProjectIds, ...incomingProjectIds])

  const collapsedProjects = currentProjects.filter((item) => !replacedProjectIds.has(item.id))
  const projectIds = new Set(collapsedProjects.map((item) => item.id))
  const addedProjects = importedProjects
    .filter((item) => !projectIds.has(incomingProjectIds.get(item.id) || item.id))
    .map((item, index) => ({
      id: item.id,
      name: item.name,
      icon: '📁',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      pinned: false,
      order: collapsedProjects.length + index,
      folderPath: item.folderPath,
      importedSourceName: item.name,
      importedSourceFolderPath: item.folderPath
    } as P))

  const incomingProjects = new Map(importedProjects.map((item) => [incomingProjectIds.get(item.id) || item.id, item]))
  const updatedProjects = collapsedProjects.map((item) => {
    const incoming = incomingProjects.get(item.id)
    if (!incoming || item.importedSourceName === undefined) return item
    return {
      ...item,
      name: item.name === item.importedSourceName ? incoming.name : item.name,
      folderPath: item.folderPath === item.importedSourceFolderPath ? incoming.folderPath : item.folderPath,
      importedSourceName: incoming.name,
      importedSourceFolderPath: incoming.folderPath,
      updatedAt: Math.max(item.updatedAt, incoming.updatedAt)
    }
  })

  const remappedCurrentSessions = currentSessions.map((item) => {
    const projectId = replacedProjectIds.get(item.projectId) || item.projectId
    const importedSourceProjectId = item.importedSourceProjectId
      ? incomingProjectIds.get(item.importedSourceProjectId) || replacedProjectIds.get(item.importedSourceProjectId) || item.importedSourceProjectId
      : undefined
    return projectId === item.projectId && importedSourceProjectId === item.importedSourceProjectId
      ? item
      : { ...item, projectId, importedSourceProjectId }
  })
  const sessionIds = new Set(remappedCurrentSessions.map((item) => item.id))
  const addedSessions = importedSessions
    .filter((item) => !sessionIds.has(item.id))
    .map((item, index) => ({
      id: item.id,
      title: item.title,
      mode: 'code',
      status: 'completed',
      projectId: incomingProjectIds.get(item.projectId) || item.projectId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      stepCount: 0,
      tokens: 0,
      pinned: false,
      archived: item.archived,
      order: remappedCurrentSessions.length + index,
      lastReadAt: item.updatedAt,
      unread: false,
      importedSourceTitle: item.title,
      importedSourceProjectId: incomingProjectIds.get(item.projectId) || item.projectId,
      importedSourceArchived: item.archived
    } as unknown as S))
  const incomingSessions = new Map(importedSessions.map((item) => [item.id, item]))
  const updatedSessions = remappedCurrentSessions.map((item) => {
    const incoming = incomingSessions.get(item.id)
    if (!incoming || item.importedSourceTitle === undefined) return item
    const incomingProjectId = incomingProjectIds.get(incoming.projectId) || incoming.projectId
    return {
      ...item,
      title: item.title === item.importedSourceTitle ? incoming.title : item.title,
      projectId: item.projectId === item.importedSourceProjectId ? incomingProjectId : item.projectId,
      archived: item.archived === item.importedSourceArchived ? incoming.archived : item.archived,
      importedSourceTitle: incoming.title,
      importedSourceProjectId: incomingProjectId,
      importedSourceArchived: incoming.archived,
      updatedAt: Math.max(item.updatedAt, incoming.updatedAt)
    }
  })

  return {
    projects: [...updatedProjects, ...addedProjects],
    sessions: [...updatedSessions, ...addedSessions],
    projectIdChanges
  }
}

export function removeImportedLists<P extends VisibleProject, S extends VisibleSession>(
  currentProjects: P[],
  currentSessions: S[],
  projectIds: string[],
  sessionIds: string[]
): { projects: P[]; sessions: S[] } {
  const removedSessions = new Set(sessionIds)
  const sessions = currentSessions.filter((session) => !removedSessions.has(session.id))
  const removableProjects = new Set(projectIds)
  const projects = currentProjects.filter((project) =>
    !removableProjects.has(project.id) ||
    project.importedSourceName === undefined ||
    sessions.some((session) => session.projectId === project.id))
  return { projects, sessions }
}
