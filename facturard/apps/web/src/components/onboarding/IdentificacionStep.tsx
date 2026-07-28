'use client'

import type { JSX } from 'react'
import { useState } from 'react'
import { CheckCircle2, RotateCcw, Building2, User, UserCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { useRncValidation } from '@/hooks/useRncValidation'
import { cn } from '@/lib/utils'

export type TipoIdentificacion = 'RNC' | 'CEDULA'

export interface IdentificacionResult {
  identificacion: string
  tipo: TipoIdentificacion
  razonSocial: string
  /** true cuando el nombre lo escribió el usuario (cédula fuera del padrón DGII). */
  manual: boolean
}

interface Props {
  initial?: { identificacion: string; tipo: TipoIdentificacion } | undefined
  onComplete: (result: IdentificacionResult) => void
}

export function IdentificacionStep({ initial, onComplete }: Props): JSX.Element {
  const [tipo, setTipo] = useState<TipoIdentificacion>(initial?.tipo ?? 'RNC')
  const [valor, setValor] = useState(initial?.identificacion ?? '')
  const [nombreManual, setNombreManual] = useState('')
  const [nonce, setNonce] = useState(0)
  const { status, razonSocial, error } = useRncValidation(valor, nonce)

  const esCedula = tipo === 'CEDULA'
  const largoOk = esCedula ? valor.length === 11 : valor.length === 9
  // Cédula fuera del padrón: dejamos continuar con el nombre escrito a mano.
  const permiteManual = esCedula && status === 'invalid' && largoOk

  function cambiarTipo(next: TipoIdentificacion): void {
    setTipo(next)
    setValor('')
    setNombreManual('')
    setNonce((n) => n + 1)
  }

  function continuar(): void {
    if (status === 'valid') {
      onComplete({ identificacion: valor, tipo, razonSocial, manual: false })
    } else if (permiteManual && nombreManual.trim() !== '') {
      onComplete({ identificacion: valor, tipo, razonSocial: nombreManual.trim(), manual: true })
    }
  }

  const puedeContinuar = status === 'valid' || (permiteManual && nombreManual.trim() !== '')

  return (
    <div className="animate-fade-in-up flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-ui-xs font-bold uppercase tracking-wide text-brand-600">Paso 1</span>
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/30">
            <UserCheck size={21} />
          </span>
          <div className="flex flex-col gap-1 pt-1">
            <h2 className="text-h6 font-bold leading-tight text-text-primary">Identifícate</h2>
            <p className="text-body-sm text-text-secondary">
              Empresa con RNC o persona física con cédula. Lo validamos con la DGII y confirmamos tu
              nombre.
            </p>
          </div>
        </div>
      </div>

      <ToggleGroup
        variant="solid"
        value={tipo}
        onChange={(v) => cambiarTipo(v as TipoIdentificacion)}
        options={[
          { value: 'RNC', label: 'Tengo RNC', icon: Building2 },
          { value: 'CEDULA', label: 'Tengo cédula', icon: User },
        ]}
      />

      <div className="relative">
        <Input
          label={esCedula ? 'Cédula' : 'RNC'}
          placeholder={esCedula ? '11 dígitos' : '9 dígitos'}
          inputMode="numeric"
          autoFocus
          maxLength={esCedula ? 11 : 9}
          value={valor}
          onChange={(e) => {
            const max = esCedula ? 11 : 9
            setValor(e.target.value.replace(/\D/g, '').slice(0, max))
            setNombreManual('')
          }}
          error={status === 'invalid' && !esCedula ? error : ''}
        />
        {status === 'loading' && (
          <div className="absolute right-3 top-9">
            <Spinner size={18} />
          </div>
        )}
      </div>

      {status === 'valid' && (
        <div className="animate-scale-in flex items-center gap-3 rounded-2xl border border-success-500/25 bg-gradient-to-br from-success-50 to-white px-4 py-3.5 text-body-sm font-semibold text-success-700">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-success-400 to-success-600 text-white shadow-sm shadow-success-500/30">
            <CheckCircle2 size={16} />
          </span>
          <span>{razonSocial}</span>
        </div>
      )}

      {/* RNC de empresa no encontrado → reintentar (la DGII puede estar caída). */}
      {status === 'invalid' && !esCedula && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setNonce((n) => n + 1)}>
          <RotateCcw size={15} />
          Reintentar validación
        </Button>
      )}

      {/* Cédula fuera del padrón → permitir nombre manual (se guarda sin validar). */}
      {permiteManual && (
        <div className="flex flex-col gap-2">
          <p className="text-ui-sm text-text-secondary">
            No encontramos esa cédula en la DGII. Escribe tu nombre para continuar.
          </p>
          <Input
            label="Tu nombre"
            placeholder="Nombre y apellido"
            value={nombreManual}
            onChange={(e) => setNombreManual(e.target.value)}
          />
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        disabled={!puedeContinuar}
        onClick={continuar}
        className={cn('w-full transition-all duration-300', puedeContinuar && 'shadow-lg shadow-brand-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-500/40')}
      >
        Continuar
      </Button>
    </div>
  )
}
