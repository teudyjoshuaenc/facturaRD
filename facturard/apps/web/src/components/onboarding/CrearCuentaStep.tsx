'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { AlertCircle, Building2, FileCheck2, Hash, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { api, getErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/context/AuthContext'
import type { TenantInfo } from '@/lib/session'
import type { TipoIdentificacion } from './IdentificacionStep'

interface Props {
  locationId: string
  identificacion: string
  tipo: TipoIdentificacion
  razonSocial: string
  /** true si el nombre lo escribió el usuario (cédula fuera del padrón). */
  razonSocialManual: boolean
  /** null → se crea el tenant SIN certificado (podrá certificarse después). */
  file: File | null
  passphrase: string
  onCreated: (tenant: TenantInfo) => void
  /** Volver: al paso de certificado (con cert) o al de elección (sin cert). */
  onBack: () => void
}

export function CrearCuentaStep({
  locationId,
  identificacion,
  tipo,
  razonSocial,
  razonSocialManual,
  file,
  passphrase,
  onCreated,
  onBack,
}: Props): JSX.Element {
  const { setAuth } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const conCertificado = file !== null

  async function handleSubmit(): Promise<void> {
    setSubmitting(true)
    setError('')
    try {
      const form = new FormData()
      form.append('locationId', locationId)
      form.append('rnc', identificacion)
      form.append('tipoIdentificacion', tipo)
      // El nombre manual solo se envía como respaldo (cédula fuera del padrón).
      if (razonSocialManual) form.append('razonSocial', razonSocial)
      if (conCertificado) {
        form.append('file', file)
        form.append('passphrase', passphrase)
      }

      const res = await api.post<{ token: string; tenant: TenantInfo }>('/ghl/onboarding', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAuth(res.data.token, res.data.tenant)
      onCreated(res.data.tenant)
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          conCertificado
            ? 'No pudimos crear la cuenta. Revisa el certificado y la contraseña.'
            : 'No pudimos crear la cuenta. Intenta de nuevo.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h6 text-text-primary">Crea tu cuenta</h2>
        <p className="text-body-sm text-text-secondary">
          {conCertificado
            ? 'Revisa los datos. Al crear la cuenta guardamos tu certificado cifrado y quedas listo para emitir.'
            : 'Revisa los datos. Puedes empezar ahora y certificarte cuando quieras.'}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-background-canvas p-4">
        <ResumenFila icon={<Building2 size={16} />} label="Nombre" value={razonSocial} />
        <ResumenFila icon={<Hash size={16} />} label={tipo === 'CEDULA' ? 'Cédula' : 'RNC'} value={identificacion} />
        {conCertificado && (
          <ResumenFila
            icon={<FileCheck2 size={16} className="text-success-500" />}
            label="Certificado"
            value={file.name}
          />
        )}
      </div>

      {!conCertificado && (
        <div className="flex items-start gap-3 rounded-lg border border-success-500/30 bg-success-500/10 p-4">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-success-600" />
          <div className="flex flex-col gap-1 text-body-sm">
            <span className="font-medium text-text-primary">Listo para empezar</span>
            <span className="text-text-secondary">
              Usa FacturaRD para cotizar y preparar tus facturas. Cuando quieras enviarlas a la DGII,
              te ayudamos con la certificación.
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex flex-col gap-3 rounded-lg border border-danger-500/40 bg-danger-500/10 p-4">
          <div className="flex items-start gap-2 text-body-sm text-danger-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
          {conCertificado && (
            <Button variant="secondary" size="sm" className="self-start" onClick={onBack}>
              Volver a corregir el certificado
            </Button>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={onBack} disabled={submitting}>
          Atrás
        </Button>
        <Button variant="primary" size="lg" className="flex-1" disabled={submitting} onClick={handleSubmit}>
          {submitting ? <Spinner size={18} className="text-white" /> : conCertificado ? 'Crear cuenta' : 'Crear cuenta y empezar'}
        </Button>
      </div>
    </div>
  )
}

function ResumenFila({ icon, label, value }: { icon: JSX.Element; label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-body-sm text-text-secondary">
        {icon}
        {label}
      </span>
      <span className="truncate text-body-sm font-medium text-text-primary" title={value}>
        {value}
      </span>
    </div>
  )
}
