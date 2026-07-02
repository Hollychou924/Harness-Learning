import {
  Settings,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Pencil,
  Trash2,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  X,
  LayoutGrid,
  List
} from 'lucide-react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useTaskStore, type Session, type Project, DEFAULT_PROJECT_ID } from '../store/task'
import { useSettingsStore } from './settings/settingsStore'

/* ============================================================
 * 左侧导航（对标 Codex 桌面客户端）
 * - 两种组织模式可切换：按项目分组 / 按时间排列
 * - 对话支持拖拽排序、拖进拖出置顶区
 * - 右侧相对时间 + hover 完整时间
 * - 批量归档
 * ============================================================ */

const COLLAPSED_KEY = 'xld.collapsed.v1'

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveCollapsed(map: Record<string, boolean>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function Sidebar() {
  const store = useTaskStore()
  const { mode, setMode, message, startTask, reset, projects, sessions, activeProjectId, activeSessionId, sidebarMode } = store
  const { openSettings } = useSettingsStore()
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [renamingProject, setRenamingProject] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => loadCollapsed())
  // 拖拽状态
  const [dragSessionId, setDragSessionId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  useEffect(() => { saveCollapsed(collapsed) }, [collapsed])

  const toggleCollapse = (id: string) => setCollapsed((m) => ({ ...m, [id]: !m[id] }))

  const searchMatch = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    return new Set(sessions.filter((s) => s.title.toLowerCase().includes(q)).map((s) => s.id))
  }, [sessions, search])

  const sortedProjects = useMemo(() => {
    const normal = projects.filter((p) => p.id !== DEFAULT_PROJECT_ID)
    const def = projects.find((p) => p.id === DEFAULT_PROJECT_ID)
    const list = [...normal].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0) || a.order - b.order
    )
    return def ? [...list, def] : list
  }, [projects])

  const pinnedProjects = sortedProjects.filter((p) => p.pinned)
  const otherProjects = sortedProjects.filter((p) => !p.pinned && p.id !== DEFAULT_PROJECT_ID)
  const defaultProject = sortedProjects.find((p) => p.id === DEFAULT_PROJECT_ID)

  const isExpanded = (p: Project) => {
    if (search) return true
    if (p.id === activeProjectId) return true
    return !collapsed[p.id]
  }

  const sessionsOf = (pid: string) => {
    let list = sessions.filter((s) => s.projectId === pid && !s.archived)
    if (searchMatch) list = list.filter((s) => searchMatch.has(s.id))
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0) || b.order - a.order || b.updatedAt - a.updatedAt)
  }

  const archivedOf = (pid: string) => sessions.filter((s) => s.projectId === pid && s.archived)

  // ===== 拖拽处理 =====
  const handleDragStart = (e: React.DragEvent, sessionId: string) => {
    setDragSessionId(sessionId)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(overId)
  }
  const handleDrop = (e: React.DragEvent, overSessionId: string, projectId: string) => {
    e.preventDefault()
    if (!dragSessionId || dragSessionId === overSessionId) { setDragSessionId(null); setDragOverId(null); return }
    // 在同项目内重排；若跨项目则先迁移再重排
    const list = sessionsOf(projectId).map((s) => s.id)
    if (!list.includes(dragSessionId)) {
      // 跨项目：把拖动的会话归属改到目标项目
      store.updateSessionProject(dragSessionId, projectId)
    }
    const current = sessionsOf(projectId).map((s) => s.id)
    const fromIdx = current.indexOf(dragSessionId)
    const toIdx = current.indexOf(overSessionId)
    if (fromIdx === -1 || toIdx === -1) { setDragSessionId(null); setDragOverId(null); return }
    const reordered = [...current]
    reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, dragSessionId)
    store.reorderSessions(reordered)
    setDragSessionId(null)
    setDragOverId(null)
  }
  // 拖到置顶区：置顶该对话
  const handleDropToPinned = (e: React.DragEvent) => {
    e.preventDefault()
    if (dragSessionId && !sessions.find((s) => s.id === dragSessionId)?.pinned) {
      store.togglePinSession(dragSessionId)
    }
    setDragSessionId(null); setDragOverId(null)
  }

  const renderProjectBlock = (p: Project) => {
    const expanded = isExpanded(p)
    const list = sessionsOf(p.id)
    const isDefault = p.id === DEFAULT_PROJECT_ID
    return (
      <div key={p.id} className="space-y-0.5">
        <ProjectRow
          project={p}
          expanded={expanded}
          onToggle={() => toggleCollapse(p.id)}
          onActivate={() => store.setActiveProject(p.id)}
          onRename={isDefault ? null : () => { setRenamingProject(p.id); setNewProjectName(p.name) }}
          onDelete={isDefault ? null : () => { if (confirm(`删除项目「${p.name}」及其下所有对话？`)) store.deleteProject(p.id) }}
          onTogglePin={isDefault ? null : () => store.togglePinProject(p.id)}
          onArchiveAll={list.length > 0 ? () => store.archiveAllInProject(p.id) : null}
        />
        {expanded && (
          <>
            {list.length === 0 && !search && (
              <p className="pl-7 py-1 text-[11px] text-[var(--ink-soft)]/60">暂无对话</p>
            )}
            {list.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                active={s.id === activeSessionId}
                onClick={() => void store.continueSession(s.id)}
                onDragStart={(e) => handleDragStart(e, s.id)}
                onDragOver={(e) => handleDragOver(e, s.id)}
                onDrop={(e) => handleDrop(e, s.id, p.id)}
                isDragging={dragSessionId === s.id}
                isDragOver={dragOverId === s.id}
              />
            ))}
            {archivedOf(p.id).length > 0 && !search && (
              <ArchivedSection
                sessions={archivedOf(p.id)}
                expanded={showArchived}
                onToggle={() => setShowArchived((v) => !v)}
                activeId={activeSessionId}
                onClick={(id) => void store.continueSession(id)}
              />
            )}
          </>
        )}
      </div>
    )
  }

  // ===== 时间模式：所有非归档对话按时间分组 =====
  const timeGroups = useMemo(() => {
    let list = sessions.filter((s) => !s.archived)
    if (searchMatch) list = list.filter((s) => searchMatch.has(s.id))
    return groupByTime(list)
  }, [sessions, searchMatch])

  return (
    <aside className="glass-soft w-60 flex-shrink-0 flex flex-col border-r border-white/40">
      <div className="drag h-9" />

      {/* Work / Code 切换 */}
      <div className="px-3 pb-2">
        <div className="flex gap-1 p-1 rounded-lg bg-black/[0.05]">
          {(['work', 'code'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 h-7 rounded-md text-sm font-medium transition ${mode === m ? 'bg-white shadow-sm text-[var(--ink)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}>
              {m === 'work' ? 'Work' : 'Code'}
            </button>
          ))}
        </div>
      </div>

      {/* 新建对话 */}
      <div className="px-3 pb-2">
        <button onClick={() => { reset(); startTask() }} disabled={!message.trim()}
          className="no-drag w-full h-9 rounded-lg glass flex items-center justify-center gap-2 text-sm font-medium hover:brightness-105 transition disabled:opacity-50">
          <Plus size={15} /> 新建对话
        </button>
      </div>

      {/* 组织模式切换 + 搜索 */}
      <div className="px-3 pb-2 flex items-center gap-1.5">
        <div className="flex gap-0.5 p-0.5 rounded-md bg-black/[0.04] flex-shrink-0">
          <button onClick={() => store.setSidebarMode('project')} title="按项目分组"
            className={`w-7 h-6 rounded flex items-center justify-center transition ${sidebarMode === 'project' ? 'bg-white shadow-sm text-[var(--ink)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}>
            <LayoutGrid size={13} />
          </button>
          <button onClick={() => store.setSidebarMode('time')} title="按时间排列"
            className={`w-7 h-6 rounded flex items-center justify-center transition ${sidebarMode === 'time' ? 'bg-white shadow-sm text-[var(--ink)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}>
            <List size={13} />
          </button>
        </div>
        <div className="relative flex-1">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索"
            className="no-drag w-full h-6 pl-6 pr-5 text-xs rounded-md bg-black/[0.04] outline-none focus:bg-black/[0.06] transition placeholder:text-[var(--ink-soft)]/60" />
          {search && <button onClick={() => setSearch('')} className="absolute right-1 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] hover:text-[var(--ink)]"><X size={11} /></button>}
        </div>
      </div>

      {/* 置顶区（仅项目模式，有置顶对话时显示，可拖入） */}
      {sidebarMode === 'project' && (
        <PinnedDropZone sessions={pinnedSessionsAll(sessions, searchMatch)} activeId={activeSessionId}
          onClick={(id) => void store.continueSession(id)} onDrop={handleDropToPinned}
          onDragOver={(e) => { e.preventDefault(); setDragOverId('__pinned__') }}
          isDragOver={dragOverId === '__pinned__'} />
      )}

      {/* 主体列表 */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {sidebarMode === 'project' ? (
          <>
            {pinnedProjects.length > 0 && (
              <div className="space-y-0.5">
                <SectionLabel label="置顶项目" />
                {pinnedProjects.map(renderProjectBlock)}
              </div>
            )}
            <div className="space-y-0.5">
              {otherProjects.length > 0 && <SectionLabel label="项目" action={
                <button onClick={() => setNewProjectOpen(true)} className="text-[var(--ink-soft)] hover:text-[var(--ink)]"><FolderPlus size={12} /></button>
              } />}
              {otherProjects.map(renderProjectBlock)}
            </div>
            {defaultProject && (
              <div className="space-y-0.5">
                <SectionLabel label="对话" />
                {renderProjectBlock(defaultProject)}
              </div>
            )}
            {sortedProjects.length === 0 && (
              <p className="px-2 py-3 text-xs text-[var(--ink-soft)] opacity-70 text-center">还没有项目，新建一个开始吧</p>
            )}
          </>
        ) : (
          /* 时间模式 */
          <div className="space-y-2">
            {timeGroups.length === 0 && (
              <p className="px-2 py-3 text-xs text-[var(--ink-soft)] opacity-70 text-center">{search ? '没有匹配的对话' : '还没有对话'}</p>
            )}
            {timeGroups.map((g) => (
              <div key={g.key} className="space-y-0.5">
                <SectionLabel label={g.label} />
                {g.sessions.map((s) => {
                  const proj = projects.find((p) => p.id === s.projectId)
                  return (
                    <SessionRow key={s.id} session={s} active={s.id === activeSessionId}
                      onClick={() => void store.continueSession(s.id)}
                      onDragStart={(e) => handleDragStart(e, s.id)}
                      onDragOver={(e) => handleDragOver(e, s.id)}
                      onDrop={(e) => handleDrop(e, s.id, s.projectId)}
                      isDragging={dragSessionId === s.id}
                      isDragOver={dragOverId === s.id}
                      showProject={proj && proj.id !== DEFAULT_PROJECT_ID ? proj.name : undefined}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部 */}
      <div className="px-3 py-2.5 border-t border-white/40">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-1 flex-1 min-w-0">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-pink-400 flex-shrink-0" />
            <span className="text-xs text-[var(--ink-soft)] truncate">周浩</span>
          </div>
          <button onClick={() => openSettings()} title="设置"
            className="no-drag w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:bg-black/[0.06] hover:text-[var(--ink)] transition flex-shrink-0">
            <Settings size={16} />
          </button>
        </div>
      </div>

      {newProjectOpen && (
        <NameDialog title="新建项目" initial="" placeholder="项目名称" confirmLabel="创建"
          onCancel={() => setNewProjectOpen(false)}
          onConfirm={(name) => { store.createProject(name); setNewProjectOpen(false) }} />
      )}
      {renamingProject && (
        <NameDialog title="重命名项目" initial={newProjectName} placeholder="项目名称" confirmLabel="保存"
          onCancel={() => setRenamingProject(null)}
          onConfirm={(name) => { store.renameProject(renamingProject, name); setRenamingProject(null) }} />
      )}
    </aside>
  )
}

/* ---- 置顶拖放区 ---- */
function PinnedDropZone({ sessions, activeId, onClick, onDrop, onDragOver, isDragOver }: {
  sessions: Session[]; activeId: string | null; onClick: (id: string) => void
  onDrop: (e: React.DragEvent) => void; onDragOver: (e: React.DragEvent) => void; isDragOver: boolean
}) {
  if (sessions.length === 0) return null
  return (
    <div className={`px-2 pb-1 ${isDragOver ? 'bg-amber-50/50 rounded-lg' : ''}`}
      onDragOver={onDragOver} onDrop={onDrop}>
      <SectionLabel label="置顶对话" />
      <div className="space-y-0.5">
        {sessions.map((s) => (
          <SessionRow key={s.id} session={s} active={s.id === activeId} onClick={() => onClick(s.id)} compact />
        ))}
      </div>
    </div>
  )
}

/* ---- 已归档折叠区 ---- */
function ArchivedSection({ sessions, expanded, onToggle, activeId, onClick }: {
  sessions: Session[]; expanded: boolean; onToggle: () => void; activeId: string | null; onClick: (id: string) => void
}) {
  return (
    <div className="space-y-0.5">
      <button onClick={onToggle} className="w-full flex items-center gap-1 px-1 py-1 text-[11px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition">
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        已归档 ({sessions.length})
      </button>
      {expanded && sessions.map((s) => (
        <SessionRow key={s.id} session={s} active={s.id === activeId} onClick={() => onClick(s.id)} compact />
      ))}
    </div>
  )
}

function pinnedSessionsAll(sessions: Session[], searchMatch: Set<string> | null): Session[] {
  let list = sessions.filter((s) => s.pinned && !s.archived)
  if (searchMatch) list = list.filter((s) => searchMatch.has(s.id))
  return [...list].sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0))
}

/* ---- 分类标题 ---- */
function SectionLabel({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 pt-1.5 pb-0.5">
      <span className="text-[10px] font-medium text-[var(--ink-soft)]/70">{label}</span>
      {action}
    </div>
  )
}

/* ---- 项目行 ---- */
function ProjectRow({ project, expanded, onToggle, onActivate, onRename, onDelete, onTogglePin, onArchiveAll }: {
  project: Project; expanded: boolean; onToggle: () => void; onActivate: () => void
  onRename: (() => void) | null; onDelete: (() => void) | null; onTogglePin: (() => void) | null
  onArchiveAll: (() => void) | null
}) {
  return (
    <div className="group relative flex items-center rounded-md hover:bg-black/[0.04] transition">
      <button onClick={() => { onActivate(); onToggle() }}
        className="flex-1 flex items-center gap-1.5 px-2 py-1.5 text-left min-w-0">
        {expanded ? <ChevronDown size={13} className="text-[var(--ink-soft)] flex-shrink-0" /> : <ChevronRight size={13} className="text-[var(--ink-soft)] flex-shrink-0" />}
        <span className="text-sm leading-none flex-shrink-0">{project.icon}</span>
        <span className="flex-1 text-xs font-medium text-[var(--ink)] truncate">{project.name}</span>
        {project.pinned && <Pin size={10} className="text-amber-400 flex-shrink-0" />}
      </button>
      <div className="hidden group-hover:flex items-center gap-0.5 mr-0.5">
        {onTogglePin && <IconBtn title={project.pinned ? '取消置顶' : '置顶'} onClick={onTogglePin}>{project.pinned ? <PinOff size={11} /> : <Pin size={11} />}</IconBtn>}
        {onArchiveAll && <IconBtn title="归档全部" onClick={onArchiveAll}><Archive size={11} /></IconBtn>}
        {onRename && <IconBtn title="重命名" onClick={onRename}><Pencil size={11} /></IconBtn>}
        {onDelete && <IconBtn title="删除项目" danger onClick={onDelete}><Trash2 size={11} /></IconBtn>}
      </div>
    </div>
  )
}

/* ---- 单条对话行 ---- */
function SessionRow({ session, active, onClick, onDragStart, onDragOver, onDrop, isDragging, isDragOver, showProject, compact }: {
  session: Session; active: boolean; onClick: () => void
  onDragStart?: (e: React.DragEvent) => void; onDragOver?: (e: React.DragEvent) => void; onDrop?: (e: React.DragEvent) => void
  isDragging?: boolean; isDragOver?: boolean; showProject?: string; compact?: boolean
}) {
  const store = useTaskStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(session.title)

  useEffect(() => { setName(session.title) }, [session.title])

  const icon = session.status === 'completed'
    ? <CheckCircle2 size={12} className="text-green-500 flex-shrink-0 mt-0.5" />
    : session.status === 'failed'
      ? <XCircle size={12} className="text-red-500 flex-shrink-0 mt-0.5" />
      : <Clock size={12} className="text-[var(--ink-soft)] flex-shrink-0 mt-0.5" />

  const actions: MenuAction[] = [
    { id: 'pin', label: session.pinned ? '取消置顶' : '置顶', icon: session.pinned ? <PinOff size={12} /> : <Pin size={12} />, onClick: () => store.togglePinSession(session.id) },
    { id: 'rename', label: '重命名', icon: <Pencil size={12} />, onClick: () => { setRenaming(true); setMenuOpen(false) } },
    session.archived
      ? { id: 'unarchive', label: '取消归档', icon: <ArchiveRestore size={12} />, onClick: () => store.unarchiveSession(session.id) }
      : { id: 'archive', label: '归档', icon: <Archive size={12} />, onClick: () => store.archiveSession(session.id) },
    { id: 'delete', label: '删除', icon: <Trash2 size={12} />, danger: true, onClick: () => store.deleteSession(session.id) }
  ]

  if (renaming) {
    return (
      <div className={compact ? 'pl-2 pr-1 py-0.5' : 'pl-7 pr-2 py-0.5'}>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
          onBlur={() => { if (name.trim()) store.renameSession(session.id, name); setRenaming(false) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { if (name.trim()) store.renameSession(session.id, name); setRenaming(false) }
            if (e.key === 'Escape') setRenaming(false)
          }}
          className="w-full h-6 px-2 text-xs rounded bg-white border border-blue-400 outline-none" />
      </div>
    )
  }

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={() => { /* 状态由父组件清理 */ }}
      className={`group relative flex items-center ${compact ? 'pl-2' : 'pl-7'} pr-1 py-1 rounded-md cursor-pointer transition ${
        active ? 'bg-black/[0.07]' : 'hover:bg-black/[0.04]'
      } ${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'border-t-2 border-blue-400' : ''}`}
    >
      <button onClick={onClick} className="flex-1 flex items-center gap-1.5 min-w-0 text-left">
        {icon}
        <span className={`flex-1 truncate text-xs ${active ? 'text-[var(--ink)] font-medium' : 'text-[var(--ink-soft)]'}`}>{session.title}</span>
      </button>
      {/* 右侧：项目标签(时间模式) + 相对时间 + 置顶图标 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {showProject && <span className="text-[9px] text-[var(--ink-soft)]/60 bg-black/[0.04] px-1 rounded max-w-[48px] truncate">{showProject}</span>}
        <span className="text-[9px] text-[var(--ink-soft)]/50" title={new Date(session.updatedAt).toLocaleString('zh-CN')}>
          {timeAgo(session.updatedAt)}
        </span>
        {session.pinned && <Pin size={9} className="text-amber-400 flex-shrink-0" />}
      </div>
      <button onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
        className="no-drag w-5 h-5 rounded flex items-center justify-center text-[var(--ink-soft)] hover:bg-black/[0.08] opacity-0 group-hover:opacity-100 transition flex-shrink-0">
        <MoreHorizontal size={12} />
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 z-50 w-28 glass rounded-lg shadow-lg py-1">
            {actions.map((a) => (
              <button key={a.id} onClick={(e) => { e.stopPropagation(); a.onClick(); setMenuOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/[0.05] transition ${a.danger ? 'text-red-500' : 'text-[var(--ink)]'}`}>
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ---- 小工具 ---- */
interface MenuAction { id: string; label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button title={title} onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`w-6 h-6 rounded flex items-center justify-center transition ${danger ? 'text-red-500 hover:bg-red-50' : 'text-[var(--ink-soft)] hover:bg-black/[0.08] hover:text-[var(--ink)]'}`}>
      {children}
    </button>
  )
}

function NameDialog({ title, initial, placeholder, confirmLabel, onCancel, onConfirm }: {
  title: string; initial: string; placeholder: string; confirmLabel: string
  onCancel: () => void; onConfirm: (name: string) => void
}) {
  const [val, setVal] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30" onClick={onCancel}>
      <div className="w-72 glass rounded-2xl shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">{title}</h3>
        <input ref={ref} value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter' && val.trim()) onConfirm(val); if (e.key === 'Escape') onCancel() }}
          className="w-full h-9 px-3 text-sm rounded-lg bg-white border border-black/10 outline-none focus:border-blue-400" />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition">取消</button>
          <button onClick={() => val.trim() && onConfirm(val)} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--ink)] text-white hover:opacity-90 transition">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

interface TimeGroup { key: string; label: string; sessions: Session[] }

function groupByTime(sessions: Session[]): TimeGroup[] {
  const pinned = sessions.filter((s) => s.pinned).sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0))
  const normal = sessions.filter((s) => !s.pinned).sort((a, b) => b.updatedAt - a.updatedAt)
  const groups: TimeGroup[] = []
  if (pinned.length) groups.push({ key: 'pinned', label: '置顶', sessions: pinned })

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000
  const weekAgo = today - 6 * 86400000
  const buckets: Record<string, Session[]> = { 今天: [], 昨天: [], '近 7 天': [], 更早: [] }
  for (const s of normal) {
    if (s.updatedAt >= today) buckets['今天'].push(s)
    else if (s.updatedAt >= yesterday) buckets['昨天'].push(s)
    else if (s.updatedAt >= weekAgo) buckets['近 7 天'].push(s)
    else buckets['更早'].push(s)
  }
  for (const [label, items] of Object.entries(buckets)) {
    if (items.length) groups.push({ key: label, label, sessions: items })
  }
  return groups
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return '刚刚'
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}d`
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}t`
  if (n < 1000000) return `${(n / 1000).toFixed(0)}Kt`
  return `${(n / 1000000).toFixed(1)}Mt`
}
