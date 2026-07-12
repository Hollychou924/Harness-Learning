import { useDetailLevelStore, type DetailLevel } from './detailLevelStore'

const OPTIONS: Array<{ id: DetailLevel; label: string }> = [
  { id: 'normal', label: '正常' },
  { id: 'expandAll', label: '全部展开' },
  { id: 'conclusionOnly', label: '只看结论' }
]

/** 时间轴详细程度入口（M2.5） */
export function DetailLevelControl() {
  const { level, setLevel } = useDetailLevelStore()
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5 text-[11px]">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setLevel(opt.id)}
          className={`rounded-full px-2 py-0.5 transition ${
            level === opt.id
              ? 'bg-[var(--whale-blue)] text-white'
              : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
