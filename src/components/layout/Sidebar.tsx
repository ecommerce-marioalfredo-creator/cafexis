import { NavLink } from 'react-router-dom'
import logoOnDark from '@/assets/logo-dark.png'
import { useBusiness } from '@/hooks/useBusiness'
import { useAuth } from '@/context/AuthContext'
import { ADMIN_ROLES, BUSINESS_STAFF_ROLES, HELP_ROLES, PLATFORM_ROLES } from './roles'
import type { UserRole } from '@/types/domain'
import './Sidebar.css'

/**
 * Ítems de navegación según Design System sección 2 (Arquitectura de
 * información), filtrados por rol (Fase 3 — Roles y personal): el barista
 * solo necesita su tablero de pedidos (con la receta de cada bebida
 * visible ahí mismo, ver OrderCard.tsx), no el resto del panel
 * administrativo. administrador y supervisor_tecnico ven todo.
 *
 * Fase 7: el equipo de plataforma (supervisor técnico y soporte) tiene la
 * consola de soporte; soporte solo ve esa sección (es de solo lectura sobre
 * los negocios). Administrador y barista abren casos desde "Ayuda".
 */
const NAV_ITEMS: Array<{ to: string; label: string; icon: string; end?: true; roles?: UserRole[] }> = [
  { to: '/soporte', label: 'Consola de soporte', icon: '🛟', roles: PLATFORM_ROLES },
  { to: '/', label: 'Dashboard', icon: '📊', end: true, roles: ADMIN_ROLES },
  { to: '/ventas', label: 'Ventas', icon: '🧾', roles: BUSINESS_STAFF_ROLES },
  { to: '/inventario', label: 'Inventario', icon: '📦', roles: ADMIN_ROLES },
  { to: '/productos', label: 'Productos y recetas', icon: '☕', roles: ADMIN_ROLES },
  { to: '/compras', label: 'Compras', icon: '🛒', roles: ADMIN_ROLES },
  { to: '/proveedores', label: 'Proveedores', icon: '🚚', roles: ADMIN_ROLES },
  { to: '/reportes', label: 'Reportes', icon: '📈', roles: ADMIN_ROLES },
  { to: '/trazabilidad', label: 'Trazabilidad', icon: '🌱', roles: ADMIN_ROLES },
  { to: '/suscripcion', label: 'Suscripción', icon: '💳', roles: ADMIN_ROLES },
  { to: '/configuracion', label: 'Configuración', icon: '⚙️', roles: ADMIN_ROLES },
  { to: '/ayuda', label: 'Ayuda y soporte', icon: '💬', roles: HELP_ROLES },
]

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { business } = useBusiness()
  const { user } = useAuth()
  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)))

  return (
    <>
      {mobileOpen && <div className="sidebar__overlay" onClick={onClose} aria-hidden="true" />}
      <aside className={['sidebar', mobileOpen ? 'sidebar--open' : ''].join(' ')}>
        <div className="sidebar__brand">
          <img src={logoOnDark} alt="Cafexis" className="sidebar__brand-logo" />
          <button className="sidebar__close" onClick={onClose} aria-label="Cerrar menú">
            ✕
          </button>
          {business && (
            <div className="sidebar__business">
              {business.branding.logoUrl ? (
                <img src={business.branding.logoUrl} alt={business.name} className="sidebar__business-logo" />
              ) : (
                <span className="sidebar__business-fallback" aria-hidden="true">
                  {business.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="sidebar__business-name">{business.name}</span>
            </div>
          )}
        </div>
        <nav className="sidebar__nav">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? false}
              className={({ isActive }) => ['sidebar__link', isActive ? 'sidebar__link--active' : ''].join(' ')}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
