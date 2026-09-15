import type { ReactNode } from 'react'
import './MetricCard.css'

interface MetricCardProps {
  label: string
  value: string
  hint?: string
  icon?: ReactNode
  tone?: 'default' | 'warning'
}

/**
 * Tarjeta de métrica para el dashboard (mockup: "Ventas de hoy",
 * "Pedidos activos", "Alertas de inventario"). Sección 10 Design System.
 */
export function MetricCard({ label, value, hint, icon, tone = 'default' }: MetricCardProps) {
  return (
    <div className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <span className="metric-card__label">{label}</span>
        {icon && <span className="metric-card__icon">{icon}</span>}
      </div>
      <strong className="metric-card__value">{value}</strong>
      {hint && <span className="metric-card__hint">{hint}</span>}
    </div>
  )
}
