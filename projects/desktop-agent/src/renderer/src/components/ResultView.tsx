import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../api'

export function ResultView({ content }: { content: string }) {
  if (!content) {
    return (
      <div className="glass rounded-2xl p-4 text-sm text-[var(--ink-soft)]">
        正在生成报告…
      </div>
    )
  }
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-xs text-[var(--ink-soft)] mb-2 flex items-center gap-1.5">
        <span>📦 报告</span>
      </div>
      <div className="prose text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" onClick={(e) => { e.preventDefault(); if (href) api.openExternal(href) }}>
              {children}
            </a>
          )
        }}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
