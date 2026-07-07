'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { AlertCircle, Building2, FileCheck2, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { api, getErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/context/AuthContext'
import type { TenantInfo } from '@/lib/session'

interface Props {
  locationId: string
  rnc: string
  razonSocial: string
  file: File
  passphrase: string
  onCreated: (tenant: TenantInfo) => void
  onBackToCert: () => void
}

export function CrearCuentaStep({ locationId, rnc, razonSocial, file, passphrase, onCreated, onBackToCert }: Props): JSX.Element {
  const { setAuth } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(): Promise<void> {
    setSubmitting(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('locationId', locationId)
      form.append('rnc', rnc)
      form.append('passphrase', passphrase)

      const res = await api.post<{ token: string; tenant: TenantInfo }>('/ghl/onboarding', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAuth(res.data.token, res.data.tenant)
      onCreated(res.data.tenant)
    } catch (err) {
      setError(getErrorMessage(err, 'No pudimos crear la cuenta. Revisa el certificado y la contraseña.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h6 text-text-primary">Crea tu cuenta</h2>
        <p className="text-body-sm text-text-secondary">
          Revisa los datos. Al crear la cuenta guardamos tu certificado cifrado y quedas listo para emitir.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-background-canvas p-4">
        <ResumenFila icon={<Building2 size={16} />} label="Empresa" value={razonSocial} />
        <ResumenFila icon={<Hash size={16} />} label="RNC" value={rnc} />
        <ResumenFila icon={<FileCheck2 size={16} className="text-success-500" />} label="Certificado" value={file.name} />
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-lg border border-danger-500/40 bg-danger-500/10 p-4">
          <div className="flex items-start gap-2 text-body-sm text-danger-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" className="self-start" onClick={onBackToCert}>
            Volver a corregir el certificado
          </Button>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={onBackToCert} disabled={submitting}>
          Atrás
        </Button>
        <Button variant="primary" size="lg" className="flex-1" disabled={submitting} onClick={handleSubmit}>
          {submitting ? <Spinner size={18} className="text-white" /> : 'Crear cuenta'}
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
