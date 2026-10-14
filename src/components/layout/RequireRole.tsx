import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { homePathForRole } from './roles'
import type { UserRole } from '@/types/domain'

interface RequireRoleProps {
  roles: UserRole[]
  /** A dónde redirigir si el rol no tiene acceso. Por defecto, el "home" de cada rol: /ventas para barista, / para el resto. */
  redirectTo?: string
}

/**
 * Protege rutas por rol en el servidor de rutas, no solo ocultando el
 * enlace en el menú (ver Sidebar.tsx): si un barista teclea /inventario a
 * mano, lo redirige en vez de mostrarle la pantalla. Debe ir dentro de
 * <RequireAuth>, que ya garantiza que hay sesión activa.
 */
export function RequireRole({ roles, redirectTo }: RequireRoleProps) {
  const { user } = useAuth()

  if (user && !roles.includes(user.role)) {
    return <Navigate to={redirectTo ?? homePathForRole(user.role)} replace />
  }

  return <Outlet />
}
