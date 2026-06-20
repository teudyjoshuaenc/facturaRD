'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Copy, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { CertificateDropzone } from '@/components/certificados/certificate-dropzone'
import { api, getErrorMessage } from '@/lib/api'
import { useCertificado } from '@/hooks/useCertificado'
import { formatDate } from '@/lib/comprobantes'

interface TenantFull {
  id: string
  rnc: string
  razonSocial: string
  plan: 'BASICO' | 'PYME' | 'PRO'
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO'
}

interface WebhookGHL {
  id: string
  tipo: string
  urlReceiverGHL?: string
  secretoHMAC?: string
}

const PLAN_LABELS: Record<TenantFull['plan'], string> = {
  BASICO: 'Básico',
  PYME: 'PYME',
  PRO: 'Pro',
}

const ESTADO_VARIANT: Record<TenantFull['estado'], 'success' | 'warning' | 'danger'> = {
  ACTIVO: 'success',
  SUSPENDIDO: 'warning',
  CANCELADO: 'danger',
}

const ESTADO_LABEL: Record<TenantFull['estado'], string> = {
  ACTIVO: 'Activo',
  SUSPENDIDO: 'Suspendido',
  CANCELADO: 'Cancelado',
}

export default function ConfiguracionPage(): JSX.Element {
  const queryClient = useQueryClient()

  const { data: tenant } = useQuery({
    queryKey: ['tenant-info'],
    queryFn: () => api.get<TenantFull[]>('/tenants').then((res) => res.data[0]),
  })

  const {
    certificado,
    isLoading: certLoading,
    diasParaVencer,
    porVencer,
    showForm,
    setShowForm,
    file,
    setFile,
    passphrase,
    setPassphrase,
    submitting: certSubmitting,
    error: certError,
    handleUpload: handleUploadCertificado,
    handleCancel: handleCancelCert,
  } = useCertificado()

  const { data: webhooks, isLoading: webhooksLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.get<WebhookGHL[]>('/webhooks').then((res) => res.data),
  })

  const ghlWebhook = webhooks?.find((w) => w.tipo === 'GHL_ENTRADA')

  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState<'url' | 'secret' | null>(null)

  async function handleRegenerar(): Promise<void> {
    setRegenerating(true)
    try {
      await api.post('/webhooks/ghl/configurar')
      await queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success(ghlWebhook ? 'Secreto regenerado correctamente' : 'Integración configurada correctamente')
    } catch {
      toast.error('Error al configurar la integración')
    } finally {
      setRegenerating(false)
    }
  }

  async function handleCopy(value: string, which: 'url' | 'secret'): Promise<void> {
    await navigator.clipboard.writeText(value)
    setCopied(which)
    toast.success(which === 'url' ? 'URL copiada' : 'Secreto copiado')
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Datos de empresa */}
      <Card>
        <CardHeader>
          <CardTitle>Datos de empresa</CardTitle>
          <CardDescription>Información registrada de tu negocio</CardDescription>
        </CardHeader>
        <CardContent>
          {!tenant ? (
            <div className="flex items-center justify-center p-8">
              <Spinner size={24} />
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-ui-sm text-text-secondary">RNC</dt>
                <dd className="text-body-base text-text-primary">{tenant.rnc}</dd>
              </div>
              <div>
                <dt className="text-ui-sm text-text-secondary">Razón social</dt>
                <dd className="text-body-base text-text-primary">{tenant.razonSocial}</dd>
              </div>
              <div>
                <dt className="text-ui-sm text-text-secondary">Plan</dt>
                <dd className="text-body-base text-text-primary">{PLAN_LABELS[tenant.plan]}</dd>
              </div>
              <div>
                <dt className="text-ui-sm text-text-secondary">Estado</dt>
                <dd>
                  <Badge variant={ESTADO_VARIANT[tenant.estado]}>
                    {ESTADO_LABEL[tenant.estado]}
                  </Badge>
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      {/* 2. Certificado digital */}
      <Card>
        <CardHeader>
          <CardTitle>Certificado digital</CardTitle>
          <CardDescription>
            Certificado P12 usado para firmar tus comprobantes fiscales
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {certLoading ? (
            <div className="flex items-center justify-center p-8">
              <Spinner size={24} />
            </div>
          ) : certificado ? (
            <>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-ui-sm text-text-secondary">Titular</dt>
                  <dd className="text-body-base text-text-primary">{certificado.titular}</dd>
                </div>
                <div>
                  <dt className="text-ui-sm text-text-secondary">RNC</dt>
                  <dd className="text-body-base text-text-primary">{certificado.rnc}</dd>
                </div>
                <div>
                  <dt className="text-ui-sm text-text-secondary">Vigencia</dt>
                  <dd className="text-body-base text-text-primary">
                    {formatDate(certificado.validoDesde)} → {formatDate(certificado.validoHasta)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ui-sm text-text-secondary">Estado</dt>
                  <dd>
                    <Badge variant={certificado.activo ? 'success' : 'neutral'}>
                      {certificado.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </dd>
                </div>
              </dl>

              {porVencer && (
                <div className="flex items-center gap-2 rounded-lg border border-warning-500/40 bg-warning-500/10 px-4 py-3 text-body-sm text-warning-700">
                  <AlertTriangle size={18} />
                  <span>
                    {diasParaVencer !== null && diasParaVencer >= 0
                      ? `Tu certificado vence en ${diasParaVencer} días. Actualízalo para evitar interrupciones.`
                      : 'Tu certificado ha vencido. Actualízalo lo antes posible.'}
                  </span>
                </div>
              )}
            </>
          ) : (
            <p className="text-body-sm text-text-secondary">
              No hay certificado digital configurado.
            </p>
          )}

          {!showForm ? (
            <Button variant="secondary" className="self-start" onClick={() => setShowForm(true)}>
              {certificado ? 'Reemplazar certificado' : 'Cargar certificado'}
            </Button>
          ) : (
            <div className="flex flex-col gap-4 border-t border-border-subtle pt-4">
              <CertificateDropzone file={file} onFileChange={setFile} />
              <Input
                label="Contraseña del certificado *"
                type="password"
                placeholder="Passphrase del .p12"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
              {certError && <p className="text-ui-sm text-danger-600">{certError}</p>}
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleCancelCert} disabled={certSubmitting}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  disabled={!file || !passphrase || certSubmitting}
                  onClick={handleUploadCertificado}
                >
                  {certSubmitting ? (
                    <Spinner size={18} className="text-white" />
                  ) : (
                    'Guardar certificado'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Integración GoHighLevel */}
      <Card>
        <CardHeader>
          <CardTitle>Integración GoHighLevel</CardTitle>
          <CardDescription>Configura el webhook receptor en tu subcuenta de GHL</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {webhooksLoading ? (
            <div className="flex items-center justify-center p-8">
              <Spinner size={24} />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-ui-sm text-text-primary">URL del webhook</label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={ghlWebhook?.urlReceiverGHL ?? 'Aún no configurado'}
                    className="flex-1"
                  />
                  {ghlWebhook?.urlReceiverGHL && (
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => handleCopy(ghlWebhook.urlReceiverGHL!, 'url')}
                    >
                      {copied === 'url' ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-ui-sm text-text-primary">Secreto HMAC</label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    type="password"
                    value={ghlWebhook?.secretoHMAC ?? 'Aún no configurado'}
                    className="flex-1"
                  />
                  {ghlWebhook?.secretoHMAC && (
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => handleCopy(ghlWebhook.secretoHMAC!, 'secret')}
                    >
                      {copied === 'secret' ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  )}
                </div>
              </div>

              <Button
                variant="secondary"
                className="self-start"
                disabled={regenerating}
                onClick={handleRegenerar}
              >
                {regenerating ? (
                  <Spinner size={16} />
                ) : (
                  <>
                    <RefreshCw size={16} />
                    {ghlWebhook ? 'Regenerar secreto' : 'Configurar integración'}
                  </>
                )}
              </Button>

              <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-background-canvas p-4 text-body-sm text-text-secondary">
                <div className="flex items-center gap-2 text-text-primary">
                  <ShieldCheck size={16} />
                  <span className="font-medium">Cómo configurarlo en GoHighLevel</span>
                </div>
                <ol className="list-decimal pl-5">
                  <li>Ve a Configuración → Webhooks dentro de tu subcuenta de GoHighLevel.</li>
                  <li>Crea un nuevo webhook y pega la URL anterior como destino.</li>
                  <li>Agrega el secreto HMAC en el encabezado de firma del webhook.</li>
                  <li>
                    Selecciona el evento que dispara la creación del comprobante (ej. creación de
                    factura/pago).
                  </li>
                  <li>
                    Guarda los cambios. Cada evento enviará los datos a FacturaRD para emitir el
                    e-CF correspondiente.
                  </li>
                </ol>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
