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
        <p className="text-body-base text-text-secondary">Acceso solo disponible desde GoHighLevel</p>
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
