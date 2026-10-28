'use client'

import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RegistroShell } from '@/components/registro/RegistroShell'
import { registroApi } from '@/lib/registro'
import { getErrorMessage } from '@/lib/api'
import { saveRegistroToken } from '@/lib/session'

export default function RegistroPage(): JSX.Element {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [yaExiste, setYaExiste] = useState(false)

  async function enviar(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setYaExiste(false)
    setEnviando(true)
    try {
      const res = await registroApi.post<{ tokenRegistro: string }>('/iniciar', { email: email.trim() })
      saveRegistroToken(res.data.tokenRegistro)
      router.push('/registro/configurar')
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) setYaExiste(true)
      setError(getErrorMessage(err, 'No pudimos continuar. Intenta de nuevo.'))
      setEnviando(false)
    }
  }

  return (
    <RegistroShell
      titulo="Crea tu cuenta"
      subtitulo="Empieza con tu correo. Luego proteges tu cuenta con Google Authenticator y completas los datos de tu empresa."
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
          {...(error && !yaExiste ? { error } : {})}
        />
        {yaExiste && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-ui-sm text-brand-800">
            Ese correo ya tiene una cuenta.{' '}
            <Link href="/login" className="font-semibold underline">Entra con tu código</Link>
          </p>
        )}
        <Button type="submit" disabled={enviando || !email.trim()} className="w-full">
          {enviando ? 'Un momento…' : 'Continuar'}
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
