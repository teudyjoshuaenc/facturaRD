'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { api, getErrorMessage } from '@/lib/api'

interface Props {
  onDone: () => void
}

// Tipos de e-CF con etiqueta corta para la lista de sincronización.
const TIPOS: { tipo: string; label: string }[] = [
  { tipo: 'E31', label: 'E31 · Crédito fiscal' },
  { tipo: 'E32', label: 'E32 · Consumo' },
  { tipo: 'E33', label: 'E33 · Nota de débito' },
  { tipo: 'E34', label: 'E34 · Nota de crédito' },
  { tipo: 'E41', label: 'E41 · Compras' },
  { tipo: 'E43', label: 'E43 · Gastos menores' },
  { tipo: 'E44', label: 'E44 · Regímenes especiales' },
  { tipo: 'E45', label: 'E45 · Gubernamental' },
  { tipo: 'E46', label: 'E46 · Exportaciones' },
  { tipo: 'E47', label: 'E47 · Pagos al exterior' },
]

export function SecuenciasStep({ onDone }: Props): JSX.Element {
  const [modo, setModo] = useState<'no' | 'si'>('no')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function setValor(tipo: string, raw: string): void {
    setValores((v) => ({ ...v, [tipo]: raw.replace(/\D/g, '') }))
  }

  async function guardar(): Promise<void> {
    // Solo se envían los tipos con un número; los vacíos se omiten.
    const entries = TIPOS
      .map(({ tipo }) => ({ tipo, valor: valores[tipo]?.trim() ?? '' }))
      .filter((e) => e.valor !== '')
      .map((e) => ({ tipoECF: e.tipo, ultimaSecuencia: Number(e.valor) }))

    if (entries.length === 0) {
      onDone()
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await api.post('/secuencias/sincronizar', entries)
      onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'No pudimos guardar las secuencias. Intenta de nuevo u omite por ahora.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h6 text-text-primary">¿Ya emitías e-CF?</h2>
        <p className="text-body-sm text-text-secondary">
          Si venías emitiendo en otro sistema, continuamos tu numeración para no duplicar y evitar
          rechazos de la DGII.
        </p>
      </div>

      <ToggleGroup
        value={modo}
        onChange={setModo}
        options={[
          { value: 'no', label: 'No, es mi primera vez' },
          { value: 'si', label: 'Sí, ya emitía' },
        ]}
      />

      {modo === 'si' && (
        <div className="flex flex-col gap-2">
          <p className="text-ui-sm text-text-secondary">
            Escribe la última secuencia usada por cada tipo. Deja en blanco los que no uses.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TIPOS.map(({ tipo, label }) => (
              <div key={tipo} className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-white px-3 py-2">
                <label htmlFor={`seq-${tipo}`} className="text-ui-sm text-text-primary">
                  {label}
                </label>
                <input
                  id={`seq-${tipo}`}
                  inputMode="numeric"
                  placeholder="0"
                  value={valores[tipo] ?? ''}
                  onChange={(e) => setValor(tipo, e.target.value)}
                  className="h-9 w-20 rounded-lg border border-neutral-300 bg-white px-3 text-right text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-ui-sm text-danger-600">{error}</p>}

      <div className="flex flex-col gap-3">
        <Button variant="primary" size="lg" className="w-full" disabled={submitting} onClick={modo === 'si' ? guardar : onDone}>
          {submitting ? <Spinner size={18} className="text-white" /> : modo === 'si' ? 'Guardar y continuar' : 'Continuar'}
        </Button>
        <Button variant="ghost" size="md" className="w-full" disabled={submitting} onClick={onDone}>
          Omitir por ahora
        </Button>
      </div>
    </div>
  )
}
