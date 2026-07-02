// KaTeX 数学公式渲染
// 处理 $$...$$ 块级公式 和 $...$ 行内公式
// 跳过代码块内的 $ 符号（避免误识别变量）

import katex from 'katex'

// 行内公式：$...$  (不匹配 $$ 和代码块内)
const INLINE_MATH = /\$([^\$\n]{1,}?)\$/g
// 块级公式：$$...$$
const BLOCK_MATH = /\$\$([\s\S]+?)\$\$/g

function tryRenderKatex(tex: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
      errorColor: '#cc0000',
      strict: false,
      trust: true,
      macros: {
        '\\R': '\\mathbb{R}',
        '\\N': '\\mathbb{N}',
        '\\Z': '\\mathbb{Z}',
        '\\Q': '\\mathbb{Q}',
        '\\C': '\\mathbb{C}'
      }
    })
  } catch {
    return null
  }
}

export function renderKatexInElement(el: HTMLElement): void {
  // 只处理文本节点，跳过 pre/code/script/style
  const SKIP_TAGS = new Set(['PRE', 'CODE', 'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'])

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Text): number {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      // 跳过已经处理过的
      if (parent.closest('.katex')) return NodeFilter.FILTER_REJECT
      // 跳过代码块
      let p: Element | null = parent
      while (p && p !== el) {
        if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT
        p = p.parentElement
      }
      // 必须含 $ 符号
      if (!node.nodeValue?.includes('$')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    }
  })

  const targets: Text[] = []
  let current: Node | null
  while ((current = walker.nextNode())) {
    targets.push(current as Text)
  }

  for (const textNode of targets) {
    const text = textNode.nodeValue || ''
    if (!text.includes('$')) continue

    const parent = textNode.parentElement
    if (!parent) continue

    // 先处理块级 $$...$$
    const html = processMath(text)
    if (html === text) continue

    const span = document.createElement('span')
    span.innerHTML = html
    parent.replaceChild(span, textNode)
  }
}

function processMath(text: string): string {
  let result = text

  // 块级公式 $$...$$
  result = result.replace(BLOCK_MATH, (_match, tex: string) => {
    const html = tryRenderKatex(tex, true)
    return html ? `<span class="md-math-block">${html}</span>` : `$$${tex}$$`
  })

  // 行内公式 $...$（不在块级公式结果里重复处理）
  result = result.replace(INLINE_MATH, (match, tex: string) => {
    // 跳过空内容和疑似价格/变量
    if (!tex.trim()) return match
    if (/^\d/.test(tex.trim())) return match // $100 这种价格不处理
    const html = tryRenderKatex(tex, false)
    return html || match
  })

  return result
}
