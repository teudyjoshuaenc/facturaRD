'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { clearSession, getToken, getTenant, saveSession, type TenantInfo } from '@/lib/session'

interface AuthState {
  token: string | null
  tenant: TenantInfo | null
  isReady: boolean
  setAuth: (token: string, tenant: TenantInfo) => void
  clearAuth: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [token, setToken] = useState<string | null>(null)
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setToken(getToken())
    setTenant(getTenant())
    setIsReady(true)
  }, [])

  const setAuth = useCallback((newToken: string, newTenant: TenantInfo) => {
    saveSession(newToken, newTenant)
    setToken(newToken)
    setTenant(newTenant)
  }, [])

  const clearAuth = useCallback(() => {
    clearSession()
    setToken(null)
    setTenant(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, tenant, isReady, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}