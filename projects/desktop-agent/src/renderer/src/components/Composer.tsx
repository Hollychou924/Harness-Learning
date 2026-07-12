import { useRef, useState } from 'react'
import { useTaskStore } from '../store/task'
import { ApprovalCard } from './ApprovalCard'
import { ChatInput } from './ChatInput'
import { ComposerQuestionPanel } from './ComposerQuestionPanel'
import { ContinuationCard } from './ContinuationCard'
import { PlanCard } from './PlanCard'
import { ProgressPill } from './ProgressPill'
import { QueueTray } from './QueueTray'
import { DetailLevelControl } from './DetailLevelControl'

export function Composer() {
  const { status, message, attachments, setMessage, startTask, queueMessage, cancelTask, taskId, messages, currentTurn, approvalPending, pendingPlan, pendingQuestion, respondQuestion, continuationPending, todos } = useTaskStore()
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)

  if (status === 'idle' && messages.length === 0) return null

  const isExecuting = status === 'executing'
  const isFinished = status === 'completed' || status === 'failed'
  const hitlBlocking = Boolean(approvalPending || pendingPlan || pendingQuestion || continuationPending)

  const handleSend = async () => {
    if (pendingRef.current) return
    const hasBlockedAttachment = attachments.some((a) => a.status === 'failed' || a.status === 'uploading')
    const readyAttachments = attachments.filter((a) => a.status !== 'failed' && a.status !== 'uploading')
    if (hasBlockedAttachment) return
    if (!message.trim() && readyAttachments.length === 0) return
    if (isExecuting && taskId) {
      pendingRef.current = true
      setPending(true)
      try {
        await queueMessage(message, readyAttachments)
      } finally {
        pendingRef.current = false
        setPending(false)
      }
    } else if (isFinished || (status === 'idle' && messages.length > 0)) {
      void startTask()
    }
  }

  const isContinuing = status === 'idle' && messages.length > 0
  const placeholder = isExecuting
    ? '输入下一条消息，将在当前任务完成后发送…'
    : isContinuing
      ? '继续对话，上下文已完整保留…'
      : '输入新任务…'

  return (
    <div className="flex-shrink-0 px-6 py-3">
      <div className="mx-auto max-w-4xl">
        {!hitlBlocking && (
          <div className="mb-2 flex items-center justify-center gap-3">
            <ProgressPill status={status} currentTurn={currentTurn} todos={todos} hasApprovalPending={false} />
            <DetailLevelControl />
          </div>
        )}
        <QueueTray />
        {approvalPending ? (
          <ApprovalCard />
        ) : pendingPlan ? (
          <PlanCard />
        ) : continuationPending ? (
          <ContinuationCard />
        ) : pendingQuestion ? (
          <ComposerQuestionPanel question={pendingQuestion} onAnswer={respondQuestion} />
        ) : (
          <ChatInput
            value={message}
            onChange={setMessage}
            onSend={handleSend}
            onStop={() => void cancelTask()}
            isRunning={isExecuting}
            placeholder={pending ? '发送中…' : placeholder}
          />
        )}
        {hitlBlocking && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => void cancelTask()}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] text-[var(--ink-soft)] hover:text-red-500"
            >
              停止任务
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
