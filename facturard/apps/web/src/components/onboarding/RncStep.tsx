'use client'

import type { JSX } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useRncValidation } from '@/hooks/useRncValidation'
import { useState } from 'react'

interface Props {
  onComplete: (rnc: string, razonSocial: string) => void
}

export function RncStep({ onComplete }: Props): JSX.Element {
  const [rnc, setRnc] = useState('')
  const { status, razonSocial, error } = useRncValidation(rnc)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-h6 text-text-primary">Información de empresa</h2>
        <p className="text-body-sm text-text-secondary">
          Ingresa el RNC de tu empresa para validarlo con la DGII
        </p>
      </div>

      <div className="relative">
        <Input
          label="RNC *"
          placeholder="9 dígitos"
          inputMode="numeric"
          maxLength={9}
          value={rnc}
          onChange={(e) => setRnc(e.target.value.replace(/\D/g, '').slice(0, 9))}
          error={status === 'invalid' ? error : ''}
        />
        {status === 'loading' && (
          <div className="absolute right-3 top-9">
            <Spinner size={18} />
          </div>
        )}
      </div>

      {status === 'valid' && (
        <div className="flex items-center gap-2 rounded-lg border border-success-500/40 bg-success-500/10 px-4 py-3 text-body-sm text-success-700">
          <CheckCircle2 size={18} />
          <span>{razonSocial}</span>
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        disabled={status !== 'valid'}
        onClick={() => onComplete(rnc, razonSocial)}
        className="w-full"
      >
        Continuar
      </Button>
    </div>
  )
}
