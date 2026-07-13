'use client'

import type { JSX } from 'react'
import { useState } from 'react'
import { CheckCircle2, RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { useRncValidation } from '@/hooks/useRncValidation'

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h6 text-text-primary">Identifícate</h2>
        <p className="text-body-sm text-text-secondary">
          Empresa con RNC o persona física con cédula. Lo validamos con la DGII y confirmamos tu
          nombre.
        </p>
      </div>

      <ToggleGroup
        value={tipo}
        onChange={(v) => cambiarTipo(v as TipoIdentificacion)}
        options={[
          { value: 'RNC', label: 'Tengo RNC' },
          { value: 'CEDULA', label: 'Tengo cédula' },
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
        <div className="flex items-center gap-2 rounded-lg border border-success-500/40 bg-success-500/10 px-4 py-3 text-body-sm text-success-700">
          <CheckCircle2 size={18} className="shrink-0" />
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
        className="w-full"
      >
        Continuar
      </Button>
    </div>
  )
}
