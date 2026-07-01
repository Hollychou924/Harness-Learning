import {
  Sparkles,
  Search,
  Wrench,
  Bot,
  FolderTree,
  Clock,
  Settings,
  Plus,
  CheckCircle2,
  XCircle,
  History
} from 'lucide-react'
import { useTaskStore } from '../store/task'
import { useSettingsStore } from './settings/settingsStore'
import type { HistoryEntry } from '../store/task'

export function Sidebar() {
  const { mode, setMode, history, message, startTask, reset, status } = useTaskStore()
  const { openSettings } = useSettingsStore()
  return (
    <aside className="glass-soft w-56 flex-shrink-0 flex flex-col border-r border-white/40">
      {/* 红绿灯预留区 */}
      <div className="drag h-9" />

      {/* Work / Code 切换 */}
      <div className="px-3 pb-2">
        <div className="flex gap-1 p-1 rounded-lg bg-black/[0.05]">
          <button
            onClick={() => setMode('work')}
            className={`flex-1 h-7 rounded-md text-sm font-medium transition ${
              mode === 'work'
                ? 'bg-white shadow-sm text-[var(--ink)]'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            Work
          </button>
          <button
            onClick={() => setMode('code')}
            className={`flex-1 h-7 rounded-md text-sm font-medium transition ${
              mode === 'code'
                ? 'bg-white shadow-sm text-[var(--ink)]'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            Code
          </button>
        </div>
      </div>

      {/* 新建任务 */}
      <div className="px-3 pb-2">
        <button
          onClick={() => {
            if (status !== 'idle') reset()
            startTask()
          }}
          disabled={!message.trim()}
          className="no-drag w-full h-9 rounded-lg glass flex items-center justify-center gap-2 text-sm font-medium hover:brightness-105 transition disabled:opacity-50"
        >
          <Plus size={15} /> 新建任务
        </button>
      </div>

      {/* 任务历史 */}
      <div className="px-3 pb-1 pt-1">
        <div className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
          <History size={11} />
          <span>最近任务</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
        {history.length === 0 ? (
          <p className="px-2 py-2 text-xs text-[var(--ink-soft)] opacity-70">
            还没有任务记录
          </p>
        ) : (
          groupHistoryByTime(history).map((group) => (
            <div key={group.label} className="space-y-0.5">
              <div className="px-1 pt-1 text-[10px] font-medium text-[var(--ink-soft)]/70">
                {group.label}
              </div>
              {group.items.map((h) => <HistoryItem key={h.id} entry={h} />)}
            </div>
          ))
        )}
      </div>

      {/* 导航 */}
      <nav className="px-3 py-1.5 border-t border-white/40 space-y-0.5 text-sm">
        <NavItem icon={<Search size={15} />} label="搜索" />
        <NavItem icon={<Wrench size={15} />} label="技能" />
        <NavItem icon={<FolderTree size={15} />} label="项目" />
        <NavItem icon={<Bot size={15} />} label="自动化" />
      </nav>

      {/* Logo + 底部 */}
      <div className="px-3 py-3 border-t border-white/40 space-y-1">
        <div className="flex items-center gap-2 px-1 pb-1.5">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center shadow-sm">
            <Sparkles size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">小蓝鲸</span>
        </div>
        <NavItem icon={<Settings size={15} />} label="设置" onClick={() => openSettings()} />
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--ink-soft)]">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-pink-400" />
          <span>周浩</span>
        </div>
      </div>
    </aside>
  )
}

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const icon =
    entry.status === 'completed' ? (
      <CheckCircle2 size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
    ) : entry.status === 'failed' ? (
      <XCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
    ) : (
      <Clock size={13} className="text-[var(--ink-soft)] flex-shrink-0 mt-0.5" />
    )
  return (
    <button
      className="no-drag w-full text-left px-2 py-1.5 rounded-lg hover:bg-black/[0.04] transition group"
      title={entry.title}
    >
      <div className="flex items-start gap-1.5">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="text-xs leading-snug text-[var(--ink)] line-clamp-2 group-hover:text-[var(--ink)]">
            {entry.title}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[var(--ink-soft)]">
            <span>{timeAgo(entry.finishedAt)}</span>
            {entry.stepCount > 0 && <span>· {entry.stepCount} 步</span>}
            {entry.tokens > 0 && <span>· {formatTokens(entry.tokens)}</span>}
          </div>
        </div>
      </div>
    </button>
  )
}

function NavItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="no-drag w-full h-8 px-2 rounded-lg flex items-center gap-2.5 text-[var(--ink-soft)] hover:bg-black/[0.04] hover:text-[var(--ink)] transition">
      {icon}
      <span>{label}</span>
    </button>
  )
}

function groupHistoryByTime(items: HistoryEntry[]): { label: string; items: HistoryEntry[] }[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000
  const weekAgo = today - 6 * 86400000
  const groups: { label: string; items: HistoryEntry[] }[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '近 7 天', items: [] },
    { label: '更早', items: [] }
  ]
  for (const item of items) {
    if (item.finishedAt >= today) groups[0].items.push(item)
    else if (item.finishedAt >= yesterday) groups[1].items.push(item)
    else if (item.finishedAt >= weekAgo) groups[2].items.push(item)
    else groups[3].items.push(item)
  }
  return groups.filter((g) => g.items.length > 0)
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
