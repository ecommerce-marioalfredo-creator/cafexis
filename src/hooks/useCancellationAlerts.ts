import { useEffect } from 'react'
import { useAsync } from './useAsync'
import { DASHBOARD_POLL_MS } from './useDashboardData'
import { listBusinessNotifications, onNotificationsChanged } from '@/services/api/notificationsService'

/**
 * Cancelaciones de hoy para las alertas del dashboard. No depende de `readAt`: ese
 * estado se comparte entre todo el personal, y si una persona abre la campana las
 * alertas desaparecerían para las demás. Todos los avisos del negocio son cancelaciones.
 */
export function useCancellationAlerts() {
  const { data, error, refresh } = useAsync(listBusinessNotifications, [], { pollMs: DASHBOARD_POLL_MS })

  // Quien cancela desde esta pestaña ve la alerta enseguida, sin esperar el siguiente minuto.
  useEffect(() => onNotificationsChanged(() => void refresh()), [refresh])

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  return {
    alerts: (data ?? []).filter((n) => new Date(n.createdAt) >= startOfToday),
    failed: Boolean(error),
  }
}
