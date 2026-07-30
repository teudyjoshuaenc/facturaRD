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
    <div className="animate-fade-in-up flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-ui-xs font-bold uppercase tracking-wide text-brand-600">Paso 2</span>
        <h2 className="text-h6 font-bold leading-tight text-text-primary">¿Ya facturas electrónicamente ante la DGII?</h2>
        <p className="text-body-sm text-text-secondary">
          El comprobante fiscal electrónico (e-CF) se firma con un certificado digital. Si aún no lo
          tienes, no te preocupes: puedes empezar hoy y certificarte después.
        </p>
      </div>

      <div className="flex flex-col gap-3.5">
        <button
          type="button"
          onClick={onYaCertificado}
          className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-white p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_12px_28px_-8px_rgba(3,121,213,0.35)] focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          {/* Wash de color que entra al hacer hover — reemplaza el borde plano */}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-white opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden />

          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/30 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
            <ShieldCheck size={22} />
          </span>
          <span className="relative flex flex-1 flex-col">
            <span className="text-body-base font-bold text-text-primary">Sí, ya estoy certificado</span>
            <span className="text-body-sm text-text-secondary">Tengo mi certificado .p12 y mis secuencias.</span>
          </span>
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-50 text-text-tertiary transition-all duration-300 group-hover:bg-brand-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-brand-500/40">
            <ChevronRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </button>

        <button
          type="button"
          onClick={onTodaviaNo}
          className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-white p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_12px_28px_-8px_rgba(244,122,60,0.35)] focus:outline-none focus:ring-2 focus:ring-cta-500/30"
        >
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cta-50 via-white to-white opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden />

          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cta-500 to-cta-600 text-white shadow-lg shadow-cta-500/30 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
            <Sparkles size={22} />
          </span>
          <span className="relative flex flex-1 flex-col">
            <span className="text-body-base font-bold text-text-primary">Todavía no / No sé qué es</span>
            <span className="text-body-sm text-text-secondary">Empieza a cotizar y preparar facturas ya mismo.</span>
          </span>
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-50 text-text-tertiary transition-all duration-300 group-hover:bg-cta-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-cta-500/40">
            <ChevronRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </button>
      </div>

      <Button variant="ghost" size="md" className="self-start" onClick={onBack}>
        Atrás
      </Button>
    </div>
  )
}
