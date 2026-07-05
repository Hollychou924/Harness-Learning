import {
  Settings,
  MessageSquarePlus,
  CheckCircle2,
  XCircle,
  Clock,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Pencil,
  Trash2,
  FolderPlus,
  Folder,
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from 'lucide-react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useTaskStore, type Session, type Project, DEFAULT_PROJECT_ID } from '../store/task'
import { useSettingsStore } from './settings/settingsStore'
import { NameDialog, NewProjectDialog } from './Dialogs'
import { WhaleTooltip } from './WhaleTooltip'

/* ============================================================
 * 左侧导航（对标 Codex 桌面客户端）
 * - 顶部常驻入口：新对话 / 自动化 / 技能
 * - 中部按区块：置顶对话 / 项目 / 普通对话
 * - 项目可展开，项目下对话按时间倒序，默认折叠超出的旧对话
 * - 对话右侧显示相对时间；运行中显示小蓝点
 * - 项目/对话支持置顶、归档、重命名、删除、新建子对话
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

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const store = useTaskStore()
  const { mode, setMode, message, startTask, reset, projects, sessions, activeProjectId, activeSessionId } = store
  const { openSettings } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<'new' | 'scheduled' | 'plugins'>('new')
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [renamingProject, setRenamingProject] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [renamingSession, setRenamingSession] = useState<{ id: string; title: string } | null>(null)
  const [projectCollapsed, setProjectCollapsed] = useState<Record<string, boolean>>(() => loadCollapsed())
  const [dragSessionId, setDragSessionId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  // 项目内默认只显示前 N 条；点「展开显示」后切到全量
  const [expandedAll, setExpandedAll] = useState<Record<string, boolean>>({})
  const SESSION_VISIBLE_DEFAULT = 5
  // 轻量提示：一期给「自动化 / 技能」等未实现入口使用
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  const notifyComingSoon = (label: string) => {
    setToast(`「${label}」功能即将上线`)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }

  useEffect(() => { saveCollapsed(projectCollapsed) }, [projectCollapsed])

  const toggleCollapse = (id: string) => setProjectCollapsed((m) => ({ ...m, [id]: !m[id] }))

  const sortedProjects = useMemo(() => {
    return [...projects].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0) || a.order - b.order
    )
  }, [projects])

  const pinnedProjects = sortedProjects.filter((p) => p.pinned)
  const otherProjects = sortedProjects.filter((p) => !p.pinned)
  const unassignedSessions = sessions.filter((s) => s.projectId === DEFAULT_PROJECT_ID)

  const isExpanded = (p: Project) => {
    if (Object.prototype.hasOwnProperty.call(projectCollapsed, p.id)) return !projectCollapsed[p.id]
    if (p.id === activeProjectId) return true
    return !projectCollapsed[p.id]
  }

  const sessionsOf = (pid: string) => {
    const list = sessions.filter((s) => s.projectId === pid && !s.archived)
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0) || b.order - a.order || b.updatedAt - a.updatedAt)
  }


  const handleDragStart = (e: React.DragEvent, sessionId: string) => {
    setDragSessionId(sessionId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/session', sessionId)
  }
  const handleDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(overId)
  }
  const handleDrop = (e: React.DragEvent, overSessionId: string, projectId: string) => {
    e.preventDefault()
    if (!dragSessionId || dragSessionId === overSessionId) { setDragSessionId(null); setDragOverId(null); return }
    const list = sessionsOf(projectId).map((s) => s.id)
    if (!list.includes(dragSessionId)) {
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
  const handleDropToPinned = (e: React.DragEvent) => {
    e.preventDefault()
    if (dragSessionId && !sessions.find((s) => s.id === dragSessionId)?.pinned) {
      store.togglePinSession(dragSessionId)
    }
    setDragSessionId(null); setDragOverId(null)
  }

  const renderProjectBlock = (p: Project, sectionLabel?: string) => {
    const expanded = isExpanded(p)
    const list = sessionsOf(p.id)
    const isDefault = p.id === DEFAULT_PROJECT_ID
    return (
      <div key={p.id} className="space-y-0.5">
        {sectionLabel && <SectionLabel label={sectionLabel} />}
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
            {list.length === 0 && (
              <p className="pl-7 py-1 text-[11px] text-[var(--ink-soft)]/60">暂无对话</p>
            )}
            {(expandedAll[p.id] ? list : list.slice(0, SESSION_VISIBLE_DEFAULT)).map((s) => (
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
                onRename={() => setRenamingSession({ id: s.id, title: s.title })}
              />
            ))}
            {!expandedAll[p.id] && list.length > SESSION_VISIBLE_DEFAULT && (
              <button onClick={() => setExpandedAll((m) => ({ ...m, [p.id]: true }))}
                className="w-full flex items-center gap-1 pl-7 pr-2 py-1 text-[11px] text-[var(--ink-soft)]/70 hover:text-[var(--ink-soft)] transition">
                <ChevronDown size={11} /> 展开显示 {list.length - SESSION_VISIBLE_DEFAULT} 条
              </button>
            )}
            {expandedAll[p.id] && list.length > SESSION_VISIBLE_DEFAULT && (
              <button onClick={() => setExpandedAll((m) => ({ ...m, [p.id]: false }))}
                className="w-full flex items-center gap-1 pl-7 pr-2 py-1 text-[11px] text-[var(--ink-soft)]/70 hover:text-[var(--ink-soft)] transition">
                <ChevronUp size={11} /> 收起
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <aside
      className={`glass-soft flex-shrink-0 flex flex-col border-r border-white/40 transition-all duration-300 ease-in-out overflow-hidden ${
        collapsed ? 'w-0 border-r-0' : 'w-60'
      }`}
    >
      <div className="drag h-9 flex-shrink-0" />
      {/* 顶部快捷入口：新对话 / 自动化 / 技能 */}
      <div className="px-3 pb-2">
        <div className="space-y-0.5">
          <NavPill icon={<MessageSquarePlus size={15} />} label="新对话" active={activeTab === 'new'}
            onClick={() => { setActiveTab('new'); reset(); }} />
          <NavPill icon={<Clock size={15} />} label="自动化" active={activeTab === 'scheduled'}
            onClick={() => { setActiveTab('scheduled'); notifyComingSoon('自动化') }} />
          <NavPill icon={<Settings size={15} />} label="技能" active={activeTab === 'plugins'}
            onClick={() => { setActiveTab('plugins'); notifyComingSoon('技能') }} />
        </div>
      </div>

      {/* 置顶对话区（可拖入自动置顶） */}
      <PinnedDropZone sessions={pinnedSessionsAll(sessions)} activeId={activeSessionId}
        onClick={(id) => void store.continueSession(id)} onDrop={handleDropToPinned}
        onDragOver={(e) => { e.preventDefault(); setDragOverId('__pinned__') }}
        isDragOver={dragOverId === '__pinned__'}
        onRename={(id, title) => setRenamingSession({ id, title })} />

      {/* 主体列表：按项目分组，项目下对话按时间倒序（最新在前） */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-2 space-y-1">
        {pinnedProjects.length > 0 && (
          <div className="space-y-0.5">
            <SectionLabel label="置顶" />
            {pinnedProjects.map((p) => renderProjectBlock(p, '置顶项目'))}
          </div>
        )}
        <div className="space-y-0.5">
          <SectionLabel
            label="项目"
            action={(
              <WhaleTooltip label="新建项目">
                <button onClick={() => setNewProjectOpen(true)}
                  className="no-drag w-6 h-6 rounded-md hover:bg-black/[0.06] flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] transition">
                  <FolderPlus size={13} />
                </button>
              </WhaleTooltip>
            )}
          />
          {otherProjects.map((p) => renderProjectBlock(p))}
        </div>
        {unassignedSessions.length > 0 && (
          <div className="space-y-0.5">
            <SectionLabel label="无项目对话" />
            {(() => {
              const list = sessionsOf(DEFAULT_PROJECT_ID)
              if (list.length === 0) {
                return <p className="pl-2.5 py-1 text-[11px] text-[var(--ink-soft)]/60">暂无对话</p>
              }
              const visible = expandedAll[DEFAULT_PROJECT_ID] ? list : list.slice(0, SESSION_VISIBLE_DEFAULT)
              return (
                <>
                  {visible.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      active={s.id === activeSessionId}
                      onClick={() => void store.continueSession(s.id)}
                      onDragStart={(e) => handleDragStart(e, s.id)}
                      onDragOver={(e) => handleDragOver(e, s.id)}
                      onDrop={(e) => handleDrop(e, s.id, DEFAULT_PROJECT_ID)}
                      isDragging={dragSessionId === s.id}
                      isDragOver={dragOverId === s.id}
                      compact
                      onRename={() => setRenamingSession({ id: s.id, title: s.title })}
                    />
                  ))}
                  {!expandedAll[DEFAULT_PROJECT_ID] && list.length > SESSION_VISIBLE_DEFAULT && (
                    <button onClick={() => setExpandedAll((m) => ({ ...m, [DEFAULT_PROJECT_ID]: true }))}
                      className="w-full flex items-center gap-1 pl-2.5 pr-2 py-1 text-[11px] text-[var(--ink-soft)]/70 hover:text-[var(--ink-soft)] transition">
                      <ChevronDown size={11} /> 展开显示 {list.length - SESSION_VISIBLE_DEFAULT} 条
                    </button>
                  )}
                  {expandedAll[DEFAULT_PROJECT_ID] && list.length > SESSION_VISIBLE_DEFAULT && (
                    <button onClick={() => setExpandedAll((m) => ({ ...m, [DEFAULT_PROJECT_ID]: false }))}
                      className="w-full flex items-center gap-1 pl-2.5 pr-2 py-1 text-[11px] text-[var(--ink-soft)]/70 hover:text-[var(--ink-soft)] transition">
                      <ChevronUp size={11} /> 收起
                    </button>
                  )}
                </>
              )
            })()}
          </div>
        )}
        {sortedProjects.length === 0 && (
          <p className="px-2.5 py-3 text-xs text-[var(--ink-soft)] opacity-70 text-center">还没有项目，点「项目」右侧按钮新建一个</p>
        )}
      </div>

      {/* 底部 */}
      <div className="px-3 py-2.5 border-t border-white/40">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-1 flex-1 min-w-0">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-pink-400 flex-shrink-0" />
            <span className="text-xs text-[var(--ink-soft)] truncate">周浩</span>
          </div>
          <WhaleTooltip label="设置">
            <button onClick={() => openSettings()}
              className="no-drag w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:bg-black/[0.06] hover:text-[var(--ink)] transition flex-shrink-0">
              <Settings size={16} />
            </button>
          </WhaleTooltip>
        </div>
      </div>

      {newProjectOpen && (
        <NewProjectDialog
          onCancel={() => setNewProjectOpen(false)}
          onCreateNew={(name) => { store.createProject(name); setNewProjectOpen(false) }}
          onLoadFolder={(name, folderPath) => { store.createProject(name, '📁', folderPath); setNewProjectOpen(false) }}
        />
      )}
      {renamingProject && (
        <NameDialog title="重命名项目" initial={newProjectName} placeholder="项目名称" confirmLabel="保存"
          onCancel={() => setRenamingProject(null)}
          onConfirm={(name) => { store.renameProject(renamingProject, name); setRenamingProject(null) }} />
      )}
      {renamingSession && (
        <NameDialog title="重命名对话" initial={renamingSession.title} placeholder="对话名称" confirmLabel="保存"
          onCancel={() => setRenamingSession(null)}
          onConfirm={(name) => { store.renameSession(renamingSession.id, name); setRenamingSession(null) }} />
      )}
      {toast && (
        <div className="absolute left-1/2 bottom-6 -translate-x-1/2 z-[120] px-3 py-1.5 rounded-full floating-toast text-white text-[12px]">
          {toast}
        </div>
      )}
    </aside>
  )
}

/* ---- 顶部导航 Pill ---- */
function NavPill({ icon, label, active, badge, onClick }: { icon: React.ReactNode; label: string; active?: boolean; badge?: number; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`no-drag w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition ${
        active ? 'bg-white/60 text-[var(--ink)] shadow-sm' : 'text-[var(--ink-soft)] hover:bg-black/[0.04] hover:text-[var(--ink)]'
      }`}>
      <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[18px] h-[18px] px-1.5 flex items-center justify-center rounded-full bg-[var(--ink)]/10 text-[11px] text-[var(--ink-soft)]">{badge}</span>
      )}
    </button>
  )
}

/* ---- 置顶拖放区 ---- */
function PinnedDropZone({ sessions, activeId, onClick, onDrop, onDragOver, isDragOver, onRename }: {
  sessions: Session[]; activeId: string | null; onClick: (id: string) => void
  onDrop: (e: React.DragEvent) => void; onDragOver: (e: React.DragEvent) => void; isDragOver: boolean
  onRename?: (id: string, title: string) => void
}) {
  if (sessions.length === 0) return null
  return (
    <div className={`px-3 pb-1 ${isDragOver ? 'bg-amber-50/50 rounded-lg' : ''}`}
      onDragOver={onDragOver} onDrop={onDrop}>
      <SectionLabel label="置顶对话" />
      <div className="space-y-0.5">
        {sessions.map((s) => (
          <SessionRow key={s.id} session={s} active={s.id === activeId} onClick={() => onClick(s.id)} compact onRename={() => onRename?.(s.id, s.title)} />
        ))}
      </div>
    </div>
  )
}

/* ---- 已归档折叠区 ---- */
function pinnedSessionsAll(sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.pinned && !s.archived)
    .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0))
}

/* ---- 分类标题 ---- */
function SectionLabel({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 pt-1.5 pb-0.5">
      <span className="text-[13px] font-semibold text-[var(--ink-soft)] tracking-wide">{label}</span>
      {action}
    </div>
  )
}

/* ---- 项目行 ---- */
function ProjectRow({ project, expanded, onToggle, onActivate, onRename, onDelete, onTogglePin, onArchiveAll }: {
  project: Project; expanded: boolean; onToggle: () => void; onActivate: () => void
  onRename: (() => void) | null; onDelete: (() => void) | null
  onTogglePin: (() => void) | null; onArchiveAll: (() => void) | null
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div
      className="group relative flex items-center rounded-[10px] hover:bg-black/[0.04] transition"
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true) }}
    >
      <button onClick={() => { onActivate(); onToggle() }}
        className="flex-1 flex items-center gap-2.5 px-2.5 py-1.5 text-left min-w-0">
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          <Folder size={15} className="text-[var(--ink-soft)]" />
        </span>
        <span className="flex-1 text-[12px] font-medium text-[var(--ink)] truncate">{project.name}</span>
        {project.pinned && <Pin size={10} className="text-amber-400 flex-shrink-0" />}
        {expanded ? <ChevronDown size={13} className="text-[var(--ink-soft)] flex-shrink-0" /> : <ChevronRight size={13} className="text-[var(--ink-soft)] flex-shrink-0" />}
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-7 z-50 w-36 floating-surface rounded-lg py-1">
            {onTogglePin && (
              <button onClick={(e) => { e.stopPropagation(); onTogglePin(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/[0.05] transition">
                {project.pinned ? <PinOff size={12} /> : <Pin size={12} />} {project.pinned ? '取消置顶' : '置顶'}
              </button>
            )}
            {onArchiveAll && (
              <button onClick={(e) => { e.stopPropagation(); onArchiveAll(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/[0.05] transition">
                <Archive size={12} /> 归档所有聊天
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/[0.05] transition">
              <Pencil size={12} /> 整理侧边栏
            </button>
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/[0.05] transition">
              <Clock size={12} /> 排序条件
            </button>
            {onRename && (
              <button onClick={(e) => { e.stopPropagation(); onRename(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/[0.05] transition">
                <Pencil size={12} /> 重命名
              </button>
            )}
            {onDelete && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/[0.05] transition text-red-500">
                <Trash2 size={12} /> 删除项目
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ---- 单条对话行 ---- */
function SessionRow({ session, active, onClick, onDragStart, onDragOver, onDrop, isDragging, isDragOver, showProject, compact, onRename }: {
  session: Session; active: boolean; onClick: () => void
  onDragStart?: (e: React.DragEvent) => void; onDragOver?: (e: React.DragEvent) => void; onDrop?: (e: React.DragEvent) => void
  isDragging?: boolean; isDragOver?: boolean; showProject?: string; compact?: boolean; onRename?: () => void
}) {
  const store = useTaskStore()
  const [menuOpen, setMenuOpen] = useState(false)

  const icon = session.status === 'completed'
    ? <CheckCircle2 size={12} className="text-green-500 flex-shrink-0 mt-0.5" />
    : session.status === 'failed'
      ? <XCircle size={12} className="text-red-500 flex-shrink-0 mt-0.5" />
      : <Clock size={12} className="text-[var(--ink-soft)] flex-shrink-0 mt-0.5" />

  const actions: MenuAction[] = [
    { id: 'pin', label: session.pinned ? '取消置顶' : '置顶', icon: session.pinned ? <PinOff size={12} /> : <Pin size={12} />, onClick: () => store.togglePinSession(session.id) },
    { id: 'rename', label: '重命名', icon: <Pencil size={12} />, onClick: () => { onRename?.(); setMenuOpen(false) } },
    session.archived
      ? { id: 'unarchive', label: '取消归档', icon: <ArchiveRestore size={12} />, onClick: () => store.unarchiveSession(session.id) }
      : { id: 'archive', label: '归档', icon: <Archive size={12} />, onClick: () => store.archiveSession(session.id) },
    { id: 'delete', label: '删除', icon: <Trash2 size={12} />, danger: true, onClick: () => store.deleteSession(session.id) }
  ]

  return (
    <div
      draggable={!!onDragStart}
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true) }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={() => { /* 状态由父组件清理 */ }}
      className={`group relative flex items-center ${compact ? 'pl-2.5' : 'pl-7'} pr-1.5 py-[5px] rounded-[10px] cursor-pointer transition ${
        active ? 'bg-black/[0.07]' : 'hover:bg-black/[0.04]'
      } ${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'border-t-2 border-blue-400' : ''}`}
    >
      <div className="flex-1 flex items-center gap-2.5 min-w-0 text-left pr-1">
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">{icon}</span>
        <span className={`flex-1 truncate text-xs ${active ? 'text-[var(--ink)] font-medium' : 'text-[var(--ink)]/75'}`}>{session.title}</span>
      </div>
      {/* 右侧：项目标签 + 相对时间/状态 + 置顶图标 */}
      <div className="ml-auto flex items-center gap-1 flex-shrink-0">
        {showProject && <span className="text-[11px] text-[var(--ink-soft)]/60 bg-black/[0.04] px-1 rounded max-w-[48px] truncate">{showProject}</span>}
        {session.status === 'executing' ? (
          <WhaleTooltip label="进行中">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
          </WhaleTooltip>
        ) : (
          <WhaleTooltip label={new Date(session.updatedAt).toLocaleString('zh-CN')}>
            <span className="text-[11px] tabular-nums text-[var(--ink-soft)]/55">
              {timeAgo(session.updatedAt)}
            </span>
          </WhaleTooltip>
        )}
        {session.pinned && <Pin size={9} className="text-amber-400 flex-shrink-0" />}
      </div>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 z-50 w-28 floating-surface rounded-lg py-1">
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

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '刚刚'
  if (sec < 3600) return `${Math.floor(sec / 60)} 分`
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时`
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} 天`
  if (sec < 86400 * 30) return `${Math.floor(sec / (86400 * 7))} 周`
  return `${new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}`
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}t`
  if (n < 1000000) return `${(n / 1000).toFixed(0)}Kt`
  return `${(n / 1000000).toFixed(1)}Mt`
}
