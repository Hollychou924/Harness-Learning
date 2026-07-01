import { Sparkles } from 'lucide-react'

export function AboutSection() {
  return (
    <section>
      <header className="mb-5">
        <h3 className="text-lg font-semibold text-[var(--ink)]">关于</h3>
      </header>

      <div className="flex flex-col items-center text-center py-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-200 mb-4">
          <Sparkles size={28} className="text-white" />
        </div>
        <h4 className="text-xl font-semibold text-[var(--ink)]">小蓝鲸</h4>
        <p className="text-sm text-[var(--ink-soft)] mt-1">桌面生产力 Agent</p>
        <p className="text-xs text-[var(--ink-soft)]/60 mt-3">版本 0.1.0</p>
      </div>

      <div className="glass-soft rounded-xl px-4 py-3 mt-4 space-y-1.5 text-xs text-[var(--ink-soft)]">
        <div className="flex justify-between">
          <span>运行环境</span>
          <span className="text-[var(--ink)]">Electron + macOS</span>
        </div>
        <div className="flex justify-between">
          <span>界面框架</span>
          <span className="text-[var(--ink)]">React + Tailwind</span>
        </div>
      </div>
    </section>
  )
}
