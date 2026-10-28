'use client'

import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ActivarDosPasosEmpresa } from '@/components/seguridad/ActivarDosPasosEmpresa'
import { api } from '@/lib/api'

interface Estado {
  activo: boolean
  email: string | null
  exigido: boolean
}

/** Activar Google Authenticator para la cuenta de la empresa (opcional mientras EXIGIR_2FA esté apagado). */
export function DosPasosCard(): JSX.Element | null {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [activando, setActivando] = useState(false)

  useEffect(() => {
    api.get<Estado>('/seguridad/2fa').then((r) => setEstado(r.data)).catch(() => undefined)
  }, [])

  if (!estado) return null

  return (
    <Card id="dos-pasos">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-brand-600" /> Verificación en dos pasos
          </CardTitle>
          <Badge variant={estado.activo ? 'success' : 'neutral'}>{estado.activo ? 'Activa' : 'Inactiva'}</Badge>
        </div>
        <CardDescription>
          {estado.activo
            ? `Tu cuenta (${estado.email}) está protegida con Google Authenticator.`
            : 'Protege tu certificado y los datos de tu empresa con un código de Google Authenticator.'}
        </CardDescription>
      </CardHeader>
      {!estado.activo && (
        <CardContent>
          {activando ? (
            <ActivarDosPasosEmpresa
              emailCuenta={estado.email}
              onActivado={() => {
                setActivando(false)
                setEstado({ ...estado, activo: true })
              }}
            />
          ) : (
            <Button onClick={() => setActivando(true)}>Activar</Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}
