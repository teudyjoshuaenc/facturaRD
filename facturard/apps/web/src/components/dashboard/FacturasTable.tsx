import type { JSX } from 'react'
import { Download, CheckCircle2, XCircle, RefreshCw, AlertTriangle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import {
  type Comprobante,
  formatCurrency,
  formatDate,
} from '@/lib/comprobantes'

interface Props {
  facturas: Comprobante[]
  isLoading: boolean
  downloadingId: string | null
  onDownload: (c: Comprobante) => void
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
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-ui-xs font-semibold text-blue-700">
      <RefreshCw size={12} className="text-blue-600 animate-spin flex-shrink-0" />
      En proceso
    </span>
  )
}

export function FacturasTable({ facturas, isLoading, downloadingId, onDownload }: Props): JSX.Element {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size={28} />
      </div>
    )
  }

  if (facturas.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-body-sm text-text-secondary">
        No hay facturas recientes este mes
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-body-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50/30 text-ui-sm font-semibold text-text-secondary">
            <th className="px-4 py-3 font-semibold">e-NCF</th>
            <th className="px-4 py-3 font-semibold">Fecha</th>
            <th className="px-4 py-3 font-semibold">Cliente</th>
            <th className="px-4 py-3 font-semibold">Monto</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 font-semibold">Descargar</th>
          </tr>
        </thead>
        <tbody>
          {facturas.map((c) => (
            <tr key={c.id} className="border-b border-neutral-200 last:border-0 hover:bg-neutral-50/30 transition-colors">
              <td className="px-4 py-3.5 font-medium text-text-primary">{c.eNCF}</td>
              <td className="px-4 py-3.5 text-text-secondary">{formatDate(c.createdAt)}</td>
              <td className="px-4 py-3.5 text-text-primary font-medium">{c.razonSocial}</td>
              <td className="px-4 py-3.5 text-text-primary font-bold">{formatCurrency(c.montoTotal)}</td>
              <td className="px-4 py-3.5">{getStatusBadge(c.estado)}</td>
              <td className="px-4 py-3.5">
                {c.estado === 'ACEPTADO' && (
                  <button
                    type="button"
                    disabled={downloadingId === c.id}
                    onClick={() => onDownload(c)}
                    className="text-text-secondary hover:text-brand-500 disabled:opacity-50 transition-colors focus:outline-none flex items-center justify-center h-8 w-8 rounded-lg hover:bg-neutral-100/50"
                  >
                    {downloadingId === c.id ? <Spinner size={14} /> : <Download size={16} />}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
