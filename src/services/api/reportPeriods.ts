import type { ReportConfig, ReportGroupBy, ReportPeriodKind, ReportTimeGroupBy, ResolvedPeriod } from '@/types/domain'

/**
 * Períodos de reporte en la hora local del navegador. Las fechas se envían
 * a la base de datos como instantes (ISO) junto con la zona horaria, para
 * que la agrupación por hora/día/semana/mes coincida con lo que ve quien
 * consulta. La semana empieza el lunes, como en Colombia.
 */

export const PERIOD_LABEL: Record<ReportPeriodKind, string> = {
  dia: 'Día',
  semana: 'Semana',
  mes: 'Mes',
  ultimos_7: 'Últimos 7 días',
  ultimos_30: 'Últimos 30 días',
  rango: 'Rango de fechas',
}

/** Día, semana y mes se pueden recorrer hacia atrás y adelante. */
export const NAVIGABLE_PERIODS: ReportPeriodKind[] = ['dia', 'semana', 'mes']

export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota'

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7))

/** yyyy-mm-dd en hora local (no UTC, que corre el día por la noche en Colombia). */
export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const fromDateInput = (value: string) => {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const fmtDay = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
const fmtShort = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })
const fmtShortYear = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtMonth = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const rangeLabel = (from: Date, lastDay: Date) =>
  from.getFullYear() === lastDay.getFullYear()
    ? `${fmtShort.format(from)} – ${fmtShortYear.format(lastDay)}`
    : `${fmtShortYear.format(from)} – ${fmtShortYear.format(lastDay)}`

/**
 * Resuelve el período a fechas. `anchor` es cualquier fecha dentro del
 * día/semana/mes a consultar (ver shiftAnchor para recorrerlos).
 */
export function resolvePeriod(
  kind: ReportPeriodKind,
  anchor: Date,
  options: { rangeFrom?: string; rangeTo?: string } = {},
): ResolvedPeriod {
  const today = startOfDay(new Date())

  switch (kind) {
    case 'dia': {
      const from = startOfDay(anchor)
      return { from, to: addDays(from, 1), label: capitalize(fmtDay.format(from)) }
    }
    case 'semana': {
      const from = startOfWeek(anchor)
      return { from, to: addDays(from, 7), label: `Semana del ${rangeLabel(from, addDays(from, 6))}` }
    }
    case 'mes': {
      const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
      return { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 1), label: capitalize(fmtMonth.format(from)) }
    }
    case 'ultimos_7':
    case 'ultimos_30': {
      const days = kind === 'ultimos_7' ? 7 : 30
      const from = addDays(today, -(days - 1))
      return { from, to: addDays(today, 1), label: `Últimos ${days} días (${rangeLabel(from, today)})` }
    }
    case 'rango': {
      const from = options.rangeFrom ? fromDateInput(options.rangeFrom) : addDays(today, -6)
      const last = options.rangeTo ? fromDateInput(options.rangeTo) : today
      return { from, to: addDays(last, 1), label: rangeLabel(from, last) }
    }
  }
}

/** Mueve el ancla un día/semana/mes hacia atrás (−1) o adelante (+1). */
export function shiftAnchor(kind: ReportPeriodKind, anchor: Date, step: -1 | 1): Date {
  if (kind === 'dia') return addDays(anchor, step)
  if (kind === 'semana') return addDays(anchor, 7 * step)
  return new Date(anchor.getFullYear(), anchor.getMonth() + step, 1)
}

/** El siguiente período ya empezó (no tiene sentido ir más allá de hoy). */
export const canGoForward = (kind: ReportPeriodKind, anchor: Date) =>
  resolvePeriod(kind, shiftAnchor(kind, anchor, 1)).from <= new Date()

const DAY_MS = 86_400_000

/** 'auto' → escala de tiempo según la duración del período. */
export function resolveGroupBy(config: ReportConfig, period: ResolvedPeriod): Exclude<ReportGroupBy, 'auto'> {
  if (config.groupBy !== 'auto') return config.groupBy
  const days = (period.to.getTime() - period.from.getTime()) / DAY_MS
  if (days <= 2 && config.dataset === 'ventas') return 'hora'
  if (days <= 62) return 'dia'
  if (days <= 190) return 'semana'
  return 'mes'
}

export const isTimeGroupBy = (g: ReportGroupBy): g is ReportTimeGroupBy =>
  g === 'hora' || g === 'dia' || g === 'semana' || g === 'mes'

const fmtBucketDay = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtBucketMonth = new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' })

/** Etiqueta de un tramo de tiempo devuelto por la base de datos ('2026-10-13' o '2026-10-13T14:00'). */
export function formatBucket(key: string, groupBy: ReportTimeGroupBy, compact = false): string {
  if (groupBy === 'hora') return `${key.slice(11, 13)}:00`
  const date = fromDateInput(key.slice(0, 10))
  if (groupBy === 'mes') return capitalize(fmtBucketMonth.format(date))
  if (groupBy === 'semana') return compact ? fmtShort.format(date) : `Semana del ${fmtShort.format(date)}`
  return compact ? fmtShort.format(date) : capitalize(fmtBucketDay.format(date))
}
