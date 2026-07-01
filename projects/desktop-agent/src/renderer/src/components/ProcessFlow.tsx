import { useState } from 'react'
import { ChevronRight, Loader2, Check, AlertCircle, Brain, FilePlus } from 'lucide-react'
import { useTaskStore, getMergedToolLogs, getMergedFileChanges, type MergedToolGroup } from '../store/task'
import { useSettingsStore } from './settings/settingsStore'
import { ToolCard } from './toolCards'
import { ToolCardShell } from './ToolCardShell'
import { ApprovalCard } from './ApprovalCard'
import { PlanCard } from './PlanCard'
import { TodoChecklist } from './TodoChecklist'
import { SubtaskList } from './SubtaskList'

export function ProcessFlow() {
  const { status, thinking, toolLogs, chunks, error } = useTaskStore()
  const { showThinking } = useSettingsStore()
  const merged = getMergedToolLogs(toolLogs)
  const fileChanges = getMergedFileChanges(toolLogs)
  const doneCount = toolLogs.filter((t) => t.result).length
  const runningCount = toolLogs.filter((t) => !t.result).length
  const isCompleted = status === 'completed'

  return (
    <div className="space-y-2">
      <StatusLine status={status} doneCount={doneCount} runningCount={runningCount} total={toolLogs.length} />

      {showThinking && thinking.length > 0 && <ThinkingBlock items={thinking} executing={status === 'executing'} />}

      {/* 文件变更区（Turn 三段之文件变更） */}
      {fileChanges.length > 0 && (
        <FileChangeSection changes={fileChanges} collapsed={isCompleted} />
      )}

      {/* 过程块区（Turn 三段之过程块） */}
      {merged.length > 0 && (
        <div className={`glass rounded-xl p-1.5 space-y-0.5 ${isCompleted ? 'opacity-70' : ''}`}>
          {merged.map((group) => (
            <MergedToolGroupView key={group.id} group={group} />
          ))}
        </div>
      )}

      {/* 最终回答（Turn 三段之最终回答，仅完成态展示） */}
      {isCompleted && chunks && (
        <div className="glass rounded-xl px-3 py-2.5">
          <div className="text-xs text-[var(--ink-soft)] mb-1 flex items-center gap-1.5">
            <Check size={12} className="text-green-500" />
            <span>任务完成</span>
          </div>
          <p className="text-sm leading-relaxed text-[var(--ink)]">{chunks}</p>
        </div>
      )}

      <PlanCard />
      <TodoChecklist />
      <SubtaskList />
      <ApprovalCard />

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

function FileChangeSection({ changes, collapsed }: { changes: { path: string; name: string; totalLines: number; entries: { id: string }[] }[]; collapsed: boolean }) {
  const [open, setOpen] = useState(!collapsed)
  const totalLines = changes.reduce((sum, c) => sum + c.totalLines, 0)
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/[0.02] transition"
      >
        <FilePlus size={14} className="text-sky-600 flex-shrink-0" />
        <span className="text-[var(--ink)]">文件变更</span>
        <span className="text-xs text-[var(--ink-soft)]">{changes.length} 个文件 · +{totalLines} 行</span>
        <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ml-auto ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-1.5">
          {changes.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="font-mono text-[var(--ink)] truncate flex-1" title={c.path}>{c.name}</span>
              {c.entries.length > 1 && (
                <span className="text-xs text-[var(--ink-soft)]">{c.entries.length} 次写入</span>
              )}
              {c.totalLines > 0 && (
                <span className="text-xs font-mono text-green-600 flex-shrink-0">+{c.totalLines}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MergedToolGroupView({ group }: { group: MergedToolGroup }) {
  if (group.count === 1) {
    return <ToolCard entry={group.firstEntry} />
  }
  // 合并展示：同类工具连续调用 >1 次时折叠为一条
  return <MergedGroupCard group={group} />
}

function MergedGroupCard({ group }: { group: MergedToolGroup }) {
  const [open, setOpen] = useState(false)
  const label = MERGED_LABELS[group.name] || group.name
  return (
    <div className="rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-black/[0.02] transition"
      >
        {group.allDone ? (
          group.anyError ? (
            <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
          ) : (
            <Check size={14} className="text-green-500 flex-shrink-0" />
          )
        ) : (
          <Loader2 size={14} className="text-sky-500 animate-spin flex-shrink-0" />
        )}
        <span className="text-[var(--ink)]">
          {label} <span className="text-[var(--ink-soft)]">· {group.count} 次</span>
        </span>
        <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ml-auto ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-2 pt-1 space-y-0.5">
          {group.entries.map((entry, i) => (
            <ToolCard key={entry.id || i} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

const MERGED_LABELS: Record<string, string> = {
  fetch_page: '网页读取',
  parse_page: '内容解析',
  list_files: '文件检索',
  read_file: '文件读取',
  write_file: '文件写入',
}
