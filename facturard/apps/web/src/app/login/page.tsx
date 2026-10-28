'use client'

import { Suspense, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { RegistroShell } from '@/components/registro/RegistroShell'
import { guardarSesionTenant, registroApi, type SesionTenant } from '@/lib/registro'
import { saveLocationId, saveRegistroToken } from '@/lib/session'
import { useAuth } from '@/lib/context/AuthContext'
import { getErrorMessage } from '@/lib/api'

function LoginContent(): JSX.Element {
  const router = useRouter()
  const params = useSearchParams()
  const { setAuth } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function enviar(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const res = await registroApi.post<{ tokenRegistro: string; sesion: SesionTenant | null }>('/login', {
        email: email.trim(),
        password,
      })
      saveRegistroToken(res.data.tokenRegistro)
      const locationId = params.get('location_id')
      if (locationId) saveLocationId(locationId)
      if (res.data.sesion) {
        guardarSesionTenant(res.data.sesion)
        setAuth(res.data.sesion.accessToken, res.data.sesion.tenant)
        router.replace('/dashboard')
      } else {
        router.replace('/registro/configurar')
      }
    } catch (err) {
      setError(getErrorMessage(err, 'No pudimos iniciar sesión.'))
      setEnviando(false)
    }
  }

  return (
    <RegistroShell titulo="Inicia sesión" subtitulo="Entra con el correo y la contraseña de tu cuenta de FacturaRD.">
      <form onSubmit={enviar} className="flex flex-col gap-5">
        <Input
          id="email"
          type="email"
          label="Correo electrónico"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="password"
          type="password"
          label="Contraseña"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-ui-sm text-danger-700">{error}</p>}
        <Button type="submit" disabled={enviando || !email.trim() || !password} className="w-full">
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
        <p className="text-center text-ui-sm text-text-secondary">
          ¿Nuevo en FacturaRD?{' '}
          <Link href="/registro" className="font-semibold text-brand-600 hover:underline">
            Crea tu cuenta
          </Link>
        </p>
      </form>
    </RegistroShell>
  )
}

export default function LoginPage(): JSX.Element {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center"><Spinner size={28} /></main>}>
      <LoginContent />
    </Suspense>
  )
}
