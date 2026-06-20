'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CertificateDropzone } from '@/components/certificados/certificate-dropzone'
import { api, getErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/context/AuthContext'
import type { TenantInfo } from '@/lib/session'

interface Props {
  locationId: string
  rnc: string
  onComplete: (tenant: TenantInfo) => void
  onBack: () => void
}

export function CertificadoStep({ locationId, rnc, onComplete, onBack }: Props): JSX.Element {
  const { setAuth } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(): Promise<void> {
    if (!file || !passphrase || !locationId) return

    setSubmitting(true)
    setError('')

    try {
      const onboardingRes = await api.post<{ token: string; tenant: TenantInfo }>('/ghl/onboarding', {
        locationId,
        rnc,
        passphrase,
      })
      const { token, tenant } = onboardingRes.data
      setAuth(token, tenant)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('passphrase', passphrase)
      await api.post('/certificados/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      onComplete(tenant)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-h6 text-text-primary">Sube tu certificado digital</h2>
        <p className="text-body-sm text-text-secondary">
          El certificado .p12 te lo entregó tu proveedor de firma digital (Digifirma o VIAFIRMA)
        </p>
      </div>

      <CertificateDropzone file={file} onFileChange={setFile} />

      <Input
        label="Contraseña del certificado *"
        type="password"
        placeholder="Passphrase del .p12"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
      />

      {error && <p className="text-ui-sm text-danger-600">{error}</p>}

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={onBack} disabled={submitting}>
          Atrás
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={!file || !passphrase || submitting}
          onClick={handleSubmit}
        >
          {submitting ? <Spinner size={18} className="text-white" /> : 'Verificar y continuar'}
        </Button>
      </div>
    </div>
  )
}
