import { ShieldAlert, Check, X } from 'lucide-react'
import { useTaskStore } from '../store/task'

export function ApprovalCard() {
  const { approvalPending, respondApproval } = useTaskStore()
  if (!approvalPending) return null

  const { toolName, impact, canRollback, riskLevel } = approvalPending
  const isHigh = riskLevel === 'high' || riskLevel === 'critical'

  return (
    <div className="glass rounded-xl p-4 space-y-3 border border-amber-200">
      <div className="flex items-center gap-2">
        <ShieldAlert size={16} className={isHigh ? 'text-red-500' : 'text-amber-500'} />
        <span className="text-sm font-medium text-[var(--ink)]">需要你确认</span>
        {isHigh && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-600">
            高风险
          </span>
        )}
      </div>

      <div className="text-sm text-[var(--ink-soft)] space-y-1">
        <div>
          Agent 想执行：<span className="text-[var(--ink)] font-mono">{formatToolName(toolName)}</span>
        </div>
        {impact && <div>{impact}</div>}
        {canRollback && <div className="text-xs text-green-600">可以回滚</div>}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => respondApproval(true)}
          className="h-8 px-4 rounded-lg bg-[#0071e3] text-white text-sm font-medium hover:brightness-110 transition"
        >
          <span className="flex items-center gap-1.5">
            <Check size={14} />
            允许
          </span>
        </button>
        <button
          onClick={() => respondApproval(false)}
          className="h-8 px-4 rounded-lg glass text-sm font-medium text-red-600 hover:bg-red-50 transition"
        >
          <span className="flex items-center gap-1.5">
            <X size={14} />
            不允许
          </span>
        </button>
      </div>
    </div>
  )
}

function formatToolName(name: string): string {
  if (name.startsWith('mcp__')) {
    const parts = name.split('__')
    if (parts.length >= 3) return `${parts[1]}: ${parts.slice(2).join('_')}`
  }
  return name
}
