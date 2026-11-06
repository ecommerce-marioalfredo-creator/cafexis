import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
        <OpenBusinessForm />
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

      <OpenBusinessForm />
    </PublicLayout>
  )
}

/** Acepta el link completo del negocio (…/c/mi-cafeteria) o solo su código. */
function slugFromInput(input: string): string | undefined {
  const value = input.trim()
  const fromUrl = value.match(/\/c\/([a-z0-9-]+)/i)?.[1]
  const slug = (fromUrl ?? value).toLowerCase()
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? slug : undefined
}

/**
 * En la app de clientes (Fase 7) no hay barra de direcciones: esta es la
 * forma de llegar a un negocio nuevo si no se abrió desde su link o QR.
 */
function OpenBusinessForm() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const slug = slugFromInput(value)
    if (!slug) {
      setError('Pega el link que te dio el negocio (por ejemplo …/c/mi-cafeteria) o solo su código.')
      return
    }
    navigate(`/c/${slug}`)
  }

  return (
    <form className="customer-businesses__open" onSubmit={handleSubmit}>
      <label htmlFor="open-business">¿Tienes el link o el código de un negocio?</label>
      <div className="customer-businesses__open-row">
        <input
          id="open-business"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(undefined)
          }}
          placeholder="mi-cafeteria"
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="url"
        />
        <Button variant="secondary" type="submit">
          Ir
        </Button>
      </div>
      {error && <span className="form-field__error">{error}</span>}
    </form>
  )
}
