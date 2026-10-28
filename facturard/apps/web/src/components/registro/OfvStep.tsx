'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { Lock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { registroApi } from '@/lib/registro'
import { getErrorMessage } from '@/lib/api'

interface Props {
  yaGuardada: boolean
  onGuardado: () => void
  onBack: () => void
}

/** Acceso a la Oficina Virtual de la DGII: se guarda cifrado y exige el código 2FA. */
export function OfvStep({ yaGuardada, onGuardado, onBack }: Props): JSX.Element {
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function guardar(): Promise<void> {
    setError('')
    setEnviando(true)
    try {
      await registroApi.put('/ofv', { usuario: usuario.trim(), clave, codigo })
      onGuardado()
    } catch (err) {
      setError(getErrorMessage(err, 'No pudimos guardar el acceso.'))
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h6 text-text-primary">Acceso a la Oficina Virtual (OFV)</h2>
        <p className="text-body-sm text-text-secondary">
          Con este acceso el equipo de DMAIA completa por ti los pasos del portal de certificación de la DGII.
        </p>
      </div>
      <div className="flex items-start gap-3 rounded-xl bg-brand-50 px-4 py-3 text-ui-sm text-brand-800">
        <Lock size={16} className="mt-0.5 shrink-0" />
        Se guarda cifrado. Sólo se puede ver con un código de tu Google Authenticator, y cada consulta queda registrada.
      </div>
      {yaGuardada && (
        <p className="text-ui-sm text-success-700">Ya tienes un acceso guardado. Escribe uno nuevo sólo si quieres cambiarlo.</p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input id="ofv-usuario" label="Usuario o correo de la OFV" autoComplete="off" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
        <Input id="ofv-clave" label="Contraseña de la OFV" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
        <Input
          id="ofv-codigo"
          label="Código de Google Authenticator"
          inputMode="numeric"
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-ui-sm text-danger-700">{error}</p>}
      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>Atrás</Button>
        <div className="flex gap-3">
          {yaGuardada && (
            <Button variant="secondary" onClick={onGuardado}>Mantener el actual</Button>
          )}
          <Button onClick={guardar} disabled={enviando || usuario.trim().length < 3 || clave.length < 4 || codigo.length !== 6}>
            {enviando ? 'Guardando…' : 'Guardar y continuar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
