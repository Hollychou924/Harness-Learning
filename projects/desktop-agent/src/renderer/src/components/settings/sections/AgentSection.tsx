import { useSettingsStore } from '../settingsStore'

export function AgentSection() {
  const { maxIterations, showThinking, autoApproveLow, saveGeneral } = useSettingsStore()

  return (
    <section>
      <header className="mb-5">
        <h3 className="text-lg font-semibold text-[var(--ink)]">Agent 行为</h3>
        <p className="text-sm text-[var(--ink-soft)] mt-1">调整 Agent 的执行策略和输出行为</p>
      </header>

      <div className="space-y-6">
        <div>
          <label className="text-sm font-medium text-[var(--ink)]">最大执行步数</label>
          <p className="text-xs text-[var(--ink-soft)] mt-0.5 mb-2">
            单个任务最多执行的工具调用轮数，超出后自动停止。建议 8-15 步
          </p>
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
          <div className="flex justify-between text-[10px] text-[var(--ink-soft)]/60 mt-1">
            <span>1</span><span>15</span><span>30</span>
          </div>
        </div>

        <div className="glass-soft rounded-xl px-4 py-3.5 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-[var(--ink)]">显示思考过程</div>
            <div className="text-xs text-[var(--ink-soft)] mt-1">
              在任务执行界面实时展示 Agent 的推理步骤，帮助理解决策过程
            </div>
          </div>
          <button
            onClick={() => saveGeneral({ maxIterations, autoApproveLow, showThinking: !showThinking })}
            className={`relative w-10 h-6 rounded-full transition flex-shrink-0 ${
              showThinking ? 'bg-[#0071e3]' : 'bg-black/15'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                showThinking ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </section>
  )
}
