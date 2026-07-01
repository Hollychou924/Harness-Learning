// 代码高亮：Shiki 主线程异步高亮
// 参考 kilocode markdown-stream-highlight.ts

import { createHighlighter, type Highlighter, bundledLanguages } from 'shiki'

let highlighter: Highlighter | null = null
const loadedLanguages = new Set<string>()

const COMMON_LANGS = [
  'javascript', 'typescript', 'bash', 'json', 'markdown',
  'python', 'go', 'rust', 'java', 'sql', 'html', 'css',
  'yaml', 'xml', 'tsx', 'jsx'
]

async function ensureHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter
  highlighter = await createHighlighter({
    themes: ['catppuccin-mocha'],
    langs: COMMON_LANGS
  })
  COMMON_LANGS.forEach((l) => loadedLanguages.add(l))
  return highlighter
}

async function loadLanguage(lang: string): Promise<boolean> {
  if (loadedLanguages.has(lang)) return true
  const h = await ensureHighlighter()
  try {
    if (lang in bundledLanguages) {
      await h.loadLanguage(lang as never)
      loadedLanguages.add(lang)
      return true
    }
  } catch {
    // 语言不支持
  }
  return false
}

export async function highlightCode(code: string, lang: string): Promise<string | null> {
  try {
    const h = await ensureHighlighter()
    let language = lang || 'text'
    if (language !== 'text' && !loadedLanguages.has(language)) {
      const ok = await loadLanguage(language)
      if (!ok) language = 'text'
    }
    return h.codeToHtml(code, {
      lang: language,
      theme: 'catppuccin-mocha',
      tabindex: false
    })
  } catch {
    return null
  }
}

// 检查新代码是否是旧代码的延续（流式增量）
export function continues(before: string, after: string): boolean {
  const base = before.endsWith('\n') ? before.slice(0, -1) : before
  return !!base && after.startsWith(base)
}

// 更新 pre 元素的高亮 HTML
export function updatePreElement(pre: HTMLPreElement, html: string): void {
  if (!pre.isConnected) return
  const temp = document.createElement('div')
  temp.innerHTML = html
  const next = temp.firstElementChild
  if (!(next instanceof HTMLPreElement)) return
  const scrollLeft = pre.scrollLeft
  for (const name of pre.getAttributeNames()) {
    pre.removeAttribute(name)
  }
  for (const attr of next.attributes) {
    pre.setAttribute(attr.name, attr.value)
  }
  pre.replaceChildren(...Array.from(next.childNodes))
  pre.scrollLeft = scrollLeft
}
