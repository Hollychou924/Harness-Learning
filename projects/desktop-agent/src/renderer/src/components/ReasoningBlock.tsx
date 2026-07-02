import { useEffect, useState } from 'react'
import { Brain, ChevronRight, Loader2 } from 'lucide-react'
import type { ReasoningItem } from '../../../agent/src/items'

// 思考展示：摘要(默认展示的要点) + 原文(用户主动展开才看)两级，完成后显示耗时
// 复刻 Codex reasoningItem.thinking/thoughtWithElapsed 的展示逻辑
// 超越点：最终回复一开始输出，思考框自动收起，不用用户手动点
export function ReasoningBlock({
  item,
  finalAnswerStarted
}: {
  item: ReasoningItem
  /** 本轮最终回复是否已开始输出，用于自动收起思考框 */
  finalAnswerStarted: boolean
}) {
  const [open, setOpen] = useState(true)
  const [showRawContent, setShowRawContent] = useState(false)
  const isActive = item.status === 'running'

  // 最终回复一开始输出，思考框自动收起(仅首次触发，不覆盖用户手动重新展开的选择)
  useEffect(() => {
    if (finalAnswerStarted && isActive === false) setOpen(false)
  }, [finalAnswerStarted, isActive])

  const elapsedLabel = formatElapsed(item)
  const headline = isActive ? '思考中' : elapsedLabel ? `想了 ${elapsedLabel}` : '已思考'
  const latestSummary = item.summary[item.summary.length - 1] || ''

  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/[0.02] transition"
      >
        {isActive ? (
          <Loader2 size={14} className="text-sky-500 animate-spin flex-shrink-0" />
        ) : (
          <Brain size={14} className="text-[var(--ink-soft)] flex-shrink-0" />
        )}
        <span className="text-[var(--ink)] flex-shrink-0">{headline}</span>
        {!open && latestSummary && (
          <span className="text-xs text-[var(--ink-soft)] truncate flex-1 text-left">{latestSummary}</span>
        )}
        <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ml-auto flex-shrink-0 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-2 pt-1 space-y-2">
          {/* 摘要：默认展示的思考要点 */}
          <div className="space-y-1 text-xs text-[var(--ink-soft)]">
            {item.summary.filter(Boolean).map((s, i) => (
              <div key={i} className="leading-relaxed">{s}</div>
            ))}
          </div>
          {/* 原文：完整思考过程，用户主动展开才看 */}
          {item.content.some(Boolean) && (
            <div>
              <button
                onClick={() => setShowRawContent(!showRawContent)}
                className="text-xs text-[#0071e3] hover:underline"
              >
                {showRawContent ? '收起完整思考' : '查看完整思考'}
              </button>
              {showRawContent && (
                <div className="mt-1.5 space-y-1 text-xs text-[var(--ink-soft)] bg-black/[0.03] rounded-md p-2">
                  {item.content.filter(Boolean).map((c, i) => (
                    <div key={i} className="leading-relaxed whitespace-pre-wrap">{c}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatElapsed(item: ReasoningItem): string {
  if (!item.finishedAt) return ''
  const sec = Math.max(0, Math.round((item.finishedAt - item.startedAt) / 1000))
  if (sec < 1) return ''
  if (sec < 60) return `${sec} 秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m} 分 ${s} 秒`
}
