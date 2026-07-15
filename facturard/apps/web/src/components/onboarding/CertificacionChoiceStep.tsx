'use client'

import type { JSX } from 'react'
import { ShieldCheck, Sparkles, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  onYaCertificado: () => void
  onTodaviaNo: () => void
  onBack: () => void
}

export function CertificacionChoiceStep({ onYaCertificado, onTodaviaNo, onBack }: Props): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h6 text-text-primary">¿Ya facturas electrónicamente ante la DGII?</h2>
        <p className="text-body-sm text-text-secondary">
          El comprobante fiscal electrónico (e-CF) se firma con un certificado digital. Si aún no lo
          tienes, no te preocupes: puedes empezar hoy y certificarte después.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onYaCertificado}
          className="group flex items-center gap-4 rounded-xl border border-border bg-white p-4 text-left transition-colors hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-500">
            <ShieldCheck size={20} />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="text-body-base font-medium text-text-primary">Sí, ya estoy certificado</span>
            <span className="text-body-sm text-text-secondary">Tengo mi certificado .p12 y mis secuencias.</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
        </button>

        <button
          type="button"
          onClick={onTodaviaNo}
          className="group flex items-center gap-4 rounded-xl border border-border bg-white p-4 text-left transition-colors hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-500/10 text-success-600">
            <Sparkles size={20} />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="text-body-base font-medium text-text-primary">Todavía no / No sé qué es</span>
            <span className="text-body-sm text-text-secondary">Empieza a cotizar y preparar facturas ya mismo.</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <Button variant="ghost" size="md" className="self-start" onClick={onBack}>
        Atrás
      </Button>
    </div>
  )
}
