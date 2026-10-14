import { useState } from 'react'
import { useReplenishment } from '@/hooks/useReports'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageError } from '@/components/ui/PageState'
import { PurchaseOrderModal } from './PurchaseOrderModal'
import type { InventoryItem, NewPurchaseOrderInput, ReplenishmentProjection, Supplier } from '@/types/domain'
import './ReplenishmentSection.css'

const WINDOW_OPTIONS = [7, 14, 30]
const COVER_OPTIONS = [7, 14, 30]

const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
const shortDate = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })

/** Cantidad a pedir: unidades enteras, el resto redondeado hacia arriba a 2 decimales. */
const roundUp = (quantity: number, unit: string) =>
  ['uds', 'und', 'unidades', 'u'].includes(unit.toLowerCase()) ? Math.ceil(quantity) : Math.ceil(quantity * 100) / 100

function DepletionBadge({ row, coverDays }: { row: ReplenishmentProjection; coverDays: number }) {
  if (row.quantity <= 0) return <Badge tone="error">Agotado</Badge>
  if (row.daysUntilOut === undefined || !row.depletesAt) return <Badge tone="neutral">Sin consumo reciente</Badge>
  const when = `${row.daysUntilOut < 1 ? 'hoy' : `en ${number.format(row.daysUntilOut)} días`} · ${shortDate.format(new Date(row.depletesAt))}`
  const tone = row.daysUntilOut <= 3 ? 'error' : row.daysUntilOut <= coverDays ? 'warning' : 'success'
  return <Badge tone={tone}>{when}</Badge>
}

interface ReplenishmentSectionProps {
  suppliers: Supplier[]
  inventoryItems: InventoryItem[]
  onCreateOrder: (input: NewPurchaseOrderInput) => Promise<void>
  /** Cambia cuando cambian las órdenes de compra, para recalcular "en orden abierta". */
  version: string
}

/**
 * Sugerencia de reposición (Fase 4): proyecta, con el consumo por ventas de
 * los últimos días, cuándo se agotará cada insumo y cuánto comprar para
 * cubrir un número de días. A diferencia de las propuestas automáticas de
 * Fase 2 (que se disparan al cruzar el umbral), esto anticipa lo que se va a
 * agotar aunque hoy esté en "ok".
 */
export function ReplenishmentSection({ suppliers, inventoryItems, onCreateOrder, version }: ReplenishmentSectionProps) {
  const [windowDays, setWindowDays] = useState(14)
  const [coverDays, setCoverDays] = useState(14)
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [draftOpen, setDraftOpen] = useState(false)
  const { projection, loading, error, reload } = useReplenishment(windowDays, coverDays, version)

  const rows = showAll ? projection : projection.filter((r) => r.suggestedQuantity > 0)
  const historyDays = projection[0]?.historyDays ?? windowDays
  const chosen = projection.filter((r) => selected.includes(r.inventoryItemId) && r.suggestedQuantity > 0)

  const toggle = (id: string) => setSelected((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))

  // Proveedor más común entre los preferidos de los insumos elegidos.
  const supplierCounts = new Map<string, number>()
  for (const r of chosen) {
    if (r.preferredSupplierId) supplierCounts.set(r.preferredSupplierId, (supplierCounts.get(r.preferredSupplierId) ?? 0) + 1)
  }
  const suggestedSupplier = [...supplierCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

  return (
    <section>
      <div className="page-toolbar replenishment__toolbar">
        <div>
          <h3>Sugerencia de reposición</h3>
          <p className="section-subtitle">
            Cuándo se agotará cada insumo al ritmo de ventas reciente, y cuánto comprar para cubrir los próximos días
            más el umbral de alerta.
          </p>
        </div>
        <div className="replenishment__controls">
          <label>
            Consumo de los últimos
            <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}>
              {WINDOW_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} días
                </option>
              ))}
            </select>
          </label>
          <label>
            Comprar para cubrir
            <select value={coverDays} onChange={(e) => setCoverDays(Number(e.target.value))}>
              {COVER_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} días
                </option>
              ))}
            </select>
          </label>
          <label className="replenishment__toggle">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Mostrar todos los insumos
          </label>
        </div>
      </div>

      {historyDays < windowDays && projection.length > 0 && (
        <p className="section-subtitle">
          Por ahora hay {number.format(historyDays)} día(s) de ventas registradas: la proyección se vuelve más precisa a
          medida que se acumula historial.
        </p>
      )}

      {error ? (
        <PageError message={error} onRetry={reload} />
      ) : loading && projection.length === 0 ? (
        <p className="section-subtitle">Calculando proyección…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nada por reponer en este horizonte"
          description={`Con el consumo actual, ningún insumo baja de su umbral en los próximos ${coverDays} días.`}
        />
      ) : (
        <>
          <div className="data-table-wrapper">
            <table className="data-table replenishment__table">
              <thead>
                <tr>
                  <th aria-label="Seleccionar" />
                  <th>Insumo</th>
                  <th className="replenishment__num">Existencia</th>
                  <th className="replenishment__num">Consumo diario</th>
                  <th>Se agota</th>
                  <th className="replenishment__num">Sugerido</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.inventoryItemId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(r.inventoryItemId)}
                        onChange={() => toggle(r.inventoryItemId)}
                        disabled={r.suggestedQuantity <= 0}
                        aria-label={`Incluir ${r.name} en la orden`}
                      />
                    </td>
                    <td className="replenishment__name">{r.name}</td>
                    <td className="replenishment__num">
                      {number.format(r.quantity)} {r.unit}
                    </td>
                    <td className="replenishment__num">
                      {r.dailyConsumption > 0 ? `${number.format(r.dailyConsumption)} ${r.unit}/día` : '—'}
                    </td>
                    <td>
                      <DepletionBadge row={r} coverDays={coverDays} />
                    </td>
                    <td className="replenishment__num">
                      {r.suggestedQuantity > 0 ? `${number.format(roundUp(r.suggestedQuantity, r.unit))} ${r.unit}` : '—'}
                    </td>
                    <td>{r.inOpenOrder ? <Badge tone="info">En orden abierta</Badge> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="replenishment__footer">
            <span className="section-subtitle">
              {chosen.length === 0 ? 'Marca los insumos que quieras pedir.' : `${chosen.length} insumo(s) seleccionado(s).`}
            </span>
            <Button variant="primary" disabled={chosen.length === 0} onClick={() => setDraftOpen(true)}>
              Crear orden con los seleccionados
            </Button>
          </div>
        </>
      )}

      {draftOpen && (
        <PurchaseOrderModal
          suppliers={suppliers}
          inventoryItems={inventoryItems}
          initial={{
            supplierId: suggestedSupplier,
            reason: `Sugerencia de reposición: cubrir ${coverDays} días de consumo.`,
            lines: chosen.map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: roundUp(r.suggestedQuantity, r.unit) })),
          }}
          onSave={async (input) => {
            await onCreateOrder(input)
            setSelected([])
          }}
          onClose={() => setDraftOpen(false)}
        />
      )}
    </section>
  )
}
