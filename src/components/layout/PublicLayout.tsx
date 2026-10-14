import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { applyBrandTheme } from '@/styles/applyBrandTheme'
import type { PublicBusiness } from '@/types/domain'
import './PublicLayout.css'

interface PublicLayoutProps {
  /** Cuando hay negocio (catálogo, mesa de pedidos), aplica su color de marca y muestra su nombre/logo. Ausente en páginas sin negocio asociado (ej. "Mis negocios"). */
  business?: PublicBusiness
  children: ReactNode
  headerRight?: ReactNode
}

/**
 * Layout ligero para las rutas del cliente final (/c/:slug,
 * /trazabilidad/:lotId, /mis-negocios): sin Sidebar ni Topbar del panel
 * administrativo (AppShell.tsx es solo para empleados internos). Aplica el
 * color de marca del negocio igual que AppShell, cuando hay uno.
 */
export function PublicLayout({ business, children, headerRight }: PublicLayoutProps) {
  useEffect(() => {
    applyBrandTheme(business?.branding)
    return () => applyBrandTheme(undefined)
  }, [business?.branding])

  return (
    <div className="public-layout">
      <header className="public-layout__header">
        <Link to="/" className="public-layout__brand">
          {business?.branding.logoUrl ? (
            <img src={business.branding.logoUrl} alt={business.name} className="public-layout__logo" />
          ) : (
            <span className="public-layout__logo-fallback" style={{ background: business?.branding.primaryColor }}>
              {(business?.name ?? 'Cafexis').charAt(0).toUpperCase()}
            </span>
          )}
          <span className="public-layout__name">{business?.name ?? 'Cafexis'}</span>
        </Link>
        {headerRight}
      </header>
      <main className="public-layout__content">{children}</main>
    </div>
  )
}
