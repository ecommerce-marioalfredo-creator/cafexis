import type { ReportMetric } from '@/types/domain'

/** Nombre de cada métrica de reporte, compartido por ReportViewer y CustomReportModal. */
export const METRIC_LABEL: Record<ReportMetric, string> = {
  dinero: 'Ventas en dinero',
  unidades: 'Unidades vendidas',
  pedidos: 'Pedidos',
  vendido: 'Consumo por ventas',
  entradas: 'Entradas',
  ajustes: 'Ajustes',
  existencia: 'Existencia actual',
  cobertura: 'Días de cobertura',
}
