import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/services/api/supabaseClient'
import * as customerAuthService from '@/services/api/customerAuthService'
import type { Customer } from '@/types/domain'

interface CustomerAuthContextValue {
  customer: Customer | undefined
  loading: boolean
  loginWithGoogle: (redirectTo: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined)

/**
 * Sesión del cliente final (login con Google), equivalente a AuthContext.tsx
 * pero para /c/:slug, /trazabilidad/:lotId y /mis-negocios — las rutas
 * públicas, nunca para el panel de empleados.
 *
 * Nota de arquitectura: hay un único cliente de Supabase y por tanto una
 * única sesión de auth.users por navegador. Este provider y AuthProvider
 * (empleados) nunca se montan juntos en el mismo árbol — cada familia de
 * rutas monta solo el que le corresponde (ver router.tsx). Si la misma
 * persona fuera empleada en un negocio y cliente en otro, comparte
 * auth.uid() entre ambos roles, pero app_users_cafexis y customers_cafexis
 * son tablas independientes con su propio RLS: no hay fuga de datos entre
 * uno y otro, solo dos interpretaciones distintas de la misma sesión.
 */
export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer>()
  const [loading, setLoading] = useState(true)
  const initialLoadDone = useRef(false)

  const refresh = useCallback(async () => {
    const result = await customerAuthService.getCurrentCustomer()
    setCustomer(result)
  }, [])

  useEffect(() => {
    refresh().finally(() => {
      initialLoadDone.current = true
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      if (!initialLoadDone.current) return
      refresh()
    })

    return () => subscription.subscription.unsubscribe()
  }, [refresh])

  const loginWithGoogle = useCallback(async (redirectTo: string) => {
    await customerAuthService.loginWithGoogle(redirectTo)
    // signInWithOAuth redirige de inmediato al proveedor; no hay nada que refrescar aquí.
  }, [])

  const logout = useCallback(async () => {
    await customerAuthService.logout()
    setCustomer(undefined)
  }, [])

  return (
    <CustomerAuthContext.Provider value={{ customer, loading, loginWithGoogle, logout, refresh }}>
      {children}
    </CustomerAuthContext.Provider>
  )
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const ctx = useContext(CustomerAuthContext)
  if (!ctx) throw new Error('useCustomerAuth debe usarse dentro de <CustomerAuthProvider>')
  return ctx
}
