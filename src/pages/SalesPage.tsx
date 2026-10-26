import { useMemo, useState } from 'react'
import { useOrders, type ClosedOrdersPeriod } from '@/hooks/useOrders'
import { useProducts } from '@/hooks/useProducts'
import { useAuth } from '@/context/AuthContext'
import { OrderCard } from '@/components/domain/OrderCard'
import { PointOfSaleModal } from '@/components/domain/PointOfSaleModal'
import { ConfirmPaymentModal } from '@/components/domain/ConfirmPaymentModal'
import { CancelOrderModal } from '@/components/domain/CancelOrderModal'
import { ORDER_STATUS_META, isCancellableOrderStatus } from '@/components/domain/orderStatus'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { generateInvoice } from '@/services/api/invoiceService'
import { CLOSED_ORDERS_LIMIT } from '@/services/api/salesService'
import type { Order, OrderStatus, RecipeIngredient } from '@/types/domain'

/**
 * Tablero de pedidos por estado. "Pendiente de pago" son pedidos públicos del
 * cliente final que aún no se cobran: se confirman solos cuando la pasarela
 * aprueba el pago en línea, o a mano cuando el cliente paga en caja.
 *
 * Los pedidos en curso se muestran siempre; los entregados y cancelados,
 * solo los del período elegido (antes se cargaba todo el historial, y
 * PostgREST lo cortaba en 1000 filas sin avisar).
 */
const COLUMNS: OrderStatus[] = ['pendiente_pago', 'pedido', 'en_preparacion', 'listo', 'entregado', 'cancelado']
const CLOSED_COLUMNS: OrderStatus[] = ['entregado', 'cancelado']

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
  const [posOpen, setPosOpen] = useState(false)
  const [payingOrder, setPayingOrder] = useState<Order>()
  const [cancellingOrder, setCancellingOrder] = useState<Order>()
  const [invoicingOrderId, setInvoicingOrderId] = useState<string>()
  const [actionError, setActionError] = useState<string>()
  const [actionMessage, setActionMessage] = useState<string>()

  // Cancelar y facturar: solo quien administra el negocio (la base de datos lo exige igual).
  const canManage = user?.role === 'administrador' || user?.role === 'supervisor_tecnico'

  const handleAdvance = async (orderId: string, next: OrderStatus) => {
    setActionError(undefined)
    try {
      await setStatus(orderId, next)
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo actualizar el pedido.'))
    }
  }

  const handleGenerateInvoice = async (orderId: string) => {
    setActionError(undefined)
    setActionMessage(undefined)
    setInvoicingOrderId(orderId)
    try {
      const invoice = await generateInvoice(orderId)
      if (invoice.status === 'emitida') {
        setActionMessage(`Factura electrónica emitida${invoice.cufe ? ` · CUFE ${invoice.cufe}` : ''}.`)
      } else if (invoice.status === 'error') {
        setActionError(invoice.errorMessage ?? 'No se pudo emitir la factura.')
      }
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo generar la factura.'))
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
    // La columna de cancelados solo aparece si hay alguno en el período.
    .filter((column) => column.status !== 'cancelado' || column.orders.length > 0)

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

      <div className="sales-page__period" role="group" aria-label="Período de pedidos entregados y cancelados">
        <span className="section-subtitle">Entregados y cancelados:</span>
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
          Se muestran los {CLOSED_ORDERS_LIMIT} pedidos entregados o cancelados más recientes del período; el historial
          completo está en Reportes.
        </p>
      )}
      {actionMessage && <div className="form-success-banner">{actionMessage}</div>}
      {actionError && <div className="form-error-banner">{actionError}</div>}

      <div className="orders-board">
        {columns.map((column) => (
          <div className="orders-board__column" key={column.status}>
            <span className="orders-board__column-title">
              {ORDER_STATUS_META[column.status].label}
              {CLOSED_COLUMNS.includes(column.status) ? ` · ${periodLabel}` : ''} ({column.orders.length})
            </span>
            {column.orders.length === 0 && <EmptyState title="Sin pedidos aquí" />}
            {column.orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onAdvance={(next) => handleAdvance(order.id, next)}
                recipesByProductId={recipesByProductId}
                onConfirmPayment={() => setPayingOrder(order)}
                onCancel={canManage && isCancellableOrderStatus(order.status) ? () => setCancellingOrder(order) : undefined}
                onGenerateInvoice={canManage ? () => handleGenerateInvoice(order.id) : undefined}
                generatingInvoice={invoicingOrderId === order.id}
              />
            ))}
          </div>
        ))}
      </div>

      {posOpen && <PointOfSaleModal onRegister={register} onClose={() => setPosOpen(false)} />}
      {payingOrder && (
        <ConfirmPaymentModal
          order={payingOrder}
          onConfirm={(method) => confirmPayment(payingOrder.id, method)}
          onClose={() => setPayingOrder(undefined)}
        />
      )}
      {cancellingOrder && (
        <CancelOrderModal
          order={cancellingOrder}
          onCancel={(reason) => cancel(cancellingOrder.id, reason)}
          onClose={() => setCancellingOrder(undefined)}
        />
      )}
    </div>
  )
}
