import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ConnectModal } from '@/components/domain/ConnectModal'
import { supabase } from '@/services/api/supabaseClient'
import * as customerAuthService from '@/services/api/customerAuthService'
import type { Customer } from '@/types/domain'

interface CustomerAuthContextValue {
  customer: Customer | undefined
  loading: boolean
  /** Abre la ventana con las dos formas de conectarse: Google o sin cuenta. */
  promptConnect: () => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined)

/**
 * Sesión del cliente final (Google o invitado), equivalente a AuthContext.tsx
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
  const [connectOpen, setConnectOpen] = useState(false)
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

  // signInWithOAuth redirige de inmediato al proveedor; no hay nada que refrescar aquí.
  const loginWithGoogle = useCallback(() => customerAuthService.loginWithGoogle(window.location.href), [])

  // A diferencia de Google, no sale de la página: el carrito sigue ahí al conectarse.
  const loginAsGuest = useCallback(
    async (name: string) => {
      await customerAuthService.loginAsGuest(name)
      await refresh()
    },
    [refresh],
  )

  const promptConnect = useCallback(() => setConnectOpen(true), [])
  const closeConnect = useCallback(() => setConnectOpen(false), [])

  const logout = useCallback(async () => {
    await customerAuthService.logout()
    setCustomer(undefined)
  }, [])

  return (
    <CustomerAuthContext.Provider value={{ customer, loading, promptConnect, logout, refresh }}>
      {children}
      {connectOpen && <ConnectModal onGoogle={loginWithGoogle} onGuest={loginAsGuest} onClose={closeConnect} />}
    </CustomerAuthContext.Provider>
  )
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const ctx = useContext(CustomerAuthContext)
  if (!ctx) throw new Error('useCustomerAuth debe usarse dentro de <CustomerAuthProvider>')
  return ctx
}
