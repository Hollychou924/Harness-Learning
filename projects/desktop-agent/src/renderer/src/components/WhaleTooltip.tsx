import type { ReactElement, ReactNode } from 'react'

type TooltipSide = 'top' | 'bottom'
type TooltipAlign = 'center' | 'left' | 'right'

interface WhaleTooltipProps {
  label: ReactNode
  children: ReactElement
  className?: string
  side?: TooltipSide
  align?: TooltipAlign
  disabled?: boolean
}

export function WhaleTooltip({
  label,
  children,
  className = '',
  side = 'top',
  align = 'center',
  disabled = false
}: WhaleTooltipProps) {
  if (disabled || !label) return children

  const sideClass = side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
  const alignClass = align === 'left'
    ? 'left-0'
    : align === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2'

  return (
    <span className={`relative inline-flex min-w-0 group/whale-tooltip ${className}`}>
      {children}
      <span className={`pointer-events-none absolute z-[9999] ${sideClass} ${alignClass} whitespace-nowrap rounded-md floating-tooltip px-2 py-1 text-[11px] font-medium leading-none text-white opacity-0 transition-opacity duration-150 group-hover/whale-tooltip:opacity-100 group-focus-within/whale-tooltip:opacity-100`}>
        {label}
      </span>
    </span>
  )
}
