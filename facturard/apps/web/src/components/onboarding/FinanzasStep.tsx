'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { PresupuestoOnboardingWizard } from '@/components/presupuesto/PresupuestoOnboardingWizard'
import { OnboardingDashboardPreview } from './OnboardingDashboardPreview'

interface Props {
  onDone: () => void
}

// Al llegar aquí mostramos el Dashboard real con data mock de fondo (el
// usuario "ya está dentro" de la app) y el wizard de presupuesto abierto
// encima. Cerrar el wizard (X, Cancelar, Escape o click fuera) = saltar este
// paso y pasar directo a la app real — no hay forma de interactuar con el
// dashboard de fondo (pointer-events-none).
export function FinanzasStep({ onDone }: Props): JSX.Element {
  const [open, setOpen] = useState(true)

  return (
    <>
      <OnboardingDashboardPreview />
      <PresupuestoOnboardingWizard
        open={open}
        onClose={() => {
          setOpen(false)
          onDone()
        }}
      />
    </>
  )
}
