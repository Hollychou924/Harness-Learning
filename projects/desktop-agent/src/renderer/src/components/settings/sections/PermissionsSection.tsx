import { useSettingsStore } from '../settingsStore'

export function PermissionsSection() {
  const { autoApproveLow, saveGeneral, maxIterations, showThinking } = useSettingsStore()

  return (
    <section>
      <header className="mb-5">
        <h3 className="text-lg font-semibold text-[var(--ink)]">权限与审批</h3>
        <p className="text-sm text-[var(--ink-soft)] mt-1">控制 Agent 执行操作时的审批策略</p>
      </header>

      <div className="space-y-5">
        <div className="glass-soft rounded-xl px-4 py-3.5 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-[var(--ink)]">自动批准低风险操作</div>
            <div className="text-xs text-[var(--ink-soft)] mt-1">
              读取文件、搜索网页、列表目录等低风险操作将自动执行，无需手动确认
            </div>
          </div>
          <button
            onClick={() => saveGeneral({ maxIterations, autoApproveLow: !autoApproveLow, showThinking })}
            className={`relative w-10 h-6 rounded-full transition flex-shrink-0 ${
              autoApproveLow ? 'bg-[#0071e3]' : 'bg-black/15'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                autoApproveLow ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">风险等级说明</div>
          <RiskRow level="low" label="低风险" desc="只读操作：读文件、列目录、搜索网页" auto={autoApproveLow} />
          <RiskRow level="medium" label="中风险" desc="写入操作：创建/修改文件" auto={false} />
          <RiskRow level="high" label="高风险" desc="删除操作：删除文件、移动文件" auto={false} />
          <RiskRow level="critical" label="极高风险" desc="系统操作：执行命令、安装包" auto={false} />
        </div>
      </div>
    </section>
  )
}

function RiskRow({ level, label, desc, auto }: { level: string; label: string; desc: string; auto: boolean }) {
  const colors: Record<string, string> = {
    low: 'bg-green-400',
    medium: 'bg-amber-400',
    high: 'bg-orange-400',
    critical: 'bg-red-400'
  }
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/[0.03] transition">
      <span className={`w-2 h-2 rounded-full ${colors[level]} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-[var(--ink)]">{label}</span>
        <span className="text-xs text-[var(--ink-soft)] ml-2">{desc}</span>
      </div>
      <span className={`text-[11px] font-medium flex-shrink-0 ${auto ? 'text-green-500' : 'text-[var(--ink-soft)]'}`}>
        {auto ? '自动执行' : '需确认'}
      </span>
    </div>
  )
}
