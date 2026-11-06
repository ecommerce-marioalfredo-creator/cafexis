import { useMemo, useState } from 'react'
import { useOrders, type ClosedOrdersPeriod } from '@/hooks/useOrders'
import { useProducts } from '@/hooks/useProducts'
import { useAuth } from '@/context/AuthContext'
import { OrderCard } from '@/components/domain/OrderCard'
import { useStaffOrderActions } from '@/components/domain/useStaffOrderActions'
import { PointOfSaleModal } from '@/components/domain/PointOfSaleModal'
import { ORDER_STATUS_META } from '@/components/domain/orderStatus'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { generateInvoice } from '@/services/api/invoiceService'
import { CLOSED_ORDERS_LIMIT } from '@/services/api/salesService'
import type { OrderStatus, RecipeIngredient } from '@/types/domain'

/**
 * Tablero de pedidos por estado. "Por confirmar" (estado pendiente_pago) solo
 * ocurre en pedidos públicos del cliente final: la comanda llega con la forma
 * de pago que eligió, y el personal la confirma para pasarla a preparación.
 *
 * Los pedidos en curso se muestran siempre; los entregados, solo los del
 * período elegido (antes se cargaba todo el historial, y PostgREST lo cortaba
 * en 1000 filas sin avisar). Los cancelados no están aquí: su histórico está
 * en Reportes.
 */
const COLUMNS: OrderStatus[] = ['pendiente_pago', 'pedido', 'en_preparacion', 'listo', 'entregado']

const PERIODS: Array<{ id: ClosedOrdersPeriod; label: string }> = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7_dias', label: 'Últimos 7 días' },
  { id: '30_dias', label: 'Últimos 30 días' },
]

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

export function SalesPage() {
  const [period, setPeriod] = useState<ClosedOrdersPeriod>('hoy')
  const { orders, closedTruncated, initialLoading, error, reload, setStatus, register, confirmPayment, cancel } =
    useOrders(period)
  const { products } = useProducts()
  const { user } = useAuth()
  const { cardProps, actionError, modals } = useStaffOrderActions({ setStatus, confirmPayment, cancel })
  const [posOpen, setPosOpen] = useState(false)
  const [invoicingOrderId, setInvoicingOrderId] = useState<string>()
  const [invoiceError, setInvoiceError] = useState<string>()
  const [actionMessage, setActionMessage] = useState<string>()

  // Facturar: solo quien administra el negocio (la base de datos lo exige igual).
  const canInvoice = user?.role === 'administrador' || user?.role === 'supervisor_tecnico'

  const handleGenerateInvoice = async (orderId: string) => {
    setInvoiceError(undefined)
    setActionMessage(undefined)
    setInvoicingOrderId(orderId)
    try {
      const invoice = await generateInvoice(orderId)
      if (invoice.status === 'emitida') {
        setActionMessage(`Factura electrónica emitida${invoice.cufe ? ` · CUFE ${invoice.cufe}` : ''}.`)
      } else if (invoice.status === 'error') {
        setInvoiceError(invoice.errorMessage ?? 'No se pudo emitir la factura.')
      }
    } catch (err) {
      setInvoiceError(errorMessage(err, 'No se pudo generar la factura.'))
    } finally {
      setInvoicingOrderId(undefined)
      // El estado de la factura llega con los pedidos del tablero.
      reload()
    }
  }

  // Receta de cada producto, para mostrarla en cada tarjeta de pedido (quien
  // prepara la bebida necesita ver qué lleva, no solo el nombre). Se cruza
  // contra el catálogo vivo de productos, no contra el pedido: order_items
  // guarda un snapshot plano (nombre/cantidad/precio) a propósito, para no
  // romper el historial si la receta cambia después.
  const recipesByProductId = useMemo(() => {
    const map: Record<string, RecipeIngredient[] | undefined> = {}
    for (const product of products) map[product.id] = product.recipe
    return map
  }, [products])

  const periodLabel = PERIODS.find((p) => p.id === period)?.label.toLowerCase()

  if (initialLoading) return <PageLoading label="Cargando pedidos…" />
  if (error) return <PageError message={error} onRetry={reload} />

  const columns = COLUMNS.map((status) => ({ status, orders: orders.filter((o) => o.status === status) }))

  return (
    <div>
      <div className="page-toolbar">
        <p className="section-subtitle">
          Cada venta descuenta automáticamente los ingredientes de su receta (o el café de su lote) del inventario.
        </p>
        <Button variant="primary" onClick={() => setPosOpen(true)}>
          Nueva venta
        </Button>
      </div>

      <div className="sales-page__period" role="group" aria-label="Período de pedidos entregados">
        <span className="section-subtitle">Entregados:</span>
        <div className="page-toolbar__filters">
          {PERIODS.map((p) => (
            <button
              type="button"
              key={p.id}
              aria-pressed={period === p.id}
              className={['filter-chip', period === p.id ? 'filter-chip--active' : ''].join(' ')}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {closedTruncated && (
        <p className="section-subtitle">
          Se muestran los {CLOSED_ORDERS_LIMIT} pedidos entregados más recientes del período; el historial completo está
          en Reportes.
        </p>
      )}
      {actionMessage && <div className="form-success-banner">{actionMessage}</div>}
      {actionError && <div className="form-error-banner">{actionError}</div>}
      {invoiceError && <div className="form-error-banner">{invoiceError}</div>}

      <div className="orders-board">
        {columns.map((column) => (
          <div className="orders-board__column" key={column.status}>
            <span className="orders-board__column-title">
              {ORDER_STATUS_META[column.status].label}
              {column.status === 'entregado' ? ` · ${periodLabel}` : ''} ({column.orders.length})
            </span>
            {column.orders.length === 0 && <EmptyState title="Sin pedidos aquí" />}
            {column.orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                {...cardProps(order)}
                recipesByProductId={recipesByProductId}
                onGenerateInvoice={canInvoice ? () => handleGenerateInvoice(order.id) : undefined}
                generatingInvoice={invoicingOrderId === order.id}
              />
            ))}
          </div>
        ))}
      </div>

      {posOpen && <PointOfSaleModal onRegister={register} onClose={() => setPosOpen(false)} />}
      {modals}
    </div>
  )
}
