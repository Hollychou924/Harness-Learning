import type { ReactNode } from 'react'

export function RunningStatusText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`running-sweep-text ${className}`}>
      {children}
    </span>
  )
}
