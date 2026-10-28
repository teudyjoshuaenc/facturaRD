'use client'

import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { registroApi } from '@/lib/registro'
import { getErrorMessage } from '@/lib/api'

interface QrDosPasos {
  qrDataUrl: string
  secreto: string
}

interface Props {
  /** Se llama con el código ya validado por el servidor. */
  onActivado: (codigo: string) => void
  /** Por defecto usa la sesión de registro; desde la empresa se pasan las de /seguridad/2fa. */
  configurar?: () => Promise<QrDosPasos>
  activar?: (codigo: string) => Promise<unknown>
}

const configurarRegistro = async (): Promise<QrDosPasos> =>
  (await registroApi.post<QrDosPasos>('/dos-pasos/configurar')).data
const activarRegistro = (codigo: string) => registroApi.post('/dos-pasos/activar', { codigo })

/** Activa Google Authenticator. Se exige antes de guardar datos sensibles. */
export function DosPasosStep({ onActivado, configurar = configurarRegistro, activar: activarCodigo = activarRegistro }: Props): JSX.Element {
  const [qr, setQr] = useState<QrDosPasos | null>(null)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    configurar()
      .then(setQr)
      .catch((err) => setError(getErrorMessage(err, 'No pudimos generar el código QR.')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function activar(): Promise<void> {
    setError('')
    setEnviando(true)
    try {
      await activarCodigo(codigo)
      onActivado(codigo)
    } catch (err) {
      setError(getErrorMessage(err, 'El código no es correcto.'))
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h6 text-text-primary">Verificación en dos pasos</h2>
        <p className="text-body-sm text-text-secondary">
          Protege tu certificado y tu acceso a la Oficina Virtual. Escanea el código con Google Authenticator (o
          Microsoft Authenticator) y escribe el código de 6 dígitos que aparece.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:flex-row sm:items-start">
        <div className="flex h-[200px] w-[200px] shrink-0 items-center justify-center rounded-xl bg-white">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr.qrDataUrl} alt="Código QR para Google Authenticator" width={200} height={200} />
          ) : (
            <Spinner size={24} />
          )}
        </div>
        <div className="flex flex-col gap-3 text-body-sm text-text-secondary">
          <p className="flex items-center gap-2 font-semibold text-text-primary">
            <ShieldCheck size={18} className="text-brand-600" /> Pasos
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Abre Google Authenticator y toca “+”.</li>
            <li>Elige “Escanear un código QR”.</li>
            <li>Escribe aquí el código que se genera.</li>
          </ol>
          {qr && (
            <p className="text-ui-xs">
              ¿No puedes escanear? Clave manual:{' '}
              <code className="break-all rounded bg-white px-1.5 py-0.5 text-text-primary">{qr.secreto}</code>
            </p>
          )}
        </div>
      </div>

      <Input
        id="codigo-2fa"
        label="Código de 6 dígitos"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
        {...(error ? { error } : {})}
      />
      <Button onClick={activar} disabled={enviando || codigo.length !== 6 || !qr} className="w-full sm:w-auto sm:self-end">
        {enviando ? 'Verificando…' : 'Activar y continuar'}
      </Button>
    </div>
  )
}
