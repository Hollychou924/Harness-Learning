import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { api, type TraceMeta, type TraceEvent } from '../../../api'

export function DiagnosticsSection() {
  const [traces, setTraces] = useState<TraceMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const list = (await api.traceList(50)) as TraceMeta[]
    setTraces(list)
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  if (selectedId) {
    return <TraceDetail traceId={selectedId} onBack={() => { setSelectedId(null); void refresh() }} />
  }

  return (
    <section>
      <header className="mb-5">
        <h3 className="text-lg font-semibold text-[var(--ink)]">诊断日志</h3>
        <p className="text-sm text-[var(--ink-soft)] mt-1">每条请求的完整执行链路记录，包含模型调用、工具执行、权限审批、异常等</p>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)] py-8 justify-center">
          <Loader2 size={14} className="animate-spin" /> 加载中…
        </div>
      ) : traces.length === 0 ? (
        <div className="text-sm text-[var(--ink-soft)] py-8 text-center">还没有日志记录，发起一次任务后即可查看</div>
      ) : (
        <div className="space-y-1.5">
          {traces.map((t) => (
            <button
              key={t.traceId}
              onClick={() => setSelectedId(t.traceId)}
              className="w-full text-left glass-soft rounded-xl px-4 py-3 hover:brightness-105 transition"
            >
              <div className="flex items-center gap-2">
                <StatusDot status={t.status} />
                <span className="text-sm font-medium text-[var(--ink)] truncate flex-1">{t.message || '(无消息)'}</span>
                <ChevronRight size={14} className="text-[var(--ink-soft)] flex-shrink-0" />
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--ink-soft)]">
                <span>{t.provider} / {t.model}</span>
                <span>·</span>
                <span>{new Date(t.startedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <span>·</span>
                <span>{t.eventCount} 事件</span>
                {t.finishedAt && (
                  <>
                    <span>·</span>
                    <span>{Math.round((t.finishedAt - t.startedAt) / 1000)}s</span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function TraceDetail({ traceId, onBack }: { traceId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<{ meta: TraceMeta | null; events: TraceEvent[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const d = (await api.traceGet(traceId)) as { meta: TraceMeta | null; events: TraceEvent[] }
      setDetail(d)
      setLoading(false)
    })()
  }, [traceId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)] py-8 justify-center">
        <Loader2 size={14} className="animate-spin" /> 加载日志…
      </div>
    )
  }

  if (!detail || !detail.meta) {
    return <div className="text-sm text-[var(--ink-soft)] py-8 text-center">日志不存在</div>
  }

  const phases = new Set(detail.events.map((e) => e.phase))
  const errors = detail.events.filter((e) => e.phase === 'error')

  return (
    <section>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition mb-4">
        <ChevronLeft size={16} /> 返回列表
      </button>

      {/* 概览 */}
      <div className="glass-soft rounded-xl px-4 py-3 mb-4 space-y-1.5">
        <div className="flex items-center gap-2">
          <StatusDot status={detail.meta.status} />
          <span className="text-sm font-medium text-[var(--ink)]">{detail.meta.message || '(无消息)'}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mt-2">
          <InfoRow label="模型" value={`${detail.meta.provider} / ${detail.meta.model}`} />
          <InfoRow label="模式" value={detail.meta.mode} />
          <InfoRow label="状态" value={detail.meta.status} />
          <InfoRow label="事件数" value={String(detail.meta.eventCount)} />
          <InfoRow label="开始" value={new Date(detail.meta.startedAt).toLocaleString('zh-CN')} />
          {detail.meta.finishedAt && <InfoRow label="耗时" value={`${Math.round((detail.meta.finishedAt - detail.meta.startedAt) / 1000)}s`} />}
          <InfoRow label="阶段" value={Array.from(phases).join(' → ')} />
        </div>
        {errors.length > 0 && (
          <div className="text-xs text-red-500 mt-2">⚠ {errors.length} 个异常</div>
        )}
      </div>

      {/* 时间线 */}
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)] mb-2">执行时间线</div>
      <div className="space-y-1">
        {detail.events.map((ev, i) => (
          <TimelineEvent key={i} event={ev} startTime={detail.meta!.startedAt} />
        ))}
      </div>
    </section>
  )
}

function TimelineEvent({ event, startTime }: { event: TraceEvent; startTime: number }) {
  const [expanded, setExpanded] = useState(false)
  const offset = ((event.ts - startTime) / 1000).toFixed(1)
  const phaseColors: Record<string, string> = {
    request: 'bg-sky-400',
    thinking: 'bg-violet-400',
    model_output: 'bg-blue-400',
    model_call: 'bg-cyan-400',
    tool: 'bg-amber-400',
    permission: 'bg-orange-400',
    plan: 'bg-indigo-400',
    todo: 'bg-purple-400',
    subtask: 'bg-pink-400',
    progress: 'bg-green-400',
    artifact: 'bg-teal-400',
    error: 'bg-red-400',
    completion: 'bg-green-500',
    status: 'bg-gray-400',
    user_action: 'bg-rose-400'
  }
  const color = phaseColors[event.phase] || 'bg-gray-400'
  const summary = getEventSummary(event)

  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center flex-shrink-0 pt-1.5">
        <span className={`w-2 h-2 rounded-full ${color}`} />
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <button
          onClick={() => summary.expandable && setExpanded(!expanded)}
          className={`w-full text-left ${summary.expandable ? 'hover:bg-black/[0.03] rounded-lg' : ''} px-2 py-1 -mx-1 transition`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--ink-soft)] font-mono w-12 flex-shrink-0">+{offset}s</span>
            <span className="text-xs font-medium text-[var(--ink)]">{summary.title}</span>
            {summary.badge && <span className="text-[10px] text-[var(--ink-soft)]">{summary.badge}</span>}
          </div>
        </button>
        {expanded && summary.detail && (
          <pre className="text-[11px] text-[var(--ink-soft)] bg-black/[0.04] rounded-lg p-2 mt-1 ml-14 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
            {summary.detail}
          </pre>
        )}
      </div>
    </div>
  )
}

function getEventSummary(event: TraceEvent): { title: string; badge?: string; detail?: string; expandable: boolean } {
  const d = event.data
  switch (event.type) {
    case 'task_started':
      return { title: '任务发起', badge: String(d.mode || ''), detail: JSON.stringify(d, null, 2), expandable: true }
    case 'turn_started':
      return { title: '新一轮开始', badge: String(d.turnId || ''), expandable: false }
    case 'turn_completed':
      return { title: `一轮结束: ${d.status}`, badge: String(d.turnId || ''), expandable: false }
    case 'item_started':
      return itemSummary(d.item as ItemLike, '开始')
    case 'item_completed':
      return itemSummary(d.item as ItemLike, '完成')
    case 'item_delta':
      return { title: '流式增量', badge: String((d.target as { field?: string })?.field || ''), expandable: false }
    case 'approval_request':
      return { title: `权限审批: ${d.toolName}`, badge: String(d.riskLevel || ''), detail: JSON.stringify({ impact: d.impact, args: d.args }, null, 2), expandable: true }
    case 'approval_response':
      return { title: `用户${d.approved ? '批准' : '拒绝'}`, expandable: false }
    case 'plan_proposed':
      return { title: '计划提案', detail: String(d.plan || ''), expandable: true }
    case 'plan_response':
      return { title: `计划决策: ${d.decision}`, detail: String(d.feedback || ''), expandable: Boolean(d.feedback) }
    case 'todo_update':
      return { title: 'Todo 更新', badge: `${(d.todos as unknown[])?.length || 0} 项`, detail: JSON.stringify(d.todos, null, 2), expandable: true }
    case 'subtask_started':
      return { title: `子任务开始: ${d.title}`, expandable: false }
    case 'subtask_completed':
      return { title: `子任务完成: ${d.title}`, badge: `${d.durationMs}ms`, expandable: false }
    case 'subtask_failed':
      return { title: `子任务失败: ${d.title}`, detail: String(d.error || ''), expandable: true }
    case 'usage':
      return { title: 'Token 用量', badge: `↑${d.inputTokens} ↓${d.outputTokens}`, expandable: false }
    case 'artifact':
      return { title: `产物: ${d.artifactType}`, expandable: false }
    case 'error':
      return { title: '异常', badge: '⚠', detail: String(d.message || ''), expandable: true }
    case 'completed':
      return { title: '任务完成', detail: String(d.summary || ''), expandable: true }
    case 'task_cancelled':
      return { title: '用户取消任务', expandable: false }
    case 'append_input':
      return { title: '追加输入', detail: String(d.message || ''), expandable: true }
    default:
      return { title: event.type, detail: JSON.stringify(d, null, 2), expandable: true }
  }
}

interface ItemLike {
  type: string
  id: string
  toolName?: string
  text?: string
  status?: string
  error?: string
  resultSummary?: string
}

/** 把 item_started/item_completed 里的条目转成时间线一句话摘要，认识 Turn/Item 协议的各种条目类型 */
function itemSummary(item: ItemLike | undefined, phase: string): { title: string; badge?: string; detail?: string; expandable: boolean } {
  if (!item) return { title: `条目${phase}`, expandable: false }
  switch (item.type) {
    case 'userMessage':
      return { title: '用户消息', expandable: false }
    case 'agentMessage':
      return { title: phase === '完成' ? `回复：${(item.text || '').slice(0, 40)}` : '回复生成中', expandable: phase === '完成' }
    case 'reasoning':
      return { title: `思考${phase}`, expandable: false }
    case 'toolCall':
      return {
        title: `工具 ${phase}: ${item.toolName || ''}`,
        badge: item.status,
        detail: item.resultSummary || item.error,
        expandable: Boolean(item.resultSummary || item.error)
      }
    case 'plan':
      return { title: '计划提案', expandable: false }
    case 'approval':
      return { title: '审批请求', badge: item.status, expandable: false }
    default:
      return { title: `${item.type}${phase}`, expandable: false }
  }
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-sky-400 animate-pulse',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    cancelled: 'bg-gray-400'
  }
  return <span className={`w-2 h-2 rounded-full ${colors[status] || 'bg-gray-300'} flex-shrink-0`} />
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--ink-soft)]">{label}</span>
      <span className="text-[var(--ink)] text-right truncate ml-2">{value}</span>
    </div>
  )
}
