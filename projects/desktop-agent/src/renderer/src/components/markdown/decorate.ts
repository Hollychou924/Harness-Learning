import { highlightCode, updatePreElement } from './codeHighlight'
import { renderMermaidBlocks } from './renderMermaid'
import { renderKatexInElement } from './renderKatex'

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

    // Mermaid 流程图：跳过普通代码处理，交给 mermaid 渲染器
    if (lang === 'mermaid') {
      const wrapper = document.createElement('div')
      wrapper.className = 'md-mermaid-wrapper'
      pre.replaceWith(wrapper)
      wrapper.appendChild(pre)
      continue
    }

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

  // KaTeX 数学公式渲染（同步，对文本节点处理）
  renderKatexInElement(root)

  // 来源引用卡片化
  enhanceSourceLinks(root)

  // 表格交互增强
  enhanceTables(root)

  // 图片 Lightbox 点击放大
  setupImageLightbox(root)

  // Mermaid 流程图渲染（异步）
  void renderMermaidBlocks(root)
}


// ============ 表格交互增强 ============
const TABLE_COLLAPSE_THRESHOLD = 12
const TABLE_COLLAPSE_ROWS = 6
const tableProcessed = new WeakSet<HTMLTableElement>()

export function enhanceTables(root: HTMLElement): void {
  const tables = Array.from(root.querySelectorAll('table'))
  for (const table of tables) {
    if (tableProcessed.has(table)) continue
    tableProcessed.add(table)

    // 用 table-wrapper 包裹（横向滚动）
    const wrapper = document.createElement('div')
    wrapper.className = 'table-wrapper'
    table.replaceWith(wrapper)
    wrapper.appendChild(table)

    const rows = table.querySelectorAll('tbody tr')
    const totalRows = rows.length

    // 行计数标签
    if (totalRows > 3) {
      const countLabel = document.createElement('div')
      countLabel.className = 'md-table-count'
      countLabel.textContent = `${totalRows} 行`
      countLabel.style.cssText = 'font-size:11px;color:var(--ink-soft);margin-bottom:4px;'
      wrapper.insertBefore(countLabel, table)
    }

    // 大表格折叠
    if (totalRows > TABLE_COLLAPSE_THRESHOLD) {
      let collapsed = true
      const applyCollapse = () => {
        rows.forEach((row, i) => {
          if (i >= TABLE_COLLAPSE_ROWS) {
            (row as HTMLElement).style.display = collapsed ? 'none' : ''
          }
        })
      }

      const expandBtn = document.createElement('button')
      expandBtn.className = 'md-table-expand-btn'
      expandBtn.style.cssText = 'font-size:11px;color:#0071e3;background:none;border:none;cursor:pointer;padding:4px 0;margin-top:4px;'
      expandBtn.textContent = `展开全部（共 ${totalRows} 行）`
      expandBtn.onclick = (e) => {
        e.stopPropagation()
        collapsed = !collapsed
        applyCollapse()
        expandBtn.textContent = collapsed ? `展开全部（共 ${totalRows} 行）` : '收起'
      }
      wrapper.appendChild(expandBtn)
      applyCollapse()
    }
  }
}


// ============ 来源引用卡片化 ============
const sourceListProcessed = new WeakSet<HTMLElement>()

export function enhanceSourceLinks(root: HTMLElement): void {
  // 检测末尾的来源链接列表：以"来源"或"Sources"开头的列表块
  const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'))
  for (const heading of headings) {
    const text = heading.textContent?.trim().toLowerCase() || ''
    if (!text.includes('来源') && !text.includes('source') && !text.includes('引用')) continue

    // 找到 heading 后面紧跟的列表
    let next = heading.nextElementSibling
    if (!next || next.tagName !== 'UL' && next.tagName !== 'OL') continue
    if (sourceListProcessed.has(next as HTMLElement)) continue
    sourceListProcessed.add(next as HTMLElement)

    const list = next as HTMLElement
    const items = Array.from(list.querySelectorAll('li'))
    const sourceCards: HTMLElement[] = []

    for (const item of items) {
      const link = item.querySelector('a')
      if (!link) continue
      const href = link.getAttribute('href') || ''
      if (!href.startsWith('http')) continue

      let domain = ''
      try { domain = new URL(href).hostname.replace(/^www\./, '') } catch { domain = href }

      const card = document.createElement('div')
      card.className = 'md-source-card'

      // favicon
      const favicon = document.createElement('img')
      favicon.className = 'md-source-favicon'
      favicon.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
      favicon.alt = ''
      favicon.onerror = () => {
        const placeholder = document.createElement('span')
        placeholder.className = 'md-source-favicon-placeholder'
        placeholder.textContent = domain.charAt(0).toUpperCase()
        favicon.replaceWith(placeholder)
      }
      card.appendChild(favicon)

      // 标题链接
      const titleLink = document.createElement('a')
      titleLink.className = 'md-source-title'
      titleLink.href = href
      titleLink.target = '_blank'
      titleLink.rel = 'noopener noreferrer'
      titleLink.textContent = link.textContent || domain
      card.appendChild(titleLink)

      // 域名
      const domainLabel = document.createElement('span')
      domainLabel.className = 'md-source-domain'
      domainLabel.textContent = domain
      card.appendChild(domainLabel)

      sourceCards.push(card)
    }

    if (sourceCards.length > 0) {
      const container = document.createElement('div')
      container.className = 'md-source-list'
      for (const card of sourceCards) container.appendChild(card)
      list.replaceWith(container)
    }
  }
}

// ============ 图片 Lightbox ============
const lightboxImages = new WeakSet<HTMLImageElement>()

export function setupImageLightbox(root: HTMLElement): void {
  const images = Array.from(root.querySelectorAll('img'))
  for (const img of images) {
    if (lightboxImages.has(img)) continue
    lightboxImages.add(img)
    img.addEventListener('click', () => {
      const src = img.src
      if (!src) return
      const overlay = document.createElement('div')
      overlay.className = 'md-img-lightbox'

      const lightImg = document.createElement('img')
      lightImg.src = src
      overlay.appendChild(lightImg)

      // 缩放支持
      let scale = 1
      overlay.addEventListener('wheel', (e) => {
        e.preventDefault()
        scale = Math.min(3, Math.max(0.3, scale + (e.deltaY > 0 ? -0.1 : 0.1)))
        lightImg.style.transform = `scale(${scale})`
      }, { passive: false })

      overlay.addEventListener('click', () => {
        overlay.remove()
      })
      document.body.appendChild(overlay)
    })
  }
}
