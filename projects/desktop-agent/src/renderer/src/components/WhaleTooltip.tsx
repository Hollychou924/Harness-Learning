import { useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

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
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const updatePosition = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = align === 'left'
      ? rect.left
      : align === 'right'
        ? rect.right
        : rect.left + rect.width / 2
    const y = side === 'bottom' ? rect.bottom + 6 : rect.top - 6
    setPosition({ x, y })
  }, [align, side])

  useEffect(() => {
    if (!visible) return
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [updatePosition, visible])

  if (disabled || !label) return children

  const transform = [
    align === 'center' ? 'translateX(-50%)' : align === 'right' ? 'translateX(-100%)' : '',
    side === 'top' ? 'translateY(-100%)' : ''
  ].filter(Boolean).join(' ')

  return (
    <span
      ref={anchorRef}
      className={`relative inline-flex min-w-0 ${className}`}
      aria-describedby={visible ? tooltipId : undefined}
      onMouseEnter={() => {
        updatePosition()
        setVisible(true)
      }}
      onMouseLeave={() => setVisible(false)}
      onFocusCapture={() => {
        updatePosition()
        setVisible(true)
      }}
      onBlurCapture={() => setVisible(false)}
    >
      {children}
      {createPortal(
        <span
          id={tooltipId}
          className={`pointer-events-none fixed z-[9999] whitespace-nowrap rounded-md floating-tooltip px-2 py-1 text-[11px] font-medium leading-none text-white transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}
          style={{ left: position.x, top: position.y, transform }}
          role="tooltip"
        >
          {label}
        </span>,
        document.body
      )}
    </span>
  )
}
