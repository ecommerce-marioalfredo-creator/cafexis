import { useMemo, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useProducts } from '@/hooks/useProducts'
import { PAYMENT_LABEL, SALE_PAYMENT_METHODS, currency } from './paymentMethods'
import type { NewSaleInput, PaymentMethod, Product } from '@/types/domain'
import './PointOfSaleModal.css'

interface PointOfSaleModalProps {
  onRegister: (input: NewSaleInput) => Promise<unknown>
  onClose: () => void
}

interface CartLine {
  product: Product
  quantity: number
}

/**
 * Punto de venta: elegir productos (clic para sumar), ajustar cantidades,
 * mesa/referencia, cliente opcional y método de pago. Solo registra la
 * venta — no hay cobro en línea. El descuento de inventario y la
 * validación de stock los hace la base de datos al guardar; si falta un
 * ingrediente, el mensaje de error se muestra aquí y no se guarda nada.
 */
export function PointOfSaleModal({ onRegister, onClose }: PointOfSaleModalProps) {
  const { products, loading: loadingProducts, error: productsError } = useProducts()

  const [category, setCategory] = useState<string>('todas')
  const [cart, setCart] = useState<CartLine[]>([])
  const [tableOrReference, setTableOrReference] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo')
  const [saveError, setSaveError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products])
  const visibleProducts = useMemo(
    () => (category === 'todas' ? products : products.filter((p) => p.category === category)),
    [products, category],
  )
  const total = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0)

  const addProduct = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id)
      if (existing) return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l))
      return [...prev, { product, quantity: 1 }]
    })
  }

  const changeQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (cart.length === 0) return
    setSaveError(undefined)
    setSaving(true)
    try {
      await onRegister({
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        paymentMethod,
        tableOrReference: tableOrReference.trim() || undefined,
        customerName: customerName.trim() || undefined,
      })
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo registrar la venta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Nueva venta"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="pos-form" disabled={saving || cart.length === 0}>
            {saving ? 'Registrando…' : `Registrar venta · ${currency.format(total)}`}
          </Button>
        </>
      }
    >
      <form id="pos-form" className="pos" onSubmit={handleSubmit}>
        <section className="pos__catalog" aria-label="Productos">
          {categories.length > 1 && (
            <div className="pos__categories">
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

          {loadingProducts && <p className="section-subtitle">Cargando productos…</p>}
          {productsError && <div className="form-error-banner">{productsError}</div>}
          {!loadingProducts && !productsError && products.length === 0 && (
            <EmptyState title="Aún no hay productos" description="Créalos en la sección Productos para poder venderlos." />
          )}

          <div className="pos__products">
            {visibleProducts.map((product) => {
              const inCart = cart.find((l) => l.product.id === product.id)?.quantity
              return (
                <button type="button" key={product.id} className="pos__product" onClick={() => addProduct(product)}>
                  <span className="pos__product-name">{product.name}</span>
                  <span className="pos__product-price">{currency.format(product.price)}</span>
                  {inCart && <span className="pos__product-count">{inCart}</span>}
                </button>
              )
            })}
          </div>
        </section>

        <section className="pos__ticket" aria-label="Venta actual">
          <h4>Venta actual</h4>
          {cart.length === 0 ? (
            <p className="section-subtitle">Toca un producto para agregarlo.</p>
          ) : (
            <ul className="pos__lines">
              {cart.map((line) => (
                <li key={line.product.id}>
                  <span className="pos__line-name">{line.product.name}</span>
                  <div className="pos__stepper">
                    <button
                      type="button"
                      onClick={() => changeQuantity(line.product.id, -1)}
                      aria-label={`Quitar una unidad de ${line.product.name}`}
                    >
                      −
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => changeQuantity(line.product.id, 1)}
                      aria-label={`Agregar una unidad de ${line.product.name}`}
                    >
                      +
                    </button>
                  </div>
                  <span className="pos__line-total">{currency.format(line.product.price * line.quantity)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="pos__total">
            <span>Total</span>
            <strong>{currency.format(total)}</strong>
          </div>

          <FormField label="Mesa o referencia" htmlFor="pos-table" hint="Ej. Mesa 4, Para llevar">
            <input id="pos-table" value={tableOrReference} onChange={(e) => setTableOrReference(e.target.value)} />
          </FormField>

          <FormField label="Cliente (opcional)" htmlFor="pos-customer">
            <input
              id="pos-customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Cliente de mostrador"
            />
          </FormField>

          <div className="pos__payment" role="radiogroup" aria-label="Método de pago">
            <span className="pos__payment-label">Método de pago</span>
            <div className="pos__payment-options">
              {SALE_PAYMENT_METHODS.map((method) => (
                <button
                  type="button"
                  key={method}
                  role="radio"
                  aria-checked={paymentMethod === method}
                  className={['pos__payment-option', paymentMethod === method ? 'pos__payment-option--active' : ''].join(' ')}
                  onClick={() => setPaymentMethod(method)}
                >
                  {PAYMENT_LABEL[method]}
                </button>
              ))}
            </div>
          </div>

          {saveError && <div className="form-error-banner">{saveError}</div>}
        </section>
      </form>
    </Modal>
  )
}
