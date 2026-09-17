import { useEffect, type ReactNode } from 'react'
import './Modal.css'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/**
 * Modal base (Design System sección 19, grupo "Feedback": alert, toast,
 * modal, confirmation, empty state). Cierra con click en el overlay o Esc.
 */
export function Modal({ title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="modal-panel__header">
          <h3>{title}</h3>
          <button className="modal-panel__close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="modal-panel__body">{children}</div>
        {footer && <footer className="modal-panel__footer">{footer}</footer>}
      </div>
    </div>
  )
}
