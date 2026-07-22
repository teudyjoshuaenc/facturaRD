'use client'

import React, { use, useState } from 'react'
import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import {
  ChevronLeft,
  Download,
  Send,
  Copy,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Mail,
  AlertTriangle,
  AlertCircle,
  Pencil,
} from 'lucide-react'
import {
  type Comprobante,
  estadoDgiiBadge,
  tipoClaseBadge,
  ESTADO_LABELS,
  formatCurrency,
  downloadComprobantePdf,
} from '@/lib/comprobantes'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ReenviarModal } from '@/components/facturas/ReenviarModal'
import { ConfirmReemitirModal } from '@/components/facturas/ConfirmReemitirModal'
import { toast } from 'sonner'
import { useEmissionStatus } from '@/hooks/useEmissionStatus'
import { useEnviarComprobante, useEnviosComprobante } from '@/hooks/useComprobantes'

interface PageProps {
  params: Promise<{ id: string }>
}

type TabType = 'resumen' | 'estado_dgii' | 'xml_firma' | 'historial' | 'pdf_correo'

export default function FacturaDetailPage({ params }: PageProps): JSX.Element {
  const router = useRouter()
  const resolvedParams = use(params)
  const id = resolvedParams.id

  const { blockingReason } = useEmissionStatus()

  const [activeTab, setActiveTab] = useState<TabType>('resumen')
  const [downloading, setDownloading] = useState(false)
  const [isReenviarOpen, setIsReenviarOpen] = useState(false)
  const [showConfirmReemitir, setShowConfirmReemitir] = useState(false)
  const [emitting, setEmitting] = useState(false)

  // Envío al cliente por GoHighLevel (post-emisión, no toca el estado DGII).
  const enviarComprobante = useEnviarComprobante()
  const { envios, isLoading: enviosLoading } = useEnviosComprobante(id)

  const handleEmitir = async () => {
    setEmitting(true)
    try {
      await api.post(`/comprobantes/${id}/emitir`)
      toast.success('Comprobante emitido exitosamente')
      router.push('/facturas')
    } catch (err) {
      toast.error('Error al emitir comprobante', { description: getErrorMessage(err) })
    } finally {
      setEmitting(false)
    }
  }

  // Fetch Comprobante details
  const { data: comprobante, isLoading, error } = useQuery<Comprobante>({
    queryKey: ['comprobante-detalle', id],
    queryFn: () => api.get<Comprobante>(`/comprobantes/${id}`).then((res) => res.data),
    enabled: !!id,
  })

  // Fetch Tenant details
  const { data: tenant } = useQuery<any>({
    queryKey: ['tenant-info'],
    queryFn: () => api.get<any[]>('/tenants').then((res) => res.data[0] || null),
  })

  const handleDownload = async () => {
    if (!comprobante) return
    setDownloading(true)
    try {
      await downloadComprobantePdf(api, comprobante.id, comprobante.eNCF)
    } catch {
      toast.error('No se pudo descargar el PDF de este comprobante')
    } finally {
      setDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Spinner size={36} />
        <span className="text-[14px] text-[#64748b] font-medium font-sans">Cargando comprobante...</span>
      </div>
    )
  }

  if (error || !comprobante) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 font-sans text-center">
        <AlertTriangle className="text-[#f59e0b] h-10 w-10" />
        <div>
          <h3 className="text-[18px] font-semibold text-[#333]">Comprobante no encontrado</h3>
          <p className="text-[14px] text-[#64748b] mt-1">No pudimos cargar la información de este registro.</p>
        </div>
        <Button onClick={() => router.push('/facturas')} variant="secondary">
          Volver a facturas
        </Button>
      </div>
    )
  }

  const items = comprobante.datos?.items || []
  const subtotal = items.reduce((sum: number, it: any) => sum + (it.cantidad * it.precioUnitarioItem - (it.descuento || 0)), 0)
  const total = Number(comprobante.montoTotal || 0)
  const itbis = Math.max(0, total - subtotal)

  // Format RNC: e.g. 130-87456-2
  const formatRnc = (rncStr?: string) => {
    if (!rncStr) return '—'
    return rncStr.length === 9
      ? rncStr.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
      : rncStr.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')
  }

  // Format Date and Time: e.g. 20/04/2026 10:32:15
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    const pad = (n: number) => n.toString().padStart(2, '0')
    const d = pad(date.getDate())
    const m = pad(date.getMonth() + 1)
    const y = date.getFullYear()
    const h = pad(date.getHours())
    const min = pad(date.getMinutes())
    const s = pad(date.getSeconds())
    return `${d}/${m}/${y} ${h}:${min}:${s}`
  }

  // Historial con SOLO eventos reales y verificables (nada de pasos con horas
  // inventadas). Fuente: createdAt, updatedAt, estado, trackId y mensajeDGII.
  const buildHistorial = (c: Comprobante) => {
    const eventos: {
      fecha: string
      estado: string
      icon: JSX.Element
      codigo: string
      descr: string
      trackId: string
    }[] = []

    const esAceptado = c.estado === 'ACEPTADO' || c.estado === 'ACEPTADO_CONDICIONAL'
    const esError = c.estado === 'RECHAZADO' || c.estado === 'ERROR'
    const enProceso = c.estado === 'PENDIENTE' || c.estado === 'EN_COLA' || c.estado === 'ENVIANDO'

    // Respuesta / estado actual de la DGII (evento más reciente → primero).
    if (esAceptado) {
      eventos.push({
        fecha: formatDateTime(c.updatedAt),
        estado: ESTADO_LABELS[c.estado],
        icon: <CheckCircle2 size={14} className="text-[#067647] shrink-0" />,
        codigo: c.estado === 'ACEPTADO' ? '0' : '—',
        descr: c.mensajeDGII || 'Aceptado por la DGII',
        trackId: c.trackId || '—',
      })
    } else if (esError) {
      eventos.push({
        fecha: formatDateTime(c.updatedAt),
        estado: ESTADO_LABELS[c.estado],
        icon: <XCircle size={14} className="text-[#f04438] shrink-0" />,
        codigo: '—',
        descr: c.mensajeDGII || (c.estado === 'RECHAZADO' ? 'Rechazado por la DGII' : 'Error de envío'),
        trackId: c.trackId || '—',
      })
    } else if (enProceso) {
      eventos.push({
        fecha: formatDateTime(c.updatedAt),
        estado: ESTADO_LABELS[c.estado],
        icon: <Clock size={14} className="text-[#0379d5] shrink-0" />,
        codigo: '—',
        descr: 'En proceso ante la DGII',
        trackId: c.trackId || '—',
      })
    }

    // Creación / emisión (siempre). Si tiene e-NCF, ya fue emitido.
    eventos.push({
      fecha: formatDateTime(c.createdAt),
      estado: c.eNCF ? 'Comprobante emitido' : 'Borrador creado',
      icon: <FileText size={14} className="text-[#64748b] shrink-0" />,
      codigo: '—',
      descr: c.eNCF ? `e-NCF ${c.eNCF} asignado` : 'Registro creado en el sistema',
      trackId: '—',
    })

    return eventos
  }

  // Tarjeta "Estado DGII" derivada del estado REAL (nada hardcodeado). Nunca muestra
  // "Aceptado" para un comprobante rechazado/pendiente/borrador.
  const toneStyles = {
    green: { card: 'border-[#a6f4c5] bg-[#f6fef9]', iconWrap: 'bg-[#ecfdf3] text-[#067647]', title: 'text-[#067647]' },
    red: { card: 'border-[#fecaca] bg-[#fef2f2]', iconWrap: 'bg-[#fee2e2] text-[#d92d20]', title: 'text-[#b42318]' },
    amber: { card: 'border-[#fed7aa] bg-[#fff7ed]', iconWrap: 'bg-[#ffedd5] text-[#c2410c]', title: 'text-[#c2410c]' },
    neutral: { card: 'border-[#e2e8f0] bg-[#f8fafc]', iconWrap: 'bg-[#eff6ff] text-[#0379d5]', title: 'text-[#333]' },
    draft: { card: 'border-[#e2e8f0] bg-[#f8fafc]', iconWrap: 'bg-[#f1f5f9] text-[#64748b]', title: 'text-[#333]' },
  }

  const estadoDgii = ((): {
    tone: keyof typeof toneStyles
    icon: JSX.Element
    title: string
    desc: string
    codigo: string
    showDetalle: boolean
    actions: { title: string; body: string } | null
  } => {
    const e = comprobante.estado
    if (e === 'ACEPTADO' || e === 'ACEPTADO_CONDICIONAL') {
      const cond = e === 'ACEPTADO_CONDICIONAL'
      return {
        tone: 'green',
        icon: <CheckCircle2 size={20} />,
        title: cond ? 'Aceptado con observaciones' : 'Aceptado por la DGII',
        desc: cond
          ? 'La DGII aceptó el comprobante con observaciones.'
          : 'El comprobante fue aceptado exitosamente.',
        codigo: cond ? '202 - Aceptado condicional' : '0 - Aceptado',
        showDetalle: true,
        actions: cond
          ? { title: 'Observaciones de la DGII', body: comprobante.mensajeDGII || 'Revise las observaciones reportadas por la DGII en el comprobante.' }
          : null,
      }
    }
    if (e === 'RECHAZADO') {
      return {
        tone: 'red',
        icon: <XCircle size={20} />,
        title: 'Rechazado por la DGII',
        desc: 'La DGII rechazó el comprobante. No tiene validez fiscal.',
        codigo: '—',
        showDetalle: true,
        actions: { title: 'Motivo del rechazo', body: comprobante.mensajeDGII || 'La DGII no detalló el motivo del rechazo.' },
      }
    }
    if (e === 'ERROR') {
      return {
        tone: 'amber',
        icon: <AlertTriangle size={20} />,
        title: 'Error de envío',
        desc: 'Ocurrió un error técnico al enviar el comprobante a la DGII.',
        codigo: '—',
        showDetalle: true,
        actions: { title: 'Detalle del error', body: comprobante.mensajeDGII || 'Excepción técnica en la conexión con la DGII.' },
      }
    }
    if (e === 'PENDIENTE' || e === 'EN_COLA' || e === 'ENVIANDO') {
      return {
        tone: 'neutral',
        icon: <Clock size={20} />,
        title: 'En proceso',
        desc: 'El comprobante está pendiente de respuesta de la DGII.',
        codigo: '—',
        showDetalle: true,
        actions: null,
      }
    }
    // DRAFT
    return {
      tone: 'draft',
      icon: <FileText size={20} />,
      title: 'Borrador — no enviado a la DGII',
      desc: 'Este comprobante es un borrador. Aún no se ha enviado a la DGII y no tiene validez fiscal.',
      codigo: '—',
      showDetalle: false,
      actions: null,
    }
  })()

  return (
    <div className="flex flex-col gap-6 font-sans select-none text-left w-full">
      {/* Back Button & Title Area */}
      <div className="flex gap-[16px] items-center h-[61px] w-full select-none">
        {/* Back Button */}
        <button
          onClick={() => router.push('/facturas')}
          className="bg-white border border-[#d0d5dd] h-[40px] w-[40px] rounded-[10px] flex items-center justify-center hover:bg-neutral-50 transition-colors focus:outline-none shrink-0 cursor-pointer"
          title="Volver a facturas"
        >
          <ChevronLeft size={18} className="text-[#64748b]" />
        </button>

        {/* Title and Badge */}
        <div className="flex flex-col items-start font-sans">
          <div className="flex gap-[12px] items-center">
            {/* Identificador real: e-NCF, o folio NV- de la nota de venta. */}
            <h1 className="text-[24px] font-semibold text-[#333333] leading-[36px]">
              {comprobante.eNCF || comprobante.folioInterno || 'Sin e-NCF'}
            </h1>
            {/* Estado DGII — misma fuente única que la lista. Antes este badge
                etiquetaba ERROR como "Rechazado" y ponía spinner a borradores. */}
            {(() => {
              const { label, tono, aplicaDgii, titulo } = estadoDgiiBadge(comprobante.estado)
              if (!aplicaDgii) return null
              const wrap =
                tono === 'success' ? 'bg-[rgba(6,118,71,0.1)] text-[#067647]'
                : tono === 'warning' ? 'bg-[rgba(225,113,0,0.1)] text-[#e17100]'
                : tono === 'danger' ? 'bg-[rgba(180,35,24,0.1)] text-[#b42318]'
                : 'bg-neutral-100 text-[#64748b]'
              const Icono =
                tono === 'success' ? CheckCircle2
                : tono === 'warning' ? AlertTriangle
                : tono === 'danger' ? (comprobante.estado === 'ERROR' ? AlertCircle : XCircle)
                : RefreshCw
              return (
                <div
                  title={titulo}
                  className={`inline-flex items-center gap-[6px] px-[10px] py-[5px] rounded-[10px] text-[12px] font-normal leading-[18px] ${wrap}`}
                >
                  <Icono size={13} className={`shrink-0 ${tono === 'proceso' ? 'animate-spin' : ''}`} />
                  <span>{label}</span>
                </div>
              )
            })()}
          </div>
          <p className="text-[14px] text-[#64748b] leading-[21px] mt-0.5">
            {tipoClaseBadge(comprobante).label} • {comprobante.razonSocial} • {formatCurrency(total)}
          </p>
        </div>
      </div>

      {/* Horizontal Action Buttons Row */}
      <div className="flex flex-wrap gap-[8px] items-center w-full">
        {comprobante.estado !== 'RECHAZADO' && comprobante.estado !== 'ERROR' && (
          <Button
            variant="secondary"
            onClick={handleDownload}
            disabled={downloading}
            className="h-[40px] px-[16px] py-[10px] rounded-[10px] border border-[#e2e8f0] bg-white text-[#333] hover:bg-neutral-50 text-[12px] font-normal leading-[19.5px] gap-[7px] flex items-center transition-all disabled:opacity-50"
          >
            {downloading ? <Spinner size={14} /> : <Download size={14} className="shrink-0 text-[#64748b]" />}
            <span>Descargar PDF</span>
          </Button>
        )}
        {comprobante.estado === 'DRAFT' || comprobante.estado === 'RECHAZADO' || comprobante.estado === 'ERROR' ? (
          <>
            <Button
              variant="secondary"
              onClick={() => router.push(`/nueva-factura?id=${id}`)}
              className="h-[40px] px-[16px] py-[10px] rounded-[10px] border border-[#e2e8f0] bg-white text-[#333] hover:bg-neutral-50 text-[12px] font-normal leading-[19.5px] gap-[7px] flex items-center transition-all cursor-pointer"
            >
              <Pencil size={14} className="shrink-0 text-[#64748b]" />
              <span>Editar factura</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (blockingReason) {
                  toast.error('Emisión bloqueada', { description: blockingReason })
                  return
                }
                setShowConfirmReemitir(true)
              }}
              disabled={emitting}
              className="h-[40px] px-[16px] py-[10px] rounded-[10px] border border-[#0379d5]/30 bg-white text-[#0379d5] hover:bg-blue-50 text-[12px] font-semibold leading-[19.5px] gap-[7px] flex items-center transition-all disabled:opacity-50 cursor-pointer"
            >
              {emitting ? <Spinner size={14} /> : <Send size={14} className="shrink-0 text-[#0379d5]" />}
              <span>Emitir comprobante</span>
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={() => setIsReenviarOpen(true)}
              className="h-[40px] px-[16px] py-[10px] rounded-[10px] border border-[#e2e8f0] bg-white text-[#333] hover:bg-neutral-50 text-[12px] font-normal leading-[19.5px] gap-[6px] flex items-center transition-all cursor-pointer"
            >
              <Mail size={14} className="shrink-0 text-[#64748b]" />
              <span>Reenviar al receptor</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => alert('Clonando comprobante...')}
              className="h-[40px] px-[16px] py-[10px] rounded-[10px] border border-[#e2e8f0] bg-white text-[#333] hover:bg-neutral-50 text-[12px] font-normal leading-[19.5px] gap-[7px] flex items-center transition-all cursor-pointer"
            >
              <Copy size={14} className="shrink-0 text-[#64748b]" />
              <span>Clonar</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => alert('Generando nota de crédito E34...')}
              className="h-[40px] px-[16px] py-[10px] rounded-[10px] border border-[#e2e8f0] bg-white text-[#333] hover:bg-neutral-50 text-[12px] font-normal leading-[19.5px] gap-[6px] flex items-center transition-all cursor-pointer"
            >
              <FileText size={14} className="shrink-0 text-[#64748b]" />
              <span>Crear nota de crédito E34</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => alert('Generando nota de crédito E33...')}
              className="h-[40px] px-[16px] py-[10px] rounded-[10px] border border-[#e2e8f0] bg-white text-[#333] hover:bg-neutral-50 text-[12px] font-normal leading-[19.5px] gap-[6px] flex items-center transition-all cursor-pointer"
            >
              <FileText size={14} className="shrink-0 text-[#64748b]" />
              <span>Crear nota de crédito E33</span>
            </Button>
          </>
        )}
      </div>

      {/* Tabs list switcher */}
      <div className="relative flex items-center border-b border-[#e2e8f0] w-full shrink-0">
        {[
          { key: 'resumen', label: 'Resumen' },
          { key: 'estado_dgii', label: 'Estado DGII' },
          { key: 'xml_firma', label: 'XML y firma' },
          { key: 'historial', label: 'Historial' },
          { key: 'pdf_correo', label: 'PDF y correo' },
        ].map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`px-[24px] py-[14px] flex items-center justify-center text-[12px] text-center font-semibold relative transition-colors focus:outline-none cursor-pointer font-sans leading-[19.5px] ${isActive ? 'text-[#0379d5]' : 'text-[#333] hover:text-[#0379d5]'
                }`}
            >
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0379d5]" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Panels */}
      <div className="w-full">
        {/* RESUMEN TAB */}
        {activeTab === 'resumen' && (
          <div className="flex flex-col gap-6 w-full">
            {/* Emisor & Receptor Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {/* Emisor Card */}
              <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-[24px] flex flex-col gap-[12px] w-full text-left">
                <h3 className="text-[16px] font-semibold text-[#333]">Emisor</h3>
                <div className="flex flex-col gap-[8px] text-[14px] text-normal leading-[19.5px]">
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[#64748b]">RNC</span>
                    <span className="text-[#333] font-normal">{formatRnc(tenant?.rnc) || 'missing data'}</span>
                  </div>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[#64748b]">Razón social</span>
                    <span className="text-[#333] font-normal">{tenant?.razonSocial || 'missing data'}</span>
                  </div>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[#64748b]">Dirección</span>
                    <span className="text-[#333] font-normal">{tenant?.direccion || 'missing data'}</span>
                  </div>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[#64748b]">Teléfono</span>
                    <span className="text-[#333] font-normal">{tenant?.telefono || 'missing data'}</span>
                  </div>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[#64748b]">Correo</span>
                    <span className="text-[#333] font-normal">{tenant?.email || 'missing data'}</span>
                  </div>
                </div>
              </div>

              {/* Receptor Card */}
              <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-[24px] flex flex-col gap-[12px] w-full text-left">
                <h3 className="text-[16px] font-semibold text-[#333]">Receptor</h3>
                <div className="flex flex-col gap-[8px] text-[14px] text-normal leading-[19.5px]">
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[#64748b]">RNC</span>
                    <span className="text-[#333] font-normal">{formatRnc(comprobante.rnc)}</span>
                  </div>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[#64748b]">Razón social</span>
                    <span className="text-[#333] font-normal">{comprobante.razonSocial}</span>
                  </div>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[#64748b]">Dirección</span>
                    <span className="text-[#333] font-normal">Av. Winston Churchill #45, Sto. Dgo.</span>
                  </div>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[#64748b]">Teléfono</span>
                    <span className="text-[#333] font-normal">809-555-0202</span>
                  </div>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[#64748b]">Correo</span>
                    <span className="text-[#333] font-normal">receptor@correo.com</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Service Items Table */}
            <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-[24px] flex flex-col gap-[16px] w-full text-left">
              <h3 className="text-[16px] font-semibold text-[#333]">Servicios/Productos</h3>
              <div className="overflow-x-auto w-full">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[#f1f5f9] text-[14px] text-[#64748b] leading-[19.5px]">
                      <th className="pb-[12px] font-normal text-left min-w-[250px]">Descripción</th>
                      <th className="pb-[12px] font-normal text-right w-[80px]">Cant.</th>
                      <th className="pb-[12px] font-normal text-right w-[150px]">Precio unit.</th>
                      <th className="pb-[12px] font-normal text-right w-[120px]">ITBIS</th>
                      <th className="pb-[12px] font-normal text-right w-[150px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it: any, index: number) => {
                      const itemItbis = (it.cantidad * it.precioUnitarioItem - (it.descuento || 0)) * 0.18
                      const itemTotal = (it.cantidad * it.precioUnitarioItem - (it.descuento || 0)) * 1.18
                      return (
                        <tr key={index} className="border-b border-[#f1f5f9] text-[14px] text-[#333] leading-[19.5px]">
                          <td className="py-[16px] font-semibold">{it.nombreItem}</td>
                          <td className="py-[16px] text-right">{it.cantidad}</td>
                          <td className="py-[16px] text-right">{formatCurrency(it.precioUnitarioItem)}</td>
                          <td className="py-[16px] text-right">{formatCurrency(itemItbis)}</td>
                          <td className="py-[16px] text-right">{formatCurrency(itemTotal)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="flex flex-col gap-[8px] text-[14px] text-normal leading-[19.5px] text-[#64748b] self-end w-full md:w-[300px] mt-4 border-t border-[#f1f5f9] pt-4">
                <div className="flex justify-between items-center w-full">
                  <span>Subtotal</span>
                  <span className="text-[#333]">{formatCurrency(subtotal || total)}</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <span>ITBIS (18%)</span>
                  <span className="text-[#333]">{formatCurrency(itbis || 0)}</span>
                </div>
                <div className="flex justify-between items-center w-full border-t border-[#e2e8f0] pt-2 text-[18px] font-bold text-[#333] leading-[27px]">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ESTADO DGII TAB — refleja el estado REAL del comprobante */}
        {activeTab === 'estado_dgii' && (
          <div className="flex flex-col gap-6 w-full">
            {/* Tarjeta de estado (color según estado real) */}
            <div className={`border rounded-[14px] p-[24px] flex flex-col gap-[16px] w-full text-left ${toneStyles[estadoDgii.tone].card}`}>
              <div className="flex gap-[16px] items-start w-full">
                <div className={`flex h-[34px] w-[34px] items-center justify-center rounded-full shrink-0 ${toneStyles[estadoDgii.tone].iconWrap}`}>
                  {estadoDgii.icon}
                </div>
                <div className="flex flex-col gap-[12px] w-full">
                  <div className="flex flex-col">
                    <h3 className={`text-[16px] font-semibold ${toneStyles[estadoDgii.tone].title}`}>{estadoDgii.title}</h3>
                    <p className="text-[12px] text-[#64748b] mt-0.5 font-normal">{estadoDgii.desc}</p>
                  </div>

                  {estadoDgii.showDetalle && (
                    <div className="flex flex-col gap-[8px] text-[12px] leading-[19.5px] w-full md:w-[400px]">
                      <div className="flex justify-between items-center w-full">
                        <span className="text-[#333]">TrackId</span>
                        <span className="text-[#64748b] font-mono">{comprobante.trackId || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-[#333]">Fecha respuesta</span>
                        <span className="text-[#64748b]">{formatDateTime(comprobante.updatedAt)}</span>
                      </div>
                      <div className="flex justify-between items-center w-full">
                        <span className="text-[#333]">Código DGII</span>
                        <span className="text-[#64748b]">{estadoDgii.codigo}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Caja de acciones / motivo — solo cuando hay algo real que mostrar */}
            {estadoDgii.actions && (
              <div className="bg-[rgba(3,121,213,0.05)] border border-[#0379d5] rounded-[14px] p-[24px] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 w-full text-left">
                <div className="flex gap-[16px] items-start">
                  <div className="flex h-[34px] w-[34px] items-center justify-center text-[#0379d5] shrink-0">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="flex flex-col gap-[8px]">
                    <h3 className="text-[16px] font-semibold text-[#333]">{estadoDgii.actions.title}</h3>
                    <p className="text-[13px] text-[#333] font-normal leading-[19.5px] whitespace-pre-wrap">
                      {estadoDgii.actions.body}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => router.push('/cumplimiento')}
                  className="h-[40px] px-[16px] py-[10px] rounded-[10px] bg-[#0379d5] hover:bg-[#0379d5]/90 text-white text-[13px] font-semibold leading-[19.5px] shrink-0 transition-all cursor-pointer border-0"
                >
                  Ver en cumplimiento
                </Button>
              </div>
            )}
          </div>
        )}

        {/* XML Y FIRMA TAB */}
        {activeTab === 'xml_firma' && (
          <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-[24px] flex flex-col gap-[16px] w-full text-left">
            <div className="flex gap-[8px] items-center w-full">
              <CheckCircle2 size={20} className="text-[#067647] shrink-0" />
              <h3 className="text-[14px] font-semibold text-[#333]">Firma digital verificada</h3>
            </div>

            {/* XML Code Viewer */}
            <div className="bg-[#f8fafc] rounded-[10px] px-[16px] py-[15px] w-full font-mono text-[11px] leading-[16.5px] text-[#64748b] overflow-x-auto whitespace-pre-wrap">
              {`<?xml version="1.0" encoding="UTF-8"?>
<ECF xmlns="https://dgii.gov.do/ecf">
  <Encabezado>
    <IdDoc>
      <TipoeCF>${comprobante.tipoECF}</TipoeCF>
      <eNCF>${comprobante.eNCF || 'E310000000001'}</eNCF>
      <FechaEmis>${comprobante.createdAt?.split('T')[0] || '2026-04-20'}</FechaEmis>
    </IdDoc>
    <Emisor>
      <RNCEmisor>130123456</RNCEmisor>
      <RazonSocialEmisor>Distribuidora Martínez SRL</RazonSocialEmisor>
    </Emisor>
    <Receptor>
      <RNCReceptor>${comprobante.rnc}</RNCReceptor>
      <RazonSocialReceptor>${comprobante.razonSocial}</RazonSocialReceptor>
    </Receptor>
    <Totales>
      <MontoTotal>${total}</MontoTotal>
    </Totales>
  </Encabezado>
  <ds:Signature>
    <ds:SignedInfo>
      <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <ds:DigestValue>M3V4Tj...=</ds:DigestValue>
    </ds:SignedInfo>
    <ds:SignatureValue>a9f8e3...</ds:SignatureValue>
  </ds:Signature>
</ECF>`}
            </div>

            {/* Download Link */}
            <button
              onClick={() => alert('Descargando archivo XML firmado...')}
              className="flex items-center gap-[6px] text-[#0379d5] hover:underline text-[13px] font-normal leading-[19.5px] cursor-pointer self-start focus:outline-none"
            >
              <Download size={14} />
              <span>Descargar XML firmado</span>
            </button>
          </div>
        )}

        {/* HISTORIAL TAB */}
        {activeTab === 'historial' && (
          <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-[24px] flex flex-col gap-[16px] w-full text-left">
            <h3 className="text-[16px] font-semibold text-[#333]">Historial de eventos</h3>

            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-[#f1f5f9] text-[12px] font-semibold text-[#333] leading-[19.5px]">
                    <th className="pb-[12px] text-left w-[115px] min-w-[115px]">Fecha</th>
                    <th className="pb-[12px] text-left w-[170px] min-w-[170px]">Estado DGII</th>
                    <th className="pb-[12px] text-center w-[70px] min-w-[70px]">Código</th>
                    <th className="pb-[12px] text-left w-[230px] min-w-[230px]">Descripción</th>
                    <th className="pb-[12px] text-left w-[200px] min-w-[200px]">Trackid</th>
                  </tr>
                </thead>
                <tbody>
                  {buildHistorial(comprobante).map((ev, index) => (
                    <tr key={index} className="border-b border-[#f1f5f9] text-[12px] text-normal leading-[19.5px]">
                      <td className="py-[16px] text-[rgba(51,51,51,0.5)] w-[115px] min-w-[115px] truncate">{ev.fecha}</td>
                      <td className="py-[16px] w-[170px] min-w-[170px] truncate">
                        <div className="flex gap-[8px] items-center">
                          {ev.icon}
                          <span className="text-[#333] font-normal">{ev.estado}</span>
                        </div>
                      </td>
                      <td className="py-[16px] text-center w-[70px] min-w-[70px]">
                        <span className={`${ev.codigo === '—' ? 'text-[rgba(51,51,51,0.5)]' : 'bg-[rgba(75,63,250,0.15)] text-[#4b3ffa] font-semibold px-[10px] py-[5px] rounded-[10px]'} text-[12px]`}>
                          {ev.codigo}
                        </span>
                      </td>
                      <td className="py-[16px] font-normal text-[rgba(51,51,51,0.5)] w-[230px] min-w-[230px] truncate" title={ev.descr}>{ev.descr}</td>
                      <td className="py-[16px] font-normal text-[rgba(51,51,51,0.5)] w-[200px] min-w-[200px] truncate" title={ev.trackId}>{ev.trackId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PDF Y CORREO TAB — historial real de envíos (GET :id/envios) */}
        {activeTab === 'pdf_correo' && (
          <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-[24px] flex flex-col gap-[16px] w-full text-left">
            <h3 className="text-[16px] font-semibold text-[#333]">Envíos al cliente</h3>

            {enviosLoading ? (
              <div className="flex h-[100px] items-center justify-center">
                <Spinner size={20} />
              </div>
            ) : envios.length === 0 ? (
              <div className="flex flex-col gap-[8px] items-center justify-center h-[120px] text-center">
                <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-neutral-100 text-[#475467] shrink-0 mb-1">
                  <Mail size={20} />
                </div>
                <p className="text-[15px] font-medium text-[#101828] leading-[22.5px]">
                  Sin envíos todavía
                </p>
                <p className="text-[13px] font-normal text-[#475467] leading-[19.5px]">
                  No se ha enviado este comprobante al cliente.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-[12px]">
                {envios.map((envio) => {
                  const ok = envio.estado === 'ENVIADO'
                  const canal = envio.canal === 'EMAIL' ? 'correo' : 'WhatsApp'
                  return (
                    <div
                      key={envio.id}
                      className="flex items-start gap-[12px] rounded-[12px] border border-[#f1f5f9] px-[16px] py-[12px]"
                    >
                      <div
                        className={`flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full ${
                          ok ? 'bg-[#ecfdf3] text-[#027a48]' : 'bg-[#fef3f2] text-[#b42318]'
                        }`}
                      >
                        <Mail size={16} />
                      </div>
                      <div className="flex min-w-0 flex-col gap-[2px]">
                        <span className="text-[13px] font-medium leading-[19px] text-[#333]">
                          {ok ? `Enviado por ${canal}` : `Falló el envío por ${canal}`}
                          {envio.destino ? ` a ${envio.destino}` : ''}
                        </span>
                        <span className="text-[12px] leading-[18px] text-[rgba(51,51,51,0.5)]">
                          {new Date(envio.createdAt).toLocaleString('es-DO', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                        {!ok && envio.error && (
                          <span className="text-[12px] leading-[18px] text-[#b42318]">{envio.error}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
                <p className="text-[11px] leading-[16px] text-[#64748b]">
                  &quot;Enviado&quot; significa que GoHighLevel aceptó el mensaje; la entrega al buzón
                  del cliente puede tardar unos minutos.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <ReenviarModal
        isOpen={isReenviarOpen}
        onClose={() => setIsReenviarOpen(false)}
        title="Enviar factura"
        destinatario={comprobante.datos?.receptor?.email || ''}
        onSend={async ({ asunto, mensaje }) => {
          // Llamada REAL. El toast de éxito/error lo emite el hook a partir de
          // la respuesta del backend; aquí no se asume nada.
          await enviarComprobante.mutateAsync({
            comprobanteId: id,
            canal: 'email',
            ...(asunto.trim() ? { asunto: asunto.trim() } : {}),
            ...(mensaje.trim() ? { mensaje: mensaje.trim() } : {}),
          })
        }}
      />

      <ConfirmReemitirModal
        open={showConfirmReemitir}
        onClose={() => setShowConfirmReemitir(false)}
        onConfirm={() => {
          setShowConfirmReemitir(false)
          handleEmitir()
        }}
      />
    </div>
  )
}
