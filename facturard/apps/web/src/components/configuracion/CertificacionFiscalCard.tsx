'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { AlertTriangle, CheckCircle2, ShieldOff, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { CertificateDropzone } from '@/components/certificados/certificate-dropzone'
import { SecuenciasStep } from '@/components/onboarding/SecuenciasStep'
import { useCertificado } from '@/hooks/useCertificado'
import { formatDate } from '@/lib/comprobantes'

/**
 * Sección "Certificación fiscal" — el onboarding fiscal que quedó pendiente para
 * quien se registró sin certificado. Reutiliza el dropzone del onboarding y el
 * mismo paso de secuencias (última secuencia + fecha de vencimiento por tipo).
 * Al completarlo, el tenant pasa a "puede emitir".
 */
export function CertificacionFiscalCard(): JSX.Element {
  const {
    certificado,
    isLoading,
    diasParaVencer,
    porVencer,
    showForm,
    setShowForm,
    file,
    setFile,
    passphrase,
    setPassphrase,
    submitting,
    error,
    handleUpload,
    handleCancel,
  } = useCertificado()

  const [showSecuencias, setShowSecuencias] = useState(false)

  const activo = certificado?.activo === true
  const vencido = diasParaVencer !== null && diasParaVencer < 0

  return (
    <Card id="certificacion-fiscal" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Certificación fiscal</CardTitle>
        <CardDescription>
          Habilita el envío de tus facturas a la DGII: certificado digital y secuencias.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Spinner size={24} />
          </div>
        ) : (
          <>
            {/* Estado actual */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-background-canvas p-4">
              <div className="flex items-center gap-3">
                {activo && !vencido ? (
                  <CheckCircle2 size={22} className="shrink-0 text-success-500" />
                ) : (
                  <ShieldOff size={22} className="shrink-0 text-text-tertiary" />
                )}
                <div className="flex flex-col">
                  <span className="text-body-base font-medium text-text-primary">
                    {activo && !vencido
                      ? `Certificado activo${diasParaVencer !== null ? ` · vence en ${diasParaVencer} días` : ''}`
                      : vencido
                        ? 'Certificado vencido'
                        : 'No certificado'}
                  </span>
                  <span className="text-ui-sm text-text-secondary">
                    {activo && !vencido
                      ? 'Puedes emitir e-CF a la DGII.'
                      : 'Sube tu certificado para empezar a emitir. Mientras tanto puedes cotizar y guardar borradores.'}
                  </span>
                </div>
              </div>
              <Badge variant={activo && !vencido ? 'success' : vencido ? 'danger' : 'neutral'}>
                {activo && !vencido ? 'Activo' : vencido ? 'Vencido' : 'Pendiente'}
              </Badge>
            </div>

            {/* Datos del certificado activo */}
            {certificado && (
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
              </dl>
            )}

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

            {/* Subir / reemplazar certificado — mismo dropzone del onboarding */}
            {!showForm ? (
              <Button variant={activo ? 'secondary' : 'primary'} className="self-start" onClick={() => setShowForm(true)}>
                {certificado ? 'Reemplazar certificado' : 'Subir certificado'}
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
                  helperText="Te la entregó tu proveedor de firma digital al emitir el certificado."
                />
                {error && <p className="text-ui-sm text-danger-600">{error}</p>}
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={handleCancel} disabled={submitting}>
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!file || !passphrase || submitting}
                    onClick={async () => {
                      // Con el certificado nuevo, abrir Secuencias: ahí se detecta sola la
                      // numeración que la DGII ya tiene de este emisor.
                      if (await handleUpload()) setShowSecuencias(true)
                    }}
                  >
                    {submitting ? <Spinner size={18} className="text-white" /> : 'Guardar certificado'}
                  </Button>
                </div>
              </div>
            )}

            {/* Secuencias — reutiliza el paso del onboarding */}
            <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-body-base font-medium text-text-primary">Secuencias</span>
                  <span className="text-ui-sm text-text-secondary">
                    Continúa tu numeración de la DGII para no duplicar e-NCF.
                  </span>
                </div>
                {!showSecuencias && (
                  <Button variant="secondary" size="sm" onClick={() => setShowSecuencias(true)}>
                    Configurar
                  </Button>
                )}
              </div>
              {showSecuencias && (
                <SecuenciasStep
                  detectar={activo && !vencido}
                  onDone={() => {
                    setShowSecuencias(false)
                    toast.success('Secuencias actualizadas')
                  }}
                />
              )}
            </div>

            {/* Ayuda */}
            <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-background-canvas p-4 text-body-sm text-text-secondary">
              <div className="flex items-center gap-2 text-text-primary">
                <HelpCircle size={16} />
                <span className="font-medium">¿Qué es el certificado digital?</span>
              </div>
              <p>
                Es el archivo <strong>.p12</strong> con el que se firman tus comprobantes ante la DGII.
                Lo emite una entidad de certificación autorizada a nombre del representante legal del
                negocio.
              </p>
              <p>
                ¿Aún no lo tienes? Escríbenos a{' '}
                <a href="mailto:soporte@dmaia.io" className="font-medium text-brand-500 hover:underline">
                  soporte@dmaia.io
                </a>{' '}
                y te acompañamos en todo el proceso de certificación.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
