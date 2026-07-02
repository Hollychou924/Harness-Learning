import { useState } from 'react'
import { useTaskStore } from '../store/task'
import { ChatInput } from './ChatInput'

export function Composer() {
  const { status, message, setMessage, startTask, appendInput, taskId, messages } = useTaskStore()
  const [pending, setPending] = useState(false)

  // idle 状态不渲染底部 Composer（输入框在 HomeView 中间）
  // 但恢复历史对话后（messages 非空）需要常驻输入框以继续聊
  if (status === 'idle' && messages.length === 0) return null

  const isExecuting = status === 'executing'
  const isFinished = status === 'completed' || status === 'failed'

  const handleSend = async () => {
    if (!message.trim()) return
    if (isExecuting && taskId) {
      setPending(true)
      try {
        await appendInput(message)
      } finally {
        setPending(false)
      }
    } else if (isFinished || (status === 'idle' && messages.length > 0)) {
      void startTask()
    }
  }

  const isContinuing = status === 'idle' && messages.length > 0
  const placeholder = isExecuting
    ? '追加要求，将在当前步骤完成后生效…'
    : isContinuing
      ? '继续对话，上下文已完整保留…'
      : '输入新任务…'

  return (
    <div className="flex-shrink-0 px-6 py-3 border-t border-black/[0.06]">
      <div className="mx-auto">
        <ChatInput
          value={message}
          onChange={setMessage}
          onSend={handleSend}
          placeholder={pending ? '发送中…' : placeholder}
        />
      </div>
    </div>
  )
}
