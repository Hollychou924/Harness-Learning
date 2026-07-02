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
  Folder,
  MoreHorizontal,
  X
} from 'lucide-react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useTaskStore, type Session, type Project, DEFAULT_PROJECT_ID } from '../store/task'
import { useSettingsStore } from './settings/settingsStore'

/* ============================================================
 * 左侧导航：项目 → 对话 两级管理
 * 综合 opencowork / qwen-code / opencode / AionUi / hexclaw 优点
 * ============================================================ */

export function Sidebar() {
  const store = useTaskStore()
  const { mode, setMode, message, startTask, reset, status, projects, sessions, activeProjectId, activeSessionId } = store
  const { openSettings } = useSettingsStore()
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [renamingProject, setRenamingProject] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0]

  // 当前项目下的对话
  const projectSessions = useMemo(
    () => sessions.filter((s) => s.projectId === activeProjectId),
    [sessions, activeProjectId]
  )

  // 搜索过滤
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projectSessions
    return projectSessions.filter((s) => s.title.toLowerCase().includes(q))
  }, [projectSessions, search])

  // 分组：置顶 / 按时间 / 已归档
  const groups = useMemo(() => groupSessions(filtered, showArchived), [filtered, showArchived])

  return (
    <aside className="glass-soft w-60 flex-shrink-0 flex flex-col border-r border-white/40">
      <div className="drag h-9" />

      {/* Work / Code 切换 */}
      <div className="px-3 pb-2">
        <div className="flex gap-1 p-1 rounded-lg bg-black/[0.05]">
          {(['work', 'code'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 h-7 rounded-md text-sm font-medium transition ${
                mode === m ? 'bg-white shadow-sm text-[var(--ink)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {m === 'work' ? 'Work' : 'Code'}
            </button>
          ))}
        </div>
      </div>

      {/* 新建任务 */}
      <div className="px-3 pb-2">
        <button
          onClick={() => {
            reset()
            startTask()
          }}
          disabled={!message.trim()}
          className="no-drag w-full h-9 rounded-lg glass flex items-center justify-center gap-2 text-sm font-medium hover:brightness-105 transition disabled:opacity-50"
        >
          <Plus size={15} /> 新建对话
        </button>
      </div>

      {/* 项目选择器 */}
      <div className="px-3 pb-2 relative">
        <button
          onClick={() => setProjectMenuOpen((v) => !v)}
          className="no-drag w-full h-8 px-2 rounded-lg flex items-center gap-2 hover:bg-black/[0.05] transition text-left"
        >
          <span className="text-base leading-none">{activeProject?.icon ?? '📁'}</span>
          <span className="flex-1 min-w-0 text-sm text-[var(--ink)] truncate">{activeProject?.name ?? '项目'}</span>
          <ChevronDown size={14} className="text-[var(--ink-soft)] flex-shrink-0" />
        </button>

        {projectMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setProjectMenuOpen(false)} />
            <div className="absolute left-3 right-3 top-9 z-50 glass rounded-lg shadow-lg py-1 max-h-72 overflow-y-auto">
              {[...projects]
                .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0) || a.order - b.order)
                .map((p) => (
                  <div key={p.id} className="group flex items-center px-2 hover:bg-black/[0.04] rounded-md mx-1">
                    <button
                      onClick={() => { store.setActiveProject(p.id); setProjectMenuOpen(false) }}
                      className={`flex-1 flex items-center gap-2 py-1.5 text-left min-w-0 ${p.id === activeProjectId ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'}`}
                    >
                      <span className="text-sm leading-none">{p.icon}</span>
                      <span className="flex-1 text-xs truncate">{p.name}</span>
                      {p.pinned && <Pin size={10} className="text-amber-400 flex-shrink-0" />}
                    </button>
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <IconBtn
                        title={p.pinned ? '取消置顶' : '置顶'}
                        onClick={() => store.togglePinProject(p.id)}
                      >
                        {p.pinned ? <PinOff size={11} /> : <Pin size={11} />}
                      </IconBtn>
                      {p.id !== DEFAULT_PROJECT_ID && (
                        <>
                          <IconBtn title="重命名" onClick={() => { setRenamingProject(p.id); setNewProjectName(p.name) }}>
                            <Pencil size={11} />
                          </IconBtn>
                          <IconBtn
                            title="删除项目"
                            danger
                            onClick={() => {
                              if (confirm(`删除项目「${p.name}」及其下所有对话？`)) store.deleteProject(p.id)
                            }}
                          >
                            <Trash2 size={11} />
                          </IconBtn>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              <div className="border-t border-white/40 mt-1 pt-1">
                <button
                  onClick={() => { setNewProjectOpen(true); setProjectMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition"
                >
                  <FolderPlus size={13} /> 新建项目
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 搜索框 */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索对话"
            className="no-drag w-full h-7 pl-7 pr-7 text-xs rounded-md bg-black/[0.04] outline-none focus:bg-black/[0.06] transition placeholder:text-[var(--ink-soft)]/60"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] hover:text-[var(--ink)]">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {groups.length === 0 && (
          <p className="px-2 py-3 text-xs text-[var(--ink-soft)] opacity-70 text-center">
            {search ? '没有匹配的对话' : '还没有对话，新建一个开始吧'}
          </p>
        )}
        {groups.map((g) => (
          <div key={g.key} className="space-y-0.5">
            <div className="px-1 pt-1 text-[10px] font-medium text-[var(--ink-soft)]/70 flex items-center justify-between">
              <span>{g.label}</span>
              {g.key === 'archived' && (
                <button onClick={() => setShowArchived(false)} className="text-[var(--ink-soft)] hover:text-[var(--ink)]">
                  <ChevronDown size={11} />
                </button>
              )}
            </div>
            {g.sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                active={s.id === activeSessionId}
                onClick={() => void store.continueSession(s.id)}
              />
            ))}
          </div>
        ))}

        {/* 已归档折叠入口 */}
        {projectSessions.some((s) => s.archived) && !showArchived && !search && (
          <button
            onClick={() => setShowArchived(true)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition"
          >
            <ChevronRight size={11} /> 已归档 ({projectSessions.filter((s) => s.archived).length})
          </button>
        )}
      </div>

      {/* 底部用户 + 设置 */}
      <div className="px-3 py-2.5 border-t border-white/40">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-1 flex-1 min-w-0">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-pink-400 flex-shrink-0" />
            <span className="text-xs text-[var(--ink-soft)] truncate">周浩</span>
          </div>
          <button
            onClick={() => openSettings()}
            className="no-drag w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:bg-black/[0.06] hover:text-[var(--ink)] transition flex-shrink-0"
            title="设置"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* 新建项目弹窗 */}
      {newProjectOpen && (
        <NameDialog
          title="新建项目"
          initial={newProjectName}
          placeholder="项目名称"
          confirmLabel="创建"
          onCancel={() => { setNewProjectOpen(false); setNewProjectName('') }}
          onConfirm={(name) => {
            store.createProject(name)
            setNewProjectOpen(false)
            setNewProjectName('')
          }}
        />
      )}
      {/* 重命名项目弹窗 */}
      {renamingProject && (
        <NameDialog
          title="重命名项目"
          initial={newProjectName}
          placeholder="项目名称"
          confirmLabel="保存"
          onCancel={() => setRenamingProject(null)}
          onConfirm={(name) => {
            store.renameProject(renamingProject, name)
            setRenamingProject(null)
          }}
        />
      )}
    </aside>
  )
}

/* ---- 单条对话行 ---- */
function SessionRow({ session, active, onClick }: { session: Session; active: boolean; onClick: () => void }) {
  const store = useTaskStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(session.title)

  useEffect(() => { setName(session.title) }, [session.title])

  const icon =
    session.status === 'completed' ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
    : session.status === 'failed' ? <XCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
    : <Clock size={13} className="text-[var(--ink-soft)] flex-shrink-0 mt-0.5" />

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
      <div className="px-2 py-1">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { if (name.trim()) store.renameSession(session.id, name); setRenaming(false) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { if (name.trim()) store.renameSession(session.id, name); setRenaming(false) }
            if (e.key === 'Escape') setRenaming(false)
          }}
          className="w-full h-7 px-2 text-xs rounded-md bg-white outline-none border border-blue-300"
        />
      </div>
    )
  }

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true) }}
        className={`no-drag w-full text-left px-2 py-1.5 rounded-lg transition ${
          active ? 'bg-black/[0.06]' : 'hover:bg-black/[0.04]'
        }`}
        title={session.title}
      >
        <div className="flex items-start gap-1.5">
          {icon}
          <div className="flex-1 min-w-0">
            <div className={`text-xs leading-snug truncate ${session.archived ? 'text-[var(--ink-soft)] line-through opacity-60' : 'text-[var(--ink)]'}`}>
              {session.title}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[var(--ink-soft)]">
              <span>{timeAgo(session.updatedAt)}</span>
              {session.stepCount > 0 && <span>· {session.stepCount} 步</span>}
              {session.tokens > 0 && <span>· {formatTokens(session.tokens)}</span>}
            </div>
          </div>
          {session.pinned && <Pin size={10} className="text-amber-400 flex-shrink-0 mt-0.5" />}
        </div>
      </button>

      {/* hover 时显示更多按钮 */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(true) }}
        className="no-drag absolute right-1 top-1.5 w-5 h-5 rounded flex items-center justify-center text-[var(--ink-soft)] hover:bg-black/[0.08] opacity-0 group-hover:opacity-100 transition"
      >
        <MoreHorizontal size={13} />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 z-50 w-32 glass rounded-lg shadow-lg py-1">
            {actions.map((a) => (
              <button
                key={a.id}
                onClick={(e) => { e.stopPropagation(); a.onClick(); setMenuOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/[0.05] transition ${
                  a.danger ? 'text-red-500' : 'text-[var(--ink)]'
                }`}
              >
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
interface MenuAction {
  id: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
}

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`w-6 h-6 rounded flex items-center justify-center transition ${
        danger ? 'text-red-500 hover:bg-red-50' : 'text-[var(--ink-soft)] hover:bg-black/[0.08] hover:text-[var(--ink)]'
      }`}
    >
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
        <input
          ref={ref}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter' && val.trim()) onConfirm(val); if (e.key === 'Escape') onCancel() }}
          className="w-full h-9 px-3 text-sm rounded-lg bg-white border border-black/10 outline-none focus:border-blue-400"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition">取消</button>
          <button
            onClick={() => val.trim() && onConfirm(val)}
            className="px-3 py-1.5 text-xs rounded-lg bg-[var(--ink)] text-white hover:opacity-90 transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

interface SessionGroup { key: string; label: string; sessions: Session[] }

function groupSessions(sessions: Session[], includeArchived: boolean): SessionGroup[] {
  const visible = sessions.filter((s) => includeArchived ? s.archived : !s.archived)
  const pinned = visible.filter((s) => s.pinned).sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0))
  const normal = visible.filter((s) => !s.pinned).sort((a, b) => b.updatedAt - a.updatedAt)
  const groups: SessionGroup[] = []
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
  if (includeArchived && visible.some((s) => s.archived)) {
    groups.push({ key: 'archived', label: '已归档', sessions: visible.filter((s) => s.archived) })
  }
  return groups
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return '刚刚'
  if (sec < 3600) return `${Math.floor(sec / 60)}m 前`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h 前`
  return `${Math.floor(sec / 86400)}d 前`
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}t`
  if (n < 1000000) return `${(n / 1000).toFixed(0)}Kt`
  return `${(n / 1000000).toFixed(1)}Mt`
}
