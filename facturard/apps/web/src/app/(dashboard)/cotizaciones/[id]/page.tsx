'use client'

import React, { use, useState } from 'react'
import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import {
  ChevronLeft,
  Download,
  Send,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ArrowRight,
  Info,
  Clock,
  XCircle
} from 'lucide-react'
import { formatCurrency, downloadCotizacionPdf } from '@/lib/comprobantes'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Modal } from '@/components/ui/modal'
import { toast } from 'sonner'

interface PageProps {
  params: Promise<{ id: string }>
}

interface CotizacionItem {
  id: string
  nombre: string
  descripcion?: string
  cantidad: number
  precioUnitario: number
  tratamientoITBIS: string
  indicadorBienoServicio: string
  unidadMedida?: string
  productoId?: string
}

interface Cotizacion {
  id: string
  folio: string
  estado: 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'CONVERTIDA' | 'VENCIDA'
  tenantId: string
  contactoId?: string
  subtotal: number
  itbis: number
  total: number
  notas?: string
  fechaVigencia?: string
  createdAt: string
  updatedAt: string
  items: CotizacionItem[]
  comprobanteId?: string
}

interface Contacto {
  id: string
  rnc?: string
  razonSocial: string
  nombreComercial?: string
  direccion?: string
  telefono?: string
  email?: string
}

interface Tenant {
  id: string
  rnc: string
  razonSocial: string
  nombreComercial?: string
  direccion?: string
  telefono?: string
  email?: string
}

function formatRnc(rncStr?: string): string {
  if (!rncStr) return '—'
  const clean = rncStr.replace(/\D/g, '')
  if (clean.length === 9) {
    return `${clean.substring(0, 1)}-${clean.substring(1, 3)}-${clean.substring(3, 8)}-${clean.substring(8, 9)}`
  }
  if (clean.length === 11) {
    return `${clean.substring(0, 3)}-${clean.substring(3, 10)}-${clean.substring(10, 11)}`
  }
  return rncStr
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '—'
  const clean = dateStr.includes('T') ? dateStr.split('T')[0]! : dateStr
  const parts = clean.split('-')
  if (parts.length !== 3) return dateStr
  const [year = '2026', month = '01', day = '01'] = parts
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const mIdx = parseInt(month, 10) - 1
  const mName = months[mIdx] ?? 'ene'
  return `${parseInt(day, 10)} ${mName} de ${year}`
}

function formatCurrencyWithSpace(value: string | number): string {
  const formatted = formatCurrency(value)
  if (formatted.startsWith('RD$')) {
    const rest = formatted.substring(3)
    if (!rest.startsWith(' ')) {
      return `RD$ ${rest.trim()}`
    }
  }
  return formatted
}

function formatHighlightText(text: string): React.ReactNode[] | string {
  if (!text) return ''
  const percentRegex = /(\d+%)/g
  const parts = text.split(percentRegex)
  return parts.map((part, i) => {
    if (percentRegex.test(part)) {
      return <span key={i} className="text-[#0379d5] font-semibold">{part}</span>
    }
    return part
  })
}

function EstadoBadge({ estado }: { estado: Cotizacion['estado'] }): JSX.Element {
  switch (estado) {
    case 'APROBADA':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[rgba(6,118,71,0.1)] px-[10px] py-[5px] text-[12px] font-semibold text-[#067647] font-sans">
          <CheckCircle2 size={14} className="text-[#067647] flex-shrink-0" />
          Aprobada
        </span>
      )
    case 'ENVIADA':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[rgba(225,113,0,0.1)] px-[10px] py-[5px] text-[12px] font-semibold text-[#e17100] font-sans">
          <Clock size={14} className="text-[#e17100] flex-shrink-0" />
          Enviada
        </span>
      )
    case 'BORRADOR':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[rgba(100,116,139,0.1)] px-[10px] py-[5px] text-[12px] font-semibold text-[#64748b] font-sans">
          <FileText size={14} className="text-[#64748b] flex-shrink-0" />
          Borrador
        </span>
      )
    case 'CONVERTIDA':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[rgba(3,121,213,0.1)] px-[10px] py-[5px] text-[12px] font-semibold text-[#0379d5] font-sans">
          <CheckCircle2 size={14} className="text-[#0379d5] flex-shrink-0" />
          Facturada
        </span>
      )
    case 'VENCIDA':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[rgba(180,35,24,0.1)] px-[10px] py-[5px] text-[12px] font-semibold text-[#b42318] font-sans">
          <AlertTriangle size={14} className="text-[#b42318] flex-shrink-0" />
          Vencida
        </span>
      )
    case 'RECHAZADA':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[rgba(180,35,24,0.1)] px-[10px] py-[5px] text-[12px] font-semibold text-[#b42318] font-sans">
          <XCircle size={14} className="text-[#b42318] flex-shrink-0" />
          Rechazada
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[rgba(100,116,139,0.1)] px-[10px] py-[5px] text-[12px] font-semibold text-[#64748b] font-sans">
          {estado}
        </span>
      )
  }
}

export default function CotizacionDetailPage({ params }: PageProps): JSX.Element {
  const router = useRouter()
  const resolvedParams = use(params)
  const id = resolvedParams.id

  const queryClient = useQueryClient()
  const [updatingEstado, setUpdatingEstado] = useState(false)
  const [converting, setConverting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [confirmConvertOpen, setConfirmConvertOpen] = useState(false)

  // Fetch Cotizacion details
  const { data: cotizacion, isLoading: isCotizacionLoading, error: cotizacionError, refetch } = useQuery<Cotizacion>({
    queryKey: ['cotizacion-detalle', id],
    queryFn: () => api.get<Cotizacion>(`/cotizaciones/${id}`).then((res) => res.data),
    enabled: !!id,
  })

  // Factura vinculada (para el enlace "Ver factura" cuando ya fue convertida).
  const { data: comprobante } = useQuery<{ id: string; eNCF: string | null } | null>({
    queryKey: ['comprobante-de-cotizacion', cotizacion?.comprobanteId],
    queryFn: () =>
      api.get<{ id: string; eNCF: string | null }>(`/comprobantes/${cotizacion?.comprobanteId}`).then((res) => res.data),
    enabled: !!cotizacion?.comprobanteId,
  })

  // Fetch Contact details (when cotizacion is loaded and has contactoId)
  const { data: contacto, isLoading: isContactoLoading } = useQuery<Contacto>({
    queryKey: ['contacto-detalle', cotizacion?.contactoId],
    queryFn: () => api.get<Contacto>(`/contactos/${cotizacion?.contactoId}`).then((res) => res.data),
    enabled: !!cotizacion?.contactoId,
  })

  // Fetch Tenant (Emisor) details
  const { data: tenant, isLoading: isTenantLoading } = useQuery<Tenant | null>({
    queryKey: ['tenant-info'],
    queryFn: () => api.get<Tenant[]>('/tenants').then((res) => res.data[0] || null),
  })

  const isLoading = isCotizacionLoading || isContactoLoading || isTenantLoading



  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Spinner size={36} />
        <span className="text-[14px] text-[#64748b] font-medium font-sans">Cargando cotización...</span>
      </div>
    )
  }

  if (cotizacionError || !cotizacion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 font-sans text-center">
        <AlertTriangle className="text-[#f59e0b] h-10 w-10" />
        <div>
          <h3 className="text-[18px] font-semibold text-[#333]">Cotización no encontrada</h3>
          <p className="text-[14px] text-[#64748b] mt-1">No pudimos cargar la información de esta cotización.</p>
        </div>
        <Button onClick={() => router.push('/cotizaciones')} variant="secondary">
          Volver a cotizaciones
        </Button>
      </div>
    )
  }

  const items = cotizacion.items || []
  
  // Calculate Totals based on items
  const subtotal = items.reduce((sum, item) => sum + (Number(item.cantidad) * Number(item.precioUnitario)), 0)
  const itbis = items.reduce((sum, item) => {
    const isExempt = item.tratamientoITBIS === 'EXENTO'
    return sum + (isExempt ? 0 : (Number(item.cantidad) * Number(item.precioUnitario) * 0.18))
  }, 0)
  const total = subtotal + itbis

  const puedeConvertir = cotizacion.estado !== 'CONVERTIDA'
  const puedeEnviar = cotizacion.estado === 'BORRADOR'

  // Marca la cotización como ENVIADA (no manda nada al cliente: sólo cambia el estado
  // para llevar registro; el envío real es descargar el PDF y compartirlo manualmente).
  const handleEnviar = async () => {
    setUpdatingEstado(true)
    try {
      await api.patch(`/cotizaciones/${id}/estado`, { estado: 'ENVIADA' })
      await refetch()
      toast.success('Cotización marcada como enviada. Descarga el PDF para compartirla.')
    } catch (err) {
      toast.error(getErrorMessage(err, 'No se pudo actualizar el estado'))
    } finally {
      setUpdatingEstado(false)
    }
  }

  const handleDescargarPdf = async () => {
    setDownloading(true)
    try {
      const clienteNombre = contacto?.razonSocial || contacto?.nombreComercial || 'Consumidor Final'
      await downloadCotizacionPdf(api, cotizacion.id, cotizacion.folio, clienteNombre, cotizacion.createdAt)
    } catch {
      toast.error('No se pudo descargar el PDF de la cotización')
    } finally {
      setDownloading(false)
    }
  }

  const handleConvertir = async () => {
    setConverting(true)
    try {
      await api.post(`/cotizaciones/${id}/convertir`, { emitir: false })
      await refetch()
      await queryClient.invalidateQueries({ queryKey: ['comprobantes'] })
      setConfirmConvertOpen(false)
      toast.success('Cotización convertida en factura (borrador)')
    } catch (err) {
      toast.error(getErrorMessage(err, 'No se pudo convertir la cotización'))
    } finally {
      setConverting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 text-left w-full font-sans select-none">
      
      {/* Header Area */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 w-full pb-4 border-b border-neutral-100">
        
        {/* Title and Badge */}
        <div className="flex gap-4 items-start">
          {/* Back button */}
          <button
            onClick={() => router.push('/cotizaciones')}
            className="bg-white border border-[#d0d5dd] h-[40px] w-[40px] rounded-[10px] flex items-center justify-center hover:bg-neutral-50 transition-colors focus:outline-none shrink-0 cursor-pointer"
            title="Volver a cotizaciones"
          >
            <ChevronLeft size={18} className="text-[#64748b]" />
          </button>

          <div className="flex flex-col items-start">
            <div className="flex gap-3 items-center flex-wrap">
              <h1 className="text-[24px] font-bold text-[#333333] leading-[36px]">
                {cotizacion.folio}
              </h1>
              <EstadoBadge estado={cotizacion.estado} />
            </div>
            <p className="text-[14px] text-[#64748b] leading-[21px] mt-0.5 font-normal">
              {contacto?.razonSocial || contacto?.nombreComercial || 'Cliente ad-hoc'} • {formatCurrencyWithSpace(total)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Descargar PDF (siempre disponible) */}
          <Button
            variant="secondary"
            onClick={handleDescargarPdf}
            disabled={downloading}
            className="h-[40px] px-4 rounded-[8px] border border-[#d0d5dd] bg-white text-[#344054] hover:bg-neutral-50 text-[14px] font-semibold gap-2 flex items-center shadow-sm transition-colors cursor-pointer"
          >
            {downloading ? <Spinner size={16} /> : <Download size={16} className="text-[#475467]" />}
            <span>Descargar PDF</span>
          </Button>

          {/* Editar (no si ya fue facturada) */}
          {cotizacion.estado !== 'CONVERTIDA' && (
            <Button
              variant="secondary"
              onClick={() => router.push(`/cotizaciones/nueva?id=${id}`)}
              disabled={converting || updatingEstado}
              className="h-[40px] px-4 rounded-[8px] border border-[#d0d5dd] bg-white text-[#344054] hover:bg-neutral-50 text-[14px] font-semibold gap-2 flex items-center shadow-sm transition-colors cursor-pointer"
            >
              <Pencil size={16} className="text-[#475467]" />
              <span>Editar</span>
            </Button>
          )}

          {/* Marcar como enviada (solo desde BORRADOR) */}
          {puedeEnviar && (
            <Button
              variant="secondary"
              onClick={handleEnviar}
              disabled={updatingEstado || converting}
              className="h-[40px] px-4 rounded-[8px] border border-[#d0d5dd] bg-white text-[#344054] hover:bg-neutral-50 text-[14px] font-semibold gap-2 flex items-center shadow-sm transition-colors cursor-pointer"
            >
              {updatingEstado ? <Spinner size={16} /> : <Send size={16} className="text-[#475467]" />}
              <span>Marcar enviada</span>
            </Button>
          )}

          {/* Convertir en factura (abre confirmación) */}
          {puedeConvertir && (
            <Button
              variant="primary"
              onClick={() => setConfirmConvertOpen(true)}
              disabled={converting || updatingEstado}
              className="h-[40px] px-4 rounded-[8px] text-[14px] font-semibold gap-2 flex items-center shadow-sm cursor-pointer"
            >
              <FileText size={16} />
              <span>Convertir en factura</span>
            </Button>
          )}
        </div>
      </div>

      {cotizacion.estado === 'CONVERTIDA' && cotizacion.comprobanteId && (
        <div className="flex items-center justify-between gap-2.5 px-4 py-3 rounded-[10px] bg-blue-50/50 border border-[#bfdbfe] text-[#0379d5] text-[13px] font-medium leading-normal w-full">
          <div className="flex items-center gap-2.5">
            <Info size={16} className="text-[#0379d5] shrink-0" />
            <span>Esta cotización ya fue facturada y está vinculada a su comprobante.</span>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/facturas/${cotizacion.comprobanteId}`)}
            className="inline-flex items-center gap-1.5 font-semibold hover:underline shrink-0 cursor-pointer"
          >
            Ver factura{comprobante?.eNCF ? ` ${comprobante.eNCF}` : ''}
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        
        {/* Left Column (Main details, items, conditions, attachments) */}
        <div className="flex-1 min-w-0 flex flex-col gap-6 w-full">
          
          {/* Emisor & Receptor Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            
            {/* Emisor Card */}
            <div className="bg-white border border-[#eaecf0] rounded-[16px] p-6 flex flex-col gap-4 w-full shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
              <h3 className="text-[16px] font-semibold text-[#1d2939]">Emisor</h3>
              <div className="flex flex-col gap-2.5 text-[14px] leading-[19.5px]">
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#667085] font-normal">RNC</span>
                  <span className="text-[#344054] font-medium">{formatRnc(tenant?.rnc)}</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#667085] font-normal">Razón social</span>
                  <span className="text-[#344054] font-medium text-right max-w-[200px] truncate">{tenant?.razonSocial || '—'}</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#667085] font-normal">Dirección</span>
                  <span className="text-[#344054] font-medium text-right max-w-[200px] truncate">{tenant?.direccion || '—'}</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#667085] font-normal">Teléfono</span>
                  <span className="text-[#344054] font-medium">{tenant?.telefono || '—'}</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#667085] font-normal">Correo</span>
                  <span className="text-[#344054] font-medium">{tenant?.email || '—'}</span>
                </div>
              </div>
            </div>

            {/* Receptor Card */}
            <div className="bg-white border border-[#eaecf0] rounded-[16px] p-6 flex flex-col gap-4 w-full shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
              <h3 className="text-[16px] font-semibold text-[#1d2939]">Receptor</h3>
              <div className="flex flex-col gap-2.5 text-[14px] leading-[19.5px]">
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#667085] font-normal">RNC</span>
                  <span className="text-[#344054] font-medium">{formatRnc(contacto?.rnc)}</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#667085] font-normal">Razón social</span>
                  <span className="text-[#344054] font-medium text-right max-w-[200px] truncate">{contacto?.razonSocial || contacto?.nombreComercial || '—'}</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#667085] font-normal">Dirección</span>
                  <span className="text-[#344054] font-medium text-right max-w-[200px] truncate">{contacto?.direccion || '—'}</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#667085] font-normal">Teléfono</span>
                  <span className="text-[#344054] font-medium">{contacto?.telefono || '—'}</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#667085] font-normal">Correo</span>
                  <span className="text-[#344054] font-medium text-right max-w-[200px] truncate">{contacto?.email || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white border border-[#eaecf0] rounded-[16px] p-6 flex flex-col gap-4 w-full shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
            <h3 className="text-[16px] font-semibold text-[#333] leading-[21px]">Ítems</h3>

            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#eaecf0] text-[14px] text-[#64748b] leading-[19.5px] text-left">
                    <th className="pb-[12px] font-normal min-w-[220px]">Descripción</th>
                    <th className="pb-[12px] font-normal text-center w-[80px]">Cant.</th>
                    <th className="pb-[12px] font-normal text-right w-[130px]">Precio unit.</th>
                    <th className="pb-[12px] font-normal text-right w-[110px]">ITBIS</th>
                    <th className="pb-[12px] font-normal text-right w-[130px]">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eaecf0] text-left">
                  {items.map((item, index) => {
                    const itemSubtotal = Number(item.cantidad) * Number(item.precioUnitario)
                    const itemItbis = item.tratamientoITBIS === 'EXENTO' ? 0 : itemSubtotal * 0.18
                    const itemTotal = itemSubtotal + itemItbis
                    return (
                      <tr key={item.id || index} className="text-[14px] text-[#333] leading-[19.5px] border-b border-[#eaecf0] last:border-0">
                        <td className="py-[12px] font-semibold text-[#333] align-middle">{item.nombre}</td>
                        <td className="py-[12px] text-center align-middle text-[#333] font-normal">{Number(item.cantidad)}</td>
                        <td className="py-[12px] text-right align-middle text-[#333] font-normal">{formatCurrencyWithSpace(Number(item.precioUnitario))}</td>
                        <td className="py-[12px] text-right align-middle text-[#333] font-normal">{formatCurrencyWithSpace(itemItbis)}</td>
                        <td className="py-[12px] text-right align-middle text-[#333] font-normal">{formatCurrencyWithSpace(itemTotal)}</td>
                      </tr>
                    )
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-neutral-400">
                        No hay ítems en esta cotización
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="flex flex-col gap-[8px] text-[14px] leading-[19.5px] self-end w-full md:w-[391px] mt-[12px] border-t border-[#e4e7ec] pt-[17px]">
              <div className="flex justify-between items-center w-full">
                <span className="text-[#333] font-normal">Subtotal</span>
                <span className="text-[#64748b] font-normal">{formatCurrencyWithSpace(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center w-full">
                <span className="text-[#333] font-normal">ITBIS (18%)</span>
                <span className="text-[#64748b] font-normal">{formatCurrencyWithSpace(itbis)}</span>
              </div>
              <div className="flex justify-between items-center w-full text-[#333] font-semibold text-[16px] leading-[24px]">
                <span>Total</span>
                <span>{formatCurrencyWithSpace(total)}</span>
              </div>
            </div>
          </div>

          {/* Condiciones comerciales */}
          <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-[24px] flex flex-col gap-[32px] items-start relative w-full shadow-sm">
            <h3 className="text-[18px] font-semibold text-[#0a0a0a] leading-[27px]">Condiciones comerciales</h3>
            
            <div className="flex flex-col gap-[8px] items-start w-full">
              {/* Términos y condiciones */}
              <div className="bg-[#f1f5f9]/40 border border-[#e2e8f0] rounded-[6px] p-[13px] text-left flex flex-col gap-[2px] w-full">
                <span className="text-[12px] font-normal text-[#64748b] leading-[16px]">Términos y condiciones</span>
                <div className="text-[14px] text-[#0f172a] font-semibold leading-[20px]">
                  {formatHighlightText(cotizacion.notas || '50% de anticipo para iniciar el proyecto.')}
                </div>
              </div>
            </div>
          </div>



        </div>

        {/* Right Column: detalles reales (sin historial inventado) */}
        <div className="w-full lg:w-[360px] lg:shrink-0 flex flex-col gap-6">
          <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-[21px] flex flex-col gap-4 w-full shadow-sm">
            <span className="text-[10px] font-semibold text-[#64748b] tracking-[0.44px] uppercase block">
              Detalles
            </span>
            <div className="flex flex-col gap-3 text-[13px]">
              <DetalleFila label="Folio" value={cotizacion.folio} />
              <div className="flex justify-between items-center w-full">
                <span className="text-[#667085]">Estado</span>
                <EstadoBadge estado={cotizacion.estado} />
              </div>
              <DetalleFila label="Creada" value={formatDisplayDate(cotizacion.createdAt)} />
              <DetalleFila label="Última actualización" value={formatDisplayDate(cotizacion.updatedAt)} />
              <DetalleFila
                label="Vigente hasta"
                value={cotizacion.fechaVigencia ? formatDisplayDate(cotizacion.fechaVigencia) : 'Sin fecha'}
              />
              {cotizacion.estado === 'CONVERTIDA' && cotizacion.comprobanteId && (
                <div className="flex justify-between items-center w-full pt-1 border-t border-[#eaecf0]">
                  <span className="text-[#667085]">Factura</span>
                  <button
                    type="button"
                    onClick={() => router.push(`/facturas/${cotizacion.comprobanteId}`)}
                    className="inline-flex items-center gap-1 text-[#0379d5] font-semibold hover:underline cursor-pointer"
                  >
                    {comprobante?.eNCF ?? 'Ver'}
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Confirmación de conversión */}
      <Modal
        open={confirmConvertOpen}
        onClose={() => (converting ? undefined : setConfirmConvertOpen(false))}
        title="¿Convertir esta cotización en factura?"
        subtitle={`${cotizacion.folio} · ${formatCurrencyWithSpace(total)}`}
        icon={<FileText size={20} />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmConvertOpen(false)} disabled={converting}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleConvertir} disabled={converting}>
              {converting ? <Spinner size={16} className="text-white" /> : 'Sí, convertir'}
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-[#475467] leading-relaxed">
          Se creará una factura (comprobante en borrador) con los mismos ítems. La cotización quedará
          marcada como <strong>Facturada</strong> y vinculada a la factura; no podrás editarla después.
        </p>
      </Modal>

    </div>
  )
}

function DetalleFila({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex justify-between items-center w-full gap-2">
      <span className="text-[#667085] shrink-0">{label}</span>
      <span className="text-[#344054] font-medium text-right truncate">{value}</span>
    </div>
  )
}
