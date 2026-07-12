import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../api'
import { useTaskStore } from '../../../store/task'
import { SettingsGroup, SettingsPageHeader, SettingsRow, SettingsToggle } from '../settingsUi'

type Ledger = {
  tactics: Array<Record<string, unknown>>
  failureCases: Array<Record<string, unknown>>
  outcomes: Array<Record<string, unknown>>
}

const ATTR_LABEL: Record<string, string> = {
  style: '风格',
  convention: '规范',
  logic: '逻辑',
  defect: '缺陷'
}

function isSeedId(id: string): boolean {
  return id.startsWith('t1-')
}

/** 进化账本：可查看 / 禁用 / 撤销；冲突优先级：项目规范 > 用户风格 > 通用 */
export function EvolutionSection() {
  const { projects, currentProjectId } = useTaskStore()
  const workspaceDir = useMemo(
    () => projects.find((p) => p.id === currentProjectId)?.folderPath || '',
    [projects, currentProjectId]
  )
  const [ledger, setLedger] = useState<Ledger>({ tactics: [], failureCases: [], outcomes: [] })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = async () => {
    if (!workspaceDir) {
      setLedger({ tactics: [], failureCases: [], outcomes: [] })
      setError('请先打开带文件夹的项目，才能查看本项目经验账本')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api.experienceListLedger(workspaceDir)
      if (!res.success) {
        setError(res.error || '读取失败')
        return
      }
      setLedger({
        tactics: res.tactics || [],
        failureCases: res.failureCases || [],
        outcomes: res.outcomes || []
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [workspaceDir])

  const onToggleTactic = async (id: string, enabled: boolean) => {
    if (!workspaceDir) return
    setBusyId(id)
    try {
      const res = await api.experienceUpdateTactic({
        workspaceDir,
        tacticId: id,
        action: enabled ? 'enable' : 'disable'
      })
      if (!res.success) setError(res.error || '更新失败')
      await refresh()
    } finally {
      setBusyId(null)
    }
  }

  const onRollbackTactic = async (id: string) => {
    if (!workspaceDir) return
    const label = isSeedId(id) ? '种子策略将禁用（不可删除），确认？' : '撤销后将从账本删除该条用户草稿，确认？'
    if (!window.confirm(label)) return
    setBusyId(id)
    try {
      const res = await api.experienceUpdateTactic({ workspaceDir, tacticId: id, action: 'rollback' })
      if (!res.success) setError(res.error || '撤销失败')
      await refresh()
    } finally {
      setBusyId(null)
    }
  }

  const onToggleFailure = async (id: string, enabled: boolean) => {
    if (!workspaceDir) return
    setBusyId(id)
    try {
      const res = await api.experienceUpdateFailureCase({ workspaceDir, failureId: id, enabled })
      if (!res.success) setError(res.error || '更新失败')
      await refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section>
      <SettingsPageHeader
        title="进化账本"
        subtitle="可查看、禁用、撤销本项目学到的策略与踩坑。冲突优先级：项目规范 > 用户风格 > 通用。待回测策略不会注入。"
        action={
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[12px] text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            {loading ? '刷新中…' : '刷新'}
          </button>
        }
      />

      {error && <p className="mb-3 text-[12px] text-red-500">{error}</p>}

      <SettingsGroup
        footer={
          <span>
            策略 {ledger.tactics.length} · 案例 {ledger.failureCases.length} · 反馈 {ledger.outcomes.length}
          </span>
        }
      >
        <SettingsRow label="工作区" last={!workspaceDir}>
          <span className="max-w-[320px] truncate text-[12px] text-[var(--ink-secondary)]">
            {workspaceDir || '未绑定'}
          </span>
        </SettingsRow>
      </SettingsGroup>

      <h4 className="mb-2 mt-5 text-[13px] font-medium text-[var(--ink)]">策略（Tactics）</h4>
      <SettingsGroup>
        {ledger.tactics.length === 0 ? (
          <SettingsRow label="暂无" last>
            <span className="text-[12px] text-[var(--ink-soft)]">完成任务并反馈后会出现</span>
          </SettingsRow>
        ) : (
          ledger.tactics.slice(0, 12).map((t, i) => {
            const id = String(t.id || i)
            const enabled = t.enabled !== false
            return (
              <SettingsRow
                key={id}
                label={`${ATTR_LABEL[String(t.attribution || 'defect')] || '经验'} · ${String(t.title || t.id)}`}
                last={i === Math.min(ledger.tactics.length, 12) - 1}
              >
                <div className="flex max-w-[320px] flex-col items-end gap-1.5">
                  <span className="text-right text-[11px] leading-snug text-[var(--ink-soft)]">
                    {t.validated === false ? '待回测 · ' : ''}
                    {!enabled ? '已禁用 · ' : ''}
                    {String(t.body || '').slice(0, 56)}
                  </span>
                  <div className="flex items-center gap-2">
                    <SettingsToggle
                      checked={enabled}
                      onChange={(v) => void onToggleTactic(id, v)}
                      disabled={busyId === id || !workspaceDir}
                    />
                    <button
                      type="button"
                      disabled={busyId === id || !workspaceDir}
                      onClick={() => void onRollbackTactic(id)}
                      className="text-[11px] text-[var(--ink-soft)] hover:text-red-500 disabled:opacity-40"
                    >
                      {isSeedId(id) ? '禁用' : '撤销'}
                    </button>
                  </div>
                </div>
              </SettingsRow>
            )
          })
        )}
      </SettingsGroup>

      <h4 className="mb-2 mt-5 text-[13px] font-medium text-[var(--ink)]">失败 / 反馈案例</h4>
      <SettingsGroup>
        {ledger.failureCases.length === 0 ? (
          <SettingsRow label="暂无" last>
            <span className="text-[12px] text-[var(--ink-soft)]">Verifier 未过或用户拒绝/改写时写入</span>
          </SettingsRow>
        ) : (
          ledger.failureCases
            .slice()
            .reverse()
            .slice(0, 10)
            .map((fc, i, arr) => {
              const id = String(fc.id || i)
              const enabled = fc.enabled !== false
              return (
                <SettingsRow
                  key={id}
                  label={`${ATTR_LABEL[String(fc.attribution || 'defect')] || '缺陷'} · ${String(fc.symptom || '').slice(0, 36)}`}
                  last={i === arr.length - 1}
                >
                  <div className="flex max-w-[320px] flex-col items-end gap-1.5">
                    <span className="text-right text-[11px] text-[var(--ink-soft)]">
                      {!enabled ? '已忽略 · ' : ''}
                      {String(fc.fix_hint || '').slice(0, 48)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--ink-soft)]">{enabled ? '生效' : '忽略'}</span>
                      <SettingsToggle
                        checked={enabled}
                        onChange={(v) => void onToggleFailure(id, v)}
                        disabled={busyId === id || !workspaceDir}
                      />
                    </div>
                  </div>
                </SettingsRow>
              )
            })
        )}
      </SettingsGroup>
    </section>
  )
}
