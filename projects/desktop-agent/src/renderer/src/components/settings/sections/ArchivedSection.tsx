import { useState } from 'react'
import { Archive, ArchiveRestore, Trash2, Search } from 'lucide-react'
import { useTaskStore } from '../../../store/task'
import type { Session, Project } from '../../../store/task'
import { WhaleTooltip } from '../../WhaleTooltip'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '刚刚'
  if (sec < 3600) return `${Math.floor(sec / 60)} 分前`
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} 天前`
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function ArchivedSection() {
  const { sessions, projects, unarchiveSession, deleteSession, continueSession, setActiveProject } = useTaskStore()
  const [keyword, setKeyword] = useState('')

  const projectMap = new Map<string, Project>(projects.map((p) => [p.id, p]))
  let archived = sessions.filter((s) => s.archived)
  const q = keyword.trim().toLowerCase()
  if (q) archived = archived.filter((s) => s.title.toLowerCase().includes(q))
  archived = [...archived].sort((a, b) => b.archivedAt ?? 0 - (a.archivedAt ?? 0))

  return (
    <section>
      <header className="mb-4">
        <h3 className="text-lg font-semibold text-[var(--ink)]">已归档</h3>
        <p className="text-xs text-[var(--ink-soft)] mt-1">这里展示所有归档的对话记录，可恢复或彻底删除</p>
      </header>

      {archived.length > 0 && (
        <div className="relative mb-3">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索归档对话"
            className="w-full h-8 pl-7 pr-3 text-xs rounded-lg bg-black/[0.04] outline-none focus:bg-black/[0.06] transition"
          />
        </div>
      )}

      {archived.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Archive size={32} className="text-[var(--ink-soft)]/40 mb-3" />
          <p className="text-sm text-[var(--ink-soft)]">暂无归档对话</p>
        </div>
      ) : (
        <div className="space-y-1">
          {archived.map((s) => {
            const proj = projectMap.get(s.projectId)
            return (
              <div
                key={s.id}
                className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/[0.04] transition"
              >
                <Archive size={14} className="text-[var(--ink-soft)] flex-shrink-0" />
                <button
                  onClick={() => {
                    setActiveProject(s.projectId)
                    void continueSession(s.id)
                  }}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="text-sm text-[var(--ink)] truncate">{s.title}</div>
                  <div className="text-[11px] text-[var(--ink-soft)]/70">
                    {proj ? proj.name : '普通对话'} · {timeAgo(s.updatedAt)}
                  </div>
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <WhaleTooltip label="恢复">
                    <button
                      onClick={() => unarchiveSession(s.id)}
                      className="w-7 h-7 rounded flex items-center justify-center text-[var(--ink-soft)] hover:bg-black/[0.08] hover:text-[var(--ink)] transition"
                    >
                      <ArchiveRestore size={14} />
                    </button>
                  </WhaleTooltip>
                  <WhaleTooltip label="彻底删除">
                    <button
                      onClick={() => {
                        if (confirm(`彻底删除「${s.title}」？此操作不可恢复`)) deleteSession(s.id)
                      }}
                      className="w-7 h-7 rounded flex items-center justify-center text-red-500 hover:bg-red-50 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </WhaleTooltip>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
