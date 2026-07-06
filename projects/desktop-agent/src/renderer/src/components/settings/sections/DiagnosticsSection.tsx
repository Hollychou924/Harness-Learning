import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Download, Loader2, MessageSquareWarning, Search, Shield, Wrench } from 'lucide-react'
import { api, type TraceMeta, type TraceEvent, type FeedbackTicket, type DiagnosticPackageLevel, type DiagnosticsOverview, type ReplayBundle } from '../../../api'

export function DiagnosticsSection() {
  const [traces, setTraces] = useState<TraceMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState('')
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackList, setFeedbackList] = useState<FeedbackTicket[]>([])
  const [overview, setOverview] = useState<DiagnosticsOverview | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [query, setQuery] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const list = (await api.traceList(50)) as TraceMeta[]
    const tickets = (await api.feedbackList(200)) as FeedbackTicket[]
    const summary = await api.diagnosticsOverview(200)
    setTraces(list)
    setFeedbackList(tickets)
    setOverview(summary)
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const exportRecent = async () => {
    setExporting(true)
    setNotice('')
    const result = await api.traceExport()
    setExporting(false)
    if (result.success && result.path) {
      setNotice(`已导出到 ${result.path}`)
      void api.openPath(result.path)
    } else {
      setNotice(result.error || '导出失败，请重试')
    }
  }

  const searchById = () => {
    const text = query.trim()
    if (!text) return
    const feedback = feedbackList.find((item) => item.feedbackId === text)
    if (feedback?.traceId) {
      setSelectedId(feedback.traceId)
      return
    }
    const trace = traces.find((item) => item.traceId === text || item.taskId === text || shortId(item.traceId) === text)
    if (trace) {
      setSelectedId(trace.traceId)
      return
    }
    setNotice('没有找到对应的反馈或任务记录')
  }

  if (selectedId) {
    return <TraceDetail traceId={selectedId} onBack={() => { setSelectedId(null); void refresh() }} />
  }

  const completedCount = overview?.completed ?? 0
  const failedCount = overview?.failed ?? 0

  return (
    <section>
      <header className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-[var(--ink)]">反馈</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={exportRecent}
              disabled={exporting || traces.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg floating-subsurface px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:brightness-105 disabled:opacity-40 transition"
            >
              {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              导出记录
            </button>
            <button
              onClick={() => setFeedbackOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 transition"
            >
              <MessageSquareWarning size={13} />
              反馈问题
            </button>
          </div>
        </div>
        <p className="text-sm text-[var(--ink-soft)] mt-1">
          这里可以看到你近期让小蓝鲸做过的事，也能直接反馈问题。反馈时我们会自动带上相关记录，方便排查。
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--ink-soft)]">
          <Shield size={12} />
          <span>记录默认只保存在本机，反馈前会让你确认是否附带对话和文件摘要</span>
        </div>
        {notice && <p className="text-xs text-[var(--ink-soft)] mt-2">{notice}</p>}
      </header>

      {feedbackOpen && (
        <FeedbackForm
          traceId={traces[0]?.traceId}
          onClose={() => setFeedbackOpen(false)}
          onCreated={(ticket) => {
            setFeedbackList((items) => [ticket, ...items])
            setNotice(`反馈已提交，编号 ${ticket.feedbackId}`)
          }}
        />
      )}

      {feedbackList.length > 0 && (
        <div className="mb-4 rounded-xl floating-subsurface px-4 py-3">
          <div className="mb-2 text-xs font-semibold text-[var(--ink-soft)]">反馈记录</div>
          <div className="space-y-2">
            {feedbackList.slice(0, 5).map((ticket) => (
              <div key={ticket.feedbackId} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-[var(--ink)]">{ticket.feedbackId}</span>
                <span className="text-[var(--ink-soft)]">{ticket.category}</span>
                <span className="ml-auto text-[var(--ink-soft)]">
                  {new Date(ticket.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                {ticket.traceId && (
                  <button
                    onClick={() => setSelectedId(ticket.traceId!)}
                    className="text-[var(--ink)] hover:underline"
                  >
                    查看关联任务
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {overview && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label="已完成" value={String(completedCount)} />
          <MetricCard label="失败" value={String(failedCount)} tone={failedCount > 0 ? 'warn' : undefined} />
          <MetricCard label="进行中" value={String(overview.running)} />
          <MetricCard label="已取消" value={String(overview.cancelled)} />
        </div>
      )}

      <div className="mb-4 rounded-xl floating-subsurface px-4 py-3">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] transition"
        >
          <Wrench size={13} />
          {showAdvanced ? '收起高级排查' : '高级排查'}
          <ChevronRight size={13} className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
        </button>
        {showAdvanced && (
          <div className="mt-3 pt-3 border-t border-black/[0.08]">
            <div className="mb-2 text-xs font-semibold text-[var(--ink-soft)]">按编号查询</div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') searchById() }}
                  placeholder="输入反馈编号、任务编号或记录编号"
                  className="h-9 w-full rounded-lg bg-black/[0.04] pl-8 pr-3 text-sm text-[var(--ink)] outline-none"
                />
              </div>
              <button onClick={searchById} className="rounded-lg bg-[var(--ink)] px-4 text-xs font-medium text-white hover:brightness-110 transition">
                查询
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)] py-8 justify-center">
          <Loader2 size={14} className="animate-spin" /> 加载中…
        </div>
      ) : traces.length === 0 ? (
        <div className="text-sm text-[var(--ink-soft)] py-8 text-center">还没有使用记录，发起一次任务后即可查看</div>
      ) : (
        <div className="space-y-1.5">
          {traces.map((t) => (
            <button
              key={t.traceId}
              onClick={() => setSelectedId(t.traceId)}
              className="w-full text-left floating-subsurface rounded-xl px-4 py-3 hover:brightness-105 transition"
            >
              <div className="flex items-center gap-2">
                <StatusDot status={t.status} />
                <span className="text-sm font-medium text-[var(--ink)] truncate flex-1">{t.message || '(无消息)'}</span>
                <ChevronRight size={14} className="text-[var(--ink-soft)] flex-shrink-0" />
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--ink-soft)]">
                <span>{new Date(t.startedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <span>·</span>
                <span>{statusText(t.status)}</span>
                {t.finishedAt && (
                  <>
                    <span>·</span>
                    <span>耗时 {Math.round((t.finishedAt - t.startedAt) / 1000)}s</span>
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

function statusText(status: string): string {
  switch (status) {
    case 'completed': return '已完成'
    case 'failed': return '失败'
    case 'cancelled': return '已取消'
    case 'running': return '进行中'
    default: return status
  }
}

function TraceDetail({ traceId, onBack }: { traceId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<{ meta: TraceMeta | null; events: TraceEvent[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState('')
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [replay, setReplay] = useState<ReplayBundle | null>(null)
  const [includeReplayConversation, setIncludeReplayConversation] = useState(false)
  const [includeReplayFileSummary, setIncludeReplayFileSummary] = useState(false)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const d = (await api.traceGet(traceId)) as { meta: TraceMeta | null; events: TraceEvent[] }
      setDetail(d)
      const r = await api.replayGet({ traceId, includeConversation: false, includeFileSummary: false })
      setReplay(r)
      setLoading(false)
    })()
  }, [traceId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)] py-8 justify-center">
        <Loader2 size={14} className="animate-spin" /> 加载中…
      </div>
    )
  }

  if (!detail || !detail.meta) {
    return <div className="text-sm text-[var(--ink-soft)] py-8 text-center">记录不存在</div>
  }

  const phases = new Set(detail.events.map((e) => e.phase))
  const errors = detail.events.filter((e) => e.phase === 'error')
  const exportCurrent = async () => {
    setExporting(true)
    setNotice('')
    const result = await api.traceExport(traceId)
    setExporting(false)
    if (result.success && result.path) {
      setNotice(`已导出到 ${result.path}`)
      void api.openPath(result.path)
    } else {
      setNotice(result.error || '导出失败，请重试')
    }
  }

  const refreshReplay = async (nextConversation = includeReplayConversation, nextFileSummary = includeReplayFileSummary) => {
    const r = await api.replayGet({ traceId, includeConversation: nextConversation, includeFileSummary: nextFileSummary })
    setReplay(r)
  }

  const exportReplay = async () => {
    setExporting(true)
    setNotice('')
    const result = await api.replayExport({
      traceId,
      includeConversation: includeReplayConversation,
      includeFileSummary: includeReplayFileSummary
    })
    setExporting(false)
    if (result.success && result.path) {
      setNotice(`回放包已生成：${result.path}`)
      void api.openPath(result.path)
    } else {
      setNotice(result.error || '回放包生成失败，请重试')
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition">
          <ChevronLeft size={16} /> 返回列表
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFeedbackOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 transition"
          >
            <MessageSquareWarning size={13} />
            反馈这次任务
          </button>
          <button
            onClick={exportCurrent}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg floating-subsurface px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:brightness-105 disabled:opacity-40 transition"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            导出记录
          </button>
        </div>
      </div>
      {notice && <p className="mb-3 text-xs text-[var(--ink-soft)]">{notice}</p>}

      {feedbackOpen && (
        <FeedbackForm
          traceId={traceId}
          onClose={() => setFeedbackOpen(false)}
          onCreated={(ticket) => {
            setNotice(`反馈已提交，编号 ${ticket.feedbackId}`)
            setFeedbackOpen(false)
          }}
        />
      )}

      {/* 概览 */}
      <div className="floating-subsurface rounded-xl px-4 py-3 mb-4 space-y-1.5">
        <div className="flex items-center gap-2">
          <StatusDot status={detail.meta.status} />
          <span className="text-sm font-medium text-[var(--ink)]">{detail.meta.message || '(无消息)'}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mt-2">
          <InfoRow label="状态" value={statusText(detail.meta.status)} />
          <InfoRow label="模型" value={`${detail.meta.provider} / ${detail.meta.model}`} />
          <InfoRow label="开始时间" value={new Date(detail.meta.startedAt).toLocaleString('zh-CN')} />
          {detail.meta.finishedAt && <InfoRow label="耗时" value={`${Math.round((detail.meta.finishedAt - detail.meta.startedAt) / 1000)}s`} />}
          <InfoRow label="任务模式" value={detail.meta.mode} />
        </div>
        {errors.length > 0 && (
          <div className="text-xs text-red-500 mt-2">⚠ 这次任务发生了 {errors.length} 个异常</div>
        )}
      </div>

      {replay && (
        <ReplayPanel
          replay={replay}
          includeConversation={includeReplayConversation}
          includeFileSummary={includeReplayFileSummary}
          exporting={exporting}
          onToggleConversation={(value) => {
            setIncludeReplayConversation(value)
            void refreshReplay(value, includeReplayFileSummary)
          }}
          onToggleFileSummary={(value) => {
            setIncludeReplayFileSummary(value)
            void refreshReplay(includeReplayConversation, value)
          }}
          onExport={exportReplay}
        />
      )}

      {/* 时间线 */}
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)] mb-2">执行过程</div>
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
    question: 'bg-fuchsia-400',
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
            {event.seq && <span className="text-[10px] text-[var(--ink-soft)] w-8 flex-shrink-0">#{event.seq}</span>}
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
      return { title: '任务开始', badge: String(d.mode || ''), detail: JSON.stringify(d, null, 2), expandable: true }
    case 'turn_started':
      return { title: '新一轮开始', badge: String(d.turnId || ''), expandable: false }
    case 'turn_completed':
      return { title: `一轮结束: ${d.status}`, badge: String(d.turnId || ''), expandable: false }
    case 'item_started':
      return itemSummary(d.item as ItemLike, '开始')
    case 'item_completed':
      return itemSummary(d.item as ItemLike, '完成')
    case 'item_delta':
      return { title: '流式输出', badge: String((d.target as { field?: string })?.field || ''), expandable: false }
    case 'approval_request':
      return { title: `请求确认: ${d.toolName}`, badge: String(d.riskLevel || ''), detail: JSON.stringify({ impact: d.impact, args: d.args }, null, 2), expandable: true }
    case 'approval_response':
      return { title: `用户${d.approved ? '允许' : '拒绝'}`, expandable: false }
    case 'plan_proposed':
      return { title: '提出计划', detail: String(d.plan || ''), expandable: true }
    case 'plan_response':
      return { title: `计划决策: ${d.decision}`, detail: String(d.feedback || ''), expandable: Boolean(d.feedback) }
    case 'question_proposed':
      return { title: '需要补充信息', detail: String(d.question || ''), expandable: true }
    case 'question_response':
      return { title: '用户已补充信息', detail: String(d.customAnswer || ''), expandable: Boolean(d.customAnswer) }
    case 'todo_update':
      return { title: '待办更新', badge: `${(d.todos as unknown[])?.length || 0} 项`, detail: JSON.stringify(d.todos, null, 2), expandable: true }
    case 'subtask_started':
      return { title: `子任务开始: ${d.title}`, expandable: false }
    case 'subtask_completed':
      return { title: `子任务完成: ${d.title}`, badge: `${d.durationMs}ms`, expandable: false }
    case 'subtask_failed':
      return { title: `子任务失败: ${d.title}`, detail: String(d.error || ''), expandable: true }
    case 'usage':
      return { title: '用量', badge: `↑${d.inputTokens} ↓${d.outputTokens}`, expandable: false }
    case 'artifact':
      return { title: `产物: ${d.artifactType}`, expandable: false }
    case 'error':
      return { title: '异常', badge: '⚠', detail: String(d.message || ''), expandable: true }
    case 'completed':
      return { title: '任务完成', detail: String(d.summary || ''), expandable: true }
    case 'task_cancelled':
      return { title: '用户取消任务', expandable: false }
    case 'task_paused':
      return { title: '用户暂停任务', expandable: false }
    case 'task_resumed':
      return { title: '用户继续任务', expandable: false }
    case 'task_rollback':
      return { title: '用户请求回滚', expandable: false }
    case 'append_input':
      return { title: '追加输入', detail: String(d.message || ''), expandable: true }
    case 'feedback_submitted':
      return { title: `已提交反馈 ${d.feedbackId || ''}`, expandable: false }
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
      return { title: '思考中', expandable: false }
    case 'toolCall':
      return {
        title: `执行工具: ${item.toolName || ''}`,
        badge: item.status,
        detail: item.resultSummary || item.error,
        expandable: Boolean(item.resultSummary || item.error)
      }
    case 'plan':
      return { title: '计划', expandable: false }
    case 'approval':
      return { title: '等待确认', badge: item.status, expandable: false }
    default:
      return { title: `${item.type}${phase}`, expandable: false }
  }
}

function FeedbackForm({
  traceId,
  onClose,
  onCreated
}: {
  traceId?: string
  onClose: () => void
  onCreated: (ticket: FeedbackTicket) => void
}) {
  const [category, setCategory] = useState('任务失败')
  const [description, setDescription] = useState('')
  const [contact, setContact] = useState('')
  const [packageLevel, setPackageLevel] = useState<DiagnosticPackageLevel>('basic')
  const [allowDiagnosticPackage, setAllowDiagnosticPackage] = useState(true)
  const [includeConversation, setIncludeConversation] = useState(false)
  const [includeFileSummary, setIncludeFileSummary] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!description.trim()) {
      setError('请简单描述遇到的问题')
      return
    }
    setSubmitting(true)
    setError('')
    const result = await api.feedbackCreate({
      traceId,
      category,
      description,
      contact,
      packageLevel,
      allowDiagnosticPackage,
      includeConversation,
      includeFileSummary
    })
    setSubmitting(false)
    if (result.success && result.feedback) {
      onCreated(result.feedback)
      if (result.packagePath) void api.openPath(result.packagePath)
      return
    }
    setError(result.error || '反馈提交失败，请重试')
  }

  return (
    <div className="mb-4 rounded-xl floating-subsurface px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--ink)]">反馈问题</div>
          <div className="text-xs text-[var(--ink-soft)]">
            {traceId ? '将自动关联这次任务' : '将自动关联最近一次任务'}
          </div>
        </div>
        <button onClick={onClose} className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]">取消</button>
      </div>

      <div className="grid gap-3">
        <label className="grid gap-1 text-xs text-[var(--ink-soft)]">
          问题类型
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-lg bg-black/[0.04] px-3 text-sm text-[var(--ink)] outline-none">
            {['结果不对', '任务失败', '卡住', '速度慢', '费用异常', '界面问题', '模型配置问题', '其他'].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs text-[var(--ink-soft)]">
          问题描述
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请描述你看到的问题、期望结果，以及大概什么时候发生"
            className="min-h-[82px] rounded-lg bg-black/[0.04] px-3 py-2 text-sm text-[var(--ink)] outline-none resize-none"
          />
        </label>

        <label className="grid gap-1 text-xs text-[var(--ink-soft)]">
          联系方式（可选）
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="可填写邮箱或手机号，方便追问"
            className="h-9 rounded-lg bg-black/[0.04] px-3 text-sm text-[var(--ink)] outline-none"
          />
        </label>

        <div className="rounded-lg bg-black/[0.03] p-3">
          <div className="mb-2 text-xs font-semibold text-[var(--ink)]">附带诊断信息</div>
          <div className="grid gap-2 text-xs text-[var(--ink-soft)]">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={allowDiagnosticPackage} onChange={(e) => setAllowDiagnosticPackage(e.target.checked)} />
              允许附带任务执行信息，帮助我们排查
            </label>
            <select
              value={packageLevel}
              disabled={!allowDiagnosticPackage}
              onChange={(e) => setPackageLevel(e.target.value as DiagnosticPackageLevel)}
              className="h-9 rounded-lg bg-white/60 px-3 text-sm text-[var(--ink)] outline-none disabled:opacity-50"
            >
              <option value="basic">基础：任务摘要、错误和环境信息</option>
              <option value="enhanced">增强：加上执行步骤和工具摘要</option>
              <option value="full">完整：更完整的本地记录</option>
            </select>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeConversation} disabled={!allowDiagnosticPackage} onChange={(e) => setIncludeConversation(e.target.checked)} />
              附带对话内容
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeFileSummary} disabled={!allowDiagnosticPackage} onChange={(e) => setIncludeFileSummary(e.target.checked)} />
              附带文件摘要
            </label>
          </div>
        </div>

        {error && <div className="text-xs text-red-500">{error}</div>}
        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-4 py-2 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50 transition"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            提交反馈
          </button>
        </div>
      </div>
    </div>
  )
}

function ReplayPanel({
  replay,
  includeConversation,
  includeFileSummary,
  exporting,
  onToggleConversation,
  onToggleFileSummary,
  onExport
}: {
  replay: ReplayBundle
  includeConversation: boolean
  includeFileSummary: boolean
  exporting: boolean
  onToggleConversation: (value: boolean) => void
  onToggleFileSummary: (value: boolean) => void
  onExport: () => void
}) {
  const visibleSteps = replay.steps.slice(0, 80)
  return (
    <div className="mb-4 rounded-xl glass-soft px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--ink)]">场景还原</div>
          <div className="text-xs text-[var(--ink-soft)]">按时间还原用户输入、模型、工具、审批和异常</div>
        </div>
        <button
          onClick={onExport}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-lg glass px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:brightness-105 disabled:opacity-40 transition"
        >
          {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          生成回放包
        </button>
      </div>

      <div className="mb-3 grid gap-2 text-xs text-[var(--ink-soft)] sm:grid-cols-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeConversation} onChange={(e) => onToggleConversation(e.target.checked)} />
          包含对话内容
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeFileSummary} onChange={(e) => onToggleFileSummary(e.target.checked)} />
          包含文件摘要
        </label>
      </div>

      {visibleSteps.length === 0 ? (
        <div className="text-xs text-[var(--ink-soft)]">暂无可还原步骤</div>
      ) : (
        <div className="space-y-2">
          {visibleSteps.map((step, index) => (
            <div key={`${step.ts}-${index}`} className="flex gap-2 text-xs">
              <span className="w-14 shrink-0 font-mono text-[var(--ink-soft)]">+{(step.offsetMs / 1000).toFixed(1)}s</span>
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${replayKindColor(step.kind)}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--ink)]">{step.title}</span>
                  {step.status && <span className="text-[10px] text-[var(--ink-soft)]">{step.status}</span>}
                </div>
                {step.detail && (
                  <div className="mt-0.5 line-clamp-2 text-[var(--ink-soft)]">{step.detail}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function replayKindColor(kind: string): string {
  const colors: Record<string, string> = {
    user: 'bg-sky-400',
    model: 'bg-blue-400',
    tool: 'bg-amber-400',
    approval: 'bg-orange-400',
    plan: 'bg-indigo-400',
    question: 'bg-fuchsia-400',
    file: 'bg-teal-400',
    error: 'bg-red-400',
    system: 'bg-gray-400'
  }
  return colors[kind] || 'bg-gray-400'
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="rounded-xl floating-subsurface px-3 py-2">
      <div className="text-[11px] text-[var(--ink-soft)]">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone === 'warn' ? 'text-red-500' : 'text-[var(--ink)]'}`}>{value}</div>
    </div>
  )
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

function shortId(value?: string): string {
  if (!value) return ''
  if (value.length <= 12) return value
  return `${value.slice(0, 8)}…${value.slice(-4)}`
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--ink-soft)]">{label}</span>
      <span className="text-[var(--ink)] text-right truncate ml-2">{value}</span>
    </div>
  )
}
