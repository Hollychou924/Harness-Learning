import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FolderOpen, FolderPlus } from 'lucide-react'
import { api } from '../api'

/* ---- 通用命名弹窗：整窗居中 ---- */
export function NameDialog({ title, initial, placeholder, confirmLabel, onCancel, onConfirm }: {
  title: string; initial: string; placeholder: string; confirmLabel: string
  onCancel: () => void; onConfirm: (name: string) => void
}) {
  const [val, setVal] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center floating-screen" onClick={onCancel}>
      <div className="w-72 floating-surface rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">{title}</h3>
        <input ref={ref} value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter' && val.trim()) onConfirm(val); if (e.key === 'Escape') onCancel() }}
          className="w-full h-9 px-3 text-sm rounded-lg bg-white border border-black/10 outline-none focus:border-blue-400" />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition">取消</button>
          <button onClick={() => val.trim() && onConfirm(val)} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--ink)] text-white hover:opacity-90 transition">{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ---- 新建项目弹窗：整窗居中，双入口（导入文件夹 / 从零新建） ---- */
export function NewProjectDialog({ onCancel, onCreateNew, onLoadFolder }: {
  onCancel: () => void
  onCreateNew: (name: string) => void
  onLoadFolder: (name: string, folderPath: string) => void
}) {
  const [mode, setMode] = useState<'choose' | 'new'>('choose')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { if (mode === 'new') { ref.current?.focus() } }, [mode])


  const content = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center floating-screen" onClick={onCancel}>
      <div className="w-[420px] floating-surface rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-base font-semibold text-[var(--ink)]">新建项目</h3>
        <p className="mb-4 text-xs text-[var(--ink-soft)]">选择已有项目文件夹加载，或从零新建一个项目</p>

        {mode === 'choose' && (
          <div className="space-y-2.5">
            <button onClick={async () => {
              setBusy(true); setErr('')
              try {
                const path = await api.pickFolder()
                if (path) {
                  const base = path.split('/').filter(Boolean).pop() || '项目'
                  onLoadFolder(base, path)
                }
              } catch { setErr('选择文件夹失败') }
              setBusy(false)
            }} disabled={busy}
              className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-black/10 hover:border-blue-400 hover:bg-blue-50/40 transition text-left disabled:opacity-50">
              <FolderOpen size={20} className="text-[var(--ink-soft)] mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-[var(--ink)]">选择已有文件夹</div>
                <div className="text-xs text-[var(--ink-soft)] mt-0.5">加载本机已有的成熟项目文件夹</div>
              </div>
            </button>
            <button onClick={() => setMode('new')}
              className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-black/10 hover:border-blue-400 hover:bg-blue-50/40 transition text-left">
              <FolderPlus size={20} className="text-[var(--ink-soft)] mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-[var(--ink)]">新建项目</div>
                <div className="text-xs text-[var(--ink-soft)] mt-0.5">从零创建一个新项目目录</div>
              </div>
            </button>
            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
        )}

        {mode === 'new' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[var(--ink-soft)] mb-1.5">项目名称</label>
              <input ref={ref} value={name} onChange={(e) => setName(e.target.value)} placeholder="项目名称"
                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onCreateNew(name.trim()); if (e.key === 'Escape') onCancel() }}
                className="w-full h-9 px-3 text-sm rounded-lg bg-white border border-black/10 outline-none focus:border-blue-400" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onCancel} className="px-3 py-1.5 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition">取消</button>
              <button disabled={!name.trim()}
                onClick={() => onCreateNew(name.trim())}
                className="px-4 py-1.5 text-xs rounded-lg bg-[var(--ink)] text-white hover:opacity-90 disabled:opacity-40 transition">
                创建
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
  return createPortal(content, document.body)
}
