import { memo, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { api } from '../api'

export const ResultView = memo(function ResultView({ content }: { content: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // 流式输出时自动滚动到底部
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [content, autoScroll])

  // 用户手动滚动时停止自动跟随
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 60)
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
        className="md-content px-5 py-4 max-h-[60vh] overflow-y-auto"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noreferrer" onClick={(e) => { e.preventDefault(); if (href) api.openExternal(href) }}>
                {children}
              </a>
            ),
            pre: ({ children }) => <pre className="code-block">{children}</pre>,
            code: ({ className, children, ...props }) => {
              const isInline = !className
              if (isInline) return <code className="inline-code" {...props}>{children}</code>
              return <code className={className} {...props}>{children}</code>
            },
            table: ({ children }) => (
              <div className="table-wrapper"><table>{children}</table></div>
            ),
            blockquote: ({ children }) => (
              <blockquote className="blockquote">{children}</blockquote>
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
})
