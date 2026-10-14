import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { getPublicBusiness, getPublicCatalog } from '@/services/api/publicBusinessService'
import { linkToBusiness } from '@/services/api/customerAuthService'
import { registerPublicOrder } from '@/services/api/publicOrdersService'
import { createPaymentLink } from '@/services/api/paymentService'
import { PAYMENT_LABEL, SALE_PAYMENT_METHODS, currency } from '@/components/domain/paymentMethods'
import type { PublicBusiness, PublicProduct, PaymentMethod } from '@/types/domain'
import './PublicCatalogPage.css'

interface CartLine {
  product: PublicProduct
  quantity: number
}

/**
 * Catálogo público de un negocio (/c/:slug): el menú que ve el cliente al
 * escanear el QR de acceso. Ver el catálogo es público sin sesión; agregar
 * al carrito y pedir exige haber iniciado sesión con Google.
 *
 * El carrito reutiliza el mismo patrón de PointOfSaleModal.tsx (agregar con
 * un clic, +/- por línea), adaptado a una página de ancho de celular en vez
 * de un modal de escritorio.
 */
export function PublicCatalogPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { customer, loading: authLoading, loginWithGoogle } = useCustomerAuth()

  const [business, setBusiness] = useState<PublicBusiness>()
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const [category, setCategory] = useState('todas')
  const [cart, setCart] = useState<CartLine[]>([])
  const [tableOrReference, setTableOrReference] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const [orderCode, setOrderCode] = useState<string>()
  const [linking, setLinking] = useState(false)

  const load = () => {
    if (!slug) return
    setLoading(true)
    setError(undefined)
    getPublicBusiness(slug)
      .then(async (b) => {
        if (!b) {
          setBusiness(undefined)
          return
        }
        setBusiness(b)
        const catalog = await getPublicCatalog(b.id)
        setProducts(catalog)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [slug])

  // Una vez logueado, vincula al cliente con este negocio (idempotente) para
  // que pueda pedir y luego ver su historial en /c/:slug/pedidos.
  useEffect(() => {
    if (!customer || !business) return
    setLinking(true)
    linkToBusiness(business.id)
      .catch(() => {
        /* si falla, el botón de pedir mostrará el error real al intentar registrar el pedido */
      })
      .finally(() => setLinking(false))
  }, [customer, business])

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products])
  const visibleProducts = useMemo(
    () => (category === 'todas' ? products : products.filter((p) => p.category === category)),
    [products, category],
  )
  const total = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0)
  const showTableField = business?.type === 'cafeteria' || business?.type === 'mixto'

  const addProduct = (product: PublicProduct) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id)
      if (existing) return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l))
      return [...prev, { product, quantity: 1 }]
    })
  }

  const changeQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0),
    )
  }

  const handleLogin = async () => {
    await loginWithGoogle(window.location.href)
  }

  const handleSubmitOrder = async () => {
    if (!business || cart.length === 0) return
    setSaveError(undefined)
    setSaving(true)
    try {
      // El pedido nace en 'pendiente_pago' (Fase 6): hay que llevar al
      // cliente al checkout de Wompi antes de darlo por confirmado. El
      // webhook (supabase/functions/wompi-webhook) es quien lo mueve a
      // 'pedido' cuando el cobro se aprueba.
      const id = await registerPublicOrder({
        businessId: business.id,
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        paymentMethod,
        tableOrReference: tableOrReference.trim() || undefined,
      })
      setCart([])
      try {
        const checkoutUrl = await createPaymentLink(id)
        window.location.href = checkoutUrl
        return
      } catch (paymentErr) {
        // El pedido ya se registró (queda en "pendiente de pago"); si el
        // link de cobro no se pudo generar (ej. Wompi sin configurar), se
        // lo decimos al cliente en vez de perder la referencia del pedido.
        setOrderCode(id)
        setSaveError(
          paymentErr instanceof Error
            ? `Tu pedido quedó registrado, pero no se pudo iniciar el pago: ${paymentErr.message}`
            : 'Tu pedido quedó registrado, pero no se pudo iniciar el pago.',
        )
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo registrar tu pedido.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || authLoading) return <PageLoading label="Cargando el menú…" />
  if (error) return <PageError message={error} onRetry={load} />
  if (!business) {
    return (
      <PublicLayout>
        <EmptyState title="Este negocio no existe" description="Verifica el enlace o el código QR que escaneaste." />
      </PublicLayout>
    )
  }

  if (orderCode) {
    return (
      <PublicLayout business={business}>
        <div className="public-catalog__confirmation">
          <h1>Pedido registrado</h1>
          <p>
            Tu pedido quedó guardado, pero el pago en línea no se pudo iniciar en este momento. Puedes intentar pagar
            de nuevo desde tu historial de pedidos.
          </p>
          <div className="public-catalog__confirmation-actions">
            <Button variant="secondary" onClick={() => setOrderCode(undefined)}>
              Pedir algo más
            </Button>
            <Button variant="primary" onClick={() => navigate(`/c/${slug}/pedidos`)}>
              Ver mis pedidos
            </Button>
          </div>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout
      business={business}
      headerRight={
        customer ? (
          <Button variant="tertiary" onClick={() => navigate(`/c/${slug}/pedidos`)}>
            Mis pedidos
          </Button>
        ) : undefined
      }
    >
      {categories.length > 1 && (
        <div className="public-catalog__categories">
          {['todas', ...categories].map((c) => (
            <button
              type="button"
              key={c}
              className={['filter-chip', category === c ? 'filter-chip--active' : ''].join(' ')}
              onClick={() => setCategory(c)}
            >
              {c === 'todas' ? 'Todas' : c}
            </button>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState title="Aún no hay productos en este catálogo" />
      ) : (
        <div className="public-catalog__products">
          {visibleProducts.map((product) => {
            const inCart = cart.find((l) => l.product.id === product.id)?.quantity
            return (
              <button type="button" key={product.id} className="public-catalog__product" onClick={() => addProduct(product)}>
                {product.imageUrl && <img src={product.imageUrl} alt={product.name} />}
                <span className="public-catalog__product-name">{product.name}</span>
                <span className="public-catalog__product-price">{currency.format(product.price)}</span>
                {inCart && <span className="public-catalog__product-count">{inCart}</span>}
              </button>
            )
          })}
        </div>
      )}

      {cart.length > 0 && (
        <section className="public-catalog__cart" aria-label="Tu pedido">
          <h2>Tu pedido</h2>
          <ul className="public-catalog__cart-lines">
            {cart.map((line) => (
              <li key={line.product.id}>
                <span>{line.product.name}</span>
                <div className="public-catalog__stepper">
                  <button type="button" onClick={() => changeQuantity(line.product.id, -1)} aria-label={`Quitar una unidad de ${line.product.name}`}>
                    −
                  </button>
                  <span>{line.quantity}</span>
                  <button type="button" onClick={() => changeQuantity(line.product.id, 1)} aria-label={`Agregar una unidad de ${line.product.name}`}>
                    +
                  </button>
                </div>
                <span>{currency.format(line.product.price * line.quantity)}</span>
              </li>
            ))}
          </ul>

          <div className="public-catalog__total">
            <span>Total</span>
            <strong>{currency.format(total)}</strong>
          </div>

          {!customer ? (
            <div className="public-catalog__login-prompt">
              <p>Inicia sesión con tu cuenta de Google para confirmar tu pedido.</p>
              <Button variant="primary" onClick={handleLogin} className="btn--block">
                Iniciar sesión con Google
              </Button>
            </div>
          ) : (
            <>
              {showTableField && (
                <FormField label="Mesa" htmlFor="catalog-table" hint="Ej. Mesa 4, Para llevar">
                  <input id="catalog-table" value={tableOrReference} onChange={(e) => setTableOrReference(e.target.value)} />
                </FormField>
              )}

              <div className="public-catalog__payment" role="radiogroup" aria-label="Método de pago">
                <span className="public-catalog__payment-label">Método de pago</span>
                <div className="public-catalog__payment-options">
                  {SALE_PAYMENT_METHODS.map((method) => (
                    <button
                      type="button"
                      key={method}
                      role="radio"
                      aria-checked={paymentMethod === method}
                      className={['filter-chip', paymentMethod === method ? 'filter-chip--active' : ''].join(' ')}
                      onClick={() => setPaymentMethod(method)}
                    >
                      {PAYMENT_LABEL[method]}
                    </button>
                  ))}
                </div>
              </div>

              {saveError && <div className="form-error-banner">{saveError}</div>}

              <Button
                variant="primary"
                className="btn--block"
                disabled={saving || linking}
                onClick={handleSubmitOrder}
              >
                {saving ? 'Enviando…' : `Confirmar pedido · ${currency.format(total)}`}
              </Button>
            </>
          )}
        </section>
      )}
    </PublicLayout>
  )
}
