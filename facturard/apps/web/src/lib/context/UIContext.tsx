'use client'

import { createContext, useContext, useState } from 'react'
import type { JSX, ReactNode } from 'react'

interface UIState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  facturacionMode: 'estandar' | 'rapido'
  setFacturacionMode: (mode: 'estandar' | 'rapido') => void
  globalSearch: string
  setGlobalSearch: (search: string) => void
}

const UIContext = createContext<UIState | null>(null)

export function UIProvider({ children }: { children: ReactNode }): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [facturacionMode, setFacturacionMode] = useState<'estandar' | 'rapido'>('estandar')
  const [globalSearch, setGlobalSearch] = useState('')

  return (
    <UIContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        facturacionMode,
        setFacturacionMode,
        globalSearch,
        setGlobalSearch,
      }}
    >
      {children}
    </UIContext.Provider>
  )
}

export function useUI(): UIState {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used within UIProvider')
  return ctx
}
