import { Check } from 'lucide-react'
import { useTaskStore } from '../store/task'
import { RunningStatusText } from './RunningStatusText'

export function TodoChecklist() {
  const { todos } = useTaskStore()
  if (todos.length === 0) return null

  const completed = todos.filter((t) => t.status === 'completed').length

  return (
    <div className="glass rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
        <span className="font-medium tabular-nums">{completed}/{todos.length} 完成</span>
      </div>
      <div className="space-y-1">
        {todos.map((todo) => {
          const isCompleted = todo.status === 'completed'
          const isInProgress = todo.status === 'in_progress'
          return (
            <div
              key={todo.id}
              className={`flex items-start gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors ${
                isInProgress ? '' : 'hover:bg-black/[0.02]'
              }`}
            >
              <div className={`mt-0.5 flex w-4 h-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                isCompleted
                  ? 'border-green-500 bg-green-500 text-white'
                  : isInProgress
                  ? 'border-sky-400 bg-sky-50'
                  : 'border-black/20'
              }`}>
                {isCompleted ? <Check size={11} strokeWidth={3} /> : null}
              </div>
              {isInProgress ? (
                <RunningStatusText className="text-sm leading-relaxed">{todo.content}</RunningStatusText>
              ) : (
                <span className={`text-sm leading-relaxed ${isCompleted ? 'text-[var(--ink-soft)] line-through' : 'text-[var(--ink-soft)]'}`}>
                  {todo.content}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
