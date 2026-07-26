'use client'

import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { toast } from 'sonner'
import { Link2, Plug } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useGhlSync } from '@/hooks/useGhlSync'

export function GhlContactosCard(): JSX.Element {
  const { conectado, rncFieldKey, guardarConexion, getErrorMessage } = useGhlSync()

  const [token, setToken] = useState('')
  const [fieldKey, setFieldKey] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [error, setError] = useState('')

  // Prefill del custom field cuando carga el tenant.
  useEffect(() => {
    setFieldKey(rncFieldKey)
  }, [rncFieldKey])

  const mostrandoInputToken = !conectado || replacing
  // Si no hay conexión (o se está reemplazando el token), el token es obligatorio.
  // Si ya está conectado y no se reemplaza, se puede guardar solo el campo RNC.
  const puedeGuardar =
    !guardarConexion.isPending && (conectado && !replacing ? true : token.trim().length > 0)

  async function handleGuardar(): Promise<void> {
    setError('')
    try {
      await guardarConexion.mutateAsync({
        ...(token.trim() ? { ghlAccessToken: token.trim() } : {}),
        ghlRncFieldKey: fieldKey,
      })
      toast.success('Conexión con Dmaia CRM guardada')
      setToken('')
      setReplacing(false)
    } catch (err) {
      setError(getErrorMessage(err, 'No pudimos guardar la conexión. Revisa el token e intenta de nuevo.'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Integración con Dmaia CRM</CardTitle>
            <CardDescription>Importa tus contactos desde Dmaia CRM a FacturaRD (en una sola dirección).</CardDescription>
          </div>
          <Badge variant={conectado ? 'success' : 'neutral'}>
            <Plug size={13} />
            {conectado ? 'Conectado' : 'No conectado'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Private Integration Token */}
        {mostrandoInputToken ? (
          <Input
            label="Private Integration Token"
            type="password"
            placeholder="Pega aquí tu token de Dmaia CRM"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            helperText="Se guarda cifrado; nunca se muestra en claro."
            autoComplete="off"
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-ui-sm font-semibold text-text-secondary">Private Integration Token</label>
            <div className="flex items-center gap-2">
              <Input readOnly value="••••••••••••" className="flex-1" aria-label="Token guardado (oculto)" />
              <Button variant="secondary" size="md" onClick={() => { setReplacing(true); setToken('') }}>
                Reemplazar token
              </Button>
            </div>
          </div>
        )}

        {/* Custom field del RNC */}
        <Input
          label="Campo del RNC en Dmaia CRM"
          placeholder="Ej. rnc, cedula_rnc, custom_rnc"
          value={fieldKey}
          onChange={(e) => setFieldKey(e.target.value)}
          helperText="Nombre (o id) del campo personalizado donde guardas el RNC de cada contacto en tu CRM. Si lo dejas vacío, los contactos se importan sin RNC."
        />

        {/* Instrucciones */}
        <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-background-canvas p-4 text-body-sm text-text-secondary">
          <div className="flex items-center gap-2 text-text-primary">
            <Link2 size={16} />
            <span className="font-medium">Cómo obtener el token</span>
          </div>
          <p>
            Para conectar, genera un Private Integration Token en Dmaia CRM: Settings → Private
            Integrations → crea una integración con permisos de Contactos, copia el token y pégalo aquí.
            (Si no ves esa opción, actívala en Labs.) El campo de RNC es el nombre del campo
            personalizado donde guardas el RNC de cada contacto en tu CRM.
          </p>
        </div>

        {error && <p className="text-ui-sm text-danger-600">{error}</p>}
        {conectado && replacing && (
          <p className="text-ui-xs text-text-secondary">
            Para actualizar la conexión debes pegar el token de nuevo (no lo guardamos en claro para reutilizarlo).
          </p>
        )}

        <Button variant="primary" className="self-start" disabled={!puedeGuardar} onClick={handleGuardar}>
          {guardarConexion.isPending ? <Spinner size={18} className="text-white" /> : 'Guardar conexión'}
        </Button>
      </CardContent>
    </Card>
  )
}
