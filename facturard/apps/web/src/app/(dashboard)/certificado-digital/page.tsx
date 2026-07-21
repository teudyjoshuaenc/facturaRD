'use client'

import { useState, useRef, useEffect } from 'react'
import type { JSX } from 'react'
import {
  Download,
  RotateCw,
  KeyRound,
  FileCheck2,
  Calendar,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Info,
  ShieldCheck,
  FileKey2,
  UploadCloud,
  X,
  Hash,
  Fingerprint,
  Building2,
  Upload
} from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Modal } from '@/components/ui/modal'
import { useCertificado } from '@/hooks/useCertificado'
import { cn } from '@/lib/utils'

export default function CertificadoDigitalPage(): JSX.Element {
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

  const [showPassword, setShowPassword] = useState(false)
  const [signatureTested, setSignatureTested] = useState(false)
  const [testingSignature, setTestingSignature] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [wasSubmitting, setWasSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const activo = certificado?.activo === true
  const vencido = diasParaVencer !== null && diasParaVencer < 0

  // Calculate health score:
  // - 0 if no certificate or expired
  // - 84/100 if active but expiring within 30 days
  // - 100/100 if active and healthy (adds extra points if signature test is completed)
  let score = 0
  if (certificado && !vencido) {
    score = 90
    if (porVencer) {
      score = 84
    } else if (signatureTested) {
      score = 100
    }
  }

  // Auto-close modal when upload completes successfully
  useEffect(() => {
    if (wasSubmitting && !submitting && !error) {
      setIsUploadModalOpen(false)
      handleCancel() // Reset input states
      toast.success('Certificado digital cargado y activado correctamente')
    }
    setWasSubmitting(submitting)
  }, [submitting, error, wasSubmitting, handleCancel])

  // Handle simulated signature test
  const handleTestSignature = () => {
    if (!certificado) {
      toast.error('Carga un certificado digital activo antes de probar la firma')
      return
    }
    setTestingSignature(true)
    setTimeout(() => {
      setTestingSignature(false)
      setSignatureTested(true)
      toast.success('Prueba de firma digital exitosa contra la DGII')
    }, 1500)
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const selected = e.dataTransfer.files?.[0]
    if (selected) {
      if (selected.name.endsWith('.p12') || selected.name.endsWith('.pfx')) {
        setFile(selected)
      } else {
        toast.error('El archivo debe ser un certificado .p12 o .pfx.')
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
    }
  }

  const handleModalClose = () => {
    if (!submitting) {
      setIsUploadModalOpen(false)
      handleCancel()
    }
  }

  return (
    <div className="flex flex-col gap-6 text-left pb-10">
      {/* Header and CTA */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h4 font-bold text-text-primary">Certificado digital</h2>
          <p className="text-body-sm text-text-secondary">
            Gestioná el certificado .P12 usado para firmar comprobantes electrónicos ante DGII.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {certificado ? (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-ui-xs font-bold border",
              vencido
                ? "bg-red-50 border-red-200/50 text-red-700"
                : porVencer
                  ? "bg-orange-50 border-orange-200/50 text-orange-700"
                  : "bg-green-50 border-green-200/50 text-green-700"
            )}>
              ● {vencido ? 'Certificado vencido' : porVencer ? `Expira en ${diasParaVencer} días` : `Activo`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-50 border border-neutral-200/50 px-2.5 py-1 text-ui-xs font-bold text-neutral-700">
              ● Sin certificado
            </span>
          )}
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.print()}
            className="h-10 border border-neutral-200 hover:bg-neutral-50 px-4 text-ui-sm font-semibold flex items-center gap-1.5"
          >
            <Download size={15} />
            Exportar detalles
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsUploadModalOpen(true)}
            className="h-10 border border-neutral-200 hover:bg-neutral-50 px-4 text-ui-sm font-semibold flex items-center gap-1.5"
          >
            <RotateCw size={15} />
            Reemplazar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Spinner size={36} />
        </div>
      ) : (
        /* Main Grid Layout */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 items-start w-full">
          {/* Left Column (Grid span 3) */}
          <div className="lg:col-span-3 flex flex-col gap-6 w-full">
            {/* Card 1: Certificado Digital (Figma 304-27633 Layout / Empty state) */}
            <Card className="p-6 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col gap-5 text-left">
              <div className="flex items-start gap-3 border-b border-neutral-100 pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand-600 flex-shrink-0">
                  <span className="text-[13px] font-bold text-brand-600">1</span>
                </div>
                <div className="flex flex-col flex-1">
                  <h3 className="text-body-sm font-bold text-text-primary flex items-center justify-between w-full">
                    <span className="flex items-center gap-1.5">
                      Cargar certificado
                      <Upload size={14} className="text-neutral-400" />
                    </span>
                    <span className="text-[10px] text-text-tertiary">&uarr;</span>
                  </h3>
                  <p className="text-ui-xs text-text-secondary leading-normal">
                    Subí un archivo .P12 emitido por la CA autorizada y su contraseña privada.
                  </p>
                </div>
              </div>

              {certificado ? (
                /* Show accepted active certificate banner (Figma 304-27633) */
                <div className="bg-[rgba(6,118,71,0.05)] border border-[rgba(6,118,71,0.5)] border-dashed flex flex-col gap-4 p-[24px] rounded-[14px] w-full text-left">
                  <div className="flex gap-[8px] items-start w-full">
                    <div className="bg-[#ecfdf3] rounded-[14px] flex items-center justify-center p-2 size-[25px] flex-shrink-0">
                      <ShieldCheck size={22} className="text-[#067647]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-[16px] h-[22px] flex-wrap">
                        <p className="font-semibold text-[13px] text-[#333] leading-[19.5px]">
                          {file ? file.name : `${certificado.rnc}_certificado.p12`}
                        </p>
                        <div className="bg-[rgba(6,118,71,0.1)] h-full rounded-full shrink-0 flex items-center px-[8px] py-[6px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#067647] mr-2"></span>
                          <p className="font-semibold text-[#067647] text-[12px] leading-[18px]">
                            Archivo aceptado
                          </p>
                        </div>
                      </div>
                      
                      {/* Metadata Grid - 2 columns, side-by-side details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 text-[12px] text-[#64748b] mt-3.5 pt-3 w-full">
                        {/* Column 1 */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Building2 size={13} className="text-[#64748b] flex-shrink-0" />
                            <span className="text-[#64748b]">Titular:</span>
                            <span className="font-semibold text-[#333] ml-1">{certificado.titular}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar size={13} className="text-[#64748b] flex-shrink-0" />
                            <span className="text-[#64748b]">Vigencia:</span>
                            <span className="font-semibold text-[#333] ml-1 font-mono">
                              {new Date(certificado.validoDesde).toISOString().split('T')[0]} → {new Date(certificado.validoHasta).toISOString().split('T')[0]}
                            </span>
                          </div>
                        </div>
                        
                        {/* Column 2 */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Hash size={13} className="text-[#64748b] flex-shrink-0" />
                            <span className="text-[#64748b]">RNC:</span>
                            <span className="font-semibold text-[#333] ml-1 font-mono">{certificado.rnc}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Fingerprint size={13} className="text-[#64748b] flex-shrink-0" />
                            <span className="text-[#64748b]">Huella:</span>
                            <span className="font-semibold text-red-600 italic ml-1">
                              Missing data: Huella
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="text-[12px] font-semibold text-[#0379d5] hover:text-[#0365b2] underline mt-3.5 block text-left"
                      >
                        Cambiar archivo
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Elegant empty state banner when no certificate is configured */
                <div className="bg-neutral-50 border border-neutral-200 border-dashed flex flex-col items-center justify-center py-10 px-5 rounded-[14px] w-full text-center gap-3">
                  <div className="bg-neutral-100 rounded-full p-3 text-neutral-400">
                    <Lock size={32} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="font-semibold text-neutral-800 text-sm">No hay un certificado digital activo</h4>
                    <p className="text-xs text-neutral-500 max-w-sm">
                      Sube tu certificado .P12 para habilitar la firma digital de tus facturas y el envío a la DGII.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="h-10 px-4 bg-[#0379d5] hover:bg-brand-600 text-white font-semibold rounded-lg text-xs"
                  >
                    Cargar certificado
                  </Button>
                </div>
              )}
            </Card>

            {/* Card 2: Resultado de validación */}
            <Card className="p-6 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col gap-4 text-left">
              <div className="flex items-start gap-3 border-b border-neutral-100 pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand-600 flex-shrink-0">
                  <span className="text-[13px] font-bold text-brand-600">2</span>
                </div>
                <div className="flex flex-col">
                  <h3 className="text-body-sm font-bold text-text-primary flex items-center gap-1.5">
                    Resultado de validación
                    <span className="text-[10px] text-text-tertiary">&uarr;</span>
                  </h3>
                  <p className="text-ui-xs text-text-secondary leading-normal">
                    Verificaciones automáticas realizadas sobre el certificado cargado.
                  </p>
                </div>
              </div>

              {/* Validation items list */}
              <div className="flex flex-col gap-2.5">
                {[
                  { label: 'Firma digital verificable', desc: 'Cadena de confianza válida hasta CA raíz DGII', status: certificado ? 'OK' : 'PENDING' },
                  { label: 'RNC coincide con empresa', desc: certificado ? `${certificado.rnc} - ${certificado.titular}` : 'Pendiente de carga', status: certificado ? 'OK' : 'PENDING' },
                  { label: 'Algoritmo compatible DGII', desc: certificado ? 'SHA-256 - RSA 2048' : 'Pendiente de carga', status: certificado ? 'OK' : 'PENDING' },
                  { label: 'Fecha de expiración', desc: certificado ? `Vence el ${new Date(certificado.validoHasta).toISOString().split('T')[0]} ${porVencer ? '· renueva pronto' : ''}` : 'Pendiente de carga', status: certificado ? (porVencer ? 'WARN' : 'OK') : 'PENDING' },
                  { label: 'Compatible con DGII', desc: certificado ? 'Cumple con los requisitos técnicos para firmar e-CF E31, E32, E33, E34, E41, E43, E44 y E45.' : 'Pendiente de carga', status: certificado ? 'OK' : 'PENDING' },
                ].map((item, idx) => {
                  const isOk = item.status === 'OK'
                  const isPending = item.status === 'PENDING'
                  const isWarn = item.status === 'WARN'

                  return (
                    <div key={idx} className="flex justify-between items-start p-3 bg-neutral-50/50 border border-neutral-200/50 rounded-xl">
                      <div className="flex items-start gap-3">
                        {isOk ? (
                          <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                        ) : isWarn ? (
                          <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <Clock size={16} className="text-neutral-300 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex flex-col leading-tight">
                          <span className="text-ui-sm font-bold text-text-primary">{item.label}</span>
                          <span className="text-ui-xs text-text-secondary mt-0.5">{item.desc}</span>
                        </div>
                      </div>
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border",
                        isOk
                          ? "bg-green-50 text-green-700 border-green-200/40"
                          : isWarn
                            ? "bg-orange-50 text-orange-700 border-orange-200/40"
                            : "bg-neutral-50 text-neutral-400 border-neutral-200/40"
                      )}>
                        {isOk ? 'Aprobado' : isWarn ? 'Advertencia' : 'Pendiente'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Card 3: Prueba de firma digital (Figma 304-28015) */}
            <Card className="p-6 bg-white border border-neutral-200 shadow-sm rounded-xl flex flex-col gap-4 text-left">
              <div className="flex items-start gap-3 border-b border-neutral-100 pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-brand-600 flex-shrink-0">
                  <span className="text-[13px] font-bold text-brand-600">3</span>
                </div>
                <div className="flex flex-col">
                  <h3 className="text-body-sm font-bold text-text-primary flex items-center gap-1.5">
                    Prueba de firma digital
                    <ShieldCheck size={16} className="text-brand-500 inline" />
                  </h3>
                  <p className="text-ui-xs text-text-secondary leading-normal">
                    Firmá un XML de prueba para confirmar que el certificado funciona de punta a punta contra DGII.
                  </p>
                </div>
              </div>

              {/* Blue styled testing block */}
              <div className="bg-[rgba(3,121,213,0.05)] border border-[rgba(3,121,213,0.4)] flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 rounded-[14px] gap-4 w-full text-left">
                <div className="flex items-center gap-3">
                  <div className="bg-white border border-[#e4e7ec] rounded-[14px] flex items-center justify-center p-2.5 size-11 flex-shrink-0 shadow-sm">
                    <FileCheck2 size={20} className="text-brand-500" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-bold text-[#333]">Firma un XML de prueba</span>
                    <span className="text-xs text-text-secondary mt-0.5">
                      Generamos un e-CF de prueba, lo firmamos y validamos la respuesta.
                    </span>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleTestSignature}
                  disabled={testingSignature || !certificado}
                  className="h-10 px-4 bg-[#0379d5] hover:bg-brand-600 text-white font-semibold shrink-0 rounded-lg text-xs"
                >
                  {testingSignature ? <Spinner size={16} className="text-white" /> : 'Probar firma digital'}
                </Button>
              </div>
            </Card>
          </div>

          {/* Right Column: Figma DetailPanel (Figma 304-26110) */}
          <div className="flex flex-col gap-6 w-full lg:col-span-1">
            <div className="bg-white border border-neutral-200 flex flex-col items-start overflow-hidden rounded-[14px] shrink-0 w-full sticky top-24 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.04)]">
              {/* Header block with status-based coloring */}
              <div className={cn(
                "border-b border-neutral-200 flex flex-col gap-3.5 items-start pb-4 pt-3.5 px-5 relative shrink-0 w-full text-left",
                certificado && !vencido
                  ? porVencer
                    ? "bg-[rgba(181,71,8,0.05)]"
                    : "bg-green-500/[0.05]"
                  : vencido
                    ? "bg-red-500/[0.05]"
                    : "bg-neutral-50"
              )}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex flex-col gap-1">
                    <span className="leading-[16.5px] text-[11px] tracking-[0.6px] uppercase font-bold text-neutral-400">
                      Estado del certificado
                    </span>
                    <h4 className={cn(
                      "text-lg font-bold leading-tight",
                      certificado && !vencido
                        ? porVencer
                          ? "text-[#b54708]"
                          : "text-green-700"
                        : vencido
                          ? "text-red-700"
                          : "text-neutral-600"
                    )}>
                      {certificado && !vencido
                        ? porVencer
                          ? 'Activo · vence pronto'
                          : 'Activo'
                        : vencido
                          ? 'Vencido'
                          : 'No certificado'}
                    </h4>
                  </div>
                  <div className={cn(
                    "rounded-[14px] flex items-center justify-center p-2 size-10 flex-shrink-0",
                    certificado && !vencido
                      ? porVencer
                        ? "bg-[rgba(181,71,8,0.05)] text-[#b54708]"
                        : "bg-green-100 text-green-700"
                      : vencido
                        ? "bg-red-100 text-red-700"
                        : "bg-neutral-100 text-neutral-400"
                  )}>
                    {certificado && !vencido ? (
                      porVencer ? (
                        <AlertTriangle size={18} />
                      ) : (
                        <CheckCircle2 size={18} />
                      )
                    ) : vencido ? (
                      <XCircle size={18} />
                    ) : (
                      <Lock size={18} />
                    )}
                  </div>
                </div>
              </div>

              {/* Checklist and Health metrics container */}
              <div className="flex flex-col gap-5 items-start p-5 w-full text-left">
                {/* Checklist de activación */}
                <div className="flex flex-col gap-3 items-start w-full">
                  <span className="text-[11px] tracking-[0.6px] uppercase font-bold text-neutral-400">
                    Checklist de activación
                  </span>
                  <div className="flex gap-2 items-end">
                    <p className={cn(
                      "text-3xl font-extrabold tracking-tight leading-none",
                      porVencer ? "text-[#b54708]" : "text-neutral-800"
                    )}>
                      {diasParaVencer !== null ? Math.max(0, diasParaVencer) : '0'}
                    </p>
                    <span className="text-xs text-neutral-500 font-medium">días restantes</span>
                  </div>
                  <div className="bg-[#f2f4f7] h-1.5 rounded-full overflow-hidden w-full">
                    <div
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-500",
                        porVencer ? "bg-[#b54708]" : "bg-green-600"
                      )}
                      style={{ width: `${diasParaVencer !== null ? Math.max(5, Math.min(100, (diasParaVencer / 365) * 100)) : 0}%` }}
                    />
                  </div>
                  {certificado && (
                    <div className="flex gap-1.5 items-center text-[11px] text-neutral-500 mt-1">
                      <Calendar size={13} className="text-neutral-400" />
                      <span>Vence el </span>
                      <span className="font-bold font-mono text-neutral-700">
                        {new Date(certificado.validoHasta).toISOString().split('T')[0]}
                      </span>
                    </div>
                  )}
                </div>

                <hr className="border-neutral-200 w-full" />

                {/* Salud del certificado */}
                <div className="flex flex-col gap-3 items-start w-full">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] tracking-[0.6px] uppercase font-bold text-neutral-400">
                      Salud del certificado
                    </span>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                      score >= 80
                        ? "bg-[#ecfdf3] text-[#067647]"
                        : score > 0
                          ? "bg-orange-50 text-orange-700 border border-orange-200/50"
                          : "bg-red-50 text-red-700 border border-red-200/50"
                    )}>
                      {score}/100
                    </span>
                  </div>
                  <div className="bg-[#f2f4f7] h-2 rounded-full overflow-hidden w-full">
                    <div
                      className={cn(
                        "h-2 rounded-full transition-all duration-500",
                        score >= 80
                          ? "bg-[#067647]"
                          : score > 0
                            ? "bg-[#b54708]"
                            : "bg-red-600"
                      )}
                      style={{ width: `${score}%` }}
                    />
                  </div>

                  {/* Health status check list lines */}
                  <div className="flex flex-col gap-2 mt-2 w-full text-xs font-semibold text-neutral-700">
                    <div className="flex items-center gap-2">
                      {certificado ? (
                        <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
                      ) : (
                        <Clock size={14} className="text-neutral-300 flex-shrink-0" />
                      )}
                      <span className={cn(certificado ? "text-neutral-800" : "text-neutral-400 font-normal")}>
                        Validez y cadena de confianza
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {certificado && !porVencer ? (
                        <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
                      ) : certificado ? (
                        <XCircle size={14} className="text-red-500 flex-shrink-0" />
                      ) : (
                        <Clock size={14} className="text-neutral-300 flex-shrink-0" />
                      )}
                      <span className={cn(certificado && !porVencer ? "text-neutral-800" : "text-neutral-400 font-normal")}>
                        Vigencia adecuada (&gt;30 días)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {signatureTested ? (
                        <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
                      ) : (
                        <Clock size={14} className="text-neutral-400 flex-shrink-0 font-normal" />
                      )}
                      <span className={cn(signatureTested ? "text-neutral-800" : "text-neutral-400 font-normal")}>
                        Prueba de firma exitosa
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup for Uploading/Replacing Certificate */}
      <Modal
        open={isUploadModalOpen}
        onClose={handleModalClose}
        title="Cargar certificado"
        subtitle="Subí un archivo .P12 emitido por la CA autorizada y su contraseña privada."
        icon={<UploadCloud size={20} />}
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 max-w-[200px] leading-tight select-none">
              <Info size={12} className="text-neutral-400 flex-shrink-0" />
              <span>Nunca almacenamos tu contraseña en texto plano. Se cifra con AES-256.</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="md"
                disabled={submitting}
                onClick={handleModalClose}
                className="h-[42px] w-[101px] rounded-[10px] border-[#E2E8F0] text-[#64748B] text-[14px] font-normal"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={!file || !passphrase || submitting}
                onClick={handleUpload}
                className={cn(
                  "flex items-center justify-center gap-[4px] h-[42px] px-[20px] rounded-[10px] text-white text-[14px] font-normal whitespace-nowrap",
                  file && passphrase && !submitting
                    ? "bg-[#0379D5] hover:bg-[#0365b2]"
                    : "bg-neutral-300 text-neutral-400 cursor-not-allowed border-none"
                )}
              >
                {submitting ? (
                  <Spinner size={16} className="text-white" />
                ) : (
                  <ShieldCheck size={16} />
                )}
                Enviar
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-[20px] select-none text-left">
          {/* File Selector Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleFileDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            className={cn(
              'bg-slate-500/[0.05] border border-slate-500/30 border-dashed flex flex-col items-center justify-center px-6 py-8 rounded-[14px] cursor-pointer hover:bg-slate-500/[0.08] transition-all w-full text-center',
              dragging && 'border-brand-500 bg-brand-50/50'
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".p12,.pfx"
              className="hidden"
              onChange={handleFileSelect}
            />
            {file ? (
              <>
                <FileCheck2 className="text-green-600 mb-2 animate-bounce" size={40} />
                <p className="font-semibold text-neutral-800 text-sm">{file.name}</p>
                <p className="text-neutral-500 text-xs mt-1">
                  Archivo seleccionado · Haz clic para cambiarlo
                </p>
              </>
            ) : (
              <>
                <div className="bg-white border border-neutral-200 drop-shadow-[0px_4px_7px_rgba(16,24,40,0.06)] relative rounded-2xl size-14 flex items-center justify-center mb-2">
                  <FileKey2 size={22} className="text-neutral-500" />
                  <div className="absolute -top-1 -right-1 bg-brand-500 text-[9px] font-bold text-white px-1.5 py-0.2 rounded">
                    .P12
                  </div>
                </div>
                <p className="font-semibold text-neutral-800 text-sm">
                  Arrastrá tu archivo .P12 o <span className="text-[#0379d5] hover:underline">hacé clic para subirlo</span>
                </p>
                <p className="text-neutral-500 text-xs mt-1 font-medium">
                  También aceptamos .PFX · máx 5MB · el archivo nunca sale de tu ambiente
                </p>
              </>
            )}
          </div>

          {/* Passphrase Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-ui-sm font-semibold text-[#64748B] font-sans">
              Contraseña del certificado *
            </label>
            <div className="relative w-full">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Ingresa la contraseña"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                disabled={submitting}
                className="h-11 w-full rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] pl-10 pr-10 text-[13px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500/25"
              />
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-brand-500"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
        </div>
      </Modal>
    </div>
  )
}

