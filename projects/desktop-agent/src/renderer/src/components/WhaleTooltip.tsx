import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
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

const EDGE = 12
const MAX_WIDTH = 360

function labelIsLong(label: ReactNode): boolean {
  return typeof label === 'string' && label.length > 48
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
  const tipRef = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ left: 0, top: 0 })
  const long = labelIsLong(label)

  const place = useCallback(() => {
    const anchor = anchorRef.current
    const tip = tipRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const tipWidth = tip?.offsetWidth || Math.min(MAX_WIDTH, window.innerWidth - EDGE * 2)
    const tipHeight = tip?.offsetHeight || 28

    let left =
      align === 'left'
        ? rect.left
        : align === 'right'
          ? rect.right - tipWidth
          : rect.left + rect.width / 2 - tipWidth / 2

    left = Math.max(EDGE, Math.min(left, window.innerWidth - tipWidth - EDGE))

    let top = side === 'bottom' ? rect.bottom + 6 : rect.top - tipHeight - 6
    if (top < EDGE) top = rect.bottom + 6
    if (top + tipHeight > window.innerHeight - EDGE) {
      top = Math.max(EDGE, rect.top - tipHeight - 6)
    }

    setCoords({ left, top })
  }, [align, side])

  useLayoutEffect(() => {
    if (!visible) return
    place()
  }, [visible, label, place])

  useEffect(() => {
    if (!visible) return
    const onReposition = () => place()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [place, visible])

  if (disabled || !label) return children

  return (
    <span
      ref={anchorRef}
      className={`relative inline-flex min-w-0 ${className}`}
      aria-describedby={visible ? tooltipId : undefined}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocusCapture={() => setVisible(true)}
      onBlurCapture={() => setVisible(false)}
    >
      {children}
      {createPortal(
        <span
          ref={tipRef}
          id={tooltipId}
          className={`pointer-events-none fixed z-[9999] rounded-lg floating-tooltip px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg transition-opacity duration-150 ${
            long ? 'break-all whitespace-pre-wrap leading-snug' : 'whitespace-nowrap leading-none'
          } ${visible ? 'opacity-100' : 'opacity-0'}`}
          style={{
            left: coords.left,
            top: coords.top,
            maxWidth: `min(${MAX_WIDTH}px, calc(100vw - ${EDGE * 2}px))`,
            maxHeight: long ? 160 : undefined,
            overflow: long ? 'auto' : undefined
          }}
          role="tooltip"
        >
          {label}
        </span>,
        document.body
      )}
    </span>
  )
}
