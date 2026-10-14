import { Navigate, Outlet, useParams } from 'react-router-dom'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { PageLoading } from '@/components/ui/PageState'

/**
 * Protege rutas del cliente final que sí requieren login con Google
 * (/c/:slug/pedidos, /mis-negocios) — a diferencia del catálogo y la
 * trazabilidad, que son públicos sin sesión. Sin sesión de cliente,
 * redirige de vuelta al catálogo del mismo negocio cuando hay :slug en la
 * URL (para que ahí se le ofrezca iniciar sesión), o a /mis-negocios si no.
 */
export function RequireCustomerAuth() {
  const { customer, loading } = useCustomerAuth()
  const { slug } = useParams()

  if (loading) return <PageLoading label="Cargando…" />
  if (!customer) return <Navigate to={slug ? `/c/${slug}` : '/mis-negocios'} replace />

  return <Outlet />
}
