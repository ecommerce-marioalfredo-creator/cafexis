import { useEffect, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { NotificationBell } from '@/components/domain/NotificationBell'
import { Button } from '@/components/ui/Button'
import { ThemeMenu } from '@/components/ui/ThemeMenu'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { IS_IOS } from '@/platform/appTarget'
import { listCustomerNotifications } from '@/services/api/notificationsService'
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
  const { customer, loginWithGoogle, logout } = useCustomerAuth()
  const navigate = useNavigate()
  const signIn = () => loginWithGoogle(window.location.href)

  useEffect(() => {
    applyBrandTheme(business?.branding)
    return () => applyBrandTheme(undefined)
  }, [business?.branding])

  // El inicio del cliente es el catálogo de su negocio: "/" es el panel del personal.
  const home = business ? `/c/${business.slug}` : '/mis-negocios'

  // React Router guarda en history.state la posición dentro de la app: en la primera pantalla no hay a dónde volver.
  const showBack = IS_IOS && (window.history.state?.idx ?? 0) > 0

  return (
    <div className="public-layout">
      <header className="public-layout__header">
        {showBack && (
          <button type="button" className="public-layout__back" onClick={() => navigate(-1)} aria-label="Volver">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <Link to={home} className="public-layout__brand">
          {business?.branding.logoUrl ? (
            <img src={business.branding.logoUrl} alt={business.name} className="public-layout__logo" />
          ) : (
            <span className="public-layout__logo-fallback" style={{ background: business?.branding.primaryColor }}>
              {(business?.name ?? 'Cafexis').charAt(0).toUpperCase()}
            </span>
          )}
          <span className="public-layout__name">{business?.name ?? 'Cafexis'}</span>
        </Link>
        <div className="public-layout__nav">
          {headerRight}
          {customer ? (
            <Button variant="secondary" className="public-layout__session" onClick={logout}>
              Desconectarse
            </Button>
          ) : (
            business && (
              <Button variant="primary" className="public-layout__session" onClick={signIn}>
                Conectarse con Google
              </Button>
            )
          )}
        </div>
        <div className="public-layout__actions">
          <ThemeMenu />
          {/* En las pantallas de un negocio los avisos siempre están: sin sesión, explican cómo verlos. */}
          {(customer || business) && (
            <NotificationBell
              key={customer?.id ?? 'sin-sesion'}
              load={listCustomerNotifications}
              empty={
                customer ? undefined : (
                  <div className="public-layout__signin">
                    <p>Inicia sesión para ver los avisos de tus pedidos.</p>
                    <Button variant="secondary" className="btn--block" onClick={signIn}>
                      Iniciar sesión con Google
                    </Button>
                  </div>
                )
              }
            />
          )}
        </div>
      </header>
      <main className="public-layout__content">{children}</main>
    </div>
  )
}
