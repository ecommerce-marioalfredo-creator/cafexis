import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PlanProvider, usePlan } from '@/context/PlanContext'
import { PageLoading } from '@/components/ui/PageState'

/**
 * Protege las rutas del panel: sin sesión activa, redirige a /ingreso.
 *
 * También carga el plan del negocio (PlanProvider) para todo el panel, y
 * bloquea el acceso si la cuenta está cancelada, redirigiendo a
 * /suscripcion-vencida. Desde la 0019 vencer ya no bloquea: el negocio baja
 * a Básica y sigue operando. Esa ruta de destino queda excluida del chequeo
 * para no generar un bucle de redirección.
 */
export function RequireAuth() {
  const { business, loading } = useAuth()

  if (loading) return <PageLoading label="Cargando Cafexis…" />
  if (!business) return <Navigate to="/ingreso" replace />

  return (
    <PlanProvider businessId={business.id}>
      <AccountGate />
    </PlanProvider>
  )
}

function AccountGate() {
  const { plan, loading } = usePlan()
  const location = useLocation()

  if (location.pathname !== '/suscripcion-vencida' && !loading && plan && !plan.isActive) {
    return <Navigate to="/suscripcion-vencida" replace />
  }

  return <Outlet />
}
