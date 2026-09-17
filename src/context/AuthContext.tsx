import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/services/api/supabaseClient'
import * as authService from '@/services/api/authService'
import type { AppUser, Business, LoginInput, RegisterInput } from '@/types/domain'

interface AuthContextValue {
  business: Business | undefined
  user: AppUser | undefined
  loading: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState<Business>()
  const [user, setUser] = useState<AppUser>()
  const [loading, setLoading] = useState(true)
  // Evita una carrera entre el fetch inicial y el primer evento de
  // onAuthStateChange (Supabase dispara ambos al montar).
  const initialLoadDone = useRef(false)

  const refresh = useCallback(async () => {
    const account = await authService.getCurrentAccount()
    setBusiness(account?.business)
    setUser(account?.user)
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

  const login = useCallback(
    async (input: LoginInput) => {
      await authService.login(input)
      await refresh()
    },
    [refresh],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      await authService.register(input)
      await refresh()
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    await authService.logout()
    setBusiness(undefined)
    setUser(undefined)
  }, [])

  return (
    <AuthContext.Provider value={{ business, user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
