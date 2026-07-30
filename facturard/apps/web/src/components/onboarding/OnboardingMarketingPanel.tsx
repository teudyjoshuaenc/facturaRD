import type { JSX } from 'react'
import { ShieldCheck, FileText, Zap } from 'lucide-react'
import { Logo } from '@/components/ui/logo'

const FEATURES = [
  {
    icon: ShieldCheck,
    text: 'Facturación electrónica homologada con la DGII — sin rechazos por errores de formato.',
  },
  {
    icon: FileText,
    text: 'Cotiza y guarda borradores aunque todavía no tengas tu certificado digital.',
  },
  {
    icon: Zap,
    text: 'Todo conectado a Dmaia CRM: contactos y cobros en un solo lugar.',
  },
]

export function OnboardingMarketingPanel(): JSX.Element {
  return (
    <div className="relative hidden h-full flex-col justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-white to-white px-12 py-12 lg:flex xl:px-20">
      {/* Textura de puntos — mismo recurso decorativo del dashboard, sin assets externos */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: 'radial-gradient(#0379D5 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          maskImage: 'radial-gradient(ellipse 520px 420px at 15% 20%, black, transparent)',
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" aria-hidden />

      <div className="relative flex max-w-[460px] flex-col gap-8">
        <Logo stacked />

        <div className="flex flex-col gap-3">
          <h1 className="text-h3 font-bold leading-tight tracking-tight text-text-primary">
            Factura, cotiza y cobra desde <span className="text-brand-500">un solo lugar</span>.
          </h1>
          <p className="text-body-base text-text-secondary">
            Comprobantes fiscales electrónicos listos para la DGII, cotizaciones y flujo de caja — sin hojas de cálculo, sin dolores de cabeza.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {FEATURES.map((f) => (
            <div key={f.text} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                <f.icon size={17} />
              </span>
              <p className="pt-1.5 text-body-sm text-text-secondary">{f.text}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
