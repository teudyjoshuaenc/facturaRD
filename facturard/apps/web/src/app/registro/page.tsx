'use client'

import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RegistroShell } from '@/components/registro/RegistroShell'
import { registroApi } from '@/lib/registro'
import { getErrorMessage } from '@/lib/api'

export default function RegistroPage(): JSX.Element {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function enviar(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await registroApi.post('/iniciar', { email: email.trim() })
      setEnviado(true)
    } catch (err) {
      setError(getErrorMessage(err, 'No pudimos enviar el correo. Intenta de nuevo.'))
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <RegistroShell titulo="Revisa tu correo">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <MailCheck size={28} />
          </div>
          <p className="text-body-sm text-text-secondary">
            Te enviamos un enlace a <strong className="text-text-primary">{email}</strong> para confirmar tu correo y
            crear tu contraseña. Vence en 24 horas.
          </p>
          <button type="button" className="text-ui-sm font-semibold text-brand-600 hover:underline" onClick={() => setEnviado(false)}>
            Usar otro correo
          </button>
        </div>
      </RegistroShell>
    )
  }

  return (
    <RegistroShell
      titulo="Crea tu cuenta"
      subtitulo="Empieza con tu correo. Después completas los datos de tu empresa para facturar ante la DGII."
    >
      <form onSubmit={enviar} className="flex flex-col gap-5">
        <Input
          id="email"
          type="email"
          label="Correo electrónico"
          placeholder="tu@empresa.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...(error ? { error } : {})}
        />
        <Button type="submit" disabled={enviando || !email.trim()} className="w-full">
          {enviando ? 'Enviando…' : 'Continuar'}
        </Button>
        <p className="text-center text-ui-sm text-text-secondary">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </RegistroShell>
  )
}
