import { useMemo, useState } from 'react'
import { Check, PencilLine, X } from 'lucide-react'
import { api } from '../api'
import { useTaskStore } from '../store/task'

/**
 * 任务结束后的轻量反馈：接受 / 我改过 / 拒绝
 * 写入工作区经验账本，驱动 L1 四类归因。
 */
export function OutcomeFeedbackCard() {
  const { status, taskId, mode, projects, currentProjectId, summary } = useTaskStore()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'accept' | 'edit' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needNote, setNeedNote] = useState<'edit' | 'reject' | null>(null)
  const [learnTip, setLearnTip] = useState<string | null>(null)

  const workspaceDir = useMemo(() => {
    const p = projects.find((x) => x.id === currentProjectId)
    return p?.folderPath || ''
  }, [projects, currentProjectId])

  if (status !== 'completed' && status !== 'failed') return null
  if (done) {
    return (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--ink-soft)] space-y-1">
        <div>
          已记录反馈（{done === 'accept' ? '接受' : done === 'edit' ? '局部修改' : '拒绝'}）
          {summary ? '，将用于后续经验注入。' : '。'}
        </div>
        {learnTip && (
          <div className="rounded-lg bg-[var(--settings-input-bg)] px-2.5 py-2 text-[11px] text-[var(--ink-secondary)]">
            <div className="font-medium text-[var(--ink)]">本次学习</div>
            <div className="mt-0.5">{learnTip}</div>
            <div className="mt-1 text-[var(--ink-soft)]">可在 设置 → 进化 查看、禁用或撤销。</div>
          </div>
        )}
      </div>
    )
  }
  if (!workspaceDir) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--line)] px-3 py-2 text-[12px] text-[var(--ink-soft)]">
        绑定项目文件夹后，可把接受/修改/拒绝写入经验账本。
      </div>
    )
  }

  const submit = async (outcome: 'accept' | 'edit' | 'reject') => {
    if ((outcome === 'edit' || outcome === 'reject') && !note.trim()) {
      setNeedNote(outcome)
      setError('请先写一句原因，方便归因到风格/规范/逻辑/缺陷')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.experienceRecordOutcome({
        workspaceDir,
        outcome,
        taskId: taskId || undefined,
        note: note.trim() || undefined,
        family: mode === 'code' ? 'T1' : 'other'
      })
      if (!res.success) {
        setError(res.error || '写入失败')
        return
      }
      const route = (res as { learningRoute?: { primary?: string; rationale?: string } }).learningRoute
      const record = res.record as { learning_route_rationale?: string; learning_target?: string } | undefined
      const tip =
        route?.rationale ||
        record?.learning_route_rationale ||
        (record?.learning_target ? `落点：${record.learning_target}` : null)
      setLearnTip(tip)
      setDone(outcome)
      setNeedNote(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 space-y-2">
      <div className="text-[13px] font-medium text-[var(--ink)]">这次交付怎么样？</div>
      <div className="text-[11px] text-[var(--ink-soft)]">
        正常使用即可训练：接受 / 说明你怎么改的 / 拒绝原因，会记入本项目经验账本。
      </div>
      {(needNote || note.length > 0) && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={needNote === 'reject' ? '例如：接口层不要直接抛异常，要用统一 Result' : '例如：变量名偏好缩写 usrInfo'}
          className="w-full resize-none rounded-lg border border-[var(--line)] bg-transparent px-2.5 py-2 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => submit('accept')}
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
        >
          <Check size={13} /> 接受
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!note.trim()) {
              setNeedNote('edit')
              setError('请先写一句你怎么改的')
              return
            }
            void submit('edit')
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12px] text-[var(--ink)] hover:bg-[var(--settings-row-hover)] disabled:opacity-50"
        >
          <PencilLine size={13} /> 我改过
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!note.trim()) {
              setNeedNote('reject')
              setError('请先写一句拒绝原因')
              return
            }
            void submit('reject')
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12px] text-[var(--ink)] hover:bg-[var(--settings-row-hover)] disabled:opacity-50"
        >
          <X size={13} /> 拒绝
        </button>
      </div>
      {error && <div className="text-[11px] text-red-500">{error}</div>}
    </div>
  )
}
