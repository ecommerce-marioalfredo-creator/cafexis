import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PageLoading } from '@/components/ui/PageState'

/** Protege las rutas del panel: sin sesión activa, redirige a /ingreso. */
export function RequireAuth() {
  const { business, loading } = useAuth()

  if (loading) return <PageLoading label="Cargando Cafexis…" />
  if (!business) return <Navigate to="/ingreso" replace />

  return <Outlet />
}
