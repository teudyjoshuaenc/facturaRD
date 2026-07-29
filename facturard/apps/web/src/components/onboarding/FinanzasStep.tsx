'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PresupuestoOnboardingWizard } from '@/components/presupuesto/PresupuestoOnboardingWizard'

interface Props {
  onDone: () => void
}

export function FinanzasStep({ onDone }: Props): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h6 text-text-primary">Activa tu flujo de caja</h2>
        <p className="text-body-sm text-text-secondary">
          Responde unas preguntas sobre tu capital y presupuesto para activar el panel de Finanzas.
          Es opcional: puedes hacerlo ahora o más tarde desde Configuración.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-neutral-50 p-4">
        <Wallet size={20} className="shrink-0 text-brand-600" />
        <p className="text-ui-sm text-text-secondary">
          Capital inicial, ingresos, costos fijos y variables — todo se usa para proyectar tu caja.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button variant="primary" size="lg" className="w-full" onClick={() => setOpen(true)}>
          Configurar ahora
        </Button>
        <Button variant="ghost" size="md" className="w-full" onClick={onDone}>
          Omitir por ahora
        </Button>
      </div>

      <PresupuestoOnboardingWizard
        open={open}
        onClose={() => {
          setOpen(false)
          onDone()
        }}
      />
    </div>
  )
}
