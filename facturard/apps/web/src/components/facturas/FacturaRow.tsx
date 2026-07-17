import React from 'react'
import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import {
  Download,
  Send,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  FileText,
  Pencil,
  Mail,
  Copy,
} from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  type Comprobante,
  formatCurrency,
  formatDate,
} from '@/lib/comprobantes'

interface Props {
  factura: Comprobante
  downloadingId: string | null
  onDownload: (c: Comprobante) => void
  onViewDetail: (id: string) => void
  selected?: boolean
  onReenviar?: (c: Comprobante) => void
  onEmitir?: (c: Comprobante) => void
  isSelectionMode?: boolean
  isSelectedInBulk?: boolean
  onToggleSelectInBulk?: () => void
}

function getStatusBadge(estado: string, cotizacionId?: string | null): JSX.Element {
  if (cotizacionId) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[rgba(3,121,213,0.1)] px-[10px] py-[5px] text-[12px] font-normal text-[#0379d5] font-sans">
        <CheckCircle2 size={14} className="text-[#0379d5] flex-shrink-0" />
        Cotización convertida
      </span>
    )
  }
  if (estado === 'ACEPTADO') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[rgba(6,118,71,0.1)] px-[10px] py-[5px] text-[12px] font-normal text-[#067647] font-sans">
        <CheckCircle2 size={14} className="text-[#067647] flex-shrink-0" />
        Aceptado
      </span>
    )
  }
  if (estado === 'ACEPTADO_CONDICIONAL') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[rgba(225,113,0,0.1)] px-[10px] py-[5px] text-[12px] font-normal text-[#e17100] font-sans">
        <AlertTriangle size={14} className="text-[#e17100] flex-shrink-0" />
        Aceptado c/obs.
      </span>
    )
  }
  if (estado === 'RECHAZADO') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[rgba(180,35,24,0.1)] px-[10px] py-[5px] text-[12px] font-normal text-[#b42318] font-sans">
        <XCircle size={14} className="text-[#b42318] flex-shrink-0" />
        Rechazado
      </span>
    )
  }
  if (estado === 'DRAFT') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[rgba(100,116,139,0.1)] px-[10px] py-[5px] text-[12px] font-semibold text-[#64748b] font-sans">
        <FileText size={14} className="text-[#64748b] flex-shrink-0" />
        Borrador
      </span>
    )
  }
  // En proceso / Pendiente
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#f1f5f9] px-[10px] py-[5px] text-[12px] font-normal text-[#64748b] font-sans">
      <RefreshCw size={14} className="text-[#64748b] animate-spin flex-shrink-0" />
      En proceso
    </span>
  )
}

const FacturaRow = React.memo(function FacturaRow({
  factura: c,
  downloadingId,
  onDownload,
  onViewDetail,
  selected = false,
  onReenviar,
  onEmitir,
  isSelectionMode = false,
  isSelectedInBulk = false,
  onToggleSelectInBulk,
}: Props): JSX.Element {
  const router = useRouter()
  const itbis = Number(c.montoTotal) * 18 / 118

  // Format RNC nicely: e.g. 130-87456-2
  const formattedRnc = c.rnc
    ? c.rnc.length === 9
      ? c.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
      : c.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')
    : '—'

  const handleCellClick = () => {
    if (isSelectionMode) {
      onToggleSelectInBulk?.()
    } else {
      onViewDetail(c.id)
    }
  }

  return (
    <tr className={`border-b border-[#f1f5f9] last:border-0 hover:bg-[#f8fafc] transition-colors h-[52px] ${isSelectedInBulk ? 'bg-[rgba(3,121,213,0.05)] hover:bg-[rgba(3,121,213,0.08)]' : selected ? 'bg-[rgba(3,121,213,0.02)] hover:bg-[rgba(3,121,213,0.04)]' : 'bg-white'
      }`}>
      <td className={cn("p-0 text-center align-middle transition-all duration-300 ease-in-out border-b border-[#f1f5f9]", isSelectionMode ? "w-10" : "w-0")} onClick={(e) => e.stopPropagation()}>
        <div className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-center h-[52px] pl-4 origin-left",
          isSelectionMode ? "w-10 opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 -translate-x-4 scale-0"
        )}>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
            checked={isSelectedInBulk}
            onChange={() => onToggleSelectInBulk?.()}
          />
        </div>
      </td>
      <td
        onClick={handleCellClick}
        className="px-[16px] py-[16px] w-[90px] min-w-[90px] text-left text-[#333] font-semibold text-[12px] align-middle cursor-pointer whitespace-nowrap"
      >
        {c.eNCF || <span className="text-[#64748b]/60 italic font-normal">Borrador</span>}
      </td>
      <td
        onClick={handleCellClick}
        className="px-[16px] py-[16px] w-[120px] min-w-[120px] text-left align-middle cursor-pointer"
      >
        <div className="w-[120px] truncate text-[#333] font-normal text-[12px]" title={c.razonSocial}>
          {c.razonSocial}
        </div>
      </td>
      <td
        onClick={handleCellClick}
        className="px-[16px] py-[16px] w-[70px] min-w-[70px] text-left text-[#333] font-semibold text-[12px] align-middle cursor-pointer whitespace-nowrap"
      >
        {formattedRnc}
      </td>
      <td
        onClick={handleCellClick}
        className="px-[16px] py-[16px] w-[85px] min-w-[85px] text-left text-[#333] font-semibold text-[12px] align-middle cursor-pointer whitespace-nowrap"
      >
        {formatCurrency(c.montoTotal)}
      </td>
      <td
        onClick={handleCellClick}
        className="px-[16px] py-[16px] w-[81px] min-w-[81px] text-left text-[#64748b] font-normal text-[12px] align-middle cursor-pointer whitespace-nowrap"
      >
        {formatCurrency(itbis)}
      </td>
      <td
        onClick={handleCellClick}
        className="px-[16px] py-[16px] w-[80px] min-w-[80px] text-left text-[#64748b] font-normal text-[12px] align-middle cursor-pointer whitespace-nowrap"
      >
        {formatDate(c.createdAt)}
      </td>
      <td
        onClick={handleCellClick}
        className="px-[16px] py-[16px] w-[106px] min-w-[106px] text-left align-middle cursor-pointer whitespace-nowrap"
      >
        {getStatusBadge(c.estado, c.cotizacionId)}
      </td>
      <td className="px-[16px] py-[16px] w-[140px] min-w-[140px] text-right align-middle">
        <div className="flex items-center justify-end gap-[4px] w-full">

          {/* Descargar button */}
          {c.estado !== 'RECHAZADO' && c.estado !== 'ERROR' && (
            <button
              type="button"
              title="Descargar PDF"
              disabled={downloadingId === c.id}
              onClick={() => onDownload(c)}
              className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#333] disabled:opacity-50 transition-colors focus:outline-none flex-shrink-0"
            >
              {downloadingId === c.id ? (
                <Spinner size={14} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0">
                  <path d="M14 10V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.597 14 2 13.403 2 12.6667V10" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 2V10" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4.66666 6.66667L8 10L11.3333 6.66667" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          )}

          {/* Reenviar button (only if not draft/rejected/error) */}
          {c.estado !== 'DRAFT' && c.estado !== 'RECHAZADO' && c.estado !== 'ERROR' && (
            <button
              type="button"
              title="Reenviar correo"
              onClick={() => onReenviar && onReenviar(c)}
              className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#333] transition-colors focus:outline-none flex-shrink-0"
            >
              <Mail size={14} />
            </button>
          )}

          {/* Emitir button (only if draft/rejected/error) */}
          {(c.estado === 'DRAFT' || c.estado === 'RECHAZADO' || c.estado === 'ERROR') && (
            <button
              type="button"
              title="Emitir comprobante"
              onClick={() => onEmitir && onEmitir(c)}
              className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#0379d5] hover:bg-blue-50 transition-colors focus:outline-none flex-shrink-0"
            >
              <Send size={14} />
            </button>
          )}

          {/* Editar button (only if draft/rejected/error) */}
          {(c.estado === 'DRAFT' || c.estado === 'RECHAZADO' || c.estado === 'ERROR') && (
            <button
              type="button"
              title="Editar borrador"
              onClick={() => router.push(`/nueva-factura?id=${c.id}`)}
              className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#333] transition-colors focus:outline-none flex-shrink-0"
            >
              <Pencil size={14} />
            </button>
          )}

          {/* Duplicar/Clonar button (always) */}
          <button
            type="button"
            title="Clonar comprobante"
            onClick={() => router.push(`/nueva-factura?cloneId=${c.id}`)}
            className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#333] transition-colors focus:outline-none flex-shrink-0"
          >
            <Copy size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
})

export { FacturaRow }
