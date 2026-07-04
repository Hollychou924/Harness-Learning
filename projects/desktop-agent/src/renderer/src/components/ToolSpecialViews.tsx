import { useState } from 'react'
import { ChevronRight, Terminal, FileCode } from 'lucide-react'
import type { ToolCallItem } from '../../../agent/src/items'

// 工具特化视图：来自 lobsterai（Todo/Diff/Media）+ AionUi（diff 预览）
// 不同工具有定制渲染，比通用 JSON 展示更直观

/** write_file 的 diff 预览：展示写入内容的前后对比（来自 AionUi ReplacePreview） */
export function WriteFileDiffView({ item }: { item: ToolCallItem }) {
  const [open, setOpen] = useState(false)
  const filePath = typeof item.args.path === 'string' ? item.args.path : ''
  const content = typeof item.args.content === 'string' ? item.args.content : ''
  const fileName = filePath.split(/[/\\]/).pop() || filePath || '未命名'
  const lines = content === '' ? 0 : content.split('\n').length

  return (
    <div className="rounded-lg overflow-hidden text-sm border border-black/[0.06]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-black/[0.02] transition"
      >
        <FileCode size={14} className="text-sky-600 flex-shrink-0" />
        <span className="text-[var(--ink)] font-mono truncate">{fileName}</span>
        <span className="text-xs text-green-600 flex-shrink-0">+{lines} 行</span>
        <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ml-auto ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && content && (
        <div className="border-t border-black/[0.04]">
          <pre className="px-3 py-2 text-xs text-[var(--ink-soft)] whitespace-pre-wrap break-all font-mono max-h-60 overflow-y-auto bg-green-50/30">
            {content.slice(0, 2000)}
            {content.length > 2000 && <span className="text-[var(--ink-soft)]"> …（共 {content.length} 字）</span>}
          </pre>
        </div>
      )}
    </div>
  )
}

/** shell 的终端输出展示（来自 opencowork LocalTerminal 理念，简化版） */
export function ShellOutputView({ item }: { item: ToolCallItem }) {
  const [open, setOpen] = useState(item.status === 'running')
  const command = typeof item.args.command === 'string' ? item.args.command : ''
  const result = item.result || ''
  const hasError = item.status === 'failed'
  const lines = result ? result.split('\n').length : 0

  return (
    <div className="rounded-lg overflow-hidden text-sm border border-black/[0.06]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-black/[0.02] transition"
      >
        <Terminal size={14} className="text-[var(--ink-soft)] flex-shrink-0" />
        <span className="text-[var(--ink)] font-mono truncate flex-1 text-left">$ {command}</span>
        {result && <span className="text-xs text-[var(--ink-soft)] flex-shrink-0">{lines} 行输出</span>}
        {hasError && <span className="text-xs text-red-500 flex-shrink-0">exit ≠ 0</span>}
        <ChevronRight size={14} className={`text-[var(--ink-soft)] transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && result && (
        <div className="border-t border-black/[0.04] bg-black/[0.03]">
          <pre className={`px-3 py-2 text-xs whitespace-pre-wrap break-all font-mono max-h-60 overflow-y-auto ${
            hasError ? 'text-red-600/80' : 'text-[var(--ink-soft)]'
          }`}>
            {result.slice(0, 4000)}
            {result.length > 4000 && <span className="text-[var(--ink-soft)]"> …（共 {result.length} 字，仅显示前 4000 字）</span>}
          </pre>
        </div>
      )}
    </div>
  )
}

/** 根据工具类型选择特化视图，无匹配返回 null（走通用渲染） */
export function trySpecialView(item: ToolCallItem): React.ReactNode | null {
  if (item.kind === 'write_file' && typeof item.args.path === 'string') {
    return <WriteFileDiffView item={item} />
  }
  if (item.kind === 'shell') {
    return <ShellOutputView item={item} />
  }
  return null
}
