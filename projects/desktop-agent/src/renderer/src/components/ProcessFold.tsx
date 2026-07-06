import { useState, useCallback, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'

// 过程组 head+tail 折叠：超过阈值时首2尾2始终可见，中间折叠成"+N"按钮
// 来自 MyAgents BlockGroup：保上下文（首2看起因，尾2看进展），中间折叠避免信息过载
// 用户展开任意子项 → 整组 pin 展开，避免自动折叠丢失用户刚展开的状态

const FOLD_THRESHOLD = 6
const VISIBLE_HEAD = 2
const VISIBLE_TAIL = 2

export function ProcessFold({ children }: { children: ReactNode[] }) {
  const [isUnfolded, setIsUnfolded] = useState(false)
  const handleChildExpand = useCallback(() => setIsUnfolded(true), [])

  const count = children.length
  if (count === 0) return null

  // 不够阈值，全部展示
  if (count <= FOLD_THRESHOLD || isUnfolded) {
    return <div className="space-y-0.5">{children}</div>
  }

  // head + tail 可见，中间折叠
  const head = children.slice(0, VISIBLE_HEAD)
  const tail = children.slice(-VISIBLE_TAIL)
  const foldedCount = count - VISIBLE_HEAD - VISIBLE_TAIL

  return (
    <div className="space-y-0.5">
      {head}
      <button
        type="button"
        onClick={() => setIsUnfolded(true)}
        className="group/fold flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-black/[0.02] cursor-pointer"
      >
        <span className="w-1.5 h-1.5 shrink-0" />
        <MoreHorizontal size={14} className="text-[var(--ink-soft)] shrink-0" />
        <span className="text-[var(--ink-soft)] group-hover/fold:text-[var(--ink)] transition-colors">
          展开全部
        </span>
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-sky-500/15 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-sky-600">
          +{foldedCount}
        </span>
      </button>
      {tail}
    </div>
  )
}
