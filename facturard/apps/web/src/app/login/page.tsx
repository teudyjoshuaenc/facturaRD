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
  const locationId = params.get('location_id')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function enviar(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      // Desde el CRM la subcuenta identifica la cuenta: sólo se pide el código.
      const res = await registroApi.post<{ tokenRegistro: string; sesion: SesionTenant | null }>(
        '/login',
        locationId ? { locationId, codigo } : { email: email.trim(), codigo },
      )
      saveRegistroToken(res.data.tokenRegistro)
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
    <RegistroShell
      titulo={locationId ? 'Confirma que eres tú' : 'Inicia sesión'}
      subtitulo={locationId ? 'Escribe el código de Google Authenticator para abrir FacturaRD.' : 'Entra con tu correo y el código de Google Authenticator.'}
    >
      <form onSubmit={enviar} className="flex flex-col gap-5">
        {!locationId && (
          <Input
            id="email"
            type="email"
            label="Correo electrónico"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <Input
          id="codigo"
          label="Código de Google Authenticator"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={Boolean(locationId)}
          maxLength={6}
          required
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
        />
        {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-ui-sm text-danger-700">{error}</p>}
        <Button type="submit" disabled={enviando || (!locationId && !email.trim()) || codigo.length !== 6} className="w-full">
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
        {!locationId && <p className="text-center text-ui-sm text-text-secondary">
          ¿Nuevo en FacturaRD?{' '}
          <Link href="/registro" className="font-semibold text-brand-600 hover:underline">
            Crea tu cuenta
          </Link>
        </p>}
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
