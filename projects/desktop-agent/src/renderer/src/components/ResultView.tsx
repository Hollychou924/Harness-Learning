import { memo, useEffect, useRef, useState } from 'react'
import { MarkdownEngine } from './markdown/MarkdownEngine'
import './markdown/markdown.css'

export const ResultView = memo(function ResultView({ content }: { content: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [content, autoScroll])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 80)
  }

  if (!content) {
    return (
      <div className="glass rounded-2xl p-4 text-sm text-[var(--ink-soft)]">
        正在生成回复…
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-black/[0.05]">
        <span className="text-xs font-medium text-[var(--ink-soft)] flex items-center gap-1.5">
          <span>💬</span> 回复
        </span>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="px-5 py-4 max-h-[60vh] overflow-y-auto"
      >
        <MarkdownEngine content={content} streaming={true} />
      </div>
    </div>
  )
})
