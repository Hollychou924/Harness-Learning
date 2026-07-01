import { useState } from 'react'
import { useTaskStore } from '../store/task'

export function Composer() {
  const { status, message, setMessage, startTask, reset, appendInput, taskId } = useTaskStore()
  const [pending, setPending] = useState(false)
  if (status === 'idle') return null

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

  return (
    <div className="flex-shrink-0 px-6 py-3 border-t border-black/[0.06]">
      <div className="max-w-3xl mx-auto flex items-center gap-2">
        {isFinished ? (
          <button
            onClick={reset}
            className="h-9 px-4 rounded-lg glass text-sm font-medium hover:brightness-105 transition"
          >
            新任务
          </button>
        ) : isExecuting ? (
          <>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleAppend()
                }
              }}
              placeholder="追加要求，将在当前步骤完成后生效…"
              className="flex-1 h-9 px-3 rounded-lg glass-soft text-sm outline-none"
            />
            <button
              onClick={handleAppend}
              disabled={!message.trim() || pending}
              className="h-9 px-3 rounded-lg glass text-sm font-medium hover:brightness-105 transition disabled:opacity-40"
            >
              {pending ? '发送中…' : '追加'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
