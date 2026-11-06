/**
 * Avisos de cancelación de pedidos (0016_cancelacion_y_avisos_cafexis.sql). Cada
 * cancelación deja un aviso para el negocio y otro para el cliente, si pidió desde
 * el catálogo. Los avisos del negocio se comparten entre todo su personal.
 */
import { supabase, getActiveBusinessId } from './supabaseClient'
import { mapOrderNotification } from './mappers'
import type { OrderNotification } from '@/types/domain'
import type { OrderNotificationRow } from '@/types/database'

const NOTIFICATIONS_LIMIT = 20
const CHANGED_EVENT = 'cafexis:notifications-changed'

export async function listBusinessNotifications(): Promise<OrderNotification[]> {
  const businessId = await getActiveBusinessId()

  const { data, error } = await supabase
    .from('order_notifications_cafexis')
    .select('*')
    .eq('business_id', businessId)
    .is('customer_id', null)
    .order('created_at', { ascending: false })
    .limit(NOTIFICATIONS_LIMIT)
    .returns<OrderNotificationRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapOrderNotification)
}

export async function listCustomerNotifications(): Promise<OrderNotification[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return []

  const { data, error } = await supabase
    .from('order_notifications_cafexis')
    .select('*')
    .eq('customer_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(NOTIFICATIONS_LIMIT)
    .returns<OrderNotificationRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapOrderNotification)
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('mark_order_notifications_read_cafexis', { p_ids: ids })
  if (error) throw new Error(error.message)
}

/** Quien acaba de cancelar ve su aviso enseguida, sin esperar la siguiente revisión de la campana. */
export function notifyNotificationsChanged(): void {
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

export function onNotificationsChanged(listener: () => void): () => void {
  window.addEventListener(CHANGED_EVENT, listener)
  return () => window.removeEventListener(CHANGED_EVENT, listener)
}
