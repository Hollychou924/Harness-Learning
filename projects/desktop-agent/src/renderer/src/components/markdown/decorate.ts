import { highlightCode, updatePreElement } from './codeHighlight'

// 装饰器：对渲染后的 DOM 做后处理
// 代码块：语言标签 + 复制按钮 + 折叠 + Shiki 高亮
// 参考 AionUi CodeBlock + goose MarkdownContent + opencode decorate

const COLLAPSE_THRESHOLD = 15
const PREVIEW_LINES = 6
const CODE_LINE_HEIGHT = 20

const shellLanguages = new Set(['bash', 'sh', 'shell', 'zsh', 'fish', 'console', 'terminal'])

function createCopyButton(): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.className = 'md-copy-btn'
  btn.title = '复制代码'
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
  return btn
}

function createLangLabel(lang: string): HTMLSpanElement {
  const label = document.createElement('span')
  label.className = 'md-lang-label'
  label.textContent = lang
  return label
}

function createExpandButton(): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.className = 'md-expand-btn'
  btn.textContent = '展开'
  return btn
}

function setupCopy(wrapper: HTMLElement, codeText: string): void {
  const btn = wrapper.querySelector('.md-copy-btn') as HTMLButtonElement | null
  if (!btn) return
  btn.onclick = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(codeText)
      btn.classList.add('md-copied')
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`
      setTimeout(() => {
        btn.classList.remove('md-copied')
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
      }, 2000)
    } catch {
      /* ignore */
    }
  }
}

function setupCollapse(wrapper: HTMLElement, pre: HTMLPreElement, totalLines: number): void {
  if (totalLines <= COLLAPSE_THRESHOLD) return
  const code = pre.querySelector('code')
  if (!code) return

  let collapsed = true
  const collapseHeight = PREVIEW_LINES * CODE_LINE_HEIGHT + 24

  const applyCollapse = () => {
    if (collapsed) {
      pre.style.maxHeight = collapseHeight + 'px'
      pre.style.overflow = 'hidden'
    } else {
      pre.style.maxHeight = ''
      pre.style.overflow = ''
    }
  }

  const expandBtn = createExpandButton()
  expandBtn.textContent = `展开（共 ${totalLines} 行）`
  expandBtn.onclick = (e) => {
    e.stopPropagation()
    collapsed = !collapsed
    applyCollapse()
    expandBtn.textContent = collapsed ? `展开（共 ${totalLines} 行）` : '收起'
  }
  wrapper.appendChild(expandBtn)
  applyCollapse()
}

async function highlightCodeBlock(pre: HTMLPreElement, lang: string, codeText: string): Promise<void> {
  const html = await highlightCode(codeText, lang)
  if (html && pre.isConnected) {
    updatePreElement(pre, html)
  }
}

export function decorate(root: HTMLDivElement): void {
  const preBlocks = Array.from(root.querySelectorAll('pre'))

  for (const pre of preBlocks) {
    // 避免重复装饰
    if (pre.parentElement?.getAttribute('data-md-code')) continue

    const code = pre.querySelector('code')
    if (!code) continue

    const className = code.className || ''
    const match = /(?:^|\s)language-([^\s]+)/.exec(className)
    const lang = match?.[1] || 'text'
    const codeText = code.textContent || ''
    const totalLines = codeText.split('\n').length

    // 创建 wrapper
    const parent = pre.parentElement
    if (!parent) continue
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-md-code', 'true')
    wrapper.className = 'md-code-wrapper'
    if (shellLanguages.has(lang)) wrapper.setAttribute('data-code-kind', 'shell')
    if (lang !== 'text') wrapper.setAttribute('data-language', lang)

    parent.replaceChild(wrapper, pre)
    wrapper.appendChild(pre)

    // 语言标签
    if (lang !== 'text') {
      wrapper.appendChild(createLangLabel(lang))
    }

    // 复制按钮
    const copyBtn = createCopyButton()
    wrapper.appendChild(copyBtn)
    setupCopy(wrapper, codeText)

    // 折叠
    setupCollapse(wrapper, pre, totalLines)

    // 异步 Shiki 高亮
    void highlightCodeBlock(pre, lang, codeText)
  }
}
