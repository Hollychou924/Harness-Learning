import type { ReactNode } from 'react'

/** 页面标题：大标题 + 可选副标题 + 右侧操作 */
export function SettingsPageHeader({
  title,
  subtitle,
  action
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[17px] font-semibold tracking-tight text-[var(--ink)]">{title}</h3>
        {subtitle && (
          <div className="mt-1 text-[12px] leading-relaxed text-[var(--ink-soft)]">{subtitle}</div>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  )
}

/** Apple 风格分组卡片 */
export function SettingsGroup({
  children,
  footer,
  className = ''
}: {
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <div className="overflow-hidden rounded-xl bg-[var(--settings-group-bg)]">
        {children}
      </div>
      {footer && (
        <div className="mt-1.5 px-1 text-[11px] leading-relaxed text-[var(--ink-soft)]">{footer}</div>
      )}
    </div>
  )
}

/** 分组上方小标题 */
export function SettingsSectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
      <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-soft)]">
        {children}
      </div>
      {action}
    </div>
  )
}

export function SettingsRow({
  label,
  children,
  last,
  stacked,
  onClick
}: {
  label: ReactNode
  children?: ReactNode
  last?: boolean
  stacked?: boolean
  onClick?: () => void
}) {
  const border = last ? '' : 'border-b border-[var(--settings-sep)]'
  if (stacked) {
    return (
      <div className={`px-3.5 py-2.5 ${border}`}>
        <div className="mb-1.5 text-[13px] text-[var(--ink-soft)]">{label}</div>
        {children}
      </div>
    )
  }

  const inner = (
    <>
      <div className="min-w-0 text-[13px] text-[var(--ink)]">{label}</div>
      {children != null && <div className="min-w-0 flex justify-end text-[var(--ink-secondary)]">{children}</div>}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-[var(--settings-row-hover)] ${border}`}
      >
        {inner}
      </button>
    )
  }

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2.5 ${border}`}>
      {inner}
    </div>
  )
}

export function SettingsToggle({
  checked,
  onChange,
  disabled
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[40px] flex-shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-[var(--whale-blue)]' : 'bg-[var(--settings-toggle-off)]'
      }`}
    >
      <span
        className={`absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export function SettingsSegmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: Array<{ id: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg bg-[var(--settings-segment-bg)] p-0.5">
      {options.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`h-7 rounded-md px-2.5 text-[12px] transition ${
              active
                ? 'bg-[var(--settings-segment-thumb)] font-medium text-[var(--ink)] shadow-sm'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function SettingsEmpty({
  icon,
  title,
  hint
}: {
  icon?: ReactNode
  title: string
  hint?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      {icon && <div className="mb-3 text-[var(--ink-soft)]/50">{icon}</div>}
      <p className="text-[13px] text-[var(--ink-soft)]">{title}</p>
      {hint && <p className="mt-1 text-[11px] text-[var(--ink-secondary)]">{hint}</p>}
    </div>
  )
}

export function SettingsConfirmModal({
  title,
  body,
  confirmLabel = '确认',
  confirmTone = 'danger',
  busy,
  onCancel,
  onConfirm
}: {
  title: string
  body: ReactNode
  confirmLabel?: string
  confirmTone?: 'danger' | 'primary'
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl floating-surface p-5 shadow-xl">
        <h4 className="text-[15px] font-semibold text-[var(--ink)]">{title}</h4>
        <div className="mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">{body}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-9 rounded-lg px-3.5 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--settings-row-hover)] disabled:opacity-45"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`h-9 rounded-lg px-3.5 text-[13px] font-semibold text-white disabled:opacity-45 ${
              confirmTone === 'danger' ? 'bg-[#ff453a]' : 'bg-[var(--whale-blue)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SettingsGhostButton({
  children,
  onClick,
  disabled,
  tone = 'default'
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  tone?: 'default' | 'danger' | 'accent'
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-[#ff453a] hover:bg-[rgba(255,69,58,0.12)]'
      : tone === 'accent'
        ? 'text-[var(--whale-blue)] hover:bg-[var(--whale-blue-soft)]'
        : 'text-[var(--ink-soft)] hover:bg-[var(--settings-row-hover)] hover:text-[var(--ink)]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium transition disabled:opacity-40 ${toneClass}`}
    >
      {children}
    </button>
  )
}

export function SettingsPrimaryButton({
  children,
  onClick,
  disabled,
  className = ''
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--whale-blue)] px-4 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-45 ${className}`}
    >
      {children}
    </button>
  )
}

export const settingsInputClass =
  'w-full h-9 rounded-lg bg-[var(--settings-input-bg)] px-3 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)]/70 focus:ring-2 focus:ring-[var(--whale-blue)]/30'

export const settingsTextareaClass =
  'w-full min-h-[88px] rounded-lg bg-[var(--settings-input-bg)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none resize-none placeholder:text-[var(--ink-soft)]/70 focus:ring-2 focus:ring-[var(--whale-blue)]/30'

/** 设置内部分割线 / 列表行边框 */
export const settingsSepClass = 'border-[var(--settings-sep)]'
