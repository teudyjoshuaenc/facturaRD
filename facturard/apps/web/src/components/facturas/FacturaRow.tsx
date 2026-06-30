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
}

function getStatusBadge(estado: string): JSX.Element {
  if (estado === 'ACEPTADO') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50/70 px-2.5 py-1 text-ui-xs font-semibold text-green-700">
        <CheckCircle2 size={12} className="text-green-600 flex-shrink-0" />
        Aceptado
      </span>
    )
  }
  if (estado === 'ACEPTADO_CONDICIONAL') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50/70 px-2.5 py-1 text-ui-xs font-semibold text-warning-700">
        <AlertTriangle size={12} className="text-warning-600 flex-shrink-0" />
        Aceptado c/obs.
      </span>
    )
  }
  if (estado === 'RECHAZADO') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50/70 px-2.5 py-1 text-ui-xs font-semibold text-red-700">
        <XCircle size={12} className="text-red-600 flex-shrink-0" />
        Rechazado
      </span>
    )
  }
  // En proceso / Pendiente
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-ui-xs font-semibold text-blue-700">
      <RefreshCw size={12} className="text-blue-600 animate-spin flex-shrink-0" />
      En proceso
    </span>
  )
}

const FacturaRow = React.memo(function FacturaRow({
  factura: c,
  downloadingId,
  onDownload,
  onViewDetail,
}: Props): JSX.Element {
  const itbis = Number(c.montoTotal) * 18 / 118

  // Format RNC nicely: e.g. 130-87456-2
  const formattedRnc = c.rnc
    ? c.rnc.length === 9
      ? c.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
      : c.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')
    : '—'

  return (
    <tr className="border-b border-border-subtle last:border-0 hover:bg-neutral-50/40 transition-colors">
      <td className="px-4 py-3.5 font-medium text-text-primary text-body-sm">{c.eNCF}</td>
      <td className="px-4 py-3.5 text-text-primary text-body-sm font-medium line-clamp-1 max-w-[180px] mt-1.5" title={c.razonSocial}>
        {c.razonSocial}
      </td>
      <td className="px-4 py-3.5 text-text-secondary text-body-sm font-semibold">{formattedRnc}</td>
      <td className="px-4 py-3.5 text-text-primary text-body-sm font-bold">{formatCurrency(c.montoTotal)}</td>
      <td className="px-4 py-3.5 text-text-secondary text-body-sm">{formatCurrency(itbis)}</td>
      <td className="px-4 py-3.5 text-text-secondary text-body-sm">{formatDate(c.createdAt)}</td>
      <td className="px-4 py-3.5">{getStatusBadge(c.estado)}</td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            title="Ver detalle"
            onClick={() => onViewDetail(c.id)}
            className="text-text-secondary hover:text-brand-500 transition-colors focus:outline-none"
          >
            <Eye size={16} />
          </button>
          
          <button
            type="button"
            title="Descargar PDF"
            disabled={downloadingId === c.id}
            onClick={() => onDownload(c)}
            className="text-text-secondary hover:text-brand-500 disabled:opacity-50 transition-colors focus:outline-none"
          >
            {downloadingId === c.id ? <Spinner size={14} /> : <Download size={16} />}
          </button>

          <button
            type="button"
            title="Enviar correo"
            onClick={() => alert('Enviando factura por correo...')}
            className="text-text-secondary hover:text-brand-500 transition-colors focus:outline-none"
          >
            <Send size={16} />
          </button>

          <button
            type="button"
            title="Anular factura"
            onClick={() => alert('Anulando comprobante fiscal...')}
            className="text-red-500 hover:text-red-700 transition-colors focus:outline-none"
          >
            <Ban size={16} />
          </button>
        </div>
      </td>
    </tr>
  )
})

export { FacturaRow }
