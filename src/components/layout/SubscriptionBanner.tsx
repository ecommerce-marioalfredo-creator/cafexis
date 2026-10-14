import { useSubscription } from '@/hooks/useSubscription'
import './SubscriptionBanner.css'

const MS_PER_DAY = 1000 * 60 * 60 * 24

function daysUntil(dateIso: string): number {
  return Math.ceil((new Date(dateIso).getTime() - Date.now()) / MS_PER_DAY)
}

/**
 * Aviso de período de prueba o vencimiento, en la parte superior del panel
 * (Fase 6). El bloqueo real de acceso cuando la suscripción ya venció lo
 * hace RequireAuth.tsx, redirigiendo a /suscripcion-vencida; este banner es
 * solo el aviso preventivo mientras el negocio todavía puede operar.
 */
export function SubscriptionBanner() {
  const { subscription, loading } = useSubscription()

  if (loading || !subscription || !subscription.isActive) return null

  if (subscription.status === 'trial' && subscription.trialEndsAt) {
    const days = daysUntil(subscription.trialEndsAt)
    if (days > 7) return null // avisa solo cuando ya falta poco
    return (
      <div className="subscription-banner subscription-banner--trial">
        {days <= 0
          ? 'Tu período de prueba termina hoy.'
          : `Tu período de prueba termina en ${days} día${days === 1 ? '' : 's'}.`}
      </div>
    )
  }

  if (subscription.status === 'activa' && subscription.currentPeriodEndsAt) {
    const days = daysUntil(subscription.currentPeriodEndsAt)
    if (days > 7) return null
    return (
      <div className="subscription-banner subscription-banner--warning">
        {days <= 0 ? 'Tu suscripción vence hoy.' : `Tu suscripción vence en ${days} día${days === 1 ? '' : 's'}.`}
      </div>
    )
  }

  return null
}
