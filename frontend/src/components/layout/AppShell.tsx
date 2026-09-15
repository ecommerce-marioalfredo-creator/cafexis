import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import './AppShell.css'

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/ventas': 'Ventas',
  '/inventario': 'Inventario',
  '/productos': 'Productos y recetas',
  '/compras': 'Compras',
  '/proveedores': 'Proveedores',
  '/reportes': 'Reportes',
  '/trazabilidad': 'Trazabilidad',
  '/configuracion': 'Configuración',
}

export function AppShell() {
  const location = useLocation()
  const title = TITLES[location.pathname] ?? 'Cafexis'

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <Topbar title={title} />
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
