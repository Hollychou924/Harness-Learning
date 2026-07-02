import { useEffect, useState } from 'react'
import {
  Check,
  Loader2,
  AlertCircle,
  Target,
  ListChecks,
  Coins,
  Clock,
  FileCode,
  FileText,
  Eye,
  GitCompare,
  Flag
} from 'lucide-react'
import { useTaskStore } from '../store/task'
import { api } from '../api'
import type { ArtifactEntry } from '../store/task'
import type { ToolCallItem } from '../../../agent/src/items'

// 右栏：目标 + 进度清单 + 用量 + 产物，参考竞品 IDE 的"任务控制台"
export function RightPanel() {
  const { status, goal, turns, currentTurn, artifacts, usage, startedAt, finishedAt, error, message } =
    useTaskStore()
  const hasTask = status !== 'idle'

  if (!hasTask) {
    return null
  }

  // 进度清单：用当前轮次的工具调用条目当"步骤"展示(每次工具调用算一步)
  const latestTurn = currentTurn || turns[turns.length - 1] || null
  const toolItems = (latestTurn?.items ?? []).filter((it): it is ToolCallItem => it.type === 'toolCall')
  const steps = toolItems.map((t, i) => ({ step: i + 1, total: toolItems.length, summary: t.toolName, done: t.status === 'completed' || t.status === 'failed' }))
  const total = steps.length
  const doneCount = steps.filter((s) => s.done).length
  const isComplete = status === 'completed'
  const isFailed = status === 'failed'

  return (
    <aside className="glass-soft w-72 flex-shrink-0 flex flex-col border-l border-white/40">
      <div className="drag h-9" />

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
        </section>

        {/* 进度清单 */}
        <section className="glass rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <ListChecks size={14} className="text-[var(--ink-soft)]" />
            <span className="text-xs font-semibold tracking-wide text-[var(--ink-soft)] uppercase">
              进度
            </span>
            {total > 0 && (
              <span className="ml-auto text-xs text-[var(--ink-soft)]">
                {doneCount}/{total}
              </span>
            )}
          </div>
          {steps.length === 0 ? (
            <p className="text-xs text-[var(--ink-soft)] py-1">
              {isFailed ? '任务未完成' : isComplete ? '任务已完成' : '等待 Agent 拆解步骤…'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {steps.map((s) => (
                <li key={s.step} className="flex items-start gap-2 text-sm">
                  <StepIcon done={s.done} active={status === 'executing' && !s.done} />
                  <span
                    className={`leading-snug ${
                      s.done ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'
                    }`}
                  >
                    {s.summary || `步骤 ${s.step}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 产物 */}
        {artifacts.filter((a) => a.filePath !== 'inline').length > 0 && (
          <section className="glass rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <FileCode size={14} className="text-[var(--ink-soft)]" />
              <span className="text-xs font-semibold tracking-wide text-[var(--ink-soft)] uppercase">
                产物
              </span>
              <span className="ml-auto text-xs text-[var(--ink-soft)]">
                {artifacts.length}
              </span>
            </div>
            <ul className="space-y-1">
              {artifacts.filter((a) => a.filePath !== 'inline').map((a, i) => (
                <ArtifactItem key={i} art={a} />
              ))}
            </ul>
          </section>
        )}

        {/* 上下文容量指示器 */}
        <ContextCapacityIndicator usedTokens={usage.inputTokens + usage.outputTokens} />

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

function StepIcon({ done, active }: { done: boolean; active: boolean }) {
  if (done) return <Check size={14} className="mt-0.5 text-green-500 flex-shrink-0" />
  if (active)
    return <Loader2 size={14} className="mt-0.5 text-sky-500 animate-spin flex-shrink-0" />
  return (
    <span className="mt-1 w-3 h-3 rounded-full border border-black/20 flex-shrink-0" />
  )
}

function ArtifactItem({ art }: { art: ArtifactEntry }) {
  const meta = ARTIFACT_META[art.type] || ARTIFACT_META.file
  const name = art.filePath.split('/').pop() || art.filePath
  return (
    <li className="flex items-center gap-2 text-xs">
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

function ContextCapacityIndicator({ usedTokens }: { usedTokens: number }) {
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
        <div className="space-y-1 text-xs text-[var(--ink-soft)] pl-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span>占用 {percentage.toFixed(1)}%</span>
            {isDanger && <span className="text-red-500">即将触发上下文整理</span>}
            {!isDanger && isWarning && <span className="text-amber-500">接近压缩阈值</span>}
          </div>
          <div>剩余 {formatTokens(Math.max(0, contextLimit - usedTokens))}</div>
        </div>
      )}
    </section>
  )
}
