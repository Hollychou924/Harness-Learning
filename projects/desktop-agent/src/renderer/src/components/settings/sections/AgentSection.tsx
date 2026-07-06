import { useSettingsStore } from '../settingsStore'

export function AgentSection() {
  const { maxIterations, showThinking, approvalMode, saveGeneral } = useSettingsStore()

  return (
    <section>
      <header className="mb-5">
        <h3 className="text-lg font-semibold text-[var(--ink)]">Agent 行为</h3>
        <p className="text-sm text-[var(--ink-soft)] mt-1">调整 Agent 的执行策略和输出行为</p>
      </header>

      <div className="space-y-6">
        {/* 最大执行步数已作为内部防跑飞上限，不再暴露给用户。默认 30，续跑机制处理超长任务。 */}

        <div className="floating-subsurface rounded-xl px-4 py-3.5 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-[var(--ink)]">显示思考过程</div>
            <div className="text-xs text-[var(--ink-soft)] mt-1">
              在任务执行界面实时展示 Agent 的推理步骤，帮助理解决策过程
            </div>
          </div>
          <button
            onClick={() => saveGeneral({ maxIterations, approvalMode, showThinking: !showThinking })}
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
