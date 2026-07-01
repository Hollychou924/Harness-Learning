import { useState } from 'react'
import { ChevronRight, Loader2, Check, AlertCircle, Brain } from 'lucide-react'
import { useTaskStore } from '../store/task'
import { ToolLog } from './ToolLog'
import { FileWriteCard } from './FileWriteCard'

// 任务执行过程流：思考过程 + 工具步骤，默认折叠技术细节
export function ProcessFlow() {
  const { status, thinking, toolLogs, error } = useTaskStore()
  const doneCount = toolLogs.filter((t) => t.result).length
  const runningCount = toolLogs.filter((t) => !t.result).length
  const fileWrites = toolLogs.filter((t) => t.name === 'write_file' && t.result)

  return (
    <div className="space-y-2">
      {/* 总体状态条 */}
      <StatusLine status={status} doneCount={doneCount} runningCount={runningCount} total={toolLogs.length} />

      {/* 思考过程（可折叠） */}
      {thinking.length > 0 && <ThinkingBlock items={thinking} executing={status === 'executing'} />}

      {/* 文件写入产物卡：突出 +N 行，像竞品 IDE 那样 */}
      {fileWrites.length > 0 && (
        <div className="space-y-1.5">
          {fileWrites.map((t, i) => (
            <FileWriteCard key={i} entry={t} />
          ))}
        </div>
      )}

      {/* 工具步骤流 */}
      {toolLogs.length > 0 && (
        <div className="glass rounded-xl p-1.5 space-y-0.5">
          {toolLogs.map((t, i) => (
            <ToolLog key={i} entry={t} />
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
          <AlertCircle size={15} />
          {error}
        </div>
      )}
    </div>
  )
}

function StatusLine({ status, doneCount, runningCount, total }: {
  status: string; doneCount: number; runningCount: number; total: number
}) {
  const label =
    status === 'executing'
      ? runningCount > 0
        ? `执行中 · ${doneCount}/${total} 步完成`
        : '思考中…'
      : status === 'completed'
      ? `任务完成 · 共 ${total} 步`
      : '任务失败'
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
      {status === 'executing' ? (
        <Loader2 size={14} className="text-sky-500 animate-spin" />
      ) : status === 'completed' ? (
        <Check size={14} className="text-green-500" />
      ) : (
        <AlertCircle size={14} className="text-red-500" />
      )}
      {label}
    </div>
  )
}

function ThinkingBlock({ items, executing }: { items: string[]; executing: boolean }) {
  const [open, setOpen] = useState(false)
  const recent = items.slice(-1)[0] || ''
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/[0.02] transition"
      >
        {executing ? (
          <Loader2 size={14} className="text-sky-500 animate-spin flex-shrink-0" />
        ) : (
          <Brain size={14} className="text-[var(--ink-soft)] flex-shrink-0" />
        )}
        <span className="text-[var(--ink)]">思考过程</span>
        <span className="text-xs text-[var(--ink-soft)] truncate flex-1 text-left">
          {recent.replace(/^第 \d+ 轮思考$/, '正在分析任务')}
        </span>
        <span className="text-xs text-[var(--ink-soft)]">{items.length} 条</span>
        <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-2 pt-1 space-y-1 text-xs text-[var(--ink-soft)]">
          {items.map((t, i) => (
            <div key={i} className="leading-relaxed">{t}</div>
          ))}
        </div>
      )}
    </div>
  )
}
