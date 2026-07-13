'use client'

import { Suspense, useState } from 'react'
import type { JSX } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Spinner } from '@/components/ui/spinner'
import { IdentificacionStep, type IdentificacionResult } from '@/components/onboarding/IdentificacionStep'
import { CertificacionChoiceStep } from '@/components/onboarding/CertificacionChoiceStep'
import { CertificadoStep } from '@/components/onboarding/CertificadoStep'
import { CrearCuentaStep } from '@/components/onboarding/CrearCuentaStep'
import { SecuenciasStep } from '@/components/onboarding/SecuenciasStep'
import { SuccessStep } from '@/components/onboarding/SuccessStep'
import { cn } from '@/lib/utils'
import type { TenantInfo } from '@/lib/session'

// Pasos internos del wizard. El indicador superior los agrupa en 3 fases:
// Identifícate · Certificación · Listo (la fase "Certificación" cubre la elección
// y, si aplica, subir el .p12 y configurar secuencias).
type Step = 'ident' | 'choice' | 'cert' | 'cuenta' | 'secuencias' | 'exito'

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
    <div className="mb-8 flex items-center">
      {FASES.map((f, i) => (
        <div key={f.fase} className={cn('flex items-center', i < FASES.length - 1 && 'flex-1')}>
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full text-ui-default font-semibold transition-colors duration-200 motion-reduce:transition-none',
                faseActual > f.fase
                  ? 'bg-success-500 text-white'
                  : faseActual === f.fase
                    ? 'bg-brand-500 text-white'
                    : 'bg-neutral-100 text-text-disabled',
              )}
            >
              {faseActual > f.fase ? <Check size={16} /> : f.fase}
            </div>
            <span className={cn('text-ui-xs', faseActual >= f.fase ? 'text-text-primary' : 'text-text-disabled')}>
              {f.label}
            </span>
          </div>
          {i < FASES.length - 1 && (
            <div
              className={cn(
                'mx-2 mb-5 h-0.5 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none',
                faseActual > f.fase ? 'bg-success-500' : 'bg-neutral-200',
              )}
            />
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

  const [step, setStep] = useState<Step>('ident')
  const [ident, setIdent] = useState<IdentificacionResult | null>(null)
  // certificando: true cuando el usuario declara estar ya certificado.
  const [certificando, setCertificando] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [tenant, setTenant] = useState<TenantInfo | null>(null)

  const enExito = step === 'exito'

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-canvas px-4 py-10">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          {!enExito && (
            <div className="flex flex-col gap-1">
              <h1 className="text-h5 text-text-primary">Configura tu cuenta</h1>
              <p className="text-body-sm text-text-secondary">
                Identifícate y empieza a cotizar y facturar en minutos.
              </p>
            </div>
          )}
        </div>

        {!enExito && <Progress step={step} />}

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
            onCreated={(t) => {
              setTenant(t)
              // Con certificado → configurar secuencias; sin certificado → directo a éxito.
              setStep(certificando ? 'secuencias' : 'exito')
            }}
            onBack={() => setStep(certificando ? 'cert' : 'choice')}
          />
        )}

        {step === 'secuencias' && <SecuenciasStep onDone={() => setStep('exito')} />}

        {enExito && tenant && (
          <SuccessStep
            tenant={tenant}
            puedeEmitir={certificando}
            onContinue={() => router.push(certificando ? '/nueva-factura' : '/cotizaciones')}
          />
        )}
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
