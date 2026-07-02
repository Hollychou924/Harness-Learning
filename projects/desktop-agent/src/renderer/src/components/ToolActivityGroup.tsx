import { useState } from 'react'
import { ChevronRight, Loader2, Check, AlertCircle, RotateCcw } from 'lucide-react'
import type { ToolCallItem, ToolKind } from '../../../agent/src/items'
import { describeToolCall, describeToolGroup } from './toolActivityText'
import { DetailBlock } from './ToolCardShell'

export interface ToolGroup {
  kind: ToolKind
  items: ToolCallItem[]
}

/** 把同一轮里连续同类的工具调用条目分组，用于折叠展示 */
export function groupToolItems(items: ToolCallItem[]): ToolGroup[] {
  const groups: ToolGroup[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last.kind === item.kind && last.items[last.items.length - 1].status !== 'running') {
      last.items.push(item)
    } else {
      groups.push({ kind: item.kind, items: [item] })
    }
  }
  return groups
}

export function ToolActivityGroupView({ group }: { group: ToolGroup }) {
  if (group.items.length === 1) {
    return <SingleToolCard item={group.items[0]} />
  }
  return <MergedToolGroupCard group={group} />
}

function SingleToolCard({ item }: { item: ToolCallItem }) {
  const [open, setOpen] = useState(false)
  const text = describeToolCall(item)
  const isRunning = item.status === 'running' || item.status === 'pending'
  const isFailed = item.status === 'failed'
  const hasDetail = Boolean(item.result || Object.keys(item.args).length > 0)

  return (
    <div className="rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => hasDetail && !isRunning && setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 transition ${
          open ? 'bg-black/[0.04]' : 'hover:bg-black/[0.02]'
        } ${hasDetail && !isRunning ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <ToolStatusIcon status={item.status} />
        {/* 失败重试链：这次调用是上一次失败调用的重试，标个小图标提示 */}
        {item.retryOfItemId && <RotateCcw size={12} className="text-amber-500 flex-shrink-0" />}
        <span className={isRunning ? 'text-[var(--ink-soft)]' : isFailed ? 'text-amber-600' : 'text-[var(--ink)]'}>
          {text}
        </span>
        {hasDetail && !isRunning && (
          <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ml-auto ${open ? 'rotate-90' : ''}`} />
        )}
      </button>
      {open && hasDetail && (
        <div className="px-3 pb-2 pt-1 space-y-1.5">
          {Object.keys(item.args).length > 0 && (
            <DetailBlock title="参数" content={JSON.stringify(item.args, null, 2)} />
          )}
          {item.result && <DetailBlock title="结果" content={item.result.slice(0, 800)} />}
        </div>
      )}
    </div>
  )
}

function MergedToolGroupCard({ group }: { group: ToolGroup }) {
  const [open, setOpen] = useState(false)
  const allDone = group.items.every((it) => it.status === 'completed' || it.status === 'failed')
  const anyError = group.items.some((it) => it.status === 'failed')
  const text = describeToolGroup(group.kind, group.items.length, allDone)

  return (
    <div className="rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-black/[0.02] transition"
      >
        {allDone ? (
          anyError ? <AlertCircle size={14} className="text-amber-500 flex-shrink-0" /> : <Check size={14} className="text-green-500 flex-shrink-0" />
        ) : (
          <Loader2 size={14} className="text-sky-500 animate-spin flex-shrink-0" />
        )}
        <span className="text-[var(--ink)]">{text}</span>
        <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ml-auto ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-2 pt-1 space-y-0.5">
          {group.items.map((item) => (
            <SingleToolCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function ToolStatusIcon({ status }: { status: ToolCallItem['status'] }) {
  if (status === 'running' || status === 'pending') {
    return <Loader2 size={14} className="text-sky-500 animate-spin flex-shrink-0" />
  }
  if (status === 'failed') {
    return <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
  }
  return <Check size={14} className="text-green-500 flex-shrink-0" />
}
