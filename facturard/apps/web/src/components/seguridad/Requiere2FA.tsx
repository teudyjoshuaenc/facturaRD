'use client'

import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ActivarDosPasosEmpresa } from './ActivarDosPasosEmpresa'
import { api, getErrorMessage } from '@/lib/api'
import { borrarConfirmacion2fa, confirmacion2fa, guardarConfirmacion2fa } from '@/lib/confirmacion2fa'

interface Props {
  seccion: string
  children: ReactNode
}

/**
 * Puerta de las secciones sensibles (Empresa, Configuración): pide el código de
 * Google Authenticator cada vez que se entra. Si la empresa aún no tiene 2FA, lo
 * activa aquí mismo. El servidor exige la misma confirmación (header x-2fa).
 */
export function Requiere2FA({ seccion, children }: Props): JSX.Element {
  const [estado, setEstado] = useState<{ activo: boolean; email: string | null; exigido: boolean } | null>(null)
  const [confirmado, setConfirmado] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    borrarConfirmacion2fa()
    api
      .get<{ activo: boolean; email: string | null; exigido: boolean }>('/seguridad/2fa')
      .then((r) => setEstado(r.data))
      .catch((err) => setError(getErrorMessage(err, 'No pudimos verificar la seguridad de la cuenta.')))
    // Al salir de la sección se olvida la confirmación.
    return () => borrarConfirmacion2fa()
  }, [])

  async function confirmar(cod: string): Promise<void> {
    setError('')
    setEnviando(true)
    try {
      const r = await api.post<{ token: string; minutos: number }>('/seguridad/2fa/confirmar', { codigo: cod })
      guardarConfirmacion2fa(r.data.token, r.data.minutos)
      setConfirmado(true)
    } catch (err) {
      setError(getErrorMessage(err, 'El código no es correcto.'))
    } finally {
      setEnviando(false)
    }
  }

  if (confirmado && confirmacion2fa()) return <>{children}</>
  // Interruptor EXIGIR_2FA apagado: el código es opcional (se activa desde Configuración).
  if (estado && !estado.exigido) return <>{children}</>
  // Si el servidor no respondió, la sección sigue disponible: el propio servidor decide qué exige.
  if (error && !estado) return <>{children}</>

  return (
    <div className="mx-auto mt-6 w-full max-w-lg rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      {!estado && !error && (
        <div className="flex justify-center py-10"><Spinner size={24} /></div>
      )}

      {estado && !estado.activo && (
        <ActivarDosPasosEmpresa emailCuenta={estado.email} onActivado={(cod) => void confirmar(cod)} />
      )}

      {estado?.activo && (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            void confirmar(codigo)
          }}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <ShieldCheck size={22} />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-h6 text-text-primary">Confirma que eres tú</h2>
              <p className="text-body-sm text-text-secondary">
                Para entrar a {seccion} escribe el código de Google Authenticator.
              </p>
            </div>
          </div>
          <Input
            id="codigo-confirmacion"
            label="Código de 6 dígitos"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            {...(error ? { error } : {})}
          />
          <Button type="submit" disabled={enviando || codigo.length !== 6}>
            {enviando ? 'Verificando…' : 'Continuar'}
          </Button>
        </form>
      )}

      {error && !estado && <p className="text-ui-sm text-danger-700">{error}</p>}
    </div>
  )
}
