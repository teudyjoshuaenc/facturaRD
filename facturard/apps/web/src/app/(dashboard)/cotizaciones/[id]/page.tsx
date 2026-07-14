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
  Pencil,
  Trash2,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  AlertTriangle,
  FileText,
  Upload,
  RefreshCw,
} from 'lucide-react'
import { formatCurrency } from '@/lib/comprobantes'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
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

function CustomFileCheckIcon({ className, size = 16 }: { className?: string; size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g>
        <path
          d="M2.66667 14.6667H12C12.3536 14.6667 12.6928 14.5262 12.9428 14.2761C13.1929 14.0261 13.3333 13.687 13.3333 13.3333V4.66667L10 1.33333H4C3.64638 1.33333 3.30724 1.47381 3.05719 1.72386C2.80714 1.97391 2.66667 2.31304 2.66667 2.66667V5.33333"
          strokeWidth="1.33333"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.33333 1.33333V4C9.33333 4.35362 9.47381 4.69276 9.72386 4.94281C9.97391 5.19286 10.313 5.33333 10.6667 5.33333H13.3333"
          strokeWidth="1.33333"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M2 10L3.33333 11.3333L6 8.66667"
          strokeWidth="1.33333"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

function EstadoBadge({ estado }: { estado: Cotizacion['estado'] }): JSX.Element {
  switch (estado) {
    case 'APROBADA':
      return (
        <span className="inline-flex items-center gap-1.5 bg-[#ecfdf3] text-[#067647] border border-[#d3f9d8] text-[12px] font-semibold px-2.5 py-1 rounded-lg">
          <CheckCircle2 size={13} className="text-[#067647]" />
          Aprobada
        </span>
      )
    case 'ENVIADA':
      return (
        <span className="inline-flex items-center gap-1.5 bg-[#fffbeb] text-[#b45309] border border-[#fde68a] text-[12px] font-semibold px-2.5 py-1 rounded-lg">
          Enviada
        </span>
      )
    case 'BORRADOR':
      return (
        <span className="inline-flex items-center gap-1.5 bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0] text-[12px] font-semibold px-2.5 py-1 rounded-lg">
          Borrador
        </span>
      )
    case 'CONVERTIDA':
      return (
        <span className="inline-flex items-center gap-1.5 bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe] text-[12px] font-semibold px-2.5 py-1 rounded-lg">
          Convertida en factura
        </span>
      )
    case 'VENCIDA':
      return (
        <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 text-[12px] font-semibold px-2.5 py-1 rounded-lg">
          <AlertTriangle size={13} />
          Vencida
        </span>
      )
    case 'RECHAZADA':
      return (
        <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 text-[12px] font-semibold px-2.5 py-1 rounded-lg">
          Rechazada
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1.5 bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0] text-[12px] font-semibold px-2.5 py-1 rounded-lg">
          {estado}
        </span>
      )
  }
}

export default function CotizacionDetailPage({ params }: PageProps): JSX.Element {
  const router = useRouter()
  const resolvedParams = use(params)
  const id = resolvedParams.id

  const [updatingEstado, setUpdatingEstado] = useState(false)
  const [converting, setConverting] = useState(false)

  // Fetch Cotizacion details
  const { data: cotizacion, isLoading: isCotizacionLoading, error: cotizacionError, refetch } = useQuery<Cotizacion>({
    queryKey: ['cotizacion-detalle', id],
    queryFn: () => api.get<Cotizacion>(`/cotizaciones/${id}`).then((res) => res.data),
    enabled: !!id,
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

  const handleEnviar = async () => {
    setUpdatingEstado(true)
    try {
      await api.patch(`/cotizaciones/${id}/estado`, { estado: 'ENVIADA' })
      toast.success('Cotización enviada correctamente')
      refetch()
    } catch (err) {
      toast.error('Error al enviar la cotización', { description: getErrorMessage(err) })
    } finally {
      setUpdatingEstado(false)
    }
  }

  const handleRechazar = async () => {
    if (!confirm('¿Está seguro de que desea rechazar esta cotización?')) return
    setUpdatingEstado(true)
    try {
      await api.patch(`/cotizaciones/${id}/estado`, { estado: 'RECHAZADA' })
      toast.success('Cotización rechazada')
      refetch()
    } catch (err) {
      toast.error('Error al rechazar la cotización', { description: getErrorMessage(err) })
    } finally {
      setUpdatingEstado(false)
    }
  }

  const handleConvertir = async () => {
    setConverting(true)
    try {
      const res = await api.post(`/cotizaciones/${id}/convertir`, { emitir: false })
      toast.success('Cotización convertida a factura en borrador')
      refetch()
      if (res.data?.comprobante?.id) {
        router.push(`/facturas/${res.data.comprobante.id}`)
      }
    } catch (err) {
      toast.error('Error al convertir la cotización', { description: getErrorMessage(err) })
    } finally {
      setConverting(false)
    }
  }

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

  // Dynamic Timeline Events Simulator based on real DB timestamps
  const getTimelineEvents = () => {
    const events = []
    const baseDate = new Date(cotizacion.createdAt)
    const updateDate = new Date(cotizacion.updatedAt)
    
    const pad = (n: number) => n.toString().padStart(2, '0')
    const formatTime = (d: Date) => {
      if (isNaN(d.getTime())) return '—'
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    // 1. Cotización creada (Always present)
    events.push({
      title: 'Cotización creada',
      description: 'Comprobante generado y firmado',
      date: formatTime(baseDate),
      icon: 'file',
      color: 'gray',
    })

    // 2. Enviada al cliente
    if (['ENVIADA', 'APROBADA', 'CONVERTIDA'].includes(cotizacion.estado)) {
      const sentTime = new Date(baseDate.getTime() + 5 * 60 * 1000)
      events.unshift({
        title: 'Enviada al cliente',
        description: 'Comprobante generado y firmado',
        date: formatTime(sentTime),
        icon: 'send',
        color: 'blue',
      })
    }

    // 3. Cliente abrió el enlace
    if (['ENVIADA', 'APROBADA', 'CONVERTIDA'].includes(cotizacion.estado)) {
      const openTime = new Date(baseDate.getTime() + 15 * 60 * 1000)
      events.unshift({
        title: 'Cliente abrió el enlace',
        description: 'Comprobante generado y firmado',
        date: formatTime(openTime),
        icon: 'mail',
        color: 'purple',
      })
    }

    // 4. Cliente aprobó la cotización
    if (['APROBADA', 'CONVERTIDA'].includes(cotizacion.estado)) {
      const approvedTime = updateDate.getTime() > baseDate.getTime() ? updateDate : new Date(baseDate.getTime() + 60 * 60 * 1000)
      events.unshift({
        title: 'Cliente aprobó la cotización',
        description: 'Comprobante generado y firmado',
        date: formatTime(approvedTime),
        icon: 'check',
        color: 'green',
      })
    }

    // 5. Convertida en factura
    if (cotizacion.estado === 'CONVERTIDA') {
      events.unshift({
        title: 'Cotización convertida en factura',
        description: 'Comprobante generado y firmado',
        date: formatTime(updateDate),
        icon: 'check',
        color: 'blue',
      })
    }

    // 6. Rechazada
    if (cotizacion.estado === 'RECHAZADA') {
      events.unshift({
        title: 'Cotización rechazada',
        description: 'Comprobante rechazado por el cliente',
        date: formatTime(updateDate),
        icon: 'x',
        color: 'red',
      })
    }

    return events
  }

  const timelineEvents = getTimelineEvents()

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
          {/* Convert to Invoice */}
          {cotizacion.estado !== 'CONVERTIDA' && (
            <Button
              variant="secondary"
              onClick={handleConvertir}
              disabled={converting || updatingEstado}
              className="h-[40px] px-4 rounded-[8px] border border-[#d0d5dd] bg-white text-[#344054] hover:bg-neutral-50 text-[14px] font-semibold gap-2 flex items-center shadow-sm transition-colors cursor-pointer"
            >
              {converting ? <Spinner size={14} /> : <CustomFileCheckIcon className="text-[#475467]" />}
              <span>Convertir a factura</span>
            </Button>
          )}

          {/* Send */}
          {['BORRADOR', 'ENVIADA'].includes(cotizacion.estado) && (
            <Button
              variant="secondary"
              onClick={handleEnviar}
              disabled={updatingEstado || converting}
              className="h-[40px] px-4 rounded-[8px] border border-[#d0d5dd] bg-white text-[#344054] hover:bg-neutral-50 text-[14px] font-semibold gap-2 flex items-center shadow-sm transition-colors cursor-pointer"
            >
              {updatingEstado ? <Spinner size={14} /> : <Send size={16} className="text-[#475467]" />}
              <span>Enviar</span>
            </Button>
          )}

          {/* Edit */}
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

          {/* Reject/Delete */}
          {cotizacion.estado !== 'CONVERTIDA' && cotizacion.estado !== 'RECHAZADA' && (
            <Button
              variant="secondary"
              onClick={handleRechazar}
              disabled={updatingEstado || converting}
              className="h-[40px] px-4 rounded-[8px] border border-[#d0d5dd] bg-white text-[#b42318] hover:bg-red-50 text-[14px] font-semibold gap-2 flex items-center shadow-sm transition-colors cursor-pointer"
            >
              <Trash2 size={16} className="text-[#b42318]" />
              <span>Eliminar</span>
            </Button>
          )}
        </div>
      </div>

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
                  <span className="text-[#344054] font-medium text-right max-w-[200px] truncate">{tenant?.direccion || 'Av. Winston Churchill #45, Sto. Dgo.'}</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#667085] font-normal">Teléfono</span>
                  <span className="text-[#344054] font-medium">809-555-0101</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#667085] font-normal">Correo</span>
                  <span className="text-[#344054] font-medium">facturacion@martinez.com.do</span>
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
                  <span className="text-[#344054] font-medium text-right max-w-[200px] truncate">{contacto?.direccion || 'Av. Winston Churchill #45, Sto. Dgo.'}</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#667085] font-normal">Teléfono</span>
                  <span className="text-[#344054] font-medium">{contacto?.telefono || '809-555-0202'}</span>
                </div>
                <div className="flex justify-between items-center w-full">
                  <span className="text-[#667085] font-normal">Dirección</span>
                  <span className="text-[#344054] font-medium text-right max-w-[200px] truncate">{contacto?.direccion || 'Av. Winston Churchill #45, Sto. Dgo.'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white border border-[#eaecf0] rounded-[16px] p-6 flex flex-col gap-4 w-full shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
            <h3 className="text-[16px] font-semibold text-[#333] leading-[21px]">Receptor</h3>
            
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

              {/* Nota para el cliente */}
              <div className="bg-[#f1f5f9]/40 border border-[#e2e8f0] rounded-[6px] p-[13px] text-left flex flex-col gap-[2px] w-full">
                <span className="text-[12px] font-normal text-[#64748b] leading-[16px]">Nota para el cliente</span>
                <div className="text-[14px] text-[#0f172a] font-semibold leading-[20px]">
                  {formatHighlightText('Incluye capacitación para 5 usuarios.')}
                </div>
              </div>

              {/* Nota interna */}
              <div className="bg-[#0379d5]/10 border border-[#e2e8f0] rounded-[6px] p-[13px] text-left flex flex-col gap-[2px] w-full">
                <span className="text-[12px] font-normal text-[#0379d5] leading-[16px]">Nota interna</span>
                <div className="text-[14px] text-[#0f172a] font-normal leading-[20px]">
                  Cliente recurrente, prioridad alta.
                </div>
              </div>
            </div>
          </div>

          {/* Archivos adjuntos */}
          <div className="bg-white border border-[#eaecf0] rounded-[16px] p-6 flex flex-col gap-4 w-full shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
            <h3 className="text-[16px] font-semibold text-[#1d2939]">Archivos adjuntos</h3>
            
            <div className="border-2 border-dashed border-neutral-200 rounded-[12px] p-8 flex flex-col items-center justify-center text-center hover:border-neutral-300 transition-colors cursor-pointer bg-[#fafafa]">
              <div className="bg-white border border-[#e2e8f0] rounded-full p-2.5 text-neutral-400 mb-3 shadow-sm">
                <Upload size={20} />
              </div>
              <p className="text-[13px] font-medium text-neutral-600">
                Arrastra documentos, imágenes o PDF, o <span className="text-[#0379d5] hover:underline font-semibold">búscalos en tu equipo</span>
              </p>
              <p className="text-[11px] text-neutral-400 mt-1 font-normal">Hasta 10 MB por archivo</p>
            </div>
          </div>

        </div>

        {/* Right Column (History / Timeline Panel) */}
        <div className="w-full lg:w-[360px] lg:shrink-0 flex flex-col gap-6">
          
          {/* Timeline Card */}
          <div className="bg-white border border-[#e2e8f0] rounded-[14px] p-[21px] flex flex-col gap-[10px] w-full shadow-sm select-none">
            <span className="text-[10px] font-semibold text-[#64748b] tracking-[0.44px] uppercase leading-[16.5px] block">
              HISTORIAL
            </span>
            
            <div className="relative flex items-start w-full mt-1">
              {/* Vertical line connecting events */}
              <div className="absolute left-[15.5px] top-[16px] bottom-[16px] w-px bg-[#e4e7ec]" />

              <div className="flex flex-col gap-[16px] items-start w-full">
                {timelineEvents.map((ev, index) => {
                  let badgeClass = 'bg-[#f1f5f9] text-[#64748b]'
                  let iconEl = <CustomFileCheckIcon className="text-[#64748b]" />

                  if (ev.color === 'green') {
                    badgeClass = 'bg-[#ecfdf5] text-[#12b76a]'
                    iconEl = <Check size={16} className="text-[#12b76a]" />
                  } else if (ev.color === 'blue') {
                    badgeClass = 'bg-[#eff6ff] text-[#2e90fa]'
                    iconEl = <Send size={16} className="text-[#2e90fa]" />
                  } else if (ev.color === 'purple') {
                    badgeClass = 'bg-[#eef2ff] text-[#7f56d9]'
                    iconEl = <Mail size={16} className="text-[#7f56d9]" />
                  } else if (ev.color === 'red') {
                    badgeClass = 'bg-[#fef2f2] text-[#f04438]'
                    iconEl = <XCircle size={16} className="text-[#f04438]" />
                  }

                  return (
                    <div key={index} className="flex gap-[10px] items-start w-full relative z-10">
                      {/* Event Dot Icon */}
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${badgeClass}`}>
                        {iconEl}
                      </div>

                      <div className="flex flex-col gap-px items-start flex-1 min-w-0">
                        <span className="text-[12.5px] font-semibold text-[#333] leading-[17px] break-words w-full">
                          {ev.title}
                        </span>
                        <span className="text-[12px] font-normal text-[#333] leading-[18px] break-words w-full">
                          {ev.description}
                        </span>
                        <div className="flex items-center gap-[4px] mt-[1px] text-[#64748b] leading-[16.5px]">
                          <Clock size={9} className="text-[#64748b] shrink-0" />
                          <span className="text-[11px] font-normal font-sans text-[#64748b]">
                            {ev.date}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}
