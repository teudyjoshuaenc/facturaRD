'use client'

import { Suspense, useState } from 'react'
import type { JSX } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Spinner } from '@/components/ui/spinner'
import { RncStep } from '@/components/onboarding/RncStep'
import { CertificadoStep } from '@/components/onboarding/CertificadoStep'
import { CrearCuentaStep } from '@/components/onboarding/CrearCuentaStep'
import { SecuenciasStep } from '@/components/onboarding/SecuenciasStep'
import { SuccessStep } from '@/components/onboarding/SuccessStep'
import { cn } from '@/lib/utils'
import type { TenantInfo } from '@/lib/session'

const STEPS = [
  { id: 1, label: 'Negocio' },
  { id: 2, label: 'Certificado' },
  { id: 3, label: 'Cuenta' },
  { id: 4, label: 'Secuencias' },
] as const

// El indicador de progreso es fluido (se adapta al ancho del iframe). Usa el
// lenguaje visual del onboarding actual: activo brand-500, completado success-500.
function Progress({ step }: { step: number }): JSX.Element {
  return (
    <div className="mb-8 flex items-center">
      {STEPS.map((s, i) => (
        <div key={s.id} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full text-ui-default font-semibold transition-colors duration-200 motion-reduce:transition-none',
                step > s.id
                  ? 'bg-success-500 text-white'
                  : step === s.id
                    ? 'bg-brand-500 text-white'
                    : 'bg-neutral-100 text-text-disabled',
              )}
            >
              {step > s.id ? <Check size={16} /> : s.id}
            </div>
            <span className={cn('text-ui-xs', step >= s.id ? 'text-text-primary' : 'text-text-disabled')}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                'mx-2 mb-5 h-0.5 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none',
                step > s.id ? 'bg-success-500' : 'bg-neutral-200',
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

  const [step, setStep] = useState(1)
  const [rnc, setRnc] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [tenant, setTenant] = useState<TenantInfo | null>(null)

  const enExito = step === 5

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-canvas px-4 py-10">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          {!enExito && (
            <div className="flex flex-col gap-1">
              <h1 className="text-h5 text-text-primary">Configura tu cuenta</h1>
              <p className="text-body-sm text-text-secondary">
                Cuatro pasos para empezar a emitir comprobantes fiscales electrónicos.
              </p>
            </div>
          )}
        </div>

        {!enExito && <Progress step={step} />}

        {step === 1 && (
          <RncStep
            initialRnc={rnc}
            onComplete={(validRnc, razon) => {
              setRnc(validRnc)
              setRazonSocial(razon)
              setStep(2)
            }}
          />
        )}

        {step === 2 && (
          <CertificadoStep
            file={file}
            passphrase={passphrase}
            onFileChange={setFile}
            onPassphraseChange={setPassphrase}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && file && (
          <CrearCuentaStep
            locationId={locationId}
            rnc={rnc}
            razonSocial={razonSocial}
            file={file}
            passphrase={passphrase}
            onCreated={(t) => {
              setTenant(t)
              setStep(4)
            }}
            // Volver al Paso 2 a corregir archivo/contraseña sin perder el RNC validado.
            onBackToCert={() => setStep(2)}
          />
        )}

        {step === 4 && <SecuenciasStep onDone={() => setStep(5)} />}

        {enExito && tenant && (
          <SuccessStep tenant={tenant} onContinue={() => router.push('/nueva-factura')} />
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
