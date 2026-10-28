'use client'

import { Suspense } from 'react'
import type { JSX } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { Spinner } from '@/components/ui/spinner'
import { useGhlInit } from '@/hooks/useGhlInit'

function EntryContent(): JSX.Element {
  const { error } = useGhlInit()

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background-canvas px-4 text-center">
        <Logo stacked />
        <div className="flex flex-col gap-1">
          <h1 className="text-h6 text-text-primary">Abre Factura Dmaia desde Dmaia CRM</h1>
          <p className="max-w-sm text-body-sm text-text-secondary">
            Factura Dmaia funciona dentro de tu cuenta de Dmaia CRM. Ábrelo desde ahí para continuar.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 text-ui-sm text-text-secondary">
          <span>¿Todavía no tienes cuenta?</span>
          <div className="flex gap-3">
            <Link href="/registro" className="rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white hover:bg-brand-600">
              Crear cuenta
            </Link>
            <Link href="/login" className="rounded-lg border border-neutral-300 px-4 py-2 font-semibold text-text-primary hover:bg-neutral-50">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background-canvas">
      <Logo stacked />
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
