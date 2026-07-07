'use client'

import type { JSX } from 'react'
import { useState } from 'react'
import { CheckCircle2, RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useRncValidation } from '@/hooks/useRncValidation'

interface Props {
  initialRnc?: string
  onComplete: (rnc: string, razonSocial: string) => void
}

export function RncStep({ initialRnc = '', onComplete }: Props): JSX.Element {
  const [rnc, setRnc] = useState(initialRnc)
  // `nonce` fuerza un reintento cuando la API de la DGII está caída, sin cambiar el RNC.
  const [nonce, setNonce] = useState(0)
  const { status, razonSocial, error } = useRncValidation(rnc, nonce)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h6 text-text-primary">Identifica tu negocio</h2>
        <p className="text-body-sm text-text-secondary">
          Escribe el RNC de tu empresa. Lo validamos con la DGII y confirmamos la razón social.
        </p>
      </div>

      <div className="relative">
        <Input
          label="RNC"
          placeholder="9 dígitos"
          inputMode="numeric"
          autoFocus
          maxLength={11}
          value={rnc}
          onChange={(e) => setRnc(e.target.value.replace(/\D/g, '').slice(0, 11))}
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
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{razonSocial}</span>
        </div>
      )}

      {status === 'invalid' && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setNonce((n) => n + 1)}>
          <RotateCcw size={15} />
          Reintentar validación
        </Button>
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
