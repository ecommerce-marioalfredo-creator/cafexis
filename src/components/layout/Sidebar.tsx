import { NavLink } from 'react-router-dom'
import logoOnDark from '@/assets/logo-dark.png'
import { useBusiness } from '@/hooks/useBusiness'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/types/domain'
import './Sidebar.css'

/**
 * Ítems de navegación según Design System sección 2 (Arquitectura de
 * información), filtrados por rol (Fase 3 — Roles y personal): el barista
 * solo necesita su tablero de pedidos (con la receta de cada bebida
 * visible ahí mismo, ver OrderCard.tsx), no el resto del panel
 * administrativo. administrador y supervisor_tecnico ven todo.
 */
const NAV_ITEMS: Array<{ to: string; label: string; icon: string; end?: true; roles?: UserRole[] }> = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true, roles: ['administrador', 'supervisor_tecnico'] },
  { to: '/ventas', label: 'Ventas', icon: '🧾' },
  { to: '/inventario', label: 'Inventario', icon: '📦', roles: ['administrador', 'supervisor_tecnico'] },
  { to: '/productos', label: 'Productos y recetas', icon: '☕', roles: ['administrador', 'supervisor_tecnico'] },
  { to: '/compras', label: 'Compras', icon: '🛒', roles: ['administrador', 'supervisor_tecnico'] },
  { to: '/proveedores', label: 'Proveedores', icon: '🚚', roles: ['administrador', 'supervisor_tecnico'] },
  { to: '/reportes', label: 'Reportes', icon: '📈', roles: ['administrador', 'supervisor_tecnico'] },
  { to: '/trazabilidad', label: 'Trazabilidad', icon: '🌱', roles: ['administrador', 'supervisor_tecnico'] },
  { to: '/configuracion', label: 'Configuración', icon: '⚙️', roles: ['administrador', 'supervisor_tecnico'] },
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
