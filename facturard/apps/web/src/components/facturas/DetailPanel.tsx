'use client'

import React, { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  FileText,
  Download,
  Send,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  ExternalLink,
  Pencil,
  Mail,
  Copy,
} from 'lucide-react'
import {
  type Comprobante,
  type ComprobanteEstado,
  TIPO_ECF_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/comprobantes'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

interface DetailPanelProps {
  open: boolean
  onClose: () => void
  comprobante: Comprobante | null | undefined
  loading: boolean
  onDownload: (c: Comprobante) => void
  downloading: boolean
  onReenviar?: (c: Comprobante) => void
  onEmitir?: (c: Comprobante) => void
}

// Convert ISO date (YYYY-MM-DD or full timestamp) to DD/MM/YYYY HH:MM
function formatTimelineDate(value: string | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (isNaN(date.getTime())) return value
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year}  ${hours}:${minutes}`
}

export function DetailPanel({
  open,
  onClose,
  comprobante,
  loading,
  onDownload,
  downloading,
  onReenviar,
  onEmitir,
}: DetailPanelProps): JSX.Element | null {
  const router = useRouter()
  const [shouldRender, setShouldRender] = useState(open)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      const timer = setTimeout(() => setAnimate(true), 10)
      return () => clearTimeout(timer)
    } else {
      setAnimate(false)
      const timer = setTimeout(() => setShouldRender(false), 300)
      return () => clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!shouldRender) return null

  // Format RNC: e.g. 130-87456-2
  const formattedRnc = comprobante?.rnc
    ? comprobante.rnc.length === 9
      ? comprobante.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
      : comprobante.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')
    : '—'

  // Extract items from JSON if available
  const items = comprobante?.datos?.items || []
  const subtotal = items.reduce((sum: number, it: any) => sum + (it.cantidad * it.precioUnitarioItem - (it.descuento || 0)), 0)
  const total = Number(comprobante?.montoTotal || 0)
  const itbis = Math.max(0, total - subtotal)

  // Timeline list generator
  const historyEvents = []
  if (comprobante) {
    // 1. Emitido
    historyEvents.push({
      title: 'Emitido',
      description: 'Comprobante generado y firmado',
      date: formatTimelineDate(comprobante.createdAt),
      status: 'success',
    })

    // 2. Enviado a DGII (if trackId present)
    if (comprobante.trackId) {
      historyEvents.push({
        title: 'Enviado a DGII',
        description: `TrackId: ${comprobante.trackId}`,
        date: formatTimelineDate(comprobante.createdAt),
        status: 'info',
      })
    }

    // 3. Current DGII Response Status
    if (comprobante.estado === 'ACEPTADO' || comprobante.estado === 'ACEPTADO_CONDICIONAL') {
      historyEvents.push({
        title: 'Aceptado',
        description: 'Código 0 — Operación exitosa',
        date: formatTimelineDate(comprobante.updatedAt),
        status: 'success',
      })
    } else if (comprobante.estado === 'RECHAZADO') {
      historyEvents.push({
        title: 'Rechazado',
        description: comprobante.mensajeDGII || 'Código 99 — Rechazado por la DGII',
        date: formatTimelineDate(comprobante.updatedAt),
        status: 'danger',
      })
    } else if (comprobante.estado === 'ERROR') {
      historyEvents.push({
        title: 'Error de Envío',
        description: comprobante.mensajeDGII || 'Excepción técnica en la conexión',
        date: formatTimelineDate(comprobante.updatedAt),
        status: 'danger',
      })
    } else if (comprobante.estado !== 'DRAFT') {
      historyEvents.push({
        title: 'En proceso',
        description: 'Pendiente de respuesta de la DGII',
        date: formatTimelineDate(comprobante.updatedAt),
        status: 'neutral',
      })
    }
  }

  return (
    /* Root: Figma width=360, border=1px → inner=358. Height stretches to match table. */
    <div className="w-[360px] min-w-[360px] bg-white border border-[#e4e7ec] rounded-[14px] flex flex-col overflow-hidden select-none font-sans">

      {/* Header: Figma h=64, px=20, pt=12, pb=13. Close btn 28x28 at right. */}
      <div className="flex items-center justify-between h-[64px] border-b border-[#e4e7ec] px-[20px] bg-white shrink-0">
        {loading || !comprobante ? (
          <div className="h-5 w-28 bg-neutral-100 animate-pulse rounded-md" />
        ) : (
          <div className="flex flex-col items-start">
            <h2 className="text-[14px] font-semibold text-[#333] leading-[21px]">
              {comprobante.eNCF || 'Borrador'}
            </h2>
            <p className="text-[12px] font-normal text-[#64748b] leading-[18px]">
              {TIPO_ECF_LABELS[comprobante.tipoECF] || 'Comprobante'}
            </p>
          </div>
        )}
        {loading || !comprobante ? (
          <button
            onClick={onClose}
            className="flex h-[28px] w-[28px] items-center justify-center rounded-[4px] text-[#64748B] transition-colors hover:bg-neutral-100"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        ) : (
          <div className="flex items-center gap-[4px] shrink-0">
            <button
              type="button"
              title="Clonar comprobante"
              onClick={() => router.push(`/nueva-factura?cloneId=${comprobante.id}`)}
              className="flex h-[28px] w-[28px] items-center justify-center rounded-[4px] text-[#64748B] transition-colors hover:bg-neutral-100"
            >
              <Copy size={15} />
            </button>
            {(comprobante.estado === 'DRAFT' || comprobante.estado === 'RECHAZADO' || comprobante.estado === 'ERROR') && (
              <button
                type="button"
                title="Editar comprobante"
                onClick={() => router.push(`/nueva-factura?id=${comprobante.id}`)}
                className="flex h-[28px] w-[28px] items-center justify-center rounded-[4px] text-[#64748B] transition-colors hover:bg-neutral-100"
              >
                <Pencil size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-[28px] w-[28px] items-center justify-center rounded-[4px] text-[#64748B] transition-colors hover:bg-neutral-100"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Body: Figma h=662, p=20, gap=20 between sections. Scrollable. */}
      <div className="flex-1 overflow-y-auto p-[20px] flex flex-col gap-[20px]">
        {loading || !comprobante ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Spinner size={24} />
            <span className="text-[12px] text-[#64748B] font-medium">Cargando información...</span>
          </div>
        ) : (
          <>
            {/* Status Banner: Figma rounded-10, p=12, gap=4, h≈65.5 */}
            <div
              className={`rounded-[10px] p-[12px] text-left flex flex-col gap-[4px] ${comprobante.estado === 'ACEPTADO' || comprobante.estado === 'ACEPTADO_CONDICIONAL'
                  ? 'bg-[#ecfdf3] text-[#067647]'
                  : comprobante.estado === 'RECHAZADO' || comprobante.estado === 'ERROR'
                    ? 'bg-[#fef3f2] text-[#b42318]'
                    : 'bg-neutral-50 text-[#64748B]'
                }`}
            >
              <div className="flex items-center gap-[8px] h-[19.5px]">
                {comprobante.estado === 'ACEPTADO' || comprobante.estado === 'ACEPTADO_CONDICIONAL' ? (
                  <>
                    <CheckCircle2 size={16} className="text-[#067647] shrink-0" />
                    <span className="text-[13px] font-semibold leading-[19.5px]">Aceptado</span>
                  </>
                ) : comprobante.estado === 'RECHAZADO' || comprobante.estado === 'ERROR' ? (
                  <>
                    <XCircle size={16} className="text-[#b42318] shrink-0" />
                    <span className="text-[13px] font-semibold leading-[19.5px]">Rechazado</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} className="text-neutral-500 shrink-0 animate-spin" />
                    <span className="text-[13px] font-semibold leading-[19.5px]">En proceso</span>
                  </>
                )}
              </div>
              <p className="text-[12px] font-normal leading-[18px]">
                {comprobante.estado === 'ACEPTADO' || comprobante.estado === 'ACEPTADO_CONDICIONAL'
                  ? 'Comprobante aceptado correctamente por DGII.'
                  : comprobante.estado === 'RECHAZADO'
                    ? comprobante.mensajeDGII || 'El comprobante fiscal fue rechazado por la DGII.'
                    : comprobante.estado === 'ERROR'
                      ? comprobante.mensajeDGII || 'Hubo un error de envío en la conexión DGII.'
                      : 'El comprobante se encuentra en cola pendiente de procesamiento.'}
              </p>
            </div>

            {/* Cliente Section: Figma h=55. Label 13px semibold, name 12px, rnc 11px */}
            <div className="flex flex-col items-start text-left">
              <span className="text-[13px] font-semibold text-[#333] leading-[19.5px]">CLIENTE</span>
              <p className="text-[12px] font-normal text-[#333] leading-[18px]">{comprobante.razonSocial}</p>
              <p className="text-[11px] font-normal text-[#64748b] leading-[16.5px]">RNC · {formattedRnc}</p>
            </div>

            {/* Items Section: Figma h=87. Label 10px, card bg-f8fafc rounded-10 p-12 h=62 */}
            {items.length > 0 && (
              <div className="flex flex-col gap-[8px] items-start text-left w-full">
                <span className="text-[10px] font-semibold text-[#64748b] tracking-[0.44px] leading-[16.5px] uppercase">DETALLE</span>
                <div className="flex flex-col gap-2 w-full">
                  {items.map((it: any, index: number) => (
                    <div key={index} className="bg-[#f8fafc] rounded-[10px] p-[12px] flex items-center justify-between w-full">
                      <div className="flex flex-col items-start min-w-0 max-w-[143px]">
                        <span className="text-[13px] font-normal text-[#333] leading-[19.5px] line-clamp-2 break-words">
                          {it.nombreItem}
                        </span>
                        <span className="text-[12px] font-normal text-[#64748b] leading-[18px] whitespace-nowrap">
                          Cant {it.cantidad} · {formatCurrency(it.precioUnitarioItem)}
                        </span>
                      </div>
                      <span className="text-[13px] font-semibold text-[#333] leading-[19.5px] shrink-0 ml-4">
                        {formatCurrency(it.cantidad * it.precioUnitarioItem - (it.descuento || 0))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary: Figma h=47, gap=8 between subtotal/itbis rows */}
            <div className="flex flex-col gap-[8px] text-left w-full">
              <div className="flex justify-between h-[19.5px] items-start text-[13px] font-normal text-[#64748b] leading-[19.5px]">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal || total)}</span>
              </div>
              <div className="flex justify-between h-[19.5px] items-start text-[13px] font-normal text-[#64748b] leading-[19.5px]">
                <span>ITBIS (18%)</span>
                <span>{formatCurrency(itbis || 0)}</span>
              </div>
            </div>

            {/* Divider: Figma Line 2 */}
            <div className="w-full h-0 border-t border-[#e4e7ec]" />

            {/* Total: Figma h=27, text 18px bold */}
            <div className="flex justify-between items-start w-full h-[27px]">
              <span className="text-[18px] font-bold text-[#333] leading-[27px]">Total</span>
              <span className="text-[18px] font-bold text-[#333] leading-[27px]">{formatCurrency(total)}</span>
            </div>

            {/* History Timeline: Figma total h=220.5, label h=16.5, list h=194, gap=10 */}
            <div className="flex flex-col gap-[10px] items-start text-left w-full">
              <span className="text-[10px] font-semibold text-[#64748b] tracking-[0.44px] leading-[16.5px] uppercase">HISTORIAL</span>
              <div className="relative pl-[14px] flex flex-col gap-[16px] w-full">
                {/* Vertical Line */}
                <div className="absolute left-[3px] top-[4px] bottom-[4px] w-px bg-[#e4e7ec]" />

                {historyEvents.map((ev, index) => (
                  <div key={index} className="relative flex flex-col gap-px items-start text-left">
                    {/* Circle: Figma 7x7, bg-blue, border-2 white, at x=-14 y=5 */}
                    <div className="absolute -left-[14px] top-[5px] h-[7px] w-[7px] rounded-full bg-[#0379d5] border-2 border-white" />
                    <span className="text-[12.5px] font-semibold text-[#333] leading-[17px]">{ev.title}</span>
                    <span className="text-[12px] font-normal text-[#333] leading-[18px]">{ev.description}</span>
                    <div className="flex items-center gap-[4px] h-[17px]">
                      <Clock size={9} className="text-[#64748b] w-[9px] h-[9px] shrink-0" />
                      <span className="text-[11px] font-normal text-[#64748b] leading-[16.5px] font-mono">{ev.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer: Figma h=120, px=20, py=16, gap=8 between buttons */}
      {!loading && comprobante && (
        <div className="h-[120px] min-h-[120px] border-t border-[#e4e7ec] px-[20px] py-[16px] flex flex-col gap-[8px] select-none shrink-0">
          {/* "Ver ficha completa": Figma h=40, w=full, rounded-10, bg-blue */}
          <button
            type="button"
            onClick={() => router.push(`/facturas/${comprobante.id}`)}
            className="w-full h-[40px] bg-[#0379d5] hover:bg-[#0379d5]/90 text-white rounded-[10px] flex items-center justify-center text-[13px] font-semibold leading-[19.5px] transition-all"
          >
            Ver ficha completa
          </button>

          {/* Actions: Figma h=40, each ~100.67px, gap=8 */}
          <div className="flex gap-[8px] items-center w-full h-[40px]">
            <button
              type="button"
              disabled={downloading}
              onClick={() => onDownload(comprobante)}
              className="flex-1 min-w-0 h-[40px] border border-[#e2e8f0] rounded-[10px] bg-white text-[#333] hover:bg-neutral-50 flex items-center justify-center gap-[4px] text-[12px] font-normal leading-[19.5px] transition-all disabled:opacity-50"
            >
              {downloading ? <Spinner size={12} /> : <Download size={12} />}
              <span>PDF</span>
            </button>

            {comprobante.estado === 'DRAFT' || comprobante.estado === 'RECHAZADO' || comprobante.estado === 'ERROR' ? (
              <button
                type="button"
                onClick={() => onEmitir && onEmitir(comprobante)}
                className="flex-1 min-w-0 h-[40px] border border-[#e2e8f0] rounded-[10px] bg-white text-[#0379d5] hover:bg-blue-50 flex items-center justify-center gap-[4px] text-[12px] font-semibold leading-[19.5px] transition-all"
              >
                <Send size={12} />
                <span>Emitir</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onReenviar && onReenviar(comprobante)}
                className="flex-1 min-w-0 h-[40px] border border-[#e2e8f0] rounded-[10px] bg-white text-[#333] hover:bg-neutral-50 flex items-center justify-center gap-[4px] text-[12px] font-normal leading-[19.5px] transition-all"
              >
                <Mail size={12} />
                <span>Reenviar</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
