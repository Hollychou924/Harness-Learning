import { useEffect, useMemo, useState } from 'react'
import { Check, History, LoaderCircle, RotateCcw } from 'lucide-react'
import {
  api,
  type ImportBatchSummary,
  type ImportCategoryCounts,
  type ImportCategoryId,
  type ImportPreview,
  type ImportSourceId,
  type ImportSourceSummary
} from '../../../api'
import { useTaskStore } from '../../../store/task'
import { pickConflictAuthority } from '../../../../../import-conflict'
import {
  SettingsConfirmModal,
  SettingsEmpty,
  SettingsGhostButton,
  SettingsGroup,
  SettingsPageHeader,
  SettingsPrimaryButton,
  SettingsSectionLabel,
  SettingsSegmented
} from '../settingsUi'

const SOURCE_ORDER: ImportSourceId[] = ['codex', 'claude-code', 'cursor']

const CATEGORY_ROWS: Array<{
  id: ImportCategoryId
  label: string
  group: 'global' | 'project'
  nowrap?: boolean
  value: (c: ImportCategoryCounts) => number | string | null
}> = [
  { id: 'global-rules', label: '个人规则', group: 'global', value: (c) => c.globalRules || null },
  { id: 'global-memory', label: '个人记忆', group: 'global', value: (c) => c.globalMemory || null },
  { id: 'global-mcp', label: '全局 MCP', group: 'global', value: (c) => (c.globalMcp ? `${c.globalMcp} 个连接` : null) },
  { id: 'global-skills', label: '全局 Skills', group: 'global', value: (c) => c.globalSkills || null },
  {
    id: 'project-chats',
    label: '项目与对话记录',
    group: 'project',
    nowrap: true,
    value: (c) => (c.projectChatConversations || c.projectChatProjects
      ? `${c.projectChatProjects} · ${c.projectChatConversations}`
      : null)
  },
  { id: 'project-rules', label: '项目规则', group: 'project', value: (c) => c.projectRules || null },
  { id: 'project-memory', label: '项目记忆', group: 'project', value: (c) => c.projectMemory || null },
  { id: 'project-mcp', label: '项目 MCP', group: 'project', value: (c) => (c.projectMcp ? `${c.projectMcp} 个连接` : null) },
  { id: 'project-skills', label: '项目 Skills', group: 'project', value: (c) => c.projectSkills || null }
]

const EMPTY_COUNTS: ImportCategoryCounts = {
  globalRules: 0, globalMemory: 0, globalMcp: 0, globalSkills: 0,
  projectRules: 0, projectMemory: 0, projectChatProjects: 0, projectChatConversations: 0,
  projectMcp: 0, projectSkills: 0
}

type Phase = 'list' | 'importing' | 'done'

function countsOf(source: ImportSourceSummary | undefined): ImportCategoryCounts {
  if (!source) return EMPTY_COUNTS
  // categories 由主进程矩阵扫描产出；缺省时只能回填规则/记忆/对话，MCP·Skills 等会误显示为无数据
  if (source.categories && typeof source.categories.projectChatConversations === 'number') {
    return { ...EMPTY_COUNTS, ...source.categories }
  }
  return {
    globalRules: source.instructions || 0,
    globalMemory: (source.memories || 0) + (source.historySummaries || 0),
    globalMcp: 0,
    globalSkills: 0,
    projectRules: 0,
    projectMemory: 0,
    projectChatProjects: source.projects || 0,
    projectChatConversations: source.conversations || 0,
    projectMcp: 0,
    projectSkills: 0
  }
}

function categoriesIncomplete(sources: ImportSourceSummary[]): boolean {
  return sources.some((source) =>
    source.detected &&
    (!source.categories || typeof source.categories.projectChatConversations !== 'number'))
}

function cellValue(row: typeof CATEGORY_ROWS[number], source: ImportSourceSummary): number | string | null {
  const counts = countsOf(source)
  if (row.id === 'project-chats') {
    const projects = counts.projectChatProjects || source.projects || 0
    const conversations = counts.projectChatConversations || source.conversations || 0
    if (!projects && !conversations) return null
    return `${projects} · ${conversations}`
  }
  if (row.id === 'global-rules') {
    const n = counts.globalRules || source.instructions || 0
    return n || null
  }
  if (row.id === 'global-memory') {
    const n = counts.globalMemory || source.memories || 0
    return n || null
  }
  return row.value(counts)
}

function rowHasData(row: typeof CATEGORY_ROWS[number], sources: ImportSourceSummary[]): boolean {
  return sources.some((source) => cellValue(row, source) != null)
}

export function ImportSection() {
  const mergeImportedData = useTaskStore((state) => state.mergeImportedData)
  const removeImportedData = useTaskStore((state) => state.removeImportedData)
  const reconcileSessions = useTaskStore((state) => state.reconcileSessions)
  const sessions = useTaskStore((state) => state.sessions)

  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [history, setHistory] = useState<ImportBatchSummary[]>([])
  const [importPick, setImportPick] = useState<'all' | ImportSourceId>('all')
  const [rowChecked, setRowChecked] = useState<Record<ImportCategoryId, boolean>>({} as Record<ImportCategoryId, boolean>)
  const [busy, setBusy] = useState<'scan' | 'import' | 'revert' | null>('scan')
  const [phase, setPhase] = useState<Phase>('list')
  const [notice, setNotice] = useState('')
  const [lastBatch, setLastBatch] = useState<ImportBatchSummary | null>(null)
  const [confirmRevert, setConfirmRevert] = useState<ImportBatchSummary | null>(null)

  const detected = useMemo(() => (preview?.sources || [])
    .filter((source) => source.detected && source.compatibility !== 'unsupported')
    .sort((left, right) => SOURCE_ORDER.indexOf(left.id) - SOURCE_ORDER.indexOf(right.id)), [preview])

  const columns = useMemo(() => {
    if (importPick === 'all') return detected
    return detected.filter((source) => source.id === importPick)
  }, [detected, importPick])

  const refresh = async () => {
    setBusy('scan')
    setNotice('')
    setPhase('list')
    const [scan, imported] = await Promise.all([api.scanExternalImports(), api.getExternalImportHistory()])
    if (!scan.success || !scan.preview) {
      setNotice(scan.error || '扫描失败，请稍后重试')
      setBusy(null)
      return
    }
    setPreview(scan.preview)
    const nextDetected = scan.preview.sources
      .filter((source) => source.detected && source.compatibility !== 'unsupported')
      .sort((left, right) => SOURCE_ORDER.indexOf(left.id) - SOURCE_ORDER.indexOf(right.id))
    setImportPick(nextDetected.length === 1 ? nextDetected[0].id : 'all')
    const cols = nextDetected.length === 1 ? nextDetected : nextDetected
    const nextChecked = {} as Record<ImportCategoryId, boolean>
    for (const row of CATEGORY_ROWS) nextChecked[row.id] = rowHasData(row, cols)
    setRowChecked(nextChecked)
    if (imported.success && imported.catalog) {
      setHistory(imported.catalog.batches)
      try {
        mergeImportedData(imported.catalog.projects, imported.catalog.sessions)
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '已导入资料暂时无法加入侧边栏')
        setBusy(null)
        return
      }
    }
    setNotice(nextDetected.length
      ? (categoriesIncomplete(nextDetected)
        ? '扫描结果不完整：请完全退出并重新启动应用（主进程需重启后 MCP/Skills 等才会显示）'
        : '')
      : '未发现可导入的配置')
    setBusy(null)
  }

  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    setRowChecked(() => {
      const next = {} as Record<ImportCategoryId, boolean>
      for (const row of CATEGORY_ROWS) next[row.id] = rowHasData(row, columns)
      return next
    })
  }, [columns])

  const selectedCategories = CATEGORY_ROWS.filter((row) => rowChecked[row.id] && rowHasData(row, columns)).map((row) => row.id)
  const canImport = columns.length > 0 && selectedCategories.length > 0

  const conflictAuthority = useMemo(() => {
    if (columns.length <= 1) return undefined
    const countsBySource = new Map(columns.map((source) => [source.id, countsOf(source)]))
    return pickConflictAuthority(columns.map((source) => source.id), selectedCategories, countsBySource)
  }, [columns, selectedCategories])

  const startImport = async () => {
    if (!canImport) return
    setBusy('import')
    setPhase('importing')
    setNotice('正在导入配置…')
    const response = await api.commitExternalImports({
      sources: columns.map((source) => source.id),
      categories: selectedCategories
    })
    if (!response.success || !response.result) {
      setNotice(response.error || '导入失败，原有配置没有变化')
      setPhase('list')
      setBusy(null)
      return
    }
    try {
      mergeImportedData(response.result.projects, response.result.sessions)
      await reconcileSessions({ full: true })
      const batch = response.result.batch
      setLastBatch(batch)
      setHistory((current) => [batch, ...current.filter((item) => item.id !== batch.id)])
      setPhase('done')
      setNotice(response.warning || '')
    } catch (error) {
      setNotice(`${error instanceof Error ? error.message : '侧边栏更新失败'}。资料已保存，重新打开此页面会自动补齐。`)
      setPhase('done')
    }
    setBusy(null)
  }

  const revert = async (batch: ImportBatchSummary) => {
    setBusy('revert')
    const currentById = new Map(sessions.map((session) => [session.id, session]))
    const protectedIds = batch.createdSessionIds.filter((id) => {
      const session = currentById.get(id)
      return Boolean(session && session.updatedAt > (batch.completedAt || batch.createdAt))
    })
    const response = await api.revertExternalImport(batch.id, protectedIds)
    if (!response.success || !response.result) setNotice(response.error || '撤销失败')
    else {
      removeImportedData(response.result.batch.createdProjectIds, response.result.batch.createdSessionIds)
      setHistory((current) => current.map((item) => item.id === batch.id ? response.result!.batch : item))
      setLastBatch(null)
      setPhase('list')
      setNotice(protectedIds.length
        ? `已撤销本次导入，其余 ${protectedIds.length} 个后来继续过的对话已保留`
        : '已撤销本次导入')
    }
    setConfirmRevert(null)
    setBusy(null)
  }

  const totalProjects = columns.reduce((sum, source) => sum + countsOf(source).projectChatProjects, 0)
  const totalConversations = columns.reduce((sum, source) => sum + countsOf(source).projectChatConversations, 0)
  const projectCountLabel = Math.max(...columns.map((source) => countsOf(source).projectChatProjects), 0)

  if (busy === 'scan') {
    return (
      <section className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <LoaderCircle size={28} className="animate-spin text-[var(--whale-blue)]" />
        <p className="mt-4 text-[13px] text-[var(--ink-soft)]">正在扫描可导入的配置…</p>
      </section>
    )
  }

  if (phase === 'importing') {
    return (
      <section className="py-16 text-center">
        <h3 className="text-[17px] font-semibold tracking-tight text-[var(--ink)]">正在导入…</h3>
        <p className="mt-2 text-[13px] text-[var(--ink-soft)]">请勿关闭窗口</p>
        <div className="mx-auto mt-5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-black/[0.06]">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-[var(--whale-blue)]" />
        </div>
        <p className="mt-3 flex items-center justify-center gap-2 text-[12px] text-[var(--ink-soft)]">
          <LoaderCircle size={14} className="animate-spin" />
          {notice || '写入规则与记忆…'}
        </p>
      </section>
    )
  }

  if (phase === 'done' && lastBatch) {
    return (
      <section className="mx-auto max-w-sm py-10 text-center">
        <h3 className="text-[17px] font-semibold tracking-tight text-[var(--ink)]">导入完成</h3>
        <p className="mt-2 text-[13px] text-[var(--ink-soft)]">配置已写入，可在侧边栏续聊</p>
        <div className="mt-5">
          <SettingsGroup>
            <div className="flex items-center justify-between px-3.5 py-2.5 text-[13px] border-b border-[var(--settings-sep)]">
              <span className="text-[var(--ink)]">项目与对话</span>
              <span className="tabular-nums text-[var(--ink-secondary)]">{totalProjects} · {totalConversations}</span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 text-[13px] border-b border-[var(--settings-sep)]">
              <span className="text-[var(--ink)]">规则 / 记忆 / Skills</span>
              <span className="text-[var(--ink-secondary)]">已导入</span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 text-[13px]">
              <span className="text-[var(--ink)]">MCP 连接</span>
              <span className="text-[var(--ink-secondary)]">已导入</span>
            </div>
          </SettingsGroup>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink-soft)]">
          可在侧边栏打开导入项目续聊。MCP 与 Skills 需在设置中确认后启用。
        </p>
        {columns.length > 1 && conflictAuthority && (
          <p className="mt-2 text-[11px] text-[var(--ink-soft)]">
            冲突项已按 {columns.find((item) => item.id === conflictAuthority)?.name || conflictAuthority} 保留
          </p>
        )}
        {notice && <p className="mt-2 text-[11px] text-[var(--ink-soft)]">{notice}</p>}
        <div className="mt-5 flex flex-col gap-2">
          <SettingsPrimaryButton onClick={() => setPhase('list')} className="w-full">
            完成
          </SettingsPrimaryButton>
          <SettingsGhostButton
            tone="danger"
            onClick={() => setConfirmRevert(lastBatch)}
            disabled={busy !== null || lastBatch.status !== 'completed'}
          >
            撤销本次导入
          </SettingsGhostButton>
        </div>
        {confirmRevert && (
          <RevertModal
            onCancel={() => setConfirmRevert(null)}
            onConfirm={() => void revert(confirmRevert)}
            busy={busy === 'revert'}
          />
        )}
      </section>
    )
  }

  return (
    <section>
      <SettingsPageHeader
        title={columns.length === 1 ? `从 ${columns[0].name} 导入` : '导入配置'}
        subtitle={
          columns.length === 1
            ? '勾选要迁移的内容，确认后一键导入'
            : '勾选后导入；冲突项按所选来源保留'
        }
        action={
          <SettingsGhostButton onClick={() => void refresh()} disabled={busy !== null} tone="accent">
            重新扫描
          </SettingsGhostButton>
        }
      />

      {detected.length > 1 && (
        <div className="mb-4">
          <SettingsSegmented<'all' | ImportSourceId>
            value={importPick}
            options={[
              { id: 'all', label: `${detected.length} 个都导入` },
              ...detected.map((source) => ({ id: source.id as ImportSourceId, label: source.name }))
            ]}
            onChange={(v) => setImportPick(v)}
          />
        </div>
      )}

      {detected.length === 0 && busy === null && (
        <SettingsEmpty title="未发现可导入的配置" hint="安装过 Codex、Claude Code 或 Cursor 后会出现在这里" />
      )}

      {detected.length > 0 && (
        <>
          <MatrixBlock
            title="全局"
            rows={CATEGORY_ROWS.filter((row) => row.group === 'global')}
            columns={columns}
            rowChecked={rowChecked}
            onToggle={(id) => setRowChecked((current) => ({ ...current, [id]: !current[id] }))}
            onSelectAll={(ids, value) => setRowChecked((current) => {
              const next = { ...current }
              for (const id of ids) if (rowHasData(CATEGORY_ROWS.find((row) => row.id === id)!, columns)) next[id] = value
              return next
            })}
          />
          <MatrixBlock
            title={`项目（${projectCountLabel}）`}
            rows={CATEGORY_ROWS.filter((row) => row.group === 'project')}
            columns={columns}
            rowChecked={rowChecked}
            onToggle={(id) => setRowChecked((current) => ({ ...current, [id]: !current[id] }))}
          />

          {columns.length > 1 && conflictAuthority && (
            <div className="mt-4">
              <SettingsGroup footer="在已勾选项中，配置数量最多的来源优先保留 MCP 与 Skills；项目规则全部保留。">
                <div className="px-3.5 py-2.5 text-[13px]">
                  <span className="text-[var(--ink-soft)]">冲突时优先保留</span>
                  <span className="ml-2 font-medium text-[var(--ink)]">
                    {columns.find((item) => item.id === conflictAuthority)?.name || conflictAuthority}
                  </span>
                </div>
              </SettingsGroup>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--settings-sep)] pt-4">
            <p className="text-[12px] text-[var(--ink-soft)]">
              {canImport
                ? `已选 ${totalProjects} 个项目 · ${totalConversations} 条对话`
                : '请至少勾选一项'}
            </p>
            <SettingsPrimaryButton onClick={() => void startImport()} disabled={busy !== null || !canImport}>
              {busy === 'import' && <LoaderCircle size={14} className="animate-spin" />}
              一键导入所选
            </SettingsPrimaryButton>
          </div>
        </>
      )}

      {notice && phase === 'list' && <p className="mt-3 text-[12px] text-[var(--ink-soft)]">{notice}</p>}

      {history.length > 0 && (
        <div className="mt-7">
          <SettingsSectionLabel>
            <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
              <History size={12} /> 导入记录
            </span>
          </SettingsSectionLabel>
          <SettingsGroup>
            {history.slice(0, 8).map((batch, index, list) => (
              <div
                key={batch.id}
                className={`flex items-center gap-3 px-3.5 py-2.5 ${
                  index < list.length - 1 ? 'border-b border-[var(--settings-sep)]' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-[var(--ink)]">
                    {new Date(batch.completedAt || batch.createdAt).toLocaleString('zh-CN')}
                    {batch.sources?.length ? ` · ${batch.sources.length} 个来源` : ''}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--ink-soft)]">
                    新增 {batch.createdSessionIds.length} · 更新 {batch.updatedSessionIds.length} · 跳过 {batch.skippedSessionIds.length}
                  </div>
                </div>
                {batch.status === 'completed' && (
                  <SettingsGhostButton
                    tone="danger"
                    onClick={() => setConfirmRevert(batch)}
                    disabled={busy !== null}
                  >
                    <RotateCcw size={12} />
                    撤销
                  </SettingsGhostButton>
                )}
                {batch.status === 'reverted' && (
                  <span className="shrink-0 text-[11px] text-[var(--ink-soft)]">已撤销</span>
                )}
              </div>
            ))}
          </SettingsGroup>
        </div>
      )}

      {confirmRevert && (
        <RevertModal
          onCancel={() => setConfirmRevert(null)}
          onConfirm={() => void revert(confirmRevert)}
          busy={busy === 'revert'}
        />
      )}
    </section>
  )
}

function MatrixBlock({
  title,
  rows,
  columns,
  rowChecked,
  onToggle,
  onSelectAll
}: {
  title: string
  rows: typeof CATEGORY_ROWS
  columns: ImportSourceSummary[]
  rowChecked: Record<ImportCategoryId, boolean>
  onToggle: (id: ImportCategoryId) => void
  onSelectAll?: (ids: ImportCategoryId[], value: boolean) => void
}) {
  const multi = columns.length > 1
  return (
    <div className="mt-4">
      <SettingsSectionLabel
        action={
          onSelectAll ? (
            <div className="flex gap-2">
              <SettingsGhostButton tone="accent" onClick={() => onSelectAll(rows.map((row) => row.id), true)}>
                全选
              </SettingsGhostButton>
              <SettingsGhostButton onClick={() => onSelectAll(rows.map((row) => row.id), false)}>
                全不选
              </SettingsGhostButton>
            </div>
          ) : undefined
        }
      >
        {title}
      </SettingsSectionLabel>
      <div className="overflow-x-auto rounded-xl bg-[var(--settings-group-bg)]">
        <table className="w-full min-w-[420px] text-[13px]">
          {multi && (
            <thead>
              <tr className="text-[11px] text-[var(--ink-soft)]">
                <th className="min-w-[9.5rem] whitespace-nowrap px-3.5 py-2 text-left font-medium" />
                {columns.map((source) => (
                  <th key={source.id} className="whitespace-nowrap px-3.5 py-2 text-left font-medium">
                    {source.name}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, index) => {
              const available = rowHasData(row, columns)
              const checked = available && rowChecked[row.id]
              const last = index === rows.length - 1
              return (
                <tr
                  key={row.id}
                  className={`${available ? '' : 'opacity-45'} ${last ? '' : 'border-b border-[var(--settings-sep)]'}`}
                >
                  <td className="min-w-[9.5rem] px-3.5 py-2.5">
                    <button
                      type="button"
                      disabled={!available}
                      onClick={() => available && onToggle(row.id)}
                      className="flex items-center gap-2.5 disabled:cursor-not-allowed"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? 'border-[var(--whale-blue)] bg-[var(--whale-blue)] text-white'
                            : 'border-black/20 bg-[var(--paper)]'
                        } ${!available ? 'border-black/10 bg-black/[0.04]' : ''}`}
                      >
                        {checked && <Check size={10} strokeWidth={3} />}
                      </span>
                      <span className={`font-medium text-[var(--ink)] ${row.nowrap ? 'whitespace-nowrap' : ''}`}>
                        {row.label}
                      </span>
                    </button>
                  </td>
                  {columns.map((source) => {
                    const value = cellValue(row, source)
                    return (
                      <td
                        key={source.id}
                        className={`whitespace-nowrap px-3.5 py-2.5 tabular-nums ${
                          value == null ? 'text-[var(--ink-soft)]/50' : 'text-[var(--ink)]'
                        }`}
                      >
                        {value == null ? '—' : value}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RevertModal({ onCancel, onConfirm, busy }: { onCancel: () => void; onConfirm: () => void; busy: boolean }) {
  return (
    <SettingsConfirmModal
      title="撤销本次导入？"
      body="将移除本批写入的规则、记忆、连接、Skills 与对话。你后来继续聊过的对话会保留。"
      confirmLabel={busy ? '撤销中…' : '撤销'}
      busy={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
