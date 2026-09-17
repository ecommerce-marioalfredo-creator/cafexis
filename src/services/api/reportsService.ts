import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapCustomReport } from './mappers'
import type { ReportDefinition } from '@/types/domain'
import type { CustomReportRow } from '@/types/database'

/**
 * Reportes predefinidos: no viven en una tabla (se calculan con consultas
 * sobre orders_cafexis/inventory_items_cafexis/coffee_lots_cafexis), según
 * el diseño del esquema. custom_reports_cafexis solo guarda los que arma
 * cada negocio desde el generador personalizado.
 */
const PREDEFINED_REPORTS: ReportDefinition[] = [
  { id: 'rep-1', name: 'Bebidas y productos más vendidos', description: 'Por día, semana o mes.', custom: false },
  { id: 'rep-2', name: 'Total de ventas en dinero', description: 'Durante un período determinado.', custom: false },
  { id: 'rep-3', name: 'Ingredientes que se agotan más rápido', description: 'Basado en consumo histórico.', custom: false },
  { id: 'rep-4', name: 'Movimiento y disponibilidad de lotes', description: 'Para café en grano o molido.', custom: false },
]

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
