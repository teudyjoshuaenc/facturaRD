'use client'

import { Suspense, useState } from 'react'
import type { JSX } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Spinner } from '@/components/ui/spinner'
import { OnboardingMarketingPanel } from '@/components/onboarding/OnboardingMarketingPanel'
import { IdentificacionStep, type IdentificacionResult } from '@/components/onboarding/IdentificacionStep'
import { CertificacionChoiceStep } from '@/components/onboarding/CertificacionChoiceStep'
import { CertificadoStep } from '@/components/onboarding/CertificadoStep'
import { CrearCuentaStep } from '@/components/onboarding/CrearCuentaStep'
import { leerGhlPrefill } from '@/lib/ghl-prefill'
import { SecuenciasStep } from '@/components/onboarding/SecuenciasStep'
import { FinanzasStep } from '@/components/onboarding/FinanzasStep'
import { SuccessStep } from '@/components/onboarding/SuccessStep'
import { cn } from '@/lib/utils'
import type { TenantInfo } from '@/lib/session'

// Pasos internos del wizard. El indicador superior los agrupa en 3 fases:
// Identifícate · Certificación · Listo (la fase "Certificación" cubre la elección
// y, si aplica, subir el .p12, configurar secuencias y activar Finanzas).
type Step = 'ident' | 'choice' | 'cert' | 'cuenta' | 'secuencias' | 'finanzas' | 'exito'

const FASES = [
  { fase: 1, label: 'Identifícate' },
  { fase: 2, label: 'Certificación' },
  { fase: 3, label: 'Listo' },
] as const

function faseDe(step: Step): number {
  if (step === 'ident') return 1
  if (step === 'exito') return 3
  return 2
}

function Progress({ step }: { step: Step }): JSX.Element {
  const faseActual = faseDe(step)
  return (
    <div className="mb-9 flex items-center">
      {FASES.map((f, i) => (
        <div key={f.fase} className={cn('flex items-center', i < FASES.length - 1 && 'flex-1')}>
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full text-ui-default font-bold transition-all duration-300 motion-reduce:transition-none',
                faseActual > f.fase
                  ? 'bg-gradient-to-br from-success-400 to-success-600 text-white shadow-md shadow-success-500/30'
                  : faseActual === f.fase
                    ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/35 ring-4 ring-brand-100 scale-110'
                    : 'bg-neutral-100 text-text-disabled',
              )}
            >
              {faseActual > f.fase ? <Check size={17} /> : f.fase}
            </div>
            <span className={cn('text-ui-xs font-semibold', faseActual >= f.fase ? 'text-text-primary' : 'text-text-disabled')}>
              {f.label}
            </span>
          </div>
          {i < FASES.length - 1 && (
            <div className="mx-2.5 mb-5 h-1 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <div
                className={cn(
                  'h-full rounded-full bg-success-500 transition-all duration-500 ease-out motion-reduce:transition-none',
                  faseActual > f.fase ? 'w-full' : 'w-0',
                )}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function OnboardingContent(): JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locationId = searchParams.get('location_id') ?? ''
  const prefill = leerGhlPrefill(searchParams)

  const [step, setStep] = useState<Step>('ident')
  const [ident, setIdent] = useState<IdentificacionResult | null>(null)
  // certificando: true cuando el usuario declara estar ya certificado.
  const [certificando, setCertificando] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [tenant, setTenant] = useState<TenantInfo | null>(null)

  const enExito = step === 'exito'

  return (
    <main className="grid min-h-screen grid-cols-1 bg-background-canvas lg:grid-cols-2">
      <OnboardingMarketingPanel />

      <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(3,121,213,0.25)] sm:p-8">
          <div className="mb-8 flex flex-col gap-3 lg:hidden">
            <Logo />
          </div>

          {!enExito && (
            <div className="mb-8 flex flex-col gap-1">
              <h1 className="text-h5 font-bold tracking-tight text-text-primary">Configura tu cuenta</h1>
              <p className="text-body-sm text-text-secondary">
                Identifícate y empieza a cotizar y facturar en minutos.
              </p>
            </div>
          )}

          {!enExito && <Progress step={step} />}

          <div key={step} className="animate-fade-in-up">
            {step === 'ident' && (
              <IdentificacionStep
                initial={ident ? { identificacion: ident.identificacion, tipo: ident.tipo } : undefined}
                onComplete={(result) => {
                  setIdent(result)
                  setStep('choice')
                }}
              />
            )}

            {step === 'choice' && (
              <CertificacionChoiceStep
                onYaCertificado={() => {
                  setCertificando(true)
                  setStep('cert')
                }}
                onTodaviaNo={() => {
                  setCertificando(false)
                  setFile(null)
                  setPassphrase('')
                  setStep('cuenta')
                }}
                onBack={() => setStep('ident')}
              />
            )}

            {step === 'cert' && (
              <CertificadoStep
                file={file}
                passphrase={passphrase}
                onFileChange={setFile}
                onPassphraseChange={setPassphrase}
                onNext={() => setStep('cuenta')}
                onBack={() => setStep('choice')}
              />
            )}

            {step === 'cuenta' && ident && (
              <CrearCuentaStep
                locationId={locationId}
                identificacion={ident.identificacion}
                tipo={ident.tipo}
                razonSocial={ident.razonSocial}
                razonSocialManual={ident.manual}
                file={certificando ? file : null}
                passphrase={passphrase}
                prefill={prefill}
                onCreated={(t) => {
                  setTenant(t)
                  // Con certificado → configurar secuencias primero; ambos caminos pasan por Finanzas.
                  setStep(certificando ? 'secuencias' : 'finanzas')
                }}
                onBack={() => setStep(certificando ? 'cert' : 'choice')}
              />
            )}

            {step === 'secuencias' && <SecuenciasStep detectar onDone={() => setStep('finanzas')} />}

            {step === 'finanzas' && <FinanzasStep onDone={() => setStep('exito')} />}

            {enExito && tenant && (
              <SuccessStep
                tenant={tenant}
                puedeEmitir={certificando}
                onContinue={() => router.push(certificando ? '/nueva-factura' : '/cotizaciones')}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default function OnboardingPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background-canvas">
          <Spinner size={28} />
        </main>
      }
    >
      <OnboardingContent />
    </Suspense>
  )
}
