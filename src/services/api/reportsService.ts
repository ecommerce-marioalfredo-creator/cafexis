import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapCustomReport, mapOrder } from './mappers'
import { PREDEFINED_REPORTS } from './reportPresets'
import { browserTimeZone } from './reportPeriods'
import type {
  OrderHistoryPage,
  ReplenishmentProjection,
  ReportConfig,
  ReportDefinition,
  ReportDefinitionInput,
  ReportGroupBy,
  ResolvedPeriod,
  SalesReportRow,
  StockReportRow,
} from '@/types/domain'
import type { CustomReportRow, OrderRow } from '@/types/database'

/**
 * Reportes predefinidos (reportPresets.ts) + personalizados
 * (custom_reports_cafexis). Ambos se ejecutan con las mismas funciones de
 * base de datos — ver 0009_fase4_inteligencia_cafexis.sql —, que agregan
 * los datos en el servidor (sin el límite de 1000 filas de PostgREST) y
 * exigen rol administrador o supervisor técnico.
 */
export async function listReportDefinitions(): Promise<ReportDefinition[]> {
  const businessId = await getActiveBusinessId()

  const { data, error } = await supabase
    .from('custom_reports_cafexis')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .returns<CustomReportRow[]>()

  if (error) throw new Error(error.message)

  return [...PREDEFINED_REPORTS, ...(data ?? []).map(mapCustomReport)]
}

export async function createCustomReport(input: ReportDefinitionInput): Promise<void> {
  const businessId = await getActiveBusinessId()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { error } = await supabase.from('custom_reports_cafexis').insert({
    business_id: businessId,
    created_by: session?.user.id ?? null,
    name: input.name,
    description: input.description || null,
    config: input.config,
  })
  if (error) throw new Error(error.message)
}

export async function updateCustomReport(id: string, input: ReportDefinitionInput): Promise<void> {
  const { error } = await supabase
    .from('custom_reports_cafexis')
    .update({ name: input.name, description: input.description || null, config: input.config })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteCustomReport(id: string): Promise<void> {
  const { error } = await supabase.from('custom_reports_cafexis').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Embebe a quien canceló; llega vacío si canceló el cliente, que no está en app_users_cafexis. */
const ORDER_HISTORY_SELECT = '*, order_items_cafexis(*), canceller:app_users_cafexis!cancelled_by(name)'

/**
 * Histórico de pedidos por fecha de creación, incluidos los cancelados. Es lista
 * paginada, no agregado: PostgREST corta en 1000 filas, así que se pide por partes.
 */
export async function listOrderHistory(
  period: ResolvedPeriod,
  onlyCancelled: boolean,
  offset: number,
  limit: number,
): Promise<OrderHistoryPage> {
  const businessId = await getActiveBusinessId()
  const from = period.from.toISOString()
  const to = period.to.toISOString()

  let ordersQuery = supabase
    .from('orders_cafexis')
    .select(ORDER_HISTORY_SELECT, { count: 'exact' })
    .eq('business_id', businessId)
    .gte('created_at', from)
    .lt('created_at', to)
  if (onlyCancelled) ordersQuery = ordersQuery.eq('status', 'cancelado')

  const [orders, cancelled] = await Promise.all([
    ordersQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
      .returns<OrderRow[]>(),
    supabase
      .from('orders_cafexis')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'cancelado')
      .gte('created_at', from)
      .lt('created_at', to),
  ])

  if (orders.error) throw new Error(orders.error.message)
  if (cancelled.error) throw new Error(cancelled.error.message)

  return {
    orders: (orders.data ?? []).map(mapOrder),
    total: orders.count ?? 0,
    cancelled: cancelled.count ?? 0,
  }
}

const nonEmpty = <T,>(values: T[] | undefined) => (values && values.length > 0 ? values : null)

interface SalesRowRaw {
  key: string
  label: string
  units: number | string
  revenue: number | string
  orders: number | string
}

export async function runSalesReport(
  config: ReportConfig,
  period: ResolvedPeriod,
  groupBy: Exclude<ReportGroupBy, 'auto' | 'elemento'> | 'total',
): Promise<SalesReportRow[]> {
  const businessId = await getActiveBusinessId()
  const { data, error } = await supabase.rpc('report_sales_cafexis', {
    p_from: period.from.toISOString(),
    p_to: period.to.toISOString(),
    p_group_by: groupBy,
    p_tz: browserTimeZone(),
    p_business_id: businessId,
    p_product_ids: nonEmpty(config.filters?.productIds),
    p_categories: nonEmpty(config.filters?.categories),
    p_payment_methods: nonEmpty(config.filters?.paymentMethods),
  })
  if (error) throw new Error(error.message)

  return ((data ?? []) as SalesRowRaw[]).map((r) => ({
    key: r.key,
    label: r.label,
    units: Number(r.units),
    revenue: Number(r.revenue),
    orders: Number(r.orders),
  }))
}

interface StockRowRaw {
  key: string
  label: string
  unit: string | null
  sold: number | string
  received: number | string
  adjusted: number | string
  current_quantity: number | string | null
  threshold: number | string | null
  daily_rate: number | string | null
  days_coverage: number | string | null
}

const optionalNumber = (v: number | string | null) => (v === null ? undefined : Number(v))

export async function runStockReport(
  config: ReportConfig,
  period: ResolvedPeriod,
  groupBy: 'elemento' | 'dia' | 'semana' | 'mes' | 'total',
): Promise<StockReportRow[]> {
  const businessId = await getActiveBusinessId()
  const { data, error } = await supabase.rpc('report_stock_movements_cafexis', {
    p_target: config.dataset,
    p_from: period.from.toISOString(),
    p_to: period.to.toISOString(),
    p_group_by: groupBy,
    p_tz: browserTimeZone(),
    p_business_id: businessId,
    p_ids: nonEmpty(config.filters?.elementIds),
  })
  if (error) throw new Error(error.message)

  return ((data ?? []) as StockRowRaw[]).map((r) => ({
    key: r.key,
    label: r.label,
    unit: r.unit ?? '',
    sold: Number(r.sold),
    received: Number(r.received),
    adjusted: Number(r.adjusted),
    currentQuantity: optionalNumber(r.current_quantity),
    threshold: optionalNumber(r.threshold),
    dailyRate: optionalNumber(r.daily_rate),
    daysCoverage: optionalNumber(r.days_coverage),
  }))
}

interface ProjectionRowRaw {
  inventory_item_id: string
  name: string
  unit: string
  quantity: number | string
  low_stock_threshold: number | string
  status: ReplenishmentProjection['status']
  daily_consumption: number | string
  history_days: number | string
  days_until_out: number | string | null
  depletes_at: string | null
  days_until_threshold: number | string | null
  suggested_quantity: number | string
  preferred_supplier_id: string | null
  in_open_order: boolean
}

/** Proyección de reposición (consumo de los últimos `windowDays`, compra para cubrir `coverDays`). */
export async function getReplenishmentProjection(windowDays: number, coverDays: number): Promise<ReplenishmentProjection[]> {
  const businessId = await getActiveBusinessId()
  const { data, error } = await supabase.rpc('inventory_projection_cafexis', {
    p_window_days: windowDays,
    p_cover_days: coverDays,
    p_business_id: businessId,
  })
  if (error) throw new Error(error.message)

  return ((data ?? []) as ProjectionRowRaw[]).map((r) => ({
    inventoryItemId: r.inventory_item_id,
    name: r.name,
    unit: r.unit,
    quantity: Number(r.quantity),
    lowStockThreshold: Number(r.low_stock_threshold),
    status: r.status,
    dailyConsumption: Number(r.daily_consumption),
    historyDays: Number(r.history_days),
    daysUntilOut: optionalNumber(r.days_until_out),
    depletesAt: r.depletes_at ?? undefined,
    daysUntilThreshold: optionalNumber(r.days_until_threshold),
    suggestedQuantity: Number(r.suggested_quantity),
    preferredSupplierId: r.preferred_supplier_id ?? undefined,
    inOpenOrder: r.in_open_order,
  }))
}
