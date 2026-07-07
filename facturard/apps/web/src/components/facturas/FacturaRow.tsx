import React from 'react'
import type { JSX } from 'react'
import {
  Download,
  Eye,
  Send,
  Ban,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
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
}

function getStatusBadge(estado: string): JSX.Element {
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
}: Props): JSX.Element {
  const itbis = Number(c.montoTotal) * 18 / 118

  // Format RNC nicely: e.g. 130-87456-2
  const formattedRnc = c.rnc
    ? c.rnc.length === 9
      ? c.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
      : c.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')
    : '—'

  return (
    <tr className={`border-b border-[#f1f5f9] last:border-0 hover:bg-[#f8fafc] transition-colors h-[52px] ${
      selected ? 'bg-[rgba(3,121,213,0.05)] hover:bg-[rgba(3,121,213,0.08)]' : 'bg-white'
    }`}>
      <td
        onClick={() => onViewDetail(c.id)}
        className="px-[16px] py-[16px] w-[90px] min-w-[90px] text-left text-[#333] font-semibold text-[12px] align-middle cursor-pointer whitespace-nowrap"
      >
        {c.eNCF || <span className="text-[#64748b]/60 italic font-normal">Borrador</span>}
      </td>
      <td
        onClick={() => onViewDetail(c.id)}
        className="px-[16px] py-[16px] w-[150px] min-w-[150px] text-left align-middle cursor-pointer"
      >
        <div className="w-[150px] truncate text-[#333] font-normal text-[12px]" title={c.razonSocial}>
          {c.razonSocial}
        </div>
      </td>
      <td
        onClick={() => onViewDetail(c.id)}
        className="px-[16px] py-[16px] w-[95px] min-w-[95px] text-left text-[#333] font-semibold text-[12px] align-middle cursor-pointer whitespace-nowrap"
      >
        {formattedRnc}
      </td>
      <td
        onClick={() => onViewDetail(c.id)}
        className="px-[16px] py-[16px] w-[95px] min-w-[95px] text-left text-[#333] font-semibold text-[12px] align-middle cursor-pointer whitespace-nowrap"
      >
        {formatCurrency(c.montoTotal)}
      </td>
      <td
        onClick={() => onViewDetail(c.id)}
        className="px-[16px] py-[16px] w-[85px] min-w-[85px] text-left text-[#64748b] font-normal text-[12px] align-middle cursor-pointer whitespace-nowrap"
      >
        {formatCurrency(itbis)}
      </td>
      <td
        onClick={() => onViewDetail(c.id)}
        className="px-[16px] py-[16px] w-[80px] min-w-[80px] text-left text-[#64748b] font-normal text-[12px] align-middle cursor-pointer whitespace-nowrap"
      >
        {formatDate(c.createdAt)}
      </td>
      <td
        onClick={() => onViewDetail(c.id)}
        className="px-[16px] py-[16px] w-[100px] min-w-[100px] text-left align-middle cursor-pointer whitespace-nowrap"
      >
        {getStatusBadge(c.estado)}
      </td>
      <td className="px-[16px] py-[16px] w-[112px] min-w-[112px] text-left align-middle">
        <div className="flex items-center gap-[4px] w-[112px]">
          <button
            type="button"
            title="Ver detalle"
            onClick={() => onViewDetail(c.id)}
            className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#333] transition-colors focus:outline-none flex-shrink-0"
          >
            <Eye size={16} />
          </button>

          <button
            type="button"
            title="Descargar PDF"
            disabled={downloadingId === c.id}
            onClick={() => onDownload(c)}
            className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#333] disabled:opacity-50 transition-colors focus:outline-none flex-shrink-0"
          >
            {downloadingId === c.id ? <Spinner size={14} /> : <Download size={16} />}
          </button>

          <button
            type="button"
            title="Enviar correo"
            onClick={() => alert('Enviando factura por correo...')}
            className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#333] transition-colors focus:outline-none flex-shrink-0"
          >
            <Send size={16} />
          </button>

          <button
            type="button"
            title="Anular factura"
            onClick={() => alert('Anulando comprobante fiscal...')}
            className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#b42318] hover:bg-red-50 hover:text-red-700 transition-colors focus:outline-none flex-shrink-0"
          >
            <Ban size={16} />
          </button>
        </div>
      </td>
    </tr>
  )
})

export { FacturaRow }
