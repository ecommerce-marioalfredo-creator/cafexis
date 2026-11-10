import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { getBusinessPlan } from '@/services/api/subscriptionService'
import type { BusinessPlan, PlanFeature, PlanLimit } from '@/types/domain'

type CountedResource = 'usuarios' | 'productos' | 'insumos'

interface PlanContextValue {
  plan: BusinessPlan | undefined
  loading: boolean
  error: string | undefined
  reload: () => void
  /** Vuelve a consultar sin pasar por `loading` (ej. al abrir Suscripción, para ver el uso al día). */
  refresh: () => Promise<void>
  /** ¿El plan del negocio incluye esta función? */
  can: (feature: PlanFeature) => boolean
  /** Tope del plan para un recurso, o undefined si no tiene límite. */
  limit: (key: PlanLimit) => number | undefined
  /** ¿Ya se llegó al tope? `current` es el conteo que tiene la página; si no, el del plan. */
  atLimit: (key: CountedResource, current?: number) => boolean
}

const PlanContext = createContext<PlanContextValue | undefined>(undefined)

/**
 * Plan del negocio activo (0019_planes_suscripcion_cafexis.sql), cargado una
 * sola vez para el menú, las rutas y las páginas del panel. Se vuelve a
 * cargar cuando el supervisor técnico cambia de negocio.
 *
 * Mientras carga, o si la consulta falla, no bloquea nada en pantalla: la
 * base de datos es la que de verdad aplica los límites.
 */
export function PlanProvider({ businessId, children }: { businessId: string; children: ReactNode }) {
  const { data: plan, loading, error, reload, refresh } = useAsync(getBusinessPlan, [businessId])

  const can = useCallback((feature: PlanFeature) => !plan || plan.features.includes(feature), [plan])
  const limit = useCallback((key: PlanLimit) => plan?.limits[key], [plan])
  const atLimit = useCallback(
    (key: CountedResource, current?: number) => {
      const max = plan?.limits[key]
      return max !== undefined && (current ?? plan?.usage[key] ?? 0) >= max
    },
    [plan],
  )

  const value = useMemo(
    () => ({ plan, loading, error, reload, refresh, can, limit, atLimit }),
    [plan, loading, error, reload, refresh, can, limit, atLimit],
  )

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan debe usarse dentro de <PlanProvider> (lo monta RequireAuth)')
  return ctx
}
