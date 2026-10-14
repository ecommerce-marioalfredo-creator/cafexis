import { useMemo, useState } from 'react'
import { useOrders } from '@/hooks/useOrders'
import { useProducts } from '@/hooks/useProducts'
import { useAuth } from '@/context/AuthContext'
import { OrderCard } from '@/components/domain/OrderCard'
import { PointOfSaleModal } from '@/components/domain/PointOfSaleModal'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { generateInvoice } from '@/services/api/invoiceService'
import type { OrderStatus, RecipeIngredient } from '@/types/domain'

/**
 * El alcance inicial contempla "pedido" y "entregado"; se incorporan aquí
 * "en preparación" y "listo" como columnas intermedias, ya anticipadas en
 * el Design System (sección 13) como ampliación futura del mismo esquema.
 *
 * "Pendiente de pago" (Fase 6) solo ocurre en pedidos públicos del cliente
 * final mientras se confirma el cobro en línea; se muestra primero para que
 * el negocio sepa que hay un pedido esperando pago, aunque no pueda
 * avanzarlo manualmente (lo mueve el webhook de la pasarela).
 */
const COLUMNS: Array<{ status: OrderStatus; title: string }> = [
  { status: 'pendiente_pago', title: 'Pendiente de pago' },
  { status: 'pedido', title: 'Pedido' },
  { status: 'en_preparacion', title: 'En preparación' },
  { status: 'listo', title: 'Listo' },
  { status: 'entregado', title: 'Entregado' },
]

export function SalesPage() {
  const { orders, loading, error, reload, setStatus, register } = useOrders()
  const { products } = useProducts()
  const { user } = useAuth()
  const [posOpen, setPosOpen] = useState(false)
  const [invoicingOrderId, setInvoicingOrderId] = useState<string>()
  const [invoiceError, setInvoiceError] = useState<string>()

  const canInvoice = user?.role === 'administrador' || user?.role === 'supervisor_tecnico'

  const handleGenerateInvoice = async (orderId: string) => {
    setInvoiceError(undefined)
    setInvoicingOrderId(orderId)
    try {
      await generateInvoice(orderId)
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'No se pudo generar la factura.')
    } finally {
      setInvoicingOrderId(undefined)
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

  if (loading) return <PageLoading label="Cargando pedidos…" />
  if (error) return <PageError message={error} onRetry={reload} />

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

      {invoiceError && <div className="form-error-banner">{invoiceError}</div>}

      <div className="orders-board">
        {COLUMNS.map((column) => {
          const columnOrders = orders.filter((o) => o.status === column.status)
          return (
            <div className="orders-board__column" key={column.status}>
              <span className="orders-board__column-title">
                {column.title} ({columnOrders.length})
              </span>
              {columnOrders.length === 0 && <EmptyState title="Sin pedidos aquí" />}
              {columnOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onAdvance={(next) => setStatus(order.id, next)}
                  recipesByProductId={recipesByProductId}
                  onGenerateInvoice={
                    canInvoice && invoicingOrderId !== order.id ? () => handleGenerateInvoice(order.id) : undefined
                  }
                />
              ))}
            </div>
          )
        })}
      </div>

      {posOpen && <PointOfSaleModal onRegister={register} onClose={() => setPosOpen(false)} />}
    </div>
  )
}
