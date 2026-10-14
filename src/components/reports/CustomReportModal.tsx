import { useMemo, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { useProducts } from '@/hooks/useProducts'
import { useInventory } from '@/hooks/useInventory'
import { useTraceability } from '@/hooks/useTraceability'
import { PAYMENT_LABEL, SALE_PAYMENT_METHODS } from '@/components/domain/paymentMethods'
import { PERIOD_LABEL, toDateInput } from '@/services/api/reportPeriods'
import { METRIC_LABEL } from './ReportViewer'
import type {
  PaymentMethod,
  ReportConfig,
  ReportDataset,
  ReportDefinition,
  ReportDefinitionInput,
  ReportGroupBy,
  ReportMetric,
  ReportPeriodKind,
} from '@/types/domain'
import './CustomReportModal.css'

const DATASET_LABEL: Record<ReportDataset, string> = {
  ventas: 'Ventas',
  insumos: 'Consumo de insumos',
  lotes: 'Lotes de café',
}

const GROUP_OPTIONS: Record<ReportDataset, Array<{ value: ReportGroupBy; label: string }>> = {
  ventas: [
    { value: 'producto', label: 'Por producto' },
    { value: 'categoria', label: 'Por categoría' },
    { value: 'metodo_pago', label: 'Por método de pago' },
    { value: 'auto', label: 'En el tiempo (escala automática)' },
    { value: 'dia', label: 'Por día' },
    { value: 'semana', label: 'Por semana' },
    { value: 'mes', label: 'Por mes' },
  ],
  insumos: [
    { value: 'elemento', label: 'Por insumo' },
    { value: 'auto', label: 'En el tiempo (escala automática)' },
    { value: 'dia', label: 'Por día' },
    { value: 'semana', label: 'Por semana' },
    { value: 'mes', label: 'Por mes' },
  ],
  lotes: [
    { value: 'elemento', label: 'Por lote' },
    { value: 'auto', label: 'En el tiempo (escala automática)' },
    { value: 'dia', label: 'Por día' },
    { value: 'semana', label: 'Por semana' },
    { value: 'mes', label: 'Por mes' },
  ],
}

function metricOptions(dataset: ReportDataset, groupBy: ReportGroupBy): ReportMetric[] {
  if (dataset === 'ventas') return ['dinero', 'unidades', 'pedidos']
  return groupBy === 'elemento'
    ? ['vendido', 'entradas', 'ajustes', 'existencia', 'cobertura']
    : ['vendido', 'entradas', 'ajustes']
}

/** Los ajustes llevan signo: en barras un negativo se vería como cero. */
const canChart = (metric: ReportMetric) => metric !== 'ajustes'

const PERIOD_KINDS: ReportPeriodKind[] = ['dia', 'semana', 'mes', 'ultimos_7', 'ultimos_30', 'rango']

interface CustomReportModalProps {
  report?: ReportDefinition
  onSave: (input: ReportDefinitionInput) => Promise<void>
  onClose: () => void
}

/**
 * Generador de reportes personalizados (alcance 9.2): el administrador
 * elige qué datos, cómo agruparlos, qué medir, filtros, período por
 * defecto y si verlos en barras o en tabla. Se guarda en
 * custom_reports_cafexis.config y se consulta con el mismo visor que los
 * reportes predefinidos.
 */
export function CustomReportModal({ report, onSave, onClose }: CustomReportModalProps) {
  const { products } = useProducts()
  const { items: inventoryItems } = useInventory()
  const { lots } = useTraceability()

  const initial = report?.config
  const [name, setName] = useState(report?.name ?? '')
  const [description, setDescription] = useState(report?.description ?? '')
  const [dataset, setDataset] = useState<ReportDataset>(initial?.dataset ?? 'ventas')
  const [groupBy, setGroupBy] = useState<ReportGroupBy>(initial?.groupBy ?? 'producto')
  const [metric, setMetric] = useState<ReportMetric>(initial?.metric ?? 'dinero')
  const [chart, setChart] = useState<ReportConfig['chart']>(initial?.chart ?? 'barras')
  const [period, setPeriod] = useState<ReportPeriodKind>(initial?.period ?? 'semana')
  const [rangeFrom, setRangeFrom] = useState(initial?.rangeFrom ?? toDateInput(new Date(Date.now() - 6 * 86_400_000)))
  const [rangeTo, setRangeTo] = useState(initial?.rangeTo ?? toDateInput(new Date()))
  const [productIds, setProductIds] = useState<string[]>(initial?.filters?.productIds ?? [])
  const [categories, setCategories] = useState<string[]>(initial?.filters?.categories ?? [])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initial?.filters?.paymentMethods ?? [])
  const [elementIds, setElementIds] = useState<string[]>(initial?.filters?.elementIds ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const allCategories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products])
  const metrics = metricOptions(dataset, groupBy)

  const changeDataset = (next: ReportDataset) => {
    setDataset(next)
    setGroupBy(next === 'ventas' ? 'producto' : 'elemento')
    setMetric(next === 'ventas' ? 'dinero' : 'vendido')
    setElementIds([])
  }

  const changeGroupBy = (next: ReportGroupBy) => {
    setGroupBy(next)
    if (!metricOptions(dataset, next).includes(metric)) setMetric(dataset === 'ventas' ? 'dinero' : 'vendido')
  }

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Ponle un nombre al reporte.'
    if (period === 'rango' && (!rangeFrom || !rangeTo || rangeFrom > rangeTo)) {
      next.period = 'Elige un rango válido (la fecha inicial antes de la final).'
    }
    if (dataset === 'insumos' && groupBy !== 'elemento') {
      const chosen = elementIds.length > 0 ? inventoryItems.filter((i) => elementIds.includes(i.id)) : inventoryItems
      const units = new Set(chosen.map((i) => i.unit.toLowerCase()))
      if (units.size > 1) {
        next.filters = 'Para ver el consumo en el tiempo, elige insumos con la misma unidad (no se pueden sumar kg con litros).'
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaveError(undefined)
    if (!validate()) return

    const config: ReportConfig = {
      dataset,
      groupBy,
      metric,
      chart: canChart(metric) ? chart : 'tabla',
      period,
      ...(period === 'rango' ? { rangeFrom, rangeTo } : {}),
      filters:
        dataset === 'ventas'
          ? { productIds, categories, paymentMethods }
          : { elementIds },
    }

    setSaving(true)
    try {
      await onSave({ name: name.trim(), description: description.trim(), config })
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el reporte.')
    } finally {
      setSaving(false)
    }
  }

  const elements =
    dataset === 'insumos'
      ? inventoryItems.map((i) => ({ id: i.id, label: `${i.name} (${i.unit})` }))
      : lots.map((l) => ({ id: l.id, label: `${l.code} · ${l.variety}` }))

  return (
    <Modal
      title={report ? 'Editar reporte personalizado' : 'Nuevo reporte personalizado'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="custom-report-form" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar reporte'}
          </Button>
        </>
      }
    >
      <form id="custom-report-form" onSubmit={handleSubmit} className="custom-report-form">
        <div className="custom-report-form__grid">
          <FormField label="Nombre" htmlFor="report-name" error={errors.name}>
            <input id="report-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Ventas de café empacado" />
          </FormField>
          <FormField label="Descripción (opcional)" htmlFor="report-description">
            <input id="report-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>

          <FormField label="Datos" htmlFor="report-dataset">
            <select id="report-dataset" value={dataset} onChange={(e) => changeDataset(e.target.value as ReportDataset)}>
              {(Object.keys(DATASET_LABEL) as ReportDataset[]).map((d) => (
                <option key={d} value={d}>
                  {DATASET_LABEL[d]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Agrupar" htmlFor="report-group">
            <select id="report-group" value={groupBy} onChange={(e) => changeGroupBy(e.target.value as ReportGroupBy)}>
              {GROUP_OPTIONS[dataset].map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Medir" htmlFor="report-metric">
            <select id="report-metric" value={metric} onChange={(e) => setMetric(e.target.value as ReportMetric)}>
              {metrics.map((m) => (
                <option key={m} value={m}>
                  {METRIC_LABEL[m]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Visualización"
            htmlFor="report-chart"
            hint={canChart(metric) ? 'La tabla con todos los valores siempre se muestra.' : 'Los ajustes llevan signo: solo en tabla.'}
          >
            <select
              id="report-chart"
              value={canChart(metric) ? chart : 'tabla'}
              onChange={(e) => setChart(e.target.value as ReportConfig['chart'])}
              disabled={!canChart(metric)}
            >
              <option value="barras">Gráfico de barras + tabla</option>
              <option value="tabla">Solo tabla</option>
            </select>
          </FormField>
        </div>

        <FormField label="Período por defecto" htmlFor="report-period" error={errors.period} hint="Se puede cambiar al consultar el reporte.">
          <select id="report-period" value={period} onChange={(e) => setPeriod(e.target.value as ReportPeriodKind)}>
            {PERIOD_KINDS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABEL[p]}
              </option>
            ))}
          </select>
        </FormField>
        {period === 'rango' && (
          <div className="custom-report-form__range">
            <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} aria-label="Desde" />
            <span>a</span>
            <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} aria-label="Hasta" />
          </div>
        )}

        <fieldset className="custom-report-form__filters">
          <legend>Filtros (sin marcar = todos)</legend>

          {dataset === 'ventas' ? (
            <>
              <CheckList
                title="Productos"
                options={products.map((p) => ({ id: p.id, label: p.name }))}
                selected={productIds}
                onToggle={(id) => setProductIds((l) => toggle(l, id))}
              />
              <CheckList
                title="Categorías"
                options={allCategories.map((c) => ({ id: c, label: c }))}
                selected={categories}
                onToggle={(id) => setCategories((l) => toggle(l, id))}
              />
              <CheckList
                title="Métodos de pago"
                options={SALE_PAYMENT_METHODS.map((m) => ({ id: m, label: PAYMENT_LABEL[m] }))}
                selected={paymentMethods}
                onToggle={(id) => setPaymentMethods((l) => toggle(l, id as PaymentMethod))}
              />
            </>
          ) : (
            <CheckList
              title={dataset === 'insumos' ? 'Insumos' : 'Lotes'}
              options={elements}
              selected={elementIds}
              onToggle={(id) => setElementIds((l) => toggle(l, id))}
            />
          )}
          {errors.filters && <span className="form-field__error">{errors.filters}</span>}
        </fieldset>

        {saveError && <div className="form-error-banner">{saveError}</div>}
      </form>
    </Modal>
  )
}

interface CheckListProps {
  title: string
  options: Array<{ id: string; label: string }>
  selected: string[]
  onToggle: (id: string) => void
}

function CheckList({ title, options, selected, onToggle }: CheckListProps) {
  return (
    <div className="custom-report-form__checklist">
      <span className="custom-report-form__checklist-title">
        {title}
        {selected.length > 0 && ` (${selected.length})`}
      </span>
      {options.length === 0 ? (
        <span className="section-subtitle">No hay opciones.</span>
      ) : (
        <div className="custom-report-form__options">
          {options.map((o) => (
            <label key={o.id}>
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => onToggle(o.id)} />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
