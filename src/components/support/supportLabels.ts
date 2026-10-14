import type { BadgeTone } from '@/components/ui/Badge'
import type { SupportCaseCategory, SupportCasePriority, SupportCaseStatus } from '@/types/domain'

export const STATUS_META: Record<SupportCaseStatus, { label: string; tone: BadgeTone }> = {
  abierto: { label: 'Abierto', tone: 'warning' },
  en_progreso: { label: 'En progreso', tone: 'info' },
  esperando_cliente: { label: 'Esperando al negocio', tone: 'neutral' },
  resuelto: { label: 'Resuelto', tone: 'success' },
  cerrado: { label: 'Cerrado', tone: 'neutral' },
}

export const PRIORITY_META: Record<SupportCasePriority, { label: string; tone: BadgeTone }> = {
  baja: { label: 'Baja', tone: 'neutral' },
  media: { label: 'Media', tone: 'info' },
  alta: { label: 'Alta', tone: 'warning' },
  urgente: { label: 'Urgente', tone: 'error' },
}

export const CATEGORY_LABEL: Record<SupportCaseCategory, string> = {
  inventario: 'Inventario',
  ventas: 'Ventas',
  compras: 'Compras',
  usuarios: 'Usuarios y accesos',
  reportes: 'Reportes',
  cuenta: 'Cuenta y negocio',
  otro: 'Otro',
}

export const ACTIVE_STATUSES: SupportCaseStatus[] = ['abierto', 'en_progreso', 'esperando_cliente']
export const DONE_STATUSES: SupportCaseStatus[] = ['resuelto', 'cerrado']

const dateTime = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const relative = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' })

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))

/** "hace 5 minutos", "ayer", "hace 3 días". */
export function formatRelative(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(seconds)
  if (abs < 60) return 'hace un momento'
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 30) return relative.format(Math.round(seconds / 86400), 'day')
  return relative.format(Math.round(seconds / (86400 * 30)), 'month')
}
