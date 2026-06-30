import { useTaskStore } from '../store/task'

// 底部固定输入条，任务执行中可继续输入或重置
export function Composer() {
  const { status, message, setMessage, startTask, reset } = useTaskStore()
  if (status === 'idle') return null
  return (
    <div className="flex-shrink-0 px-6 py-3 border-t border-black/[0.06]">
      <div className="max-w-3xl mx-auto flex items-center gap-2">
        {status === 'completed' || status === 'failed' ? (
          <button
            onClick={reset}
            className="h-9 px-4 rounded-lg glass text-sm font-medium hover:brightness-105 transition"
          >
            新任务
          </button>
        ) : (
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="任务执行中，追加要求…（一期暂不支持）"
            disabled
            className="flex-1 h-9 px-3 rounded-lg glass-soft text-sm outline-none disabled:opacity-60"
          />
        )}
      </div>
    </div>
  )
}
