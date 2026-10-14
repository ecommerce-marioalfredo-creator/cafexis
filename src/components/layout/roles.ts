import type { UserRole } from '@/types/domain'

/**
 * Grupos de roles internos, en un solo lugar para el menú (Sidebar.tsx),
 * las rutas (router.tsx / RequireRole.tsx) y Configuración. La base de
 * datos aplica las mismas reglas con RLS; esto solo decide qué se muestra.
 */

/** Panel administrativo completo de un negocio. */
export const ADMIN_ROLES: UserRole[] = ['administrador', 'supervisor_tecnico']

/** Personal que opera un negocio (ventas, casos de soporte de su negocio). */
export const BUSINESS_STAFF_ROLES: UserRole[] = ['administrador', 'supervisor_tecnico', 'barista']

/** Abren casos de soporte para su negocio (el supervisor usa la consola). */
export const HELP_ROLES: UserRole[] = ['administrador', 'barista']

/** Equipo de plataforma: consola de soporte con todos los negocios. */
export const PLATFORM_ROLES: UserRole[] = ['supervisor_tecnico', 'soporte']

/** Roles que solo el supervisor técnico puede asignar o invitar. */
export const isPlatformRole = (role: UserRole) => PLATFORM_ROLES.includes(role)

export const ROLE_LABEL: Record<UserRole, string> = {
  supervisor_tecnico: 'Supervisor técnico',
  soporte: 'Soporte (plataforma)',
  administrador: 'Administrador / dueño',
  barista: 'Barista / vendedor',
  cliente: 'Cliente final',
}

/** Pantalla de inicio de cada rol (y destino al entrar a una ruta sin permiso). */
export function homePathForRole(role: UserRole): string {
  if (role === 'barista') return '/ventas'
  if (role === 'soporte') return '/soporte'
  return '/'
}
