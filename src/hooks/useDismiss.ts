import { useEffect, type RefObject } from 'react'

/**
 * Cierra un menú desplegable con un clic fuera de `ref` o con Esc. Con Esc,
 * el foco vuelve al botón que lo abre (el que tiene aria-expanded) para que
 * quien usa teclado no lo pierda.
 */
export function useDismiss(ref: RefObject<HTMLElement>, open: boolean, setOpen: (open: boolean) => void): void {
  useEffect(() => {
    if (!open) return
    const closeOnOutside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      ref.current?.querySelector<HTMLElement>('[aria-expanded]')?.focus()
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [ref, open, setOpen])
}
