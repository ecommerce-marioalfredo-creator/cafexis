import { NavLink } from 'react-router-dom'
import logoOnDark from '@/assets/logo-dark.png'
import { useBusiness } from '@/hooks/useBusiness'
import './Sidebar.css'

/**
 * Ítems de navegación según Design System sección 2 (Arquitectura de información).
 */
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/ventas', label: 'Ventas', icon: '🧾' },
  { to: '/inventario', label: 'Inventario', icon: '📦' },
  { to: '/productos', label: 'Productos y recetas', icon: '☕' },
  { to: '/compras', label: 'Compras', icon: '🛒' },
  { to: '/proveedores', label: 'Proveedores', icon: '🚚' },
  { to: '/reportes', label: 'Reportes', icon: '📈' },
  { to: '/trazabilidad', label: 'Trazabilidad', icon: '🌱' },
  { to: '/configuracion', label: 'Configuración', icon: '⚙️' },
] as const

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { business } = useBusiness()

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
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
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
