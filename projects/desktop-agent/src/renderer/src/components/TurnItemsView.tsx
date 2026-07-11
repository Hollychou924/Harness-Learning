import { useState } from 'react'
import { ChevronRight, FilePlus } from 'lucide-react'
import type { Turn, ToolCallItem } from '../../../agent/src/items'
import { ReasoningBlock } from './ReasoningBlock'
import { ToolActivityGroupView, groupToolItems } from './ToolActivityGroup'
import { CollapsedTurnBar } from './CollapsedTurnBar'
import { ProcessFold } from './ProcessFold'
import { useDetailLevelStore } from './detailLevelStore'
import { WhaleTooltip } from './WhaleTooltip'

// 单轮内条目的纯展示：思考块 + 文件变更 + 工具活动组，历史轮次和当前实时轮次共用这一份渲染逻辑
// 这样翻回历史对话，每一轮的思考/工具调用细节依然能展开看，不再是只剩一句"用了N个工具"
interface FileChangeEntry {
  path: string
  name: string
  totalLines: number
  writeCount: number
}

function collectFileChanges(items: ToolCallItem[]): FileChangeEntry[] {
  const writes = items.filter((it) => it.kind === 'write_file' && it.status === 'completed')
  const byPath = new Map<string, FileChangeEntry>()
  for (const item of writes) {
    const rawPath = typeof item.args.path === 'string' ? item.args.path : ''
    const normalized = rawPath.replace(/\\/g, '/').replace(/\/+$/, '')
    const content = typeof item.args.content === 'string' ? item.args.content : ''
    const lines = content === '' ? 0 : content.split('\n').length
    const existing = byPath.get(normalized)
    if (existing) {
      existing.totalLines += lines
      existing.writeCount += 1
    } else {
      byPath.set(normalized, {
        path: rawPath,
        name: normalized.split('/').pop() || normalized || '未命名',
        totalLines: lines,
        writeCount: 1
      })
    }
  }
  return Array.from(byPath.values())
}

export function TurnItemsView({ turn, showThinking }: { turn: Turn; showThinking: boolean }) {
  const detailLevel = useDetailLevelStore((s) => s.level)
  const items = turn.items
  const toolItems = items.filter((it): it is ToolCallItem => it.type === 'toolCall')
  const reasoningItems = items.filter((it) => it.type === 'reasoning')
  const fileChanges = collectFileChanges(toolItems)
  const finalAnswerStarted = items.some((it) => it.type === 'agentMessage' && it.phase === 'final_answer')

  const isCompleted = turn.status === 'completed'
  const groups = groupToolItems(toolItems)

  if (toolItems.length === 0 && reasoningItems.length === 0) return null

  // 只看结论模式：过程完全不渲染
  if (detailLevel === 'conclusionOnly') return null

  // 轮内折叠判定(复刻 Codex tIn)：已完成 + 最终回复已出现 + 有过程内容 → 过程默认收起
  // expandAll 模式：不折叠
  const shouldCollapse = detailLevel === 'expandAll' ? false : (isCompleted && finalAnswerStarted && (toolItems.length > 0 || reasoningItems.length > 0))

  const processContent = (
    <>
      {showThinking && reasoningItems.map((r) => (
        <ReasoningBlock key={r.id} item={r} finalAnswerStarted={finalAnswerStarted} />
      ))}

      {fileChanges.length > 0 && (
        <FileChangeSection changes={fileChanges} collapsed={isCompleted} />
      )}

      {groups.length > 0 && (
        <div className={`rounded-xl text-[var(--ink-soft)] ${isCompleted ? 'opacity-70' : ''}`}>
          <ProcessFold>
            {groups.map((g, i) => (
              <ToolActivityGroupView key={`${g.kind}-${i}`} group={g} />
            ))}
          </ProcessFold>
        </div>
      )}
    </>
  )

  return (
    <div className="space-y-0.5">
      {shouldCollapse ? <CollapsedTurnBar turn={turn}>{processContent}</CollapsedTurnBar> : processContent}
    </div>
  )
}

function FileChangeSection({ changes, collapsed }: { changes: FileChangeEntry[]; collapsed: boolean }) {
  const [open, setOpen] = useState(!collapsed)
  const totalLines = changes.reduce((sum, c) => sum + c.totalLines, 0)
  return (
    <div className="rounded-xl overflow-hidden text-[var(--ink-soft)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:text-[var(--ink)] transition"
      >
        <FilePlus size={14} className="text-sky-600 flex-shrink-0" />
        <span className="text-[var(--ink)]">文件变更</span>
        <span className="text-xs text-[var(--ink-soft)]">{changes.length} 个文件 · +{totalLines} 行</span>
        <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ml-auto ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-1.5">
          {changes.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <WhaleTooltip label={c.path} className="min-w-0 flex-1">
                <span className="font-mono text-[var(--ink)] truncate">{c.name}</span>
              </WhaleTooltip>
              {c.writeCount > 1 && (
                <span className="text-xs text-[var(--ink-soft)]">{c.writeCount} 次写入</span>
              )}
              {c.totalLines > 0 && (
                <span className="text-xs font-mono text-green-600 flex-shrink-0">+{c.totalLines}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
