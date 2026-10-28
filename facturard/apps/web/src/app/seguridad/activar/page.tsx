'use client'

import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/spinner'
import { RegistroShell } from '@/components/registro/RegistroShell'
import { ActivarDosPasosEmpresa } from '@/components/seguridad/ActivarDosPasosEmpresa'
import { api } from '@/lib/api'
import { getToken } from '@/lib/session'

/** Empresas anteriores al registro directo: deben activar el 2FA antes de usar la app. */
export default function ActivarSeguridadPage(): JSX.Element {
  const router = useRouter()
  const [estado, setEstado] = useState<{ activo: boolean; email: string | null } | null>(null)
  const [emailEmpresa, setEmailEmpresa] = useState<string | undefined>()

  useEffect(() => {
    if (!getToken()) {
      router.replace('/')
      return
    }
    api.get<{ activo: boolean; email: string | null }>('/seguridad/2fa').then((r) => {
      if (r.data.activo) router.replace('/dashboard')
      else setEstado(r.data)
    })
    api
      .get<{ email?: string | null }[]>('/tenants')
      .then((r) => setEmailEmpresa(r.data[0]?.email ?? undefined))
      .catch(() => undefined)
  }, [router])

  return (
    <RegistroShell ancho titulo="Activa la verificación en dos pasos" subtitulo="Es obligatoria para seguir usando FacturaRD.">
      {estado ? (
        <ActivarDosPasosEmpresa
          key={emailEmpresa ?? 'sin-email'}
          emailCuenta={estado.email}
          emailSugerido={emailEmpresa}
          onActivado={() => router.replace('/dashboard')}
        />
      ) : (
        <div className="flex justify-center py-10"><Spinner size={24} /></div>
      )}
    </RegistroShell>
  )
}
