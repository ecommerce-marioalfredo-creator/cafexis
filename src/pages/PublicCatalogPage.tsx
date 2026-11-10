import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { GuideViewerModal } from '@/components/domain/GuideViewerModal'
import { GUIDE_KIND_ICON, GUIDE_KIND_LABEL } from '@/components/domain/guideMedia'
import { OrderReview } from '@/components/domain/OrderReview'
import { QuantityStepper } from '@/components/domain/QuantityStepper'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { itemCountLabel, useCustomerCart } from '@/hooks/useCustomerCart'
import { getPublicBusiness, getPublicCatalog } from '@/services/api/publicBusinessService'
import { linkToBusiness } from '@/services/api/customerAuthService'
import { registerPublicOrder } from '@/services/api/publicOrdersService'
import { listPublicProductGuides } from '@/services/api/productGuidesService'
import { PAYMENT_LABEL, currency } from '@/components/domain/paymentMethods'
import type { PublicBusiness, PublicProduct, PublicProductGuide, PaymentMethod } from '@/types/domain'
import './PublicCatalogPage.css'

/**
 * La revisión del pedido vive en ?ver=pedido y no en un estado interno: así el
 * botón atrás (Android, navegador, el del encabezado en iOS) vuelve al menú en
 * vez de sacar al cliente del catálogo.
 */
const REVIEW_PARAM = 'pedido'

/**
 * Catálogo público de un negocio (/c/:slug): el menú que ve el cliente al
 * escanear el QR de acceso. Ver el catálogo es público sin sesión; enviar el
 * pedido exige conectarse (Google o invitado).
 *
 * Funciona como los kioscos de autoservicio de comida rápida:
 *   1. Menú: se toca un producto para agregarlo; ya agregado, la tarjeta
 *      muestra su cantidad para ajustarla ahí mismo.
 *   2. Una barra compacta al fondo resume el carrito (unidades y total) sin
 *      tapar el menú; al tocarla se abre "Tu pedido".
 *   3. Tu pedido (OrderReview): revisar, ajustar, elegir mesa y pago, enviar.
 */
export function PublicCatalogPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const reviewing = searchParams.get('ver') === REVIEW_PARAM
  const { customer, loading: authLoading, promptConnect } = useCustomerAuth()
  const cart = useCustomerCart(slug)
  const restoreCart = cart.restore

  const [business, setBusiness] = useState<PublicBusiness>()
  const [products, setProducts] = useState<PublicProduct[]>([])
  // Videos y PDF que el negocio marcó como disponibles para el cliente (0018).
  const [guides, setGuides] = useState<PublicProductGuide[]>([])
  const [guidePicker, setGuidePicker] = useState<PublicProduct>()
  const [viewingGuide, setViewingGuide] = useState<{ guide: PublicProductGuide; productName: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const [category, setCategory] = useState('todas')
  const [tableOrReference, setTableOrReference] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const [submittedOrder, setSubmittedOrder] = useState<{ paymentMethod: PaymentMethod; total: number }>()
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
        const [catalog, publicGuides] = await Promise.all([
          getPublicCatalog(b.id),
          // Sin la migración 0018 el catálogo sigue funcionando, solo sin guías.
          listPublicProductGuides(b.id).catch(() => [] as PublicProductGuide[]),
        ])
        setProducts(catalog)
        setGuides(publicGuides)
        // Recupera el carrito de esta pestaña (ej. al volver de entrar con Google).
        restoreCart(catalog)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.'))
      .finally(() => setLoading(false))
  }

  // restoreCart cambia solo con el slug: no provoca recargas extra.
  useEffect(load, [slug, restoreCart])

  // El logo del encabezado enlaza a esta misma URL: al pulsarlo, la confirmación
  // del pedido da paso al catálogo. El carrito se conserva.
  useEffect(() => setSubmittedOrder(undefined), [location.key])

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

  // "Tu pedido" empieza arriba; al volver, el menú queda donde el cliente lo dejó.
  const menuScrollY = useRef(0)
  useLayoutEffect(() => {
    window.scrollTo(0, reviewing ? 0 : menuScrollY.current)
  }, [reviewing])

  const openReview = () => {
    menuScrollY.current = window.scrollY
    navigate({ search: `?ver=${REVIEW_PARAM}` }, { state: { fromMenu: true } })
  }

  // Si llegó a la revisión desde el menú, atrás es el menú. Si entró directo
  // (recargó, volvió de Google), no hay historial propio: se reemplaza la URL.
  const backToMenu = () => {
    if ((location.state as { fromMenu?: boolean } | null)?.fromMenu) navigate(-1)
    else navigate({ search: '' }, { replace: true })
  }

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products])
  const visibleProducts = useMemo(
    () => (category === 'todas' ? products : products.filter((p) => p.category === category)),
    [products, category],
  )
  const guidesByProductId = useMemo(() => {
    const map: Record<string, PublicProductGuide[]> = {}
    for (const guide of guides) (map[guide.productId] ??= []).push(guide)
    return map
  }, [guides])
  const showTableField = business?.type === 'cafeteria' || business?.type === 'mixto'

  // Con un solo material se abre directo; con varios, primero se elige cuál.
  const openGuides = (product: PublicProduct) => {
    const productGuides = guidesByProductId[product.id] ?? []
    if (productGuides.length === 1) setViewingGuide({ guide: productGuides[0], productName: product.name })
    else setGuidePicker(product)
  }

  // Siempre visible. Sin sesión, /pedidos devolvería al catálogo sin explicar nada: primero se conecta.
  const ordersButton = (
    <Button variant="tertiary" onClick={customer ? () => navigate(`/c/${slug}/pedidos`) : promptConnect}>
      Mis pedidos
    </Button>
  )

  const handleSubmitOrder = async () => {
    if (!business || cart.lines.length === 0) return
    setSaveError(undefined)
    setSaving(true)
    try {
      // El pedido nace en 'pendiente_pago' y aparece en la comanda del personal
      // con la forma de pago elegida; quien lo atiende cobra y lo confirma.
      await registerPublicOrder({
        businessId: business.id,
        items: cart.lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        paymentMethod,
        tableOrReference: tableOrReference.trim() || undefined,
      })
      setSubmittedOrder({ paymentMethod, total: cart.total })
      cart.clear()
      // Un pedido nuevo empieza desde arriba del menú.
      menuScrollY.current = 0
      window.scrollTo(0, 0)
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

  if (submittedOrder) {
    return (
      <PublicLayout business={business} headerRight={ordersButton}>
        <div className="public-catalog__confirmation">
          <h1>¡Pedido enviado!</h1>
          <p>
            Elegiste pagar <strong>{currency.format(submittedOrder.total)}</strong> con{' '}
            <strong>{PAYMENT_LABEL[submittedOrder.paymentMethod]}</strong>. El equipo de {business.name} confirmará tu
            pedido y empezará a prepararlo. Puedes cancelarlo desde “Mis pedidos” mientras no hayan empezado.
          </p>
          <div className="public-catalog__confirmation-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setSubmittedOrder(undefined)
                if (reviewing) backToMenu()
              }}
            >
              Pedir algo más
            </Button>
            {/* Desde la revisión, reemplaza: atrás en "Mis pedidos" debe llevar al menú, no a un pedido vacío. */}
            <Button variant="primary" onClick={() => navigate(`/c/${slug}/pedidos`, { replace: reviewing })}>
              Ver mis pedidos
            </Button>
          </div>
        </div>
      </PublicLayout>
    )
  }

  if (reviewing) {
    return (
      <PublicLayout business={business} headerRight={ordersButton}>
        <OrderReview
          lines={cart.lines}
          total={cart.total}
          itemCount={cart.count}
          onChangeQuantity={cart.changeQuantity}
          onBack={backToMenu}
          connected={Boolean(customer)}
          onConnect={promptConnect}
          showTableField={showTableField}
          tableOrReference={tableOrReference}
          onTableOrReferenceChange={setTableOrReference}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          submitting={saving}
          submitDisabled={saving || linking}
          error={saveError}
          onSubmit={handleSubmitOrder}
        />
      </PublicLayout>
    )
  }

  return (
    <PublicLayout business={business} headerRight={ordersButton}>
      <div className="public-catalog">
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
              const quantity = cart.quantityOf(product.id)
              const productGuides = guidesByProductId[product.id]
              return (
                <div key={product.id} className="public-catalog__item">
                  <div className={['public-catalog__product', quantity > 0 ? 'public-catalog__product--selected' : ''].join(' ')}>
                    {/* Toda la tarjeta agrega una unidad, como en un kiosko; la cantidad se ajusta debajo. */}
                    <button
                      type="button"
                      className="public-catalog__product-main"
                      onClick={() => cart.add(product)}
                      aria-label={`Agregar ${product.name}, ${currency.format(product.price)}`}
                    >
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" loading="lazy" className="public-catalog__product-image" />
                      ) : (
                        <span className="public-catalog__product-image public-catalog__product-image--empty" aria-hidden="true">
                          ☕
                        </span>
                      )}
                      <span className="public-catalog__product-name">{product.name}</span>
                      <span className="public-catalog__product-price">{currency.format(product.price)}</span>
                      {quantity === 0 && (
                        <span className="public-catalog__product-add" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                          Agregar
                        </span>
                      )}
                    </button>
                    {quantity > 0 && (
                      <QuantityStepper
                        className="public-catalog__product-stepper"
                        name={product.name}
                        quantity={quantity}
                        onChange={(delta) => cart.changeQuantity(product.id, delta)}
                      />
                    )}
                  </div>
                  {productGuides && (
                    <button
                      type="button"
                      className="public-catalog__guide-link"
                      onClick={() => openGuides(product)}
                      aria-label={`Cómo se prepara ${product.name}`}
                    >
                      {productGuides.length === 1 ? GUIDE_KIND_ICON[productGuides[0].kind] : '🎬'} Cómo se prepara
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Fuera del condicional: una región en vivo que aparece junto con su texto no siempre se anuncia. */}
        <p className="visually-hidden" aria-live="polite">
          {cart.count > 0 ? `Tu pedido: ${itemCountLabel(cart.count)}, ${currency.format(cart.total)}` : ''}
        </p>

        {cart.count > 0 && (
          <div className="public-catalog__dock">
            <button
              type="button"
              className="public-catalog__cart-bar"
              onClick={openReview}
              aria-label={`Ver mi pedido: ${itemCountLabel(cart.count)}, ${currency.format(cart.total)}`}
            >
              <span className="public-catalog__cart-bar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2" />
                  <circle cx="10" cy="20.5" r="1" />
                  <circle cx="17" cy="20.5" r="1" />
                </svg>
                {/* La key reinicia la animación cada vez que cambia la cantidad. */}
                <span key={cart.count} className="public-catalog__cart-bar-count">
                  {cart.count}
                </span>
              </span>
              <span className="public-catalog__cart-bar-label">Ver mi pedido</span>
              <span className="public-catalog__cart-bar-total">{currency.format(cart.total)}</span>
              <svg className="public-catalog__cart-bar-chevron" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {guidePicker && (
        <Modal title={`Cómo se prepara · ${guidePicker.name}`} onClose={() => setGuidePicker(undefined)}>
          <ul className="public-catalog__guide-list">
            {(guidesByProductId[guidePicker.id] ?? []).map((guide) => (
              <li key={guide.id}>
                <button
                  type="button"
                  onClick={() => {
                    setGuidePicker(undefined)
                    setViewingGuide({ guide, productName: guidePicker.name })
                  }}
                >
                  <span aria-hidden="true">{GUIDE_KIND_ICON[guide.kind]}</span>
                  <span>
                    <strong>{guide.title}</strong>
                    <span className="public-catalog__guide-kind">{GUIDE_KIND_LABEL[guide.kind]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {viewingGuide && (
        <GuideViewerModal
          guide={viewingGuide.guide}
          productName={viewingGuide.productName}
          onClose={() => setViewingGuide(undefined)}
        />
      )}
    </PublicLayout>
  )
}
