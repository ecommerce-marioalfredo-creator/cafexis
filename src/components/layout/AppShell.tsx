import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { SubscriptionBanner } from './SubscriptionBanner'
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
  '/suscripcion': 'Suscripción',
  '/configuracion': 'Configuración',
  '/ayuda': 'Ayuda y soporte',
  '/soporte': 'Consola de soporte',
}

/** Rutas con parámetros: título por prefijo. */
const PREFIX_TITLES: Array<[string, string]> = [
  ['/ayuda/', 'Ayuda y soporte'],
  ['/soporte/negocios/', 'Consola · Negocio'],
  ['/soporte/casos/', 'Consola · Caso'],
]

export function AppShell() {
  const location = useLocation()
  const title =
    TITLES[location.pathname] ?? PREFIX_TITLES.find(([prefix]) => location.pathname.startsWith(prefix))?.[1] ?? 'Cafexis'
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
        <SubscriptionBanner />
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
