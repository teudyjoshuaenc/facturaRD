'use client'

import { useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/context/AuthContext'
import { UIProvider } from '@/lib/context/UIContext'

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <UIProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </UIProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
