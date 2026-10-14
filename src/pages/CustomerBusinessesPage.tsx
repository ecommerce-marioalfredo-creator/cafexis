import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { listMyBusinesses } from '@/services/api/customerAuthService'
import type { CustomerBusinessLink } from '@/types/domain'
import './CustomerBusinessesPage.css'

/**
 * "Mis negocios" (/mis-negocios): a dónde llega el cliente cuando entra sin
 * pasar por un /c/:slug específico, o cuando vuelve a abrir la app — elige a
 * cuál negocio de los que ya vinculó quiere entrar, como elegir cuenta de
 * Google.
 */
export function CustomerBusinessesPage() {
  const { customer, loading: authLoading, loginWithGoogle, logout } = useCustomerAuth()
  const [links, setLinks] = useState<CustomerBusinessLink[]>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const load = () => {
    if (!customer) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(undefined)
    listMyBusinesses()
      .then(setLinks)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar tus negocios.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [customer])

  const handleLogin = async () => {
    await loginWithGoogle(window.location.href)
  }

  if (authLoading || loading) return <PageLoading label="Cargando…" />

  if (!customer) {
    return (
      <PublicLayout>
        <div className="customer-businesses__empty">
          <h1>Bienvenido a Cafexis</h1>
          <p>Inicia sesión con Google para ver los negocios a los que te has vinculado.</p>
          <Button variant="primary" onClick={handleLogin}>
            Iniciar sesión con Google
          </Button>
        </div>
      </PublicLayout>
    )
  }

  if (error) return <PageError message={error} onRetry={load} />

  return (
    <PublicLayout
      headerRight={
        <Button variant="tertiary" onClick={logout}>
          Cerrar sesión
        </Button>
      }
    >
      <h1 className="customer-businesses__title">Mis negocios</h1>

      {!links || links.length === 0 ? (
        <EmptyState
          title="Aún no te has vinculado a ningún negocio"
          description="Escanea el código QR o visita el link que te dé el negocio para empezar."
        />
      ) : (
        <ul className="customer-businesses__list">
          {links.map(({ business }) => (
            <li key={business.id}>
              <Link to={`/c/${business.slug}`} className="customer-businesses__item">
                {business.branding.logoUrl ? (
                  <img src={business.branding.logoUrl} alt={business.name} />
                ) : (
                  <span className="customer-businesses__fallback" style={{ background: business.branding.primaryColor }}>
                    {business.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span>{business.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PublicLayout>
  )
}
