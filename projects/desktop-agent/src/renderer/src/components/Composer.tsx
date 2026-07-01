import { useState } from 'react'
import { useTaskStore } from '../store/task'

export function Composer() {
  const { status, message, setMessage, startTask, reset, appendInput, taskId } = useTaskStore()
  const [pending, setPending] = useState(false)

  const isFinished = status === 'completed' || status === 'failed'
  const isExecuting = status === 'executing'

  const handleAppend = async () => {
    if (!message.trim() || !taskId) return
    setPending(true)
    try {
      await appendInput(message)
    } finally {
      setPending(false)
    }
  }

  const isIdle = status === 'idle'

  return (
    <div className="flex-shrink-0 px-6 py-3 border-t border-black/[0.06]">
      <div className="max-w-3xl mx-auto flex items-end gap-2">
        {isFinished && (
          <button
            onClick={reset}
            className="h-9 px-4 mb-1 rounded-lg glass text-sm font-medium hover:brightness-105 transition flex-shrink-0"
          >
            新任务
          </button>
        )}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (isIdle) void startTask()
              else if (isExecuting) handleAppend()
            }
          }}
          placeholder={isIdle ? '描述你要做的事…' : isExecuting ? '追加要求，将在当前步骤完成后生效…' : '输入新任务…'}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none px-3 py-2.5 text-sm leading-relaxed max-h-32 min-h-[40px] glass-soft rounded-xl"
        />
        {isIdle && (
          <button
            onClick={() => void startTask()}
            disabled={!message.trim()}
            className="h-9 px-4 mb-0.5 rounded-xl bg-[#0071e3] text-white text-sm font-medium disabled:opacity-40 hover:brightness-110 transition flex-shrink-0"
          >
            发送
          </button>
        )}
        {isExecuting && (
          <button
            onClick={handleAppend}
            disabled={!message.trim() || pending}
            className="h-9 px-3 mb-0.5 rounded-xl glass text-sm font-medium hover:brightness-105 transition disabled:opacity-40 flex-shrink-0"
          >
            {pending ? '发送中…' : '追加'}
          </button>
        )}
      </div>
    </div>
  )
}
