import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Target,
  Coins,
  Clock,
  FileCode,
  FileText,
  Eye,
  GitCompare,
  Flag,
  CheckCircle2,
  RotateCcw,
  Wand2
} from 'lucide-react'
import { useTaskStore } from '../store/task'
import { api } from '../api'
import type { ArtifactEntry, SourceEntry } from '../store/task'
import type { ToolCallItem, Turn } from '../../../agent/src/items'

function deriveSourcesFromTurns(turns: Turn[], currentTurn: Turn | null): SourceEntry[] {
  const allTurns = currentTurn ? [...turns, currentTurn] : turns
  const byKey = new Map<string, SourceEntry>()
  for (const turn of allTurns) {
    for (const item of turn.items) {
      if (item.type !== 'toolCall') continue
      const filePath = typeof item.args.path === 'string'
        ? item.args.path
        : item.kind === 'list_files' && typeof item.args.dir === 'string'
          ? item.args.dir
          : undefined
      if ((item.kind === 'read_file' || item.kind === 'list_files') && filePath) {
        const path = filePath
        byKey.set(`file:${path}`, { type: 'file', label: path.split('/').pop() || path, path })
      }
      if (item.kind === 'fetch_page' && typeof item.args.url === 'string') {
        const url = item.args.url
        byKey.set(`web:${url}`, { type: 'web', label: url, url })
      }
    }
  }
  return Array.from(byKey.values()).slice(0, 20)
}

// 右栏：目标状态 + 产物 + 来源 + 用量，优先展示用户能拿走的结果
export function RightPanel({ collapsed }: { collapsed: boolean }) {
  const { status, taskId, goal, turns, currentTurn, artifacts, usage, startedAt, finishedAt, error, message, projects, activeProjectId, setMessage, requestManualCompact } =
    useTaskStore()
  const activeWorkspaceDir = projects.find((p) => p.id === activeProjectId)?.folderPath
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactEntry | null>(null)
  const [previewText, setPreviewText] = useState('')
  const [previewDataUrl, setPreviewDataUrl] = useState('')
  const [previewKind, setPreviewKind] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [artifactAccepted, setArtifactAccepted] = useState(false)

  useEffect(() => {
    if (!selectedArtifact) return
    setArtifactAccepted(false)
    setPreviewText('')
    setPreviewDataUrl('')
    setPreviewKind('')
    setPreviewError('')
    void api.workspacePreviewFile(selectedArtifact.filePath, activeWorkspaceDir).then((res) => {
      setPreviewKind(res.kind || '')
      if (res.dataUrl) setPreviewDataUrl(res.dataUrl)
      if (res.content) setPreviewText(res.content)
      if (!res.dataUrl && !res.content) setPreviewError(res.error || '这个产物暂时不能直接预览，可以打开文件查看')
    })
  }, [selectedArtifact, activeWorkspaceDir])

  const hasTask = status !== 'idle'

  if (!hasTask) {
    return null
  }

  // 只保留一行进度摘要，把空间让给产物和来源。
  const latestTurn = currentTurn || turns[turns.length - 1] || null
  const toolItems = (latestTurn?.items ?? []).filter((it): it is ToolCallItem => it.type === 'toolCall')
  const total = toolItems.length
  const doneCount = toolItems.filter((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'stopped' || t.status === 'canceled').length
  const visibleArtifacts = artifacts.filter((a) => a.filePath !== 'inline')
  const sources = deriveSourcesFromTurns(turns, currentTurn)

  return (
    <aside
      className={`glass-soft flex-shrink-0 flex flex-col border-l border-white/40 transition-all duration-300 ease-in-out overflow-hidden ${
        collapsed ? 'w-0 border-l-0' : 'w-72'
      }`}
    >
      <div className="drag h-9 flex-shrink-0" />
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-3">
        {/* 目标卡 */}
        <section className="glass rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} className="text-[var(--ink-soft)]" />
            <span className="text-xs font-semibold tracking-wide text-[var(--ink-soft)] uppercase">
              目标
            </span>
            <StatusBadge status={status} className="ml-auto" />
          </div>
          <p className="text-sm leading-relaxed text-[var(--ink)] line-clamp-4">
            {goal || message || '（未设定）'}
          </p>
          <p className="text-xs text-[var(--ink-soft)] mt-2">
            {total > 0 ? `已完成 ${doneCount}/${total} 步` : '等待开始'}
          </p>
        </section>

        {/* 产物 */}
        <section className="glass rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <FileCode size={14} className="text-[var(--ink-soft)]" />
            <span className="text-xs font-semibold tracking-wide text-[var(--ink-soft)] uppercase">产物</span>
            {visibleArtifacts.length > 0 && <span className="ml-auto text-xs text-[var(--ink-soft)]">{visibleArtifacts.length}</span>}
          </div>
          {visibleArtifacts.length === 0 ? (
            <p className="text-xs text-[var(--ink-soft)] py-1">暂无产物</p>
          ) : (
            <ul className="space-y-1">{visibleArtifacts.map((a, i) => <ArtifactItem key={i} art={a} onPreview={() => setSelectedArtifact(a)} />)}</ul>
          )}
        </section>

        {selectedArtifact && (
          <ArtifactPreview
            art={selectedArtifact}
            content={previewText}
            dataUrl={previewDataUrl}
            kind={previewKind}
            error={previewError}
            accepted={artifactAccepted}
            onAccept={() => setArtifactAccepted(true)}
            onRevise={() => setMessage(`请继续修改 ${artifactName(selectedArtifact.filePath)}：`)}
            onRollback={() => { if (taskId) void api.rollbackTask(taskId) }}
            onOpen={() => void api.openPath(selectedArtifact.filePath)}
          />
        )}

        {/* 来源 */}
        <section className="glass rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <FileText size={14} className="text-[var(--ink-soft)]" />
            <span className="text-xs font-semibold tracking-wide text-[var(--ink-soft)] uppercase">来源</span>
            {sources.length > 0 && <span className="ml-auto text-xs text-[var(--ink-soft)]">{sources.length}</span>}
          </div>
          {sources.length === 0 ? (
            <p className="text-xs text-[var(--ink-soft)] py-1">暂无来源</p>
          ) : (
            <ul className="space-y-1">{sources.map((s, i) => <SourceItem key={i} source={s} />)}</ul>
          )}
        </section>

        {/* 上下文容量指示器 */}
        <ContextCapacityIndicator usedTokens={usage.inputTokens + usage.outputTokens} running={status === 'executing'} onManualCompact={requestManualCompact} />

        {/* 用量与计时 */}
        <section className="glass rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[var(--ink-soft)]" />
            <span className="text-xs font-semibold tracking-wide text-[var(--ink-soft)] uppercase">
              用量
            </span>
          </div>
          <UsageRow
            icon={<Coins size={13} />}
            label="Tokens"
            value={formatTokens(usage.inputTokens + usage.outputTokens)}
          />
          <UsageRow
            icon={<Clock size={13} />}
            label="耗时"
            value={<Duration start={startedAt} end={finishedAt} running={status === 'executing'} />}
          />
        </section>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}
      </div>
    </aside>
  )
}

function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    executing: { label: '执行中', cls: 'bg-sky-100 text-sky-600' },
    completed: { label: '已完成', cls: 'bg-green-100 text-green-600' },
    failed: { label: '失败', cls: 'bg-red-100 text-red-600' },
    idle: { label: '待机', cls: 'bg-black/5 text-[var(--ink-soft)]' }
  }
  const m = map[status] || map.idle
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.cls} ${className}`}
    >
      {m.label}
    </span>
  )
}

function ArtifactItem({ art, onPreview }: { art: ArtifactEntry; onPreview: () => void }) {
  const meta = ARTIFACT_META[art.type] || ARTIFACT_META.file
  const name = artifactName(art.filePath)
  return (
    <li>
      <button onClick={onPreview} className="w-full flex items-center gap-2 text-xs rounded-md px-1 py-1 hover:bg-black/[0.04] transition text-left">
      <span className="text-[var(--ink-soft)] flex-shrink-0">{meta.icon}</span>
      <span className="truncate text-[var(--ink)]" title={art.filePath}>
        {name}
      </span>
      {art.added != null && (
        <span className="ml-auto text-green-600 font-mono">+{art.added}</span>
      )}
      {art.removed != null && art.removed > 0 && (
        <span className="text-red-500 font-mono">-{art.removed}</span>
      )}
      </button>
    </li>
  )
}

function ArtifactPreview({ art, content, dataUrl, kind, error, accepted, onAccept, onRevise, onRollback, onOpen }: {
  art: ArtifactEntry
  content: string
  dataUrl: string
  kind: string
  error: string
  accepted: boolean
  onAccept: () => void
  onRevise: () => void
  onRollback: () => void
  onOpen: () => void
}) {
  const name = artifactName(art.filePath)
  return (
    <section className="glass rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Eye size={14} className="text-[var(--ink-soft)]" />
        <span className="text-xs font-semibold tracking-wide text-[var(--ink-soft)] uppercase">预览</span>
      </div>
      <div className="text-xs font-mono text-[var(--ink)] truncate" title={art.filePath}>{name}</div>
      {dataUrl ? (
        <div className="rounded-lg bg-black/[0.03] p-2">
          <img src={dataUrl} alt={name} className="max-h-52 w-full object-contain rounded-md" />
        </div>
      ) : content ? (
        <pre className="max-h-52 overflow-y-auto rounded-lg bg-black/[0.03] px-2.5 py-2 text-[11px] text-[var(--ink-soft)] whitespace-pre-wrap break-all font-mono">
          {kind === 'table' ? '表格预览\n' : kind === 'document' ? '文档预览\n' : ''}{content.slice(0, 5000)}{content.length > 5000 ? '\n...（仅显示前 5000 字）' : ''}
        </pre>
      ) : (
        <div className="rounded-lg bg-black/[0.03] px-2.5 py-2 text-xs text-[var(--ink-soft)]">{error || '正在读取预览...'}</div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={onAccept} className="h-8 rounded-lg bg-green-50 text-green-700 text-xs font-medium inline-flex items-center justify-center gap-1">
          <CheckCircle2 size={13} /> {accepted ? '已采用' : '采用'}
        </button>
        <button onClick={onRevise} className="h-8 rounded-lg bg-sky-50 text-sky-700 text-xs font-medium inline-flex items-center justify-center gap-1">
          <Wand2 size={13} /> 继续修改
        </button>
        <button onClick={onRollback} className="h-8 rounded-lg glass text-amber-700 text-xs font-medium inline-flex items-center justify-center gap-1">
          <RotateCcw size={13} /> 回退
        </button>
        <button onClick={onOpen} className="h-8 rounded-lg glass text-[var(--ink-soft)] text-xs font-medium">打开文件</button>
      </div>
    </section>
  )
}

function artifactName(path: string): string {
  return path.split('/').pop() || path
}

function SourceItem({ source }: { source: SourceEntry }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="text-[var(--ink-soft)] flex-shrink-0">{source.type === 'web' ? '🔗' : '📄'}</span>
      <span className="truncate text-[var(--ink)]" title={source.path || source.url || source.label}>{source.label}</span>
    </li>
  )
}

function UsageRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[var(--ink-soft)] flex-shrink-0">{icon}</span>
      <span className="text-[var(--ink-soft)]">{label}</span>
      <span className="ml-auto font-mono text-[var(--ink)]">{value}</span>
    </div>
  )
}

const ARTIFACT_META: Record<string, { icon: React.ReactNode }> = {
  diff: { icon: <GitCompare size={13} /> },
  report: { icon: <FileText size={13} /> },
  file: { icon: <FileCode size={13} /> },
  preview: { icon: <Eye size={13} /> },
  evidence: { icon: <FileText size={13} /> },
  task_summary: { icon: <Flag size={13} /> }
}

function formatTokens(n: number): string {
  if (n <= 0) return '—'
  if (n < 1000) return `${n}`
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`
  return `${(n / 1000000).toFixed(2)}M`
}

function formatDuration(start: number, end: number): string {
  const sec = Math.max(0, Math.floor((end - start) / 1000))
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m ${s}s`
}

// 执行中时每秒自刷新一次
function Duration({
  start,
  end,
  running
}: {
  start: number | null
  end: number | null
  running: boolean
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])
  if (!start) return <span>—</span>
  const finish = end || now
  return <>{formatDuration(start, finish)}</>
}

const DEFAULT_CONTEXT_LIMIT = 200000

function ContextCapacityIndicator({ usedTokens, running, onManualCompact }: { usedTokens: number; running: boolean; onManualCompact: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [contextLimit, setContextLimit] = useState(DEFAULT_CONTEXT_LIMIT)
  useEffect(() => {
    api.configGet('contextLimit').then((v) => {
      if (typeof v === 'number' && v > 0) setContextLimit(v)
    })
  }, [])
  const percentage = Math.min(100, (usedTokens / contextLimit) * 100)
  const isWarning = percentage > 70
  const isDanger = percentage > 90
  const color = isDanger ? 'rgb(239 68 68)' : isWarning ? 'rgb(245 158 11)' : 'rgb(14 165 233)'
  const size = 28
  const strokeWidth = 2.5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <section className="glass rounded-xl p-3 space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2"
      >
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke="rgb(0 0 0 / 0.08)" strokeWidth={strokeWidth}
            />
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={color} strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
        </div>
        <span className="text-xs font-semibold tracking-wide text-[var(--ink-soft)] uppercase">
          上下文
        </span>
        <span className="ml-auto text-xs font-mono text-[var(--ink-soft)]">
          {formatTokens(usedTokens)} / {formatTokens(contextLimit)}
        </span>
      </button>
      {expanded && (
        <div className="space-y-2 text-xs text-[var(--ink-soft)] pl-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span>占用 {percentage.toFixed(1)}%</span>
            {isDanger && <span className="text-red-500">即将触发上下文整理</span>}
            {!isDanger && isWarning && <span className="text-amber-500">接近压缩阈值</span>}
          </div>
          <div>剩余 {formatTokens(Math.max(0, contextLimit - usedTokens))}</div>
          <button
            onClick={onManualCompact}
            disabled={running}
            className="h-7 px-2 rounded-lg glass text-xs text-[var(--ink)] hover:bg-black/[0.04] disabled:opacity-40 disabled:cursor-not-allowed"
            title={running ? '任务进行中时，无法手动整理上下文' : '整理旧上下文'}
          >
            {running ? '运行中不可整理' : '手动整理上下文'}
          </button>
        </div>
      )}
    </section>
  )
}
