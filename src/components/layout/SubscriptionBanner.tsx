import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePlan } from '@/context/PlanContext'
import { ADMIN_ROLES } from './roles'
import './SubscriptionBanner.css'

const MS_PER_DAY = 1000 * 60 * 60 * 24

function daysUntil(dateIso: string): number {
  return Math.ceil((new Date(dateIso).getTime() - Date.now()) / MS_PER_DAY)
}

const dayLabel = (days: number) => `${days} día${days === 1 ? '' : 's'}`

/**
 * Aviso en la parte superior del panel: la prueba o el plan están por
 * terminar, o ya terminaron y el negocio bajó a Básica (0019). Quien
 * administra tiene el enlace a Suscripción; el barista solo ve el aviso.
 */
export function SubscriptionBanner() {
  const { plan, loading } = usePlan()
  const { user } = useAuth()

  if (loading || !plan || !plan.isActive) return null

  const link = user && ADMIN_ROLES.includes(user.role) && (
    <>
      {' '}
      <Link to="/suscripcion" className="subscription-banner__link">
        Ver planes
      </Link>
    </>
  )

  if (plan.lapsed) {
    return (
      <div className="subscription-banner subscription-banner--warning">
        {plan.status === 'trial' ? `Terminó tu prueba de ${plan.planName}` : `Tu plan ${plan.planName} venció`}: ahora
        estás en {plan.effectivePlanName}.{link}
      </div>
    )
  }

  if (plan.status === 'trial' && plan.trialEndsAt) {
    const days = daysUntil(plan.trialEndsAt)
    if (days > 7) return null // avisa solo cuando ya falta poco
    return (
      <div className="subscription-banner subscription-banner--trial">
        {days <= 0
          ? `Tu prueba de ${plan.planName} termina hoy.`
          : `Tu prueba de ${plan.planName} termina en ${dayLabel(days)}.`}{' '}
        Después pasas a Básica.{link}
      </div>
    )
  }

  if (plan.status === 'activa' && plan.currentPeriodEndsAt) {
    const days = daysUntil(plan.currentPeriodEndsAt)
    if (days > 7) return null
    return (
      <div className="subscription-banner subscription-banner--warning">
        {days <= 0 ? `Tu plan ${plan.planName} vence hoy.` : `Tu plan ${plan.planName} vence en ${dayLabel(days)}.`}
        {link}
      </div>
    )
  }

  return null
}
