'use client'

import { Suspense } from 'react'
import type { JSX } from 'react'
import { CotizacionForm } from '@/components/cotizaciones/CotizacionForm'
import { Spinner } from '@/components/ui/spinner'

export default function NuevaCotizacionPage(): JSX.Element {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} />
      </div>
    }>
      <CotizacionForm />
    </Suspense>
  )
}
