import { useState } from 'react'
import { ChevronRight, Loader2, Check, AlertCircle, RotateCcw, StopCircle, Ban } from 'lucide-react'
import type { ToolCallItem, ToolKind } from '../../../agent/src/items'
import { describeToolCall, describeToolGroup, getToolSummaryNode, getToolStatusColor } from './toolActivityText'
import { DetailBlock } from './ToolCardShell'
import { ErrorCard } from './ErrorCard'
import { trySpecialView } from './ToolSpecialViews'

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
  const text = describeToolCall(item)
  const isRunning = item.status === 'running' || item.status === 'pending'
  const isFailed = item.status === 'failed'
  const isStopped = item.status === 'stopped'
  const isCanceled = item.status === 'canceled'
  const hasDetail = Boolean(item.result || Object.keys(item.args).length > 0)
  const summaryNode = getToolSummaryNode(item)
  const statusColor = getToolStatusColor(item.status)

  // 错误默认展开但可收起（来自 Kun）；用户操作过则 pin
  const [userPinned, setUserPinned] = useState(false)
  const isOpen = userPinned || (isFailed && !isRunning)

  const handleToggle = (): void => {
    if (!hasDetail || isRunning) return
    setUserPinned(!isOpen)
  }

  // 失败且有错误分类：用 ErrorCard 渲染（来自 harnessclaw 错误分类体系）
  if (isFailed && (item.errorType || item.error)) {
    return <ErrorCard item={item} />
  }

  // 工具特化视图：write_file 的 diff、shell 的终端输出（来自 lobsterai + AionUi）
  const specialView = trySpecialView(item)
  if (specialView) {
    return <>{specialView}</>
  }

  return (
    <div className="rounded-lg overflow-hidden text-sm">
      <button
        onClick={handleToggle}
        className={`w-full flex items-center gap-2 px-3 py-1.5 transition ${
          isOpen ? 'bg-black/[0.04]' : 'hover:bg-black/[0.02]'
        } ${hasDetail && !isRunning ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {/* 状态圆点（来自 MyAgents） */}
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor.dot}`} />
        {/* 状态图标 */}
        <ToolStatusIcon status={item.status} />
        {/* 失败重试链 */}
        {item.retryOfItemId && <RotateCcw size={12} className="text-amber-500 flex-shrink-0" />}
        {/* 主文案 */}
        <span className={`${isRunning ? 'text-[var(--ink-soft)]' : isFailed ? 'text-red-500' : isStopped ? 'text-amber-500' : isCanceled ? 'text-[var(--ink-soft)]' : 'text-[var(--ink)]'}`}>
          {text}
        </span>
        {/* 摘要节点（来自 MyAgents） */}
        {summaryNode && (
          <span className="text-xs text-[var(--ink-soft)] font-mono flex-shrink-0">{summaryNode}</span>
        )}
        {/* 计时（来自 opencowork） */}
        {!isRunning && item.finishedAt && item.startedAt && (
          <ElapsedLabel startedAt={item.startedAt} finishedAt={item.finishedAt} />
        )}
        {hasDetail && !isRunning && (
          <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ml-auto ${isOpen ? 'rotate-90' : ''}`} />
        )}
      </button>
      {isOpen && hasDetail && (
        <div className="px-3 pb-2 pt-1 space-y-1.5">
          {Object.keys(item.args).length > 0 && (
            <DetailBlock title="参数" content={JSON.stringify(item.args, null, 2)} />
          )}
          {item.result && <DetailBlock title="结果" content={item.result.slice(0, 800)} />}
          {item.errorType && (
            <DetailBlock title="错误类型" content={item.errorType} />
          )}
        </div>
      )}
    </div>
  )
}

function MergedToolGroupCard({ group }: { group: ToolGroup }) {
  const [open, setOpen] = useState(false)
  const allDone = group.items.every((it) => it.status === 'completed' || it.status === 'failed' || it.status === 'stopped' || it.status === 'canceled')
  const anyError = group.items.some((it) => it.status === 'failed')
  const anyStopped = group.items.some((it) => it.status === 'stopped')
  const text = describeToolGroup(group.kind, group.items.length, allDone, group.items)

  // 组级状态色（来自 opencowork groupStatus 聚合）
  const groupColor = anyError
    ? { dot: 'bg-red-500', icon: <AlertCircle size={14} className="text-red-500 flex-shrink-0" /> }
    : anyStopped
    ? { dot: 'bg-amber-500', icon: <StopCircle size={14} className="text-amber-500 flex-shrink-0" /> }
    : allDone
    ? { dot: 'bg-[var(--ink-muted)]/40', icon: <Check size={14} className="text-green-500 flex-shrink-0" /> }
    : { dot: 'bg-sky-500 animate-pulse', icon: <Loader2 size={14} className="text-sky-500 animate-spin flex-shrink-0" /> }

  return (
    <div className="rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-black/[0.02] transition"
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${groupColor.dot}`} />
        {groupColor.icon}
        <span className="text-[var(--ink)]">{text}</span>
        <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ml-auto ${isOpen ? 'rotate-90' : ''}`} />
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
    return <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
  }
  if (status === 'stopped') {
    return <StopCircle size={14} className="text-amber-500 flex-shrink-0" />
  }
  if (status === 'canceled') {
    return <Ban size={14} className="text-[var(--ink-soft)] flex-shrink-0" />
  }
  return <Check size={14} className="text-green-500 flex-shrink-0" />
}

function ElapsedLabel({ startedAt, finishedAt }: { startedAt: number; finishedAt: number }) {
  const sec = Math.max(0, Math.round((finishedAt - startedAt) / 1000))
  if (sec < 1) return null
  const label = sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m${sec % 60}s`
  return <span className="text-xs text-[var(--ink-soft)] flex-shrink-0">{label}</span>
}
