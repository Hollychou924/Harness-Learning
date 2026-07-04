import { useState } from 'react'
import { Check, ChevronRight, ShieldAlert, X } from 'lucide-react'
import { useTaskStore } from '../store/task'

type ApprovalScope = 'once' | 'task' | 'always'

const SCOPE_OPTIONS: Array<{ value: ApprovalScope; label: string; description: string }> = [
  { value: 'once', label: '只允许这一次', description: '最稳妥，下一次同类动作还会再问你。' },
  { value: 'task', label: '本次任务都允许', description: '同一个任务里遇到同类动作不再打断。' },
  { value: 'always', label: '以后同类都允许', description: '后续同类动作会直接放行，适合你信任的固定动作。' }
]

export function ApprovalCard() {
  const { approvalPending, respondApproval } = useTaskStore()
  const [scope, setScope] = useState<ApprovalScope>('once')
  const [detailsOpen, setDetailsOpen] = useState(false)
  if (!approvalPending) return null

  const { toolName, impact, canRollback, riskLevel, args } = approvalPending
  const isHigh = riskLevel === 'high' || riskLevel === 'critical'
  const action = formatAction(toolName, args)
  const details = JSON.stringify(args, null, 2)

  return (
    <div className={`glass rounded-xl p-4 space-y-3 border ${isHigh ? 'border-red-200' : 'border-amber-200'}`}>
      <div className="flex items-start gap-2">
        <ShieldAlert size={16} className={isHigh ? 'text-red-500 mt-0.5 flex-shrink-0' : 'text-amber-500 mt-0.5 flex-shrink-0'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--ink)]">需要你确认</span>
            {isHigh && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                高风险
              </span>
            )}
          </div>
          <div className="text-sm text-[var(--ink)] mt-1 leading-relaxed">小蓝鲸想要：{action}</div>
          {impact && <div className="text-xs text-[var(--ink-soft)] mt-1 leading-relaxed">原因：{simplifyImpact(impact)}</div>}
          <div className={`text-xs mt-1 ${canRollback ? 'text-green-600' : 'text-red-500'}`}>
            {canRollback ? '如果结果不合适，后续可尝试撤回或改回。' : '这个动作可能不容易撤回，请谨慎确认。'}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {SCOPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setScope(option.value)}
            className={`w-full text-left rounded-lg px-3 py-2 border transition ${scope === option.value ? 'border-sky-300 bg-sky-50/70' : 'border-black/[0.06] hover:bg-black/[0.02]'}`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 ${scope === option.value ? 'border-sky-500 bg-sky-500' : 'border-black/20'}`} />
              <span className="text-sm text-[var(--ink)]">{option.label}</span>
            </div>
            <div className="text-xs text-[var(--ink-soft)] ml-5 mt-1">{option.description}</div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
      >
        <ChevronRight size={13} className={`transition-transform ${detailsOpen ? 'rotate-90' : ''}`} />
        查看具体内容
      </button>
      {detailsOpen && (
        <pre className="max-h-40 overflow-y-auto rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-[var(--ink-soft)] whitespace-pre-wrap break-all font-mono">
          {details}
        </pre>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => respondApproval(true, scope)}
          className="h-8 px-4 rounded-lg bg-[#0071e3] text-white text-sm font-medium hover:brightness-110 transition"
        >
          <span className="flex items-center gap-1.5">
            <Check size={14} />
            允许并继续
          </span>
        </button>
        <button
          onClick={() => respondApproval(false, 'once')}
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

function formatAction(name: string, args: Record<string, unknown>): string {
  if (name === 'shell' && typeof args.command === 'string') return `运行「${shorten(args.command, 90)}」`
  if (name === 'write_file' && typeof args.path === 'string') return `写入文件「${args.path}」`
  if (name === 'create_docx') return '生成 Word 文档'
  if (name === 'create_xlsx') return '生成表格文件'
  if (name.startsWith('mcp__')) return '使用外部能力完成操作'
  return name
}

function simplifyImpact(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function shorten(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}
