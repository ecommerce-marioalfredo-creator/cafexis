import { NavLink } from 'react-router-dom'
import logoOnDark from '@/assets/logo-dark.png'
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

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src={logoOnDark} alt="Cafexis" />
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
  )
}
