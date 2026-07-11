import { useEffect, useMemo, useState } from 'react'
import { Check, History, LoaderCircle, RotateCcw } from 'lucide-react'
import { api, type ImportBatchSummary, type ImportPreview, type ImportSourceId, type ImportSourceSummary } from '../../../api'
import { useTaskStore } from '../../../store/task'
import { loadImportReminderPreferences, saveImportReminderPreferences } from '../../../importPreferences'

const SOURCE_ORDER: ImportSourceId[] = ['codex', 'claude-code', 'cursor']

function countText(source: ImportSourceSummary): string {
  const parts = [`${source.projects} 个项目`, `${source.conversations} 个对话`]
  if (source.viewOnlyConversations) parts.push(`${source.viewOnlyConversations} 个正文可用但过程缺失`)
  if (source.failedConversations) parts.push(`${source.failedConversations} 项无法读取`)
  return parts.join(' · ')
}

export function ImportSection() {
  const mergeImportedData = useTaskStore((state) => state.mergeImportedData)
  const removeImportedData = useTaskStore((state) => state.removeImportedData)
  const sessions = useTaskStore((state) => state.sessions)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [selected, setSelected] = useState<ImportSourceId[]>([])
  const [history, setHistory] = useState<ImportBatchSummary[]>([])
  const [includeInstructions, setIncludeInstructions] = useState(true)
  const [includeExtensions, setIncludeExtensions] = useState(false)
  const [busy, setBusy] = useState<'scan' | 'import' | 'revert' | null>('scan')
  const [notice, setNotice] = useState('正在检查本机资料...')
  const [remindersEnabled, setRemindersEnabled] = useState(() => loadImportReminderPreferences().enabled)

  const detected = useMemo(() => (preview?.sources || [])
    .filter((source) => source.detected)
    .sort((left, right) => SOURCE_ORDER.indexOf(left.id) - SOURCE_ORDER.indexOf(right.id)), [preview])

  const refresh = async () => {
    setBusy('scan')
    setNotice('正在检查本机资料...')
    const [scan, imported] = await Promise.all([api.scanExternalImports(), api.getExternalImportHistory()])
    if (!scan.success || !scan.preview) {
      setNotice(scan.error || '检查失败，请稍后重试')
      setBusy(null)
      return
    }
    setPreview(scan.preview)
    setSelected(scan.preview.sources.filter((source) => source.detected && source.compatibility !== 'unsupported').map((source) => source.id))
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
    setNotice(scan.preview.sources.some((source) => source.detected) ? '' : '没有发现可导入的本机资料')
    setBusy(null)
  }

  useEffect(() => { void refresh() }, [])

  const toggleSource = (id: ImportSourceId) => {
    setSelected((current) => current.includes(id)
      ? (current.length > 1 ? current.filter((item) => item !== id) : current)
      : [...current, id])
  }

  const startImport = async () => {
    if (selected.length === 0) return
    setBusy('import')
    setNotice('正在导入，原有资料不会被覆盖...')
    const response = await api.commitExternalImports({
      sources: selected,
      includeProjectsAndConversations: true,
      includeInstructionsAndMemory: includeInstructions,
      includeExtensions
    })
    if (!response.success || !response.result) {
      setNotice(response.error || '导入失败，原有资料没有变化')
      setBusy(null)
      return
    }
    try {
      mergeImportedData(response.result.projects, response.result.sessions)
      const batch = response.result.batch
      setHistory((current) => [batch, ...current.filter((item) => item.id !== batch.id)])
      const partial = batch.failed.filter((item) => item.severity === 'partial').length
      const failed = batch.failed.filter((item) => item.severity !== 'partial').length
      setNotice(response.warning || `导入完成：新增 ${batch.createdSessionIds.length} 个，更新 ${batch.updatedSessionIds.length} 个，跳过重复 ${batch.skippedSessionIds.length} 个${partial ? `，${partial} 个正文可用但过程缺失` : ''}${failed ? `，${failed} 项无法读取` : ''}`)
    } catch (error) {
      setNotice(`${error instanceof Error ? error.message : '侧边栏更新失败'}。资料已经安全保存，重新打开此页面会自动补齐。`)
    }
    setBusy(null)
  }

  const revert = async (batch: ImportBatchSummary) => {
    if (!confirm('撤回这一批导入？你后来继续过的对话会保留。')) return
    setBusy('revert')
    const currentById = new Map(sessions.map((session) => [session.id, session]))
    const protectedIds = batch.createdSessionIds.filter((id) => {
      const session = currentById.get(id)
      return Boolean(session && session.updatedAt > (batch.completedAt || batch.createdAt))
    })
    const response = await api.revertExternalImport(batch.id, protectedIds)
    if (!response.success || !response.result) setNotice(response.error || '撤回失败')
    else {
      removeImportedData(response.result.batch.createdProjectIds, response.result.batch.createdSessionIds)
      setHistory((current) => current.map((item) => item.id === batch.id ? response.result!.batch : item))
      setNotice(protectedIds.length ? `已撤回，其余 ${protectedIds.length} 个后来继续过的对话已保留` : '已撤回这批导入')
    }
    setBusy(null)
  }

  return (
    <section>
      <header className="mb-5">
        <h3 className="text-lg font-semibold text-[var(--ink)]">导入资料</h3>
        <p className="text-sm text-[var(--ink-soft)] mt-1">从本机的其他开发工具迁移项目和历史对话</p>
      </header>

      <div className="space-y-3">
        {detected.map((source) => {
          const checked = selected.includes(source.id)
          const disabled = source.compatibility === 'unsupported'
          return (
            <button key={source.id} disabled={disabled || busy !== null} onClick={() => toggleSource(source.id)}
              className={`w-full border px-4 py-3 text-left rounded-lg transition ${checked ? 'border-[#0071e3] bg-blue-500/[0.06]' : 'border-black/[0.10] hover:bg-black/[0.03]'} ${disabled ? 'opacity-55' : ''}`}>
              <div className="flex items-center gap-3">
                <span className={`w-5 h-5 flex items-center justify-center rounded border ${checked ? 'bg-[#0071e3] border-[#0071e3] text-white' : 'border-black/20'}`}>
                  {checked && <Check size={13} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
                    {source.name}{source.version && <span className="text-[11px] font-normal text-[var(--ink-soft)]">{source.version}</span>}
                  </span>
                  <span className="block text-xs text-[var(--ink-soft)] mt-0.5">{countText(source)}</span>
                  {(source.instructions || source.memories || source.historySummaries || source.extensions) > 0 && <span className="block text-[11px] text-[var(--ink-soft)] mt-1">
                    {[
                      source.instructions ? `${source.instructions} 份说明` : '',
                      source.memories ? `${source.memories} 份记忆` : '',
                      source.historySummaries ? `${source.historySummaries} 份历史摘要` : '',
                      source.extensions ? `${source.extensions} 项扩展与自动设置` : ''
                    ].filter(Boolean).join(' · ')}
                  </span>}
                  {source.note && <span className="block text-[11px] text-[var(--ink-soft)] mt-1">{source.note}</span>}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {detected.length > 0 && (
        <div className="mt-5 border-t border-black/[0.08] pt-4 space-y-3">
          <Option label="项目和对话" detail="始终导入，重复内容会自动跳过" checked disabled onChange={() => {}} />
          <Option label="项目说明、记忆和历史摘要" detail="分别保存，不直接改变现有规则" checked={includeInstructions} onChange={setIncludeInstructions} />
          <Option label="扩展与自动设置" detail="包含能力扩展、外部连接、自动动作和子助手，导入后保持关闭" checked={includeExtensions} onChange={setIncludeExtensions} />
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button onClick={() => void startImport()} disabled={busy !== null || selected.length === 0}
          className="h-9 px-4 rounded-lg bg-[#0071e3] text-white text-sm font-medium disabled:opacity-45 flex items-center gap-2">
          {busy === 'import' && <LoaderCircle size={14} className="animate-spin" />}
          {history.some((batch) => batch.status === 'completed') ? '检查新增资料' : '开始导入'}
        </button>
        <button onClick={() => void refresh()} disabled={busy !== null} className="h-9 px-3 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-45">重新检查</button>
      </div>
      {notice && <p className="mt-3 text-xs text-[var(--ink-soft)]">{notice}</p>}

      <div className="mt-6 border-t border-black/[0.08] pt-4">
        <Option label="发现新增资料时提醒" detail="只在空闲时提醒，软件升级本身不会触发" checked={remindersEnabled} onChange={(enabled) => {
          const preferences = loadImportReminderPreferences()
          saveImportReminderPreferences({ ...preferences, enabled })
          setRemindersEnabled(enabled)
        }} />
      </div>

      {history.length > 0 && (
        <div className="mt-7 border-t border-black/[0.08] pt-4">
          <div className="flex items-center gap-2 mb-2 text-sm font-medium text-[var(--ink)]"><History size={15} />导入记录</div>
          {history.slice(0, 8).map((batch) => (
            <div key={batch.id} className="flex items-center gap-3 py-2.5 border-b border-black/[0.06] last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[var(--ink)]">{new Date(batch.completedAt || batch.createdAt).toLocaleString('zh-CN')}</div>
                <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">
                  新增 {batch.createdSessionIds.length} · 更新 {batch.updatedSessionIds.length} · 跳过 {batch.skippedSessionIds.length}
                  {batch.failed.filter((item) => item.severity === 'partial').length > 0 && ` · 正文可用 ${batch.failed.filter((item) => item.severity === 'partial').length}`}
                  {batch.failed.filter((item) => item.severity !== 'partial').length > 0 && ` · 无法读取 ${batch.failed.filter((item) => item.severity !== 'partial').length}`}
                </div>
              </div>
              {batch.status === 'completed' && <button title="撤回这批导入" onClick={() => void revert(batch)} disabled={busy !== null} className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--ink-soft)] hover:bg-black/[0.06]"><RotateCcw size={14} /></button>}
              {batch.status === 'reverted' && <span className="text-[11px] text-[var(--ink-soft)]">已撤回</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Option({ label, detail, checked, disabled, onChange }: { label: string; detail: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <label className={`flex items-center gap-3 ${disabled ? 'opacity-65' : 'cursor-pointer'}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="accent-[#0071e3]" />
    <span className="flex-1"><span className="block text-sm text-[var(--ink)]">{label}</span><span className="block text-xs text-[var(--ink-soft)]">{detail}</span></span>
  </label>
}
