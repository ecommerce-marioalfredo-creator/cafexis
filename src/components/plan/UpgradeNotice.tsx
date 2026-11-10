import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePlan } from '@/context/PlanContext'
import { ADMIN_ROLES } from '@/components/layout/roles'
import { FEATURE_PITCH, availableInLabel } from './planCatalog'
import type { PlanFeature } from '@/types/domain'
import '@/components/ui/Button.css'
import './UpgradeNotice.css'

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={['lock-icon', className].filter(Boolean).join(' ')} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

interface UpgradeNoticeProps {
  feature: PlanFeature
  /** 'page' ocupa la pantalla de un módulo bloqueado; 'inline' va dentro de una tarjeta o sección. */
  variant?: 'page' | 'inline'
  title?: string
  description?: string
}

/**
 * Aviso de función fuera del plan: dice qué se gana y en qué plan está, en
 * vez de esconder el módulo. Quien administra va a Suscripción; el barista
 * no tiene acceso a esa página, así que se le pide hablar con quien sí.
 */
export function UpgradeNotice({ feature, variant = 'inline', title, description }: UpgradeNoticeProps) {
  const { user } = useAuth()
  const pitch = FEATURE_PITCH[feature]
  const canManage = Boolean(user && ADMIN_ROLES.includes(user.role))
  const Heading = variant === 'page' ? 'h2' : 'h4'

  return (
    <div className={`upgrade-notice upgrade-notice--${variant}`}>
      <span className="upgrade-notice__badge">
        <LockIcon />
        {availableInLabel(feature)}
      </span>
      <Heading className="upgrade-notice__title">{title ?? pitch.title}</Heading>
      <p className="upgrade-notice__text">{description ?? pitch.description}</p>
      {canManage ? (
        <Link to="/suscripcion" className={`btn ${variant === 'page' ? 'btn--primary' : 'btn--secondary'}`}>
          Ver planes
        </Link>
      ) : (
        <p className="upgrade-notice__hint">Pídele a quien administra el negocio que cambie de plan.</p>
      )}
    </div>
  )
}

const RESOURCE_LABEL = { usuarios: 'usuarios del equipo', productos: 'productos', insumos: 'insumos' } as const

/**
 * Tope del plan alcanzado (productos, insumos o usuarios): lo que ya existe
 * se conserva y se sigue usando; solo no se pueden agregar más.
 */
export function LimitNotice({ resource }: { resource: keyof typeof RESOURCE_LABEL }) {
  const { plan } = usePlan()
  const { user } = useAuth()
  const max = plan?.limits[resource]
  if (!plan || max === undefined) return null
  const canManage = Boolean(user && ADMIN_ROLES.includes(user.role))

  return (
    <div className="upgrade-notice upgrade-notice--inline upgrade-notice-block" role="status">
      <span className="upgrade-notice__badge">
        <LockIcon />
        Tope de tu plan {plan.effectivePlanName}
      </span>
      <p className="upgrade-notice__text">
        Tu plan permite hasta {max} {RESOURCE_LABEL[resource]}. Lo que ya tienes se conserva; para agregar más, cambia de
        plan.
      </p>
      {canManage && (
        <Link to="/suscripcion" className="btn btn--secondary">
          Ver planes
        </Link>
      )}
    </div>
  )
}

/**
 * Ruta de un módulo que depende del plan (ej. Compras): si el plan no lo
 * incluye, muestra el aviso en vez de la pantalla. El menú lo sigue
 * mostrando, con candado (Sidebar.tsx).
 */
export function RequirePlan({ feature }: { feature: PlanFeature }) {
  const { can } = usePlan()
  return can(feature) ? <Outlet /> : <UpgradeNotice feature={feature} variant="page" />
}
