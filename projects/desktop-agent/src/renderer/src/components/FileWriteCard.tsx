import { FilePlus, Check } from 'lucide-react'
import type { ToolLogEntry } from '../store/task'

// 把 write_file 工具调用渲染成一张"文件写入"卡片，
// 像 IDE 那样展示文件名 + 新增行数，便于扫读产物。
export function FileWriteCard({ entry }: { entry: ToolLogEntry }) {
  const path = typeof entry.args.path === 'string' ? entry.args.path : ''
  const content = typeof entry.args.content === 'string' ? entry.args.content : ''
  const name = path.split('/').pop() || path || '未命名'
  const lines = content === '' ? 0 : content.split('\n').length
  const failed = entry.result?.includes('"error"')

  return (
    <div className="glass rounded-xl px-3 py-2 flex items-center gap-2.5 text-sm">
      <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
        {failed ? (
          <span className="text-amber-500 text-xs">⚠</span>
        ) : (
          <FilePlus size={14} className="text-sky-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[var(--ink)] truncate" title={path}>
            {name}
          </span>
          {!failed && (
            <Check size={12} className="text-green-500 flex-shrink-0" />
          )}
        </div>
        {path && (
          <div className="text-[11px] text-[var(--ink-soft)] truncate" title={path}>
            {path}
          </div>
        )}
      </div>
      {!failed && lines > 0 && (
        <span className="text-xs font-mono text-green-600 flex-shrink-0">
          +{lines}
        </span>
      )}
    </div>
  )
}
