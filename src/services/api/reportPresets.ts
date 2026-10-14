import type { ReportDefinition } from '@/types/domain'

/**
 * Los 4 reportes del documento de alcance (sección 9.1). No viven en una
 * tabla: son configuraciones fijas que se ejecutan con las mismas funciones
 * de base de datos que los reportes personalizados (ver
 * 0009_fase4_inteligencia_cafexis.sql). Sus ids no son uuid, así que nunca
 * chocan con los de custom_reports_cafexis.
 */
export const PREDEFINED_REPORTS: ReportDefinition[] = [
  {
    id: 'mas-vendidos',
    name: 'Bebidas y productos más vendidos',
    description: 'Unidades vendidas por producto, por día, semana o mes.',
    custom: false,
    config: { dataset: 'ventas', groupBy: 'producto', metric: 'unidades', chart: 'barras', period: 'semana' },
  },
  {
    id: 'total-ventas',
    name: 'Total de ventas en dinero',
    description: 'Ventas, pedidos y ticket promedio del período, con el desglose por método de pago.',
    custom: false,
    config: {
      dataset: 'ventas',
      groupBy: 'auto',
      metric: 'dinero',
      chart: 'barras',
      period: 'semana',
      breakdown: 'metodo_pago',
    },
  },
  {
    id: 'insumos-agotan',
    name: 'Ingredientes que se agotan más rápido',
    description: 'Consumo por ventas y días que alcanza la existencia actual a ese ritmo.',
    custom: false,
    config: { dataset: 'insumos', groupBy: 'elemento', metric: 'cobertura', chart: 'tabla', period: 'mes' },
  },
  {
    id: 'lotes',
    name: 'Movimiento y disponibilidad de lotes',
    description: 'Kg vendidos, entradas, ajustes y disponibilidad de cada lote de café.',
    custom: false,
    config: { dataset: 'lotes', groupBy: 'elemento', metric: 'vendido', chart: 'tabla', period: 'mes' },
  },
]
