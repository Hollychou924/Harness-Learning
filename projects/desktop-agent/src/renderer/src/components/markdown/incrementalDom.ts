// 增量 DOM 更新：用 Comment 边界标记每个 block，只更新变化的 block
// 参考 kilocode markdown-incremental-dom.ts

export interface RenderedBlock {
  key: string
  hash: string
  html: string
}

interface Record {
  key: string
  hash: string
  start: Comment
  end: Comment
}

type Decorate = (root: HTMLDivElement) => void

export function createIncrementalDom(decorate: Decorate) {
  let records: Record[] = []

  function reset(): void {
    records = []
  }

  function parse(html: string): DocumentFragment {
    const root = document.createElement('div')
    root.innerHTML = html
    decorate(root)
    const fragment = document.createDocumentFragment()
    while (root.firstChild) fragment.appendChild(root.firstChild)
    return fragment
  }

  function removeRecord(record: Record): boolean {
    const parent = record.start.parentNode
    if (!parent || record.end.parentNode !== parent) return false

    const nodes: ChildNode[] = []
    let node: ChildNode | null = record.start
    while (node && node.parentNode === parent) {
      nodes.push(node)
      if (node === record.end) {
        for (const item of nodes) parent.removeChild(item)
        return true
      }
      node = node.nextSibling
    }
    return false
  }

  function replaceRecord(record: Record, block: RenderedBlock): void {
    let node = record.start.nextSibling
    while (node && node !== record.end) {
      const next: ChildNode | null = node.nextSibling
      node.parentNode?.removeChild(node)
      node = next
    }
    record.end.parentNode?.insertBefore(parse(block.html), record.end)
    record.hash = block.hash
  }

  function appendBlock(container: HTMLDivElement, block: RenderedBlock): void {
    const start = document.createComment(`md:${block.key}:start`)
    const end = document.createComment(`md:${block.key}:end`)
    container.appendChild(start)
    container.appendChild(parse(block.html))
    container.appendChild(end)
    records.push({ key: block.key, hash: block.hash, start, end })
  }

  function update(container: HTMLDivElement, blocks: RenderedBlock[]): boolean {
    if (blocks.length < 1) return false

    // 检查记录是否仍然连接到 DOM
    if (records.length > 0 && records.some((r) => !r.start.isConnected || !r.end.isConnected)) {
      reset()
    }

    // 检查 key 是否匹配（不匹配说明内容完全变了，重置）
    const shared = Math.min(records.length, blocks.length)
    for (let i = 0; i < shared; i++) {
      if (records[i].key !== blocks[i].key) {
        reset()
        break
      }
    }

    if (records.length === 0) container.replaceChildren()

    // 移除多余的尾部 block
    while (records.length > blocks.length) {
      const record = records.at(-1)
      if (!record || !removeRecord(record)) {
        reset()
        return false
      }
      records.pop()
    }

    // 更新/追加 block
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      const record = records[i]
      if (!record) {
        appendBlock(container, block)
        continue
      }
      if (record.hash === block.hash) continue
      replaceRecord(record, block)
    }

    return true
  }

  function render(
    streaming: boolean,
    container: HTMLDivElement,
    blocks: RenderedBlock[]
  ): boolean {
    if (!streaming) return false
    return update(container, blocks)
  }

  return { reset, render, update }
}
