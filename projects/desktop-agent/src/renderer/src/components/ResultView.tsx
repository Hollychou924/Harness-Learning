import { memo } from 'react'
import { MarkdownEngine } from './markdown/MarkdownEngine'
import './markdown/markdown.css'

// 最终回复展示：扁平占满宽度，不带卡片外壳(复刻 Codex 的"文档流"风格，而非聊天气泡)
// 去掉自身 max-h + overflow-y-auto：回复自然撑开，滚动交给外层对话区统一管理，避免双滚动条
export const ResultView = memo(function ResultView({ content }: { content: string }) {
  if (!content) {
    return (
      <div className="text-sm text-[var(--ink-soft)] px-1 py-1">
        正在生成回复…
      </div>
    )
  }

  return (
    <div className="w-full px-1 py-1">
      <MarkdownEngine content={content} streaming={true} />
    </div>
  )
})
