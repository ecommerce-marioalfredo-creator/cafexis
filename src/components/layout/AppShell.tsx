import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useBusiness } from '@/hooks/useBusiness'
import { applyBrandTheme } from '@/styles/applyBrandTheme'
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
  const { business } = useBusiness()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    applyBrandTheme(business?.branding)
    return () => applyBrandTheme(undefined)
  }, [business?.branding])

  // Cierra el menú móvil automáticamente al navegar a otra sección.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  return (
    <div className="app-shell">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="app-shell__main">
        <Topbar title={title} onOpenMenu={() => setMobileNavOpen(true)} />
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
