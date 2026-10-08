'use client'

import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { api, getErrorMessage } from '@/lib/api'

// Tipos de e-CF con etiqueta corta para la lista de sincronización.
// `requiereFecha`: por norma DGII estos e-CF llevan <FechaVencimientoSecuencia>
// (E31, E33, E41, E43-E47). E32 y E34 NO la llevan → no pedimos fecha.
const TIPOS: { tipo: string; label: string; requiereFecha: boolean }[] = [
  { tipo: 'E31', label: 'E31 · Crédito fiscal', requiereFecha: true },
  { tipo: 'E32', label: 'E32 · Consumo', requiereFecha: false },
  { tipo: 'E33', label: 'E33 · Nota de débito', requiereFecha: true },
  { tipo: 'E34', label: 'E34 · Nota de crédito', requiereFecha: false },
  { tipo: 'E41', label: 'E41 · Compras', requiereFecha: true },
  { tipo: 'E43', label: 'E43 · Gastos menores', requiereFecha: true },
  { tipo: 'E44', label: 'E44 · Regímenes especiales', requiereFecha: true },
  { tipo: 'E45', label: 'E45 · Gubernamental', requiereFecha: true },
  { tipo: 'E46', label: 'E46 · Exportaciones', requiereFecha: true },
  { tipo: 'E47', label: 'E47 · Pagos al exterior', requiereFecha: true },
]

// Respuesta de POST /secuencias/detectar-dgii (los contadores YA quedaron aplicados).
interface DeteccionTipo {
  tipoECF: string
  antes: number
  detectada: number | null
  despues: number
  proximoENCF: string
  estado: 'actualizada' | 'sinCambios' | 'error'
  error?: string
  nota?: string
}

type Deteccion =
  | { estado: 'idle' }
  | { estado: 'cargando' }
  | { estado: 'listo'; tipos: DeteccionTipo[] }
  | { estado: 'error'; mensaje: string }

interface Props {
  onDone: () => void
  /**
   * Con certificado activo: al abrir, consulta a la DGII el último e-NCF recibido
   * por tipo, avanza los contadores (nunca retrocede) y prellena el formulario.
   */
  detectar?: boolean
}

export function SecuenciasStep({ onDone, detectar = false }: Props): JSX.Element {
  const [modo, setModo] = useState<'no' | 'si'>('no')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [fechas, setFechas] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [deteccion, setDeteccion] = useState<Deteccion>({ estado: 'idle' })
  const detectado = useRef(false)

  useEffect(() => {
    if (!detectar || detectado.current) return
    detectado.current = true
    setDeteccion({ estado: 'cargando' })
    api
      .post<{ tipos: DeteccionTipo[] }>('/secuencias/detectar-dgii')
      .then(({ data }) => {
        setDeteccion({ estado: 'listo', tipos: data.tipos })
        const usados = data.tipos.filter((t) => t.despues > 0)
        if (usados.length > 0) {
          setValores((v) => {
            const next = { ...v }
            for (const t of usados) next[t.tipoECF] = String(t.despues)
            return next
          })
          setModo('si')
        }
      })
      .catch((err: unknown) => {
        setDeteccion({
          estado: 'error',
          mensaje: getErrorMessage(err, 'No pudimos consultar tu numeración en la DGII.'),
        })
      })
  }, [detectar])

  function setValor(tipo: string, raw: string): void {
    setValores((v) => ({ ...v, [tipo]: raw.replace(/\D/g, '') }))
  }

  function setFecha(tipo: string, raw: string): void {
    setFechas((f) => ({ ...f, [tipo]: raw }))
  }

  async function guardar(): Promise<void> {
    // Solo se envían los tipos con un número; los vacíos se omiten.
    const conNumero = TIPOS
      .map((t) => ({ ...t, valor: valores[t.tipo]?.trim() ?? '', fecha: fechas[t.tipo]?.trim() ?? '' }))
      .filter((e) => e.valor !== '')

    if (conNumero.length === 0) {
      onDone()
      return
    }

    // La fecha de vencimiento es obligatoria para los tipos que la exigen: sin
    // ella el e-CF se rechaza en la DGII (error 145). No dejamos guardar a medias.
    const faltaFecha = conNumero.filter((e) => e.requiereFecha && e.fecha === '')
    if (faltaFecha.length > 0) {
      setError(
        `Falta la fecha de vencimiento de: ${faltaFecha.map((e) => e.tipo).join(', ')}. ` +
          'La ves en la Oficina Virtual de la DGII o en cualquier factura que ya emitiste (campo Fecha Vencimiento).',
      )
      return
    }

    const entries = conNumero.map((e) => ({
      tipoECF: e.tipo,
      ultimaSecuencia: Number(e.valor),
      // Solo mandamos fecha para los tipos que la llevan y la tienen.
      ...(e.requiereFecha && e.fecha !== '' ? { fechaVencimiento: e.fecha } : {}),
    }))

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

      <DeteccionAviso deteccion={deteccion} />

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
            Escribe la última secuencia usada y su fecha de vencimiento por cada tipo. Deja en blanco
            los que no uses.
          </p>
          <p className="text-ui-xs text-text-tertiary">
            La fecha de vencimiento de tu secuencia la ves en la Oficina Virtual de la DGII o en
            cualquier factura que ya emitiste (campo <strong>Fecha Vencimiento</strong>).
          </p>
          <div className="grid grid-cols-1 gap-2">
            {TIPOS.map(({ tipo, label, requiereFecha }) => (
              <div key={tipo} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-white px-3 py-2">
                <label htmlFor={`seq-${tipo}`} className="text-ui-sm text-text-primary">
                  {label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`seq-${tipo}`}
                    inputMode="numeric"
                    placeholder="Última #"
                    value={valores[tipo] ?? ''}
                    onChange={(e) => setValor(tipo, e.target.value)}
                    className="h-9 w-24 rounded-lg border border-neutral-300 bg-white px-3 text-right text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                  {requiereFecha && (
                    <input
                      id={`venc-${tipo}`}
                      type="date"
                      aria-label={`Fecha de vencimiento ${tipo}`}
                      value={fechas[tipo] ?? ''}
                      onChange={(e) => setFecha(tipo, e.target.value)}
                      className="h-9 w-40 rounded-lg border border-neutral-300 bg-white px-3 text-body-sm text-text-primary focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-ui-sm text-danger-600">{error}</p>}

      <div className="flex flex-col gap-3">
        <Button variant="primary" size="lg" className="w-full" disabled={submitting || deteccion.estado === 'cargando'} onClick={modo === 'si' ? guardar : onDone}>
          {submitting ? <Spinner size={18} className="text-white" /> : modo === 'si' ? 'Guardar y continuar' : 'Continuar'}
        </Button>
        <Button variant="ghost" size="md" className="w-full" disabled={submitting} onClick={onDone}>
          Omitir por ahora
        </Button>
      </div>
    </div>
  )
}

function DeteccionAviso({ deteccion }: { deteccion: Deteccion }): JSX.Element | null {
  if (deteccion.estado === 'idle') return null

  if (deteccion.estado === 'cargando') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-background-canvas px-4 py-3 text-body-sm text-text-secondary">
        <Spinner size={18} />
        Consultando tu numeración en la DGII…
      </div>
    )
  }

  // Si NINGÚN tipo se pudo consultar (p. ej. en certecf la DGII no publica TrackIds),
  // no sabemos nada: es el mismo caso que un error de la llamada, no "empiezas en 1".
  const sinVerificar =
    deteccion.estado === 'listo' && deteccion.tipos.every((t) => t.estado === 'error')

  if (deteccion.estado === 'error' || sinVerificar) {
    const mensaje =
      deteccion.estado === 'error' ? deteccion.mensaje : 'No pudimos consultar tu numeración en la DGII.'
    return (
      <div className="flex items-start gap-2 rounded-lg border border-warning-500/40 bg-warning-500/10 px-4 py-3 text-body-sm text-warning-700">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <span>{mensaje} Si ya emitías e-CF, escribe tu última secuencia abajo.</span>
      </div>
    )
  }

  const usados = deteccion.tipos.filter((t) => t.despues > 0)
  const errores = deteccion.tipos.filter((t) => t.estado === 'error')
  const notaE32 = deteccion.tipos.find((t) => t.tipoECF === 'E32')?.nota

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-success-500/40 bg-success-500/10 px-4 py-3 text-body-sm text-text-primary">
      <div className="flex items-start gap-2">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success-500" />
        <span>
          {usados.length > 0
            ? 'Encontramos tu numeración en la DGII y ya la aplicamos. Tus próximos comprobantes:'
            : errores.length > 0
              ? 'En los tipos que pudimos consultar, la DGII no tiene e-CF emitidos con tu RNC: empiezan desde el número 1.'
              : 'La DGII no tiene e-CF emitidos con tu RNC: empezarás desde el número 1.'}
        </span>
      </div>
      {usados.length > 0 && (
        <ul className="ml-7 flex flex-col gap-0.5 text-ui-sm">
          {usados.map((t) => (
            <li key={t.tipoECF}>
              <strong>{t.tipoECF}</strong> continúa en <span className="font-mono">{t.proximoENCF}</span>
            </li>
          ))}
        </ul>
      )}
      {errores.length > 0 && (
        <p className="ml-7 text-ui-sm text-warning-700">
          No pudimos verificar {errores.map((t) => t.tipoECF).join(', ')}. Si los usabas, escribe la última
          secuencia abajo.
        </p>
      )}
      {notaE32 && <p className="ml-7 text-ui-xs text-text-secondary">{notaE32}</p>}
      {usados.length > 0 && (
        <p className="ml-7 text-ui-xs text-text-secondary">
          Completa la fecha de vencimiento de cada tipo (la DGII no la expone en esta consulta).
        </p>
      )}
    </div>
  )
}
