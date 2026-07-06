import { useSettingsStore } from '../settingsStore'

export function GeneralSection() {
  const { maxIterations, approvalMode, showThinking, saveGeneral } = useSettingsStore()

  return (
    <section>
      <header className="mb-5">
        <h3 className="text-lg font-semibold text-[var(--ink)]">通用</h3>
        <p className="text-sm text-[var(--ink-soft)] mt-1">控制任务执行的基本行为</p>
      </header>

      <div className="space-y-6">
        <Toggle
          label="显示思考过程"
          desc="在任务执行界面实时展示 Agent 的推理步骤"
          checked={showThinking}
          onChange={(v) => saveGeneral({ maxIterations, approvalMode, showThinking: v })}
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
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-[#0071e3]' : 'bg-black/15 hover:bg-black/20'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
