import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useSubscription } from '@/hooks/useSubscription'
import { PageLoading } from '@/components/ui/PageState'

/**
 * Protege las rutas del panel: sin sesión activa, redirige a /ingreso.
 *
 * También bloquea el acceso si la suscripción del negocio venció (Fase 6),
 * redirigiendo a /suscripcion-vencida — refuerza en el frontend lo que ya
 * exige is_business_subscription_active_cafexis() en el servidor para las
 * acciones de escritura más sensibles (0012_fase6_integraciones_cafexis.sql).
 * Esa misma ruta de destino queda excluida del chequeo para no generar un
 * bucle de redirección.
 */
export function RequireAuth() {
  const { business, loading } = useAuth()
  const { subscription, loading: loadingSubscription } = useSubscription()
  const location = useLocation()

  if (loading) return <PageLoading label="Cargando Cafexis…" />
  if (!business) return <Navigate to="/ingreso" replace />

  if (
    location.pathname !== '/suscripcion-vencida' &&
    !loadingSubscription &&
    subscription &&
    !subscription.isActive
  ) {
    return <Navigate to="/suscripcion-vencida" replace />
  }

  return <Outlet />
}
