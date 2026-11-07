import type { OrderNotification } from '@/types/domain'
import './CancellationAlerts.css'

const timeFormat = new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' })

interface CancellationAlertsProps {
  alerts: OrderNotification[]
  /** La consulta falló: se dice, porque no mostrar nada parecería que no hubo cancelaciones. */
  failed: boolean
}

/** Alerta roja del dashboard. Cada mensaje ya dice quién canceló (lo escribe cancel_order_cafexis). */
export function CancellationAlerts({ alerts, failed }: CancellationAlertsProps) {
  if (failed) {
    return <p className="form-error-banner cancellation-alerts__error">No se pudieron cargar las alertas de cancelación.</p>
  }
  if (alerts.length === 0) return null

  return (
    <section className="cancellation-alerts" role="alert">
      <h2 className="cancellation-alerts__title">
        <span aria-hidden="true">🚫</span> Pedidos cancelados hoy
      </h2>
      <ul className="cancellation-alerts__list">
        {alerts.map((alert) => (
          <li key={alert.id}>
            <span>{alert.message}</span>
            <time dateTime={alert.createdAt}>{timeFormat.format(new Date(alert.createdAt))}</time>
          </li>
        ))}
      </ul>
    </section>
  )
}
