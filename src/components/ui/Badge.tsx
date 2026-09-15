import type { ReactNode } from 'react'
import './Badge.css'

export type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

interface BadgeProps {
  tone: BadgeTone
  children: ReactNode
  icon?: ReactNode
}

/**
 * Insignia de estado. Design System sección 12: los estados siempre
 * combinan color + texto (nunca solo color) para accesibilidad.
 */
export function Badge({ tone, children, icon }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}`}>
      {icon}
      {children}
    </span>
  )
}
