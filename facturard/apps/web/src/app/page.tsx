'use client'

import { Suspense } from 'react'
import type { JSX } from 'react'
import { Logo } from '@/components/ui/logo'
import { Spinner } from '@/components/ui/spinner'
import { useGhlInit } from '@/hooks/useGhlInit'

function EntryContent(): JSX.Element {
  const { error } = useGhlInit()

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background-canvas px-4 text-center">
        <Logo />
        <div className="flex flex-col gap-1">
          <h1 className="text-h6 text-text-primary">Abre Factura Dmaia desde Dmaia CRM</h1>
          <p className="max-w-sm text-body-sm text-text-secondary">
            Factura Dmaia funciona dentro de tu cuenta de Dmaia CRM. Ábrelo desde ahí para continuar.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background-canvas">
      <Logo />
      <Spinner size={28} />
    </main>
  )
}

export default function HomePage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background-canvas">
          <Spinner size={28} />
        </main>
      }
    >
      <EntryContent />
    </Suspense>
  )
}
