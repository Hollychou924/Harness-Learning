import { useMemo, useState } from 'react'
import { Archive, ChevronDown, Folder, Search, Trash2, X } from 'lucide-react'
import { useTaskStore } from '../../../store/task'
import type { Session, Project } from '../../../store/task'
import {
  SettingsConfirmModal,
  SettingsEmpty,
  SettingsGhostButton,
  SettingsGroup,
  SettingsPageHeader,
  SettingsSectionLabel
} from '../settingsUi'

type DeleteTarget =
  | { kind: 'one'; session: Session }
  | { kind: 'project'; projectId: string; name: string; count: number }
  | { kind: 'all'; count: number }

function formatArchivedAt(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function ArchivedSection() {
  const { sessions, projects, unarchiveSession, deleteSession, continueSession, setActiveProject } = useTaskStore()
  const [keyword, setKeyword] = useState('')
  const [projectFilter, setProjectFilter] = useState<'all' | string>('all')
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [notice, setNotice] = useState<{ text: string; sessionId?: string } | null>(null)

  const projectMap = useMemo(
    () => new Map<string, Project>(projects.map((p) => [p.id, p])),
    [projects]
  )

  const archivedAll = useMemo(() => {
    return sessions
      .filter((s) => s.archived)
      .sort((a, b) => (b.archivedAt ?? b.updatedAt) - (a.archivedAt ?? a.updatedAt))
  }, [sessions])

  const projectOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of archivedAll) counts.set(s.projectId, (counts.get(s.projectId) || 0) + 1)
    return [...counts.entries()]
      .map(([id, count]) => ({
        id,
        name: projectMap.get(id)?.name || '普通对话',
        count
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }, [archivedAll, projectMap])

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return archivedAll.filter((s) => {
      if (projectFilter !== 'all' && s.projectId !== projectFilter) return false
      if (q && !s.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [archivedAll, keyword, projectFilter])

  const groups = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, Session[]>()
    for (const s of filtered) {
      if (!map.has(s.projectId)) {
        map.set(s.projectId, [])
        order.push(s.projectId)
      }
      map.get(s.projectId)!.push(s)
    }
    return order.map((projectId) => ({
      projectId,
      name: projectMap.get(projectId)?.name || '普通对话',
      sessions: map.get(projectId)!
    }))
  }, [filtered, projectMap])

  const unarchive = (session: Session) => {
    unarchiveSession(session.id)
    setNotice({ text: '已取消归档', sessionId: session.id })
  }

  const openArchived = (session: Session) => {
    setActiveProject(session.projectId)
    void continueSession(session.id)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'one') {
      deleteSession(deleteTarget.session.id)
    } else if (deleteTarget.kind === 'project') {
      for (const s of archivedAll.filter((item) => item.projectId === deleteTarget.projectId)) {
        deleteSession(s.id)
      }
    } else {
      for (const s of archivedAll) deleteSession(s.id)
    }
    setDeleteTarget(null)
    setNotice(null)
  }

  const empty = archivedAll.length === 0
  const noMatch = !empty && filtered.length === 0

  return (
    <section className="relative">
      <SettingsPageHeader
        title="已归档"
        subtitle="按项目查看，可恢复或永久删除"
        action={
          !empty ? (
            <SettingsGhostButton tone="danger" onClick={() => setDeleteTarget({ kind: 'all', count: archivedAll.length })}>
              <Trash2 size={13} />
              全部删除
            </SettingsGhostButton>
          ) : undefined
        }
      />

      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-[var(--settings-input-bg)] px-3 py-2 text-[12px] text-[var(--ink)]">
          <span className="flex-1">{notice.text}</span>
          {notice.sessionId && (
            <button
              type="button"
              onClick={() => {
                const session = sessions.find((s) => s.id === notice.sessionId)
                if (session) openArchived(session)
                setNotice(null)
              }}
              className="font-medium text-[var(--whale-blue)] hover:underline"
            >
              立即查看
            </button>
          )}
          <button type="button" onClick={() => setNotice(null)} className="rounded p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]">
            <X size={12} />
          </button>
        </div>
      )}

      {!empty && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索已归档对话"
              className="h-8 w-full rounded-lg bg-[var(--settings-input-bg)] pl-7 pr-3 text-[12px] text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--whale-blue)]/30"
            />
          </div>
          <div className="relative">
            <Folder size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-8 appearance-none rounded-lg bg-[var(--settings-input-bg)] pl-7 pr-7 text-[12px] text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--whale-blue)]/30"
            >
              <option value="all">所有项目</option>
              {projectOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}（{opt.count}）
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
          </div>
        </div>
      )}

      {empty ? (
        <SettingsEmpty icon={<Archive size={32} />} title="暂无归档对话" hint="侧边栏中归档的对话会出现在这里" />
      ) : noMatch ? (
        <SettingsEmpty title="没有匹配的归档对话" />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.projectId}>
              <SettingsSectionLabel
                action={
                  <SettingsGhostButton
                    tone="danger"
                    onClick={() =>
                      setDeleteTarget({
                        kind: 'project',
                        projectId: group.projectId,
                        name: group.name,
                        count: group.sessions.length
                      })
                    }
                  >
                    删除本组
                  </SettingsGhostButton>
                }
              >
                {group.name} · {group.sessions.length}
              </SettingsSectionLabel>
              <SettingsGroup>
                {group.sessions.map((s, index) => (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 px-3.5 py-2.5 ${
                      index < group.sessions.length - 1 ? 'border-b border-[var(--settings-sep)]' : ''
                    }`}
                  >
                    <button type="button" onClick={() => openArchived(s)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-[13px] font-medium text-[var(--ink)]">{s.title || '未命名对话'}</div>
                      <div className="mt-0.5 text-[11px] text-[var(--ink-soft)]">
                        {formatArchivedAt(s.archivedAt ?? s.updatedAt)}
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ kind: 'one', session: s })}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-soft)] transition hover:bg-red-500/[0.08] hover:text-[#b42318]"
                        aria-label="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => unarchive(s)}
                        className="h-7 rounded-md px-2.5 text-[12px] font-medium text-[var(--whale-blue)] transition hover:bg-[var(--whale-blue)]/10"
                      >
                        取消归档
                      </button>
                    </div>
                  </div>
                ))}
              </SettingsGroup>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <SettingsConfirmModal
          title="删除已归档对话？"
          body={
            deleteTarget.kind === 'one' ? (
              <>将永久删除「{deleteTarget.session.title || '未命名对话'}」，此操作不可恢复。</>
            ) : deleteTarget.kind === 'project' ? (
              <>将永久删除「{deleteTarget.name}」中的 {deleteTarget.count} 个已归档对话，此操作不可恢复。</>
            ) : (
              <>将永久删除全部 {deleteTarget.count} 个已归档对话，此操作不可恢复。</>
            )
          }
          confirmLabel="删除"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </section>
  )
}
