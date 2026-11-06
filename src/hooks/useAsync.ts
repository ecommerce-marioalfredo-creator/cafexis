import { useEffect, useRef, useState, useCallback } from 'react'

interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  error: string | undefined
  reload: () => void
  /** Vuelve a consultar sin pasar por `loading`: la página no se reemplaza por el spinner. */
  refresh: () => Promise<void>
}

interface AsyncOptions {
  /** Cada cuántos ms refrescar en silencio, mientras la pestaña esté visible. */
  pollMs?: number
}

/**
 * Ejecuta un fetcher (típicamente una llamada a services/api) y expone
 * estado de carga/error consistente para todas las páginas del panel.
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[] = [], { pollMs }: AsyncOptions = {}): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [reloadTick, setReloadTick] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  // Solo se aplica la respuesta del refresco más reciente: una consulta lenta
  // no debe pisar datos más nuevos (ej. un pedido que se acaba de confirmar).
  const latestRefresh = useRef(0)

  const reload = useCallback(() => setReloadTick((t) => t + 1), [])

  const refresh = useCallback(async () => {
    const id = ++latestRefresh.current
    try {
      const result = await fetcherRef.current()
      if (latestRefresh.current === id) {
        setData(result)
        setError(undefined)
      }
    } catch {
      // Se conserva lo último que se mostró; el siguiente refresco reintenta.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    latestRefresh.current++
    setLoading(true)
    setError(undefined)

    fetcher()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      latestRefresh.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadTick])

  useEffect(() => {
    if (!pollMs) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, pollMs)
    return () => clearInterval(timer)
  }, [pollMs, refresh])

  return { data, loading, error, reload, refresh }
}
