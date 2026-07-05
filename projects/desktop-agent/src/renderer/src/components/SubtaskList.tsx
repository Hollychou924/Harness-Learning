import { Check, X } from 'lucide-react'
import { useTaskStore } from '../store/task'
import { WhaleTooltip } from './WhaleTooltip'
import { RunningStatusText } from './RunningStatusText'

export function SubtaskList() {
  const { subtasks } = useTaskStore()
  if (subtasks.length === 0) return null

  const running = subtasks.filter((s) => s.status === 'running')

  return (
    <div className="glass rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
        {running.length === 0 && (
          <Check size={13} className="text-green-500" />
        )}
        {running.length > 0 ? (
          <RunningStatusText className="font-medium">子任务 · {subtasks.length} 个（{running.length} 个进行中）</RunningStatusText>
        ) : (
          <span className="font-medium">子任务 · {subtasks.length} 个</span>
        )}
      </div>
      <div className="space-y-1">
        {subtasks.map((st) => (
          <div key={st.id} className="flex items-center gap-2 text-sm">
            {st.status === 'completed' ? (
              <Check size={12} className="text-green-500 flex-shrink-0" />
            ) : st.status === 'running' ? null : (
              <X size={12} className="text-red-500 flex-shrink-0" />
            )}
            {st.status === 'running' ? (
              <RunningStatusText className="truncate">{st.title}</RunningStatusText>
            ) : (
              <span className="truncate text-[var(--ink-soft)]">{st.title}</span>
            )}
            {st.status === 'completed' && st.durationMs && (
              <span className="ml-auto text-xs text-[var(--ink-soft)] flex-shrink-0">
                {(st.durationMs / 1000).toFixed(0)}s{st.toolCount ? ` · ${st.toolCount} 工具` : ''}
              </span>
            )}
            {st.status === 'failed' && st.error && (
              <WhaleTooltip label={st.error} className="ml-auto min-w-0 max-w-[120px]">
                <span className="text-xs text-red-400 flex-shrink-0 truncate">
                  {st.error}
                </span>
              </WhaleTooltip>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
