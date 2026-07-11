import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, FileCode2, GitCommitHorizontal, Merge, RefreshCw, X } from 'lucide-react'
import { api, type CommitDetailResult, type CommitDiffResult, type CommitFileChange, type CommitHistoryItem } from '../api'

const PAGE_SIZE = 100

type HistoryFilter = 'all' | 'current'

type Props = {
  workspaceDir: string
  projectName: string
  onClose: () => void
}

export function CommitHistoryDialog({ workspaceDir, projectName, onClose }: Props) {
  const [commits, setCommits] = useState<CommitHistoryItem[]>([])
  const [currentHash, setCurrentHash] = useState('')
  const [currentBranch, setCurrentBranch] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [selectedHash, setSelectedHash] = useState('')
  const [detail, setDetail] = useState<CommitDetailResult | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [comparison, setComparison] = useState<CommitDiffResult | null>(null)
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState('')
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)

  const load = async (append = false) => {
    append ? setLoadingMore(true) : setLoading(true)
    setError('')
    try {
      const result = await api.getCommitHistory(workspaceDir, append ? commits.length : 0, PAGE_SIZE)
      if (!result.success) {
        setError(result.error || '无法读取提交历史')
        return
      }
      const next = result.commits || []
      setCommits((previous) => append ? [...previous, ...next] : next)
      setCurrentHash(result.currentHash || '')
      setCurrentBranch(result.currentBranch || '')
      setHasMore(Boolean(result.hasMore))
      if (!append) setSelectedHash((previous) => previous && next.some((commit) => commit.hash === previous) ? previous : result.currentHash || next[0]?.hash || '')
    } catch {
      setError('客户端已更新，请重启小蓝鲸后再试')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => { void load() }, [workspaceDir])

  useEffect(() => {
    if (!selectedHash) return
    setDetailLoading(true)
    setDetail(null)
    setComparison(null)
    setSelectedFile('')
    void api.getCommitDetail(workspaceDir, selectedHash)
      .then(setDetail)
      .catch(() => setDetail({ success: false, error: '客户端已更新，请重启小蓝鲸后再试' }))
      .finally(() => setDetailLoading(false))
  }, [selectedHash, workspaceDir])

  const compareWithCurrent = async (filePath?: string) => {
    if (!selectedHash) return
    setComparisonLoading(true)
    setSelectedFile(filePath || '')
    try {
      setComparison(await api.getCommitDiff(workspaceDir, selectedHash, 'HEAD', filePath))
    } catch {
      setComparison({ success: false, error: '客户端已更新，请重启小蓝鲸后再试' })
    } finally {
      setComparisonLoading(false)
    }
  }

  const visible = useMemo(() => filter === 'current' ? commits.filter((commit) => commit.onCurrentBranch) : commits, [commits, filter])

  return createPortal(
    <div className="fixed inset-0 z-[230] flex items-center justify-center px-5 pb-5 pt-16 floating-screen" onClick={onClose}>
      <div className="flex h-[min(680px,calc(100vh-84px))] w-[min(1060px,calc(100vw-40px))] min-w-0 flex-col overflow-hidden rounded-[24px] floating-surface" onClick={(event) => event.stopPropagation()}>
        <header className="flex min-h-16 flex-shrink-0 items-center gap-3 border-b border-black/[0.08] px-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--ink)]">项目提交历史</h2>
            <p className="truncate text-xs text-[var(--ink-soft)]">{projectName}{currentBranch ? ` · ${currentBranch}` : ''}</p>
          </div>
          <div className="ml-4 flex rounded-xl bg-black/[0.045] p-1">
            <FilterTab active={filter === 'all'} label="全部" onClick={() => setFilter('all')} />
            <FilterTab active={filter === 'current'} label="当前分支" onClick={() => setFilter('current')} />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button title="刷新" onClick={() => void load()} disabled={loading} className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--ink-soft)] hover:bg-black/[0.05] disabled:opacity-40"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
            <button title="关闭" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--ink-soft)] hover:bg-black/[0.05]"><X size={18} /></button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className={`${mobileDetailOpen ? 'hidden min-[700px]:flex' : 'flex'} min-w-0 flex-1 flex-col border-r border-black/[0.08]`}>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading && <Centered text="正在读取提交历史…" />}
              {!loading && error && <Centered text={error} error onRetry={() => void load()} />}
              {!loading && !error && commits.length === 0 && <Centered text="这个项目还没有提交记录" />}
              {!loading && !error && commits.length > 0 && visible.length === 0 && <Centered text="当前分支还没有提交记录" />}
              {!loading && !error && visible.map((commit) => (
                <CommitRow key={commit.hash} commit={commit} currentHash={currentHash} selected={commit.hash === selectedHash} onSelect={() => { setSelectedHash(commit.hash); setMobileDetailOpen(true) }} />
              ))}
              {!loading && !error && hasMore && filter === 'all' && <div className="flex justify-center py-4"><button onClick={() => void load(true)} disabled={loadingMore} className="rounded-xl bg-black/[0.05] px-4 py-2 text-xs text-[var(--ink)] hover:bg-black/[0.08] disabled:opacity-50">{loadingMore ? '正在加载…' : '查看更早记录'}</button></div>}
            </div>
          </main>

          <aside className={`${mobileDetailOpen ? 'block' : 'hidden min-[700px]:block'} w-full flex-shrink-0 overflow-y-auto p-4 min-[700px]:w-[360px]`}>
            <button onClick={() => setMobileDetailOpen(false)} className="mb-3 flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-[var(--ink-soft)] hover:bg-black/[0.04] min-[700px]:hidden"><ChevronRight size={14} className="rotate-180" />返回历史记录</button>
            {detailLoading && <Centered text="正在读取这次变化…" />}
            {!detailLoading && (!detail || !detail.success) && <Centered text={detail?.error || '请选择一条记录'} error={Boolean(detail?.error)} />}
            {!detailLoading && detail?.success && detail.commit && <CommitDetail detail={detail} currentHash={currentHash} comparison={comparison} comparisonLoading={comparisonLoading} selectedFile={selectedFile} onCompare={() => void compareWithCurrent()} onCompareFile={(path) => void compareWithCurrent(path)} />}
          </aside>
        </div>
      </div>
    </div>,
    document.body
  )
}

function FilterTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button onClick={onClick} className={`h-8 rounded-lg px-3 text-xs transition ${active ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}>{label}</button>
}

function CommitRow({ commit, currentHash, selected, onSelect }: { commit: CommitHistoryItem; currentHash: string; selected: boolean; onSelect: () => void }) {
  const isCurrent = commit.hash === currentHash
  return (
    <button onClick={onSelect} className={`flex min-h-[76px] w-full items-center gap-3 border-b border-black/[0.055] px-5 py-3 text-left transition ${selected ? 'bg-black/[0.05]' : 'hover:bg-black/[0.025]'}`}>
      <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${isCurrent ? 'bg-orange-500 ring-4 ring-orange-500/10' : 'bg-black/15'}`} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {isCurrent && <span className="flex-shrink-0 whitespace-nowrap rounded-md bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600">当前版本</span>}
          {commit.parents.length > 1 && <span className="flex flex-shrink-0 items-center gap-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-600"><Merge size={11} />合并</span>}
          <span className="min-w-0 truncate text-sm font-medium text-[var(--ink)]" title={commit.subject}>{commit.subject || '无标题记录'}</span>
        </div>
        <p className="mt-1 truncate text-xs text-[var(--ink-soft)]">{commit.author} · {formatDate(commit.timestamp)}</p>
      </div>
      <ChevronRight size={15} className="flex-shrink-0 text-[var(--ink-soft)]" />
    </button>
  )
}

function CommitDetail({ detail, currentHash, comparison, comparisonLoading, selectedFile, onCompare, onCompareFile }: { detail: CommitDetailResult; currentHash: string; comparison: CommitDiffResult | null; comparisonLoading: boolean; selectedFile: string; onCompare: () => void; onCompareFile: (path: string) => void }) {
  const commit = detail.commit!
  const isCurrent = commit.hash === currentHash
  const files = comparison?.success && !selectedFile ? comparison.files || [] : detail.files || []
  const showingLaterChanges = Boolean(comparison?.success && !selectedFile)
  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500"><GitCommitHorizontal size={18} /></div>
          <div className="min-w-0"><h3 className="text-sm font-semibold leading-relaxed text-[var(--ink)]">{commit.subject || '无标题记录'}</h3><p className="mt-1 text-xs text-[var(--ink-soft)]">{commit.author} · {formatFullDate(commit.timestamp)}</p></div>
        </div>
        {commit.body && <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-[var(--ink-soft)]">{commit.body}</p>}
        <div className="mt-4 flex gap-2 text-center text-xs"><Stat label="修改文件" value={commit.filesChanged} /><Stat label="新增内容" value={commit.additions} /><Stat label="删除内容" value={commit.deletions} /></div>
        {!isCurrent && <button onClick={onCompare} disabled={comparisonLoading} className="mt-4 h-9 w-full rounded-xl bg-[var(--ink)] text-xs text-white disabled:opacity-50">{comparisonLoading && !selectedFile ? '正在整理后来变化…' : '看看后来又改了什么'}</button>}
        {isCurrent && <div className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-600">这是当前版本</div>}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between"><h4 className="text-xs font-semibold text-[var(--ink)]">{showingLaterChanges ? '后来发生的变化' : '这次改了什么'}</h4><span className="text-xs text-[var(--ink-soft)]">{files.length} 个文件</span></div>
        {showingLaterChanges && <p className="mb-3 text-xs leading-relaxed text-[var(--ink-soft)]">从这条记录到现在，以下文件又发生了变化。点击文件可查看具体内容。</p>}
        <div className="space-y-1">{files.map((file) => <FileChangeRow key={`${file.previousPath || ''}:${file.path}`} file={file} busy={comparisonLoading && selectedFile === file.path} onClick={() => onCompareFile(file.path)} />)}{files.length === 0 && <div className="py-6 text-center text-xs text-[var(--ink-soft)]">没有文件变化</div>}</div>
      </section>

      {comparison && selectedFile && <FileChangeDetail comparison={comparison} selectedFile={selectedFile} />}
    </div>
  )
}

function FileChangeRow({ file, busy, onClick }: { file: CommitFileChange; busy: boolean; onClick: () => void }) {
  const status = statusLabel(file.status)
  return <button onClick={onClick} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left hover:bg-black/[0.04]"><span className={`flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded px-1 text-[10px] font-bold ${status.className}`}>{status.short}</span><span className="min-w-0 flex-1 truncate text-xs text-[var(--ink)]" title={file.path}>{friendlyFileName(file.path)}</span>{file.binary ? <span className="text-[10px] text-[var(--ink-soft)]">非文字文件</span> : <span className="text-[10px] text-[var(--ink-soft)]">{file.additions + file.deletions} 处变化</span>}<ChevronRight size={13} className={`text-[var(--ink-soft)] ${busy ? 'animate-pulse' : ''}`} /></button>
}

function FileChangeDetail({ comparison, selectedFile }: { comparison: CommitDiffResult; selectedFile: string }) {
  if (!comparison.success) return <section className="rounded-2xl bg-red-500/10 p-4 text-xs text-red-500">{comparison.error || '无法读取具体变化'}</section>
  if (!comparison.patch) return <section className="rounded-2xl bg-black/[0.03] p-4 text-xs text-[var(--ink-soft)]">这个文件没有可展示的文字变化，可能是图片或其他非文字文件。</section>
  return <section className="rounded-2xl bg-black/[0.03] p-3"><div className="mb-2 flex items-center gap-2"><FileCode2 size={14} className="text-[var(--ink-soft)]" /><h4 className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--ink)]">{friendlyFileName(selectedFile)} 的具体变化</h4>{comparison.truncated && <span className="text-[10px] text-orange-500">仅显示部分</span>}</div><p className="mb-2 text-[11px] leading-relaxed text-[var(--ink-soft)]">绿色加号表示后来新增，红色减号表示后来删除。</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#15181d] p-3 text-[11px] leading-relaxed text-[#d8dee9]">{comparison.patch}</pre></section>
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="flex-1 rounded-xl bg-black/[0.035] px-2 py-2"><div className="font-semibold text-[var(--ink)]">{value}</div><div className="mt-0.5 text-[10px] text-[var(--ink-soft)]">{label}</div></div>
}

function statusLabel(status: CommitFileChange['status']): { short: string; className: string } {
  if (status === 'added') return { short: '新增', className: 'bg-emerald-500/10 text-emerald-600' }
  if (status === 'deleted') return { short: '删除', className: 'bg-red-500/10 text-red-500' }
  if (status === 'renamed') return { short: '改名', className: 'bg-sky-500/10 text-sky-600' }
  if (status === 'copied') return { short: '复制', className: 'bg-amber-500/10 text-amber-600' }
  return { short: '修改', className: 'bg-black/[0.06] text-[var(--ink-soft)]' }
}

function friendlyFileName(path: string): string {
  const parts = path.split('/')
  return parts.length > 2 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : path
}

function Centered({ text, error = false, onRetry }: { text: string; error?: boolean; onRetry?: () => void }) {
  return <div className={`flex h-full min-h-64 flex-col items-center justify-center gap-3 px-8 text-center text-sm ${error ? 'text-red-500' : 'text-[var(--ink-soft)]'}`}><span>{text}</span>{onRetry && <button onClick={onRetry} className="rounded-lg bg-black/[0.05] px-3 py-1.5 text-xs text-[var(--ink)]">重新读取</button>}</div>
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  return date.toDateString() === today.toDateString() ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

function formatFullDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
