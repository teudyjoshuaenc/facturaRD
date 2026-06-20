'use client'

import { Suspense, useState } from 'react'
import type { JSX } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Spinner } from '@/components/ui/spinner'
import { RncStep } from '@/components/onboarding/RncStep'
import { CertificadoStep } from '@/components/onboarding/CertificadoStep'
import { SuccessStep } from '@/components/onboarding/SuccessStep'
import { cn } from '@/lib/utils'
import type { TenantInfo } from '@/lib/session'

const STEPS = [
  { id: 1, label: 'Empresa' },
  { id: 2, label: 'Certificado' },
  { id: 3, label: 'Listo' },
] as const

function OnboardingContent(): JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locationId = searchParams.get('location_id') ?? ''

  const [step, setStep] = useState(1)
  const [rnc, setRnc] = useState('')
  const [tenantResult, setTenantResult] = useState<TenantInfo | null>(null)

  function handleRncComplete(validRnc: string): void {
    setRnc(validRnc)
    setStep(2)
  }

  function handleCertComplete(tenant: TenantInfo): void {
    setTenantResult(tenant)
    setStep(3)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-canvas px-4 py-12">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-sm sm:p-10">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          <div>
            <h1 className="text-h4 text-text-primary">Configura tu cuenta</h1>
            <p className="text-body-sm text-text-secondary">
              Completa estos pasos para empezar a emitir comprobantes fiscales electrónicos
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-10 flex items-center justify-center">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full text-ui-default font-semibold',
                    step > s.id
                      ? 'bg-success-500 text-white'
                      : step === s.id
                        ? 'bg-brand-500 text-white'
                        : 'bg-neutral-100 text-text-disabled',
                  )}
                >
                  {step > s.id ? <Check size={18} /> : s.id}
                </div>
                <span
                  className={cn(
                    'text-ui-sm',
                    step >= s.id ? 'text-text-primary' : 'text-text-disabled',
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-3 mb-6 h-px w-16',
                    step > s.id ? 'bg-success-500' : 'bg-neutral-200',
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {step === 1 && <RncStep onComplete={handleRncComplete} />}

        {step === 2 && (
          <CertificadoStep
            locationId={locationId}
            rnc={rnc}
            onComplete={handleCertComplete}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && tenantResult && (
          <SuccessStep tenant={tenantResult} onContinue={() => router.push('/dashboard')} />
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
