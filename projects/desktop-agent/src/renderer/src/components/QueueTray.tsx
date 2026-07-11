import { useEffect, useState } from 'react'
import { AlertCircle, ArrowUp, FileText, Pencil, Trash2 } from 'lucide-react'
import { useTaskStore } from '../store/task'
import type { QueuedMessage } from '../store/messageQueue'

export function QueueTray() {
  const {
    activeSessionId,
    taskId,
    messageQueues,
    updateQueuedMessage,
    removeQueuedMessage,
    restoreQueuedMessageToInput,
    sendQueuedMessageNow
  } = useTaskStore()
  const sessionId = activeSessionId || taskId
  const items = sessionId ? messageQueues[sessionId] || [] : []
  const [sendingId, setSendingId] = useState<string | null>(null)

  if (items.length === 0) return null

  const sendNow = async (id: string) => {
    if (sendingId) return
    setSendingId(id)
    try {
      await sendQueuedMessageNow(id)
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="mb-2 max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-black/[0.06] bg-white/55 p-2 backdrop-blur-xl">
      <div className="flex items-center justify-between px-1 text-[11px] text-[var(--ink-soft)]">
        <span>{items.length} 条排队</span>
        <span>当前任务结束后自动发送队首</span>
      </div>
      {items.map((item, index) => (
        <QueueItem
          key={item.id}
          item={item}
          index={index}
          sending={sendingId === item.id}
          onUpdate={updateQueuedMessage}
          onRemove={removeQueuedMessage}
          onRestore={restoreQueuedMessageToInput}
          onSendNow={sendNow}
        />
      ))}
    </div>
  )
}

function QueueItem({ item, index, sending, onUpdate, onRemove, onRestore, onSendNow }: {
  item: QueuedMessage
  index: number
  sending: boolean
  onUpdate: (id: string, text: string) => void
  onRemove: (id: string) => void
  onRestore: (id: string) => void
  onSendNow: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState(item.text)
  useEffect(() => setDraft(item.text), [item.id, item.text])

  const busy = sending || item.status === 'dispatching'
  const commit = () => {
    if (draft.trim() || item.attachments.length > 0) onUpdate(item.id, draft)
    else setDraft(item.text)
  }

  return (
    <div className={`rounded-xl border px-3 py-2 ${item.status === 'failed' ? 'border-red-200 bg-red-50/70' : 'border-black/[0.06] bg-white/75'}`}>
      <div className="flex items-start gap-2">
        <span className="mt-1 text-[10px] font-medium text-[var(--ink-soft)]">{index + 1}</span>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setDraft(item.text)
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) event.currentTarget.blur()
          }}
          rows={1}
          disabled={busy}
          placeholder={item.attachments.length > 0 ? '仅发送附件' : '输入消息'}
          className="min-h-7 flex-1 resize-none bg-transparent text-sm leading-5 text-[var(--ink)] outline-none disabled:opacity-50"
        />
        <button
          type="button"
          title="回填到输入框编辑"
          disabled={busy}
          onClick={() => onRestore(item.id)}
          className="rounded-lg p-1.5 text-[var(--ink-soft)] hover:bg-black/[0.04] disabled:opacity-40"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          title="立即发送（中断当前任务）"
          disabled={busy}
          onClick={() => void onSendNow(item.id)}
          className="rounded-lg p-1.5 text-[#0071e3] hover:bg-blue-50 disabled:opacity-40"
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          title="删除"
          disabled={busy}
          onClick={() => onRemove(item.id)}
          className="rounded-lg p-1.5 text-[var(--ink-soft)] hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {item.attachments.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 pl-5">
          {item.attachments.map((attachment) => attachment.type === 'image' && attachment.dataUrl ? (
            <img key={attachment.id} src={attachment.dataUrl} alt={attachment.name} title={attachment.name} className="h-9 w-9 rounded-md border border-black/10 object-cover" />
          ) : (
            <span key={attachment.id} title={attachment.name} className="flex max-w-40 items-center gap-1 rounded-md bg-black/[0.04] px-2 py-1 text-[10px] text-[var(--ink-soft)]">
              <FileText size={11} className="flex-shrink-0" /><span className="truncate">{attachment.name}</span>
            </span>
          ))}
        </div>
      )}
      {item.status === 'failed' && (
        <div className="mt-1 flex items-center gap-1 pl-5 text-[10px] text-red-500">
          <AlertCircle size={11} />发送失败，已恢复到队首
        </div>
      )}
    </div>
  )
}
