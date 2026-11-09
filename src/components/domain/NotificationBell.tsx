import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { useDismiss } from '@/hooks/useDismiss'
import { ORDERS_POLL_MS } from '@/hooks/useOrders'
import { markNotificationsRead, onNotificationsChanged } from '@/services/api/notificationsService'
import type { OrderNotification } from '@/types/domain'
import './NotificationBell.css'

const TOAST_MS = 8_000
const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

interface NotificationBellProps {
  load: () => Promise<OrderNotification[]>
  /** Reemplaza "No tienes avisos" cuando la lista está vacía (ej. quien aún no ha iniciado sesión). */
  empty?: ReactNode
}

/**
 * Campana de avisos del panel y del catálogo. Lo que llega con la pantalla
 * abierta también aparece como aviso emergente; lo anterior solo suma al contador.
 * Si la consulta falla, la campana queda vacía: los avisos no deben tumbar la página.
 */
export function NotificationBell({ load, empty }: NotificationBellProps) {
  const { data, refresh } = useAsync(load, [], { pollMs: ORDERS_POLL_MS })
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<OrderNotification>()
  const seenIds = useRef<Set<string>>()
  const rootRef = useRef<HTMLDivElement>(null)

  const notifications = data ?? []
  const unread = notifications.filter((n) => !n.readAt)

  useEffect(() => onNotificationsChanged(() => void refresh()), [refresh])

  useEffect(() => {
    if (!data) return
    if (!seenIds.current) {
      seenIds.current = new Set(data.map((n) => n.id))
      return
    }
    const seen = seenIds.current
    const fresh = data.find((n) => !seen.has(n.id))
    data.forEach((n) => seen.add(n.id))
    if (fresh) setToast(fresh)
  }, [data])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(undefined), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  useDismiss(rootRef, open, setOpen)

  const toggle = async () => {
    const opening = !open
    setOpen(opening)
    if (opening && unread.length > 0) {
      try {
        await markNotificationsRead(unread.map((n) => n.id))
        await refresh()
      } catch {
        // Siguen como no leídos y se reintenta la próxima vez que se abra.
      }
    }
  }

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        type="button"
        className="notification-bell__button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread.length > 0 ? `Avisos: ${unread.length} sin leer` : 'Avisos'}
      >
        <span aria-hidden="true">🔔</span>
        {unread.length > 0 && <span className="notification-bell__count">{unread.length}</span>}
      </button>

      {open && (
        <div className="notification-bell__panel">
          <strong className="notification-bell__title">Avisos</strong>
          {notifications.length === 0 ? (
            (empty ?? <p className="notification-bell__empty">No tienes avisos.</p>)
          ) : (
            <ul className="notification-bell__list">
              {notifications.map((n) => (
                <li key={n.id}>
                  <span>{n.message}</span>
                  <time dateTime={n.createdAt}>{dateFormat.format(new Date(n.createdAt))}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {toast && (
        <div className="notification-bell__toast" role="status">
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(undefined)} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
