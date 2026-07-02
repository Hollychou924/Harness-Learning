import { memo, useEffect, useRef, useState } from 'react'
import { MarkdownEngine } from './markdown/MarkdownEngine'
import './markdown/markdown.css'

// 最终回复展示：扁平占满宽度，不带卡片外壳(复刻 Codex 的"文档流"风格，而非聊天气泡)
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
      <div className="text-sm text-[var(--ink-soft)] px-1 py-1">
        正在生成回复…
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="w-full px-1 py-1 max-h-[70vh] overflow-y-auto"
    >
      <MarkdownEngine content={content} streaming={true} />
    </div>
  )
})
