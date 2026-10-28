'use client'

import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RegistroShell } from '@/components/registro/RegistroShell'
import { DosPasosStep } from '@/components/registro/DosPasosStep'
import { adminApi, guardarSesionAdmin, mensajeError, type AdminSesion } from '@/lib/admin'

type Paso = 'clave' | 'configurar' | 'codigo'

export default function AdminLoginPage(): JSX.Element {
  const router = useRouter()
  const [paso, setPaso] = useState<Paso>('clave')
  const [tokenPaso, setTokenPaso] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const conPaso = { headers: { Authorization: `Bearer ${tokenPaso}` } }

  function entrar(r: { token: string; admin: AdminSesion }): void {
    guardarSesionAdmin(r.token, r.admin)
    router.replace('/admin')
  }

  async function enviarClave(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const r = await adminApi.post<{ siguiente: 'configurar' | 'codigo'; tokenPaso: string }>('/auth/login', { email: email.trim(), password })
      setTokenPaso(r.data.tokenPaso)
      setPaso(r.data.siguiente)
    } catch (err) {
      setError(mensajeError(err, 'No pudimos iniciar sesión'))
    } finally {
      setEnviando(false)
    }
  }

  async function enviarCodigo(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const r = await adminApi.post<{ token: string; admin: AdminSesion }>('/auth/2fa', { codigo }, conPaso)
      entrar(r.data)
    } catch (err) {
      setError(mensajeError(err, 'Código incorrecto'))
      setEnviando(false)
    }
  }

  return (
    <RegistroShell
      ancho={paso === 'configurar'}
      titulo="Panel DMAIA"
      subtitulo={
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={15} className="text-brand-600" /> Acceso sólo para el equipo de DMAIA
        </span>
      }
    >
      {paso === 'clave' && (
        <form onSubmit={enviarClave} className="flex flex-col gap-5">
          <Input id="admin-email" type="email" label="Correo" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input id="admin-password" type="password" label="Contraseña" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-ui-sm text-danger-700">{error}</p>}
          <Button type="submit" disabled={enviando || !email.trim() || !password}>{enviando ? 'Verificando…' : 'Continuar'}</Button>
        </form>
      )}

      {paso === 'configurar' && (
        <div className="flex flex-col gap-4">
          <p className="rounded-xl bg-brand-50 px-4 py-3 text-ui-sm text-brand-800">
            Primer acceso: la verificación en dos pasos es obligatoria para el panel.
          </p>
          <DosPasosStep
            configurar={async () => (await adminApi.post('/auth/2fa/configurar', {}, conPaso)).data}
            activar={async (cod) => entrar((await adminApi.post('/auth/2fa/activar', { codigo: cod }, conPaso)).data)}
            onActivado={() => undefined}
          />
        </div>
      )}

      {paso === 'codigo' && (
        <form onSubmit={enviarCodigo} className="flex flex-col gap-5">
          <Input
            id="admin-codigo"
            label="Código de Google Authenticator"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            {...(error ? { error } : {})}
          />
          <Button type="submit" disabled={enviando || codigo.length !== 6}>{enviando ? 'Entrando…' : 'Entrar'}</Button>
          <button type="button" className="text-ui-sm text-text-secondary hover:underline" onClick={() => { setPaso('clave'); setCodigo(''); setError('') }}>
            Volver
          </button>
        </form>
      )}
    </RegistroShell>
  )
}
