'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DosPasosStep } from '@/components/registro/DosPasosStep'
import { api, getErrorMessage } from '@/lib/api'

interface Props {
  /** null si la empresa todavía no tiene cuenta (hay que pedir el correo). */
  emailCuenta: string | null
  emailSugerido?: string | undefined
  onActivado: (codigo: string) => void
}

/** Activa Google Authenticator desde la sesión de la empresa (empresas que aún no lo tienen). */
export function ActivarDosPasosEmpresa({ emailCuenta, emailSugerido, onActivado }: Props): JSX.Element {
  const [email, setEmail] = useState(emailSugerido ?? '')
  const [listoParaQr, setListoParaQr] = useState(emailCuenta !== null)
  const [error, setError] = useState('')
  const [validando, setValidando] = useState(false)

  if (!listoParaQr) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h6 text-text-primary">Protege tu cuenta</h2>
          <p className="text-body-sm text-text-secondary">
            A partir de ahora FacturaRD pide un código de Google Authenticator cada vez que lo abres desde el CRM. Indica
            el correo del responsable de la cuenta.
          </p>
        </div>
        <Input
          id="email-2fa"
          type="email"
          label="Correo del responsable"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...(error ? { error } : {})}
        />
        <Button
          disabled={validando || !email.includes('@')}
          onClick={async () => {
            setError('')
            setValidando(true)
            try {
              // Crea la cuenta con ese correo y deja el QR listo (lo reutiliza el paso siguiente).
              await api.post('/seguridad/2fa/configurar', { email: email.trim() })
              setListoParaQr(true)
            } catch (err) {
              setError(getErrorMessage(err, 'No pudimos usar ese correo.'))
            } finally {
              setValidando(false)
            }
          }}
          className="self-end"
        >
          Continuar
        </Button>
      </div>
    )
  }

  return (
    <DosPasosStep
      configurar={async () => (await api.post('/seguridad/2fa/configurar', {})).data}
      activar={(codigo) => api.post('/seguridad/2fa/activar', { codigo })}
      onActivado={onActivado}
    />
  )
}
