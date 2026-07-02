// Mermaid 流程图渲染
// 检测 ```mermaid 代码块，用 mermaid.render() 替换成 SVG 图形

let mermaidReady: Promise<typeof import('mermaid').default> | null = null
let renderCounter = 0

async function ensureMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((mod) => {
      const m = mod.default
      m.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          fontFamily: '-apple-system, "PingFang SC", "Helvetica Neue", sans-serif',
          fontSize: '14px',
          primaryColor: '#e8f0fe',
          primaryTextColor: '#1a1a2e',
          primaryBorderColor: '#4a90d9',
          lineColor: '#6b7280',
          secondaryColor: '#f0f4f8',
          tertiaryColor: '#ffffff'
        },
        flowchart: { htmlLabels: true, curve: 'basis' },
        sequence: { actorMargin: 50 },
        gantt: { leftPadding: 75 }
      })
      return m
    })
  }
  return mermaidReady
}

export async function renderMermaidBlocks(root: HTMLElement): Promise<void> {
  const blocks = Array.from(root.querySelectorAll('pre > code.language-mermaid'))
  for (const code of blocks) {
    const pre = code.closest('pre')
    if (!pre) continue
    // 已渲染过则跳过
    if (pre.getAttribute('data-mermaid-rendered') === 'true') continue
    const source = code.textContent || ''
    if (!source.trim()) continue

    const id = `mermaid-${++renderCounter}`
    pre.setAttribute('data-mermaid-rendered', 'true')
    pre.classList.add('md-mermaid-loading')

    try {
      const m = await ensureMermaid()
      const { svg } = await m.render(id, source.trim())
      if (!pre.isConnected) continue

      // 创建 mermaid 容器替换 code 内容
      const container = document.createElement('div')
      container.className = 'md-mermaid'
      container.innerHTML = svg
      pre.replaceWith(container)

      // 添加点击放大
      container.style.cursor = 'zoom-in'
      container.addEventListener('click', () => {
        const overlay = document.createElement('div')
        overlay.className = 'md-mermaid-fullscreen'
        overlay.innerHTML = svg
        overlay.onclick = () => overlay.remove()
        document.body.appendChild(overlay)
      })
    } catch (err) {
      // 渲染失败：保留原始代码，加错误标记
      pre.classList.remove('md-mermaid-loading')
      pre.classList.add('md-mermaid-error')
      const errHint = document.createElement('div')
      errHint.className = 'md-mermaid-err-hint'
      errHint.textContent = '流程图渲染失败，以下为源码'
      pre.parentElement?.insertBefore(errHint, pre)
    }
  }
}
