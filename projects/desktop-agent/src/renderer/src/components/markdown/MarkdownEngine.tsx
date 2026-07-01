import { memo, useEffect, useRef } from 'react'
import { marked } from 'marked'
import { splitBlocks, type Block } from './blockSplitter'
import { getOrRender, fnv1a, type CacheEntry } from './blockCache'
import { createIncrementalDom, type RenderedBlock } from './incrementalDom'
import { decorate } from './decorate'

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
})

interface Props {
  content: string
  streaming?: boolean
  cacheKey?: string
}

function parseMarkdown(src: string): string {
  return marked.parse(src, { async: false }) as string
}

function blocksToRendered(blocks: Block[], cacheKey: string | undefined): RenderedBlock[] {
  const base = cacheKey || 'md'
  return blocks.map((block, index) => {
    const key = `${base}:${index}:${block.mode}`
    const entry: CacheEntry = getOrRender(key, block.raw, block.src, parseMarkdown)
    return { key, hash: entry.hash, html: entry.html }
  })
}

export const MarkdownEngine = memo(function MarkdownEngine({ content, streaming = false, cacheKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const incrementalRef = useRef(createIncrementalDom(decorate))

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (!content) {
      container.innerHTML = ''
      incrementalRef.current.reset()
      return
    }

    const blocks = splitBlocks(content, streaming)
    const rendered = blocksToRendered(blocks, cacheKey)

    // 尝试增量更新
    const success = streaming
      ? incrementalRef.current.render(true, container, rendered)
      : false

    if (!success) {
      // 非流式或增量失败：fast-path 直接 innerHTML
      incrementalRef.current.reset()
      const html = rendered.map((b) => b.html).join('\n')
      container.innerHTML = html
      decorate(container)
    }
  }, [content, streaming, cacheKey])

  return <div ref={containerRef} className="md-engine" />
})
