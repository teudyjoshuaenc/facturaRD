'use client'

import { Suspense, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { RegistroShell } from '@/components/registro/RegistroShell'
import { registroApi } from '@/lib/registro'
import { saveRegistroToken } from '@/lib/session'
import { getErrorMessage } from '@/lib/api'

const CLAVE_SEGURA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/

function VerificarContent(): JSX.Element {
  const router = useRouter()
  const token = useSearchParams().get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const claveValida = CLAVE_SEGURA.test(password)
  const coinciden = password === confirmacion

  async function enviar(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const res = await registroApi.post<{ tokenRegistro: string }>('/verificar', { token, password })
      saveRegistroToken(res.data.tokenRegistro)
      router.replace('/registro/configurar')
    } catch (err) {
      setError(getErrorMessage(err, 'No pudimos confirmar tu correo.'))
      setEnviando(false)
    }
  }

  if (!token) {
    return (
      <RegistroShell titulo="Enlace incompleto" subtitulo="Abre el enlace completo que te llegó por correo.">
        <Link href="/registro" className="text-ui-sm font-semibold text-brand-600 hover:underline">
          Pedir un enlace nuevo
        </Link>
      </RegistroShell>
    )
  }

  return (
    <RegistroShell titulo="Crea tu contraseña" subtitulo="Tu correo quedará confirmado al guardarla.">
      <form onSubmit={enviar} className="flex flex-col gap-5">
        <Input
          id="password"
          type="password"
          label="Contraseña"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          helperText="Mínimo 10 caracteres, con mayúscula, minúscula y número."
          {...(password && !claveValida ? { error: 'Aún no cumple los requisitos' } : {})}
        />
        <Input
          id="confirmacion"
          type="password"
          label="Repite la contraseña"
          autoComplete="new-password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          {...(confirmacion && !coinciden ? { error: 'No coincide' } : {})}
        />
        {error && (
          <p className="rounded-lg bg-danger-50 px-3 py-2 text-ui-sm text-danger-700">
            {error}{' '}
            <Link href="/registro" className="font-semibold underline">
              Pedir otro enlace
            </Link>
          </p>
        )}
        <Button type="submit" disabled={enviando || !claveValida || !coinciden} className="w-full">
          {enviando ? 'Guardando…' : 'Guardar y continuar'}
        </Button>
      </form>
    </RegistroShell>
  )
}

export default function VerificarPage(): JSX.Element {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center"><Spinner size={28} /></main>}>
      <VerificarContent />
    </Suspense>
  )
}
