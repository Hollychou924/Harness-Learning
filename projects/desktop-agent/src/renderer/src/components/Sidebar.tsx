import { Sparkles, Search, Wrench, Bot, FolderTree, Clock, Settings, Plus } from 'lucide-react'
import { useTaskStore } from '../store/task'

export function Sidebar() {
  const { mode, setMode } = useTaskStore()
  return (
    <aside className="glass-soft w-52 flex-shrink-0 flex flex-col border-r border-white/40">
      {/* 红绿灯预留区：高度留足，不可点击 */}
      <div className="drag h-9" />

      {/* Work / Code 切换 */}
      <div className="px-3 pb-2">
        <div className="flex gap-1 p-1 rounded-lg bg-black/[0.05]">
          <button
            onClick={() => setMode('work')}
            className={`flex-1 h-7 rounded-md text-sm font-medium transition ${
              mode === 'work' ? 'bg-white shadow-sm text-[var(--ink)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            Work
          </button>
          <button
            onClick={() => setMode('code')}
            className={`flex-1 h-7 rounded-md text-sm font-medium transition ${
              mode === 'code' ? 'bg-white shadow-sm text-[var(--ink)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            Code
          </button>
        </div>
      </div>

      {/* 新建任务 */}
      <div className="px-3 pb-2">
        <button className="no-drag w-full h-9 rounded-lg glass flex items-center justify-center gap-2 text-sm font-medium hover:brightness-105 transition">
          <Plus size={15} /> 新建任务
        </button>
      </div>

      {/* 导航 */}
      <nav className="flex-1 px-3 py-1 space-y-0.5 text-sm">
        <NavItem icon={<Search size={16} />} label="搜索" />
        <NavItem icon={<Wrench size={16} />} label="技能" />
        <NavItem icon={<FolderTree size={16} />} label="项目" />
        <NavItem icon={<Clock size={16} />} label="历史" />
        <NavItem icon={<Bot size={16} />} label="自动化" />
      </nav>

      {/* Logo + 底部 */}
      <div className="px-3 py-3 border-t border-white/40 space-y-1">
        <div className="flex items-center gap-2 px-1 pb-1.5">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center shadow-sm">
            <Sparkles size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">小蓝鲸</span>
        </div>
        <NavItem icon={<Settings size={16} />} label="设置" />
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--ink-soft)]">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-pink-400" />
          <span>周浩</span>
        </div>
      </div>
    </aside>
  )
}

function NavItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="no-drag w-full h-8 px-2 rounded-lg flex items-center gap-2.5 text-[var(--ink-soft)] hover:bg-black/[0.04] hover:text-[var(--ink)] transition">
      {icon}
      <span>{label}</span>
    </button>
  )
}
