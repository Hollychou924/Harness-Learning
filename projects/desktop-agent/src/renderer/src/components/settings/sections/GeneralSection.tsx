import { useSettingsStore } from '../settingsStore'

export function GeneralSection() {
  const { maxIterations, autoApproveLow, showThinking, saveGeneral } = useSettingsStore()

  return (
    <section>
      <header className="mb-5">
        <h3 className="text-lg font-semibold text-[var(--ink)]">通用设置</h3>
        <p className="text-sm text-[var(--ink-soft)] mt-1">控制任务执行的基本行为</p>
      </header>

      <div className="space-y-6">
        <div>
          <label className="text-sm font-medium text-[var(--ink)]">最大执行步数</label>
          <p className="text-xs text-[var(--ink-soft)] mt-0.5 mb-2">单个任务最多执行的工具调用轮数，防止无限循环</p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={30}
              value={maxIterations}
              onChange={(e) => saveGeneral({ maxIterations: Number(e.target.value), autoApproveLow, showThinking })}
              className="flex-1 accent-[#0071e3]"
            />
            <span className="w-10 text-center text-sm font-medium text-[var(--ink)]">{maxIterations}</span>
          </div>
        </div>

        <Toggle
          label="自动批准低风险操作"
          desc="读取文件、搜索网页等低风险操作自动执行，不再逐个确认"
          checked={autoApproveLow}
          onChange={(v) => saveGeneral({ maxIterations, autoApproveLow: v, showThinking })}
        />

        <Toggle
          label="显示思考过程"
          desc="在任务执行界面实时展示 Agent 的推理步骤"
          checked={showThinking}
          onChange={(v) => saveGeneral({ maxIterations, autoApproveLow, showThinking: v })}
        />
      </div>
    </section>
  )
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-[var(--ink)]">{label}</div>
        <div className="text-xs text-[var(--ink-soft)] mt-0.5">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition flex-shrink-0 ${
          checked ? 'bg-[#0071e3]' : 'bg-black/15'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
