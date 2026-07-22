import type { JSX } from 'react'
import { Download, CheckCircle2, XCircle, RefreshCw, AlertTriangle, AlertCircle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  type Comprobante,
  type ComprobanteEstado,
  estadoDgiiBadge,
  formatCurrency,
  formatDate,
} from '@/lib/comprobantes'

interface Props {
  facturas: Comprobante[]
  isLoading: boolean
  downloadingId: string | null
  onDownload: (c: Comprobante) => void
}

/**
 * Mismo criterio que la lista de /facturas: labels y tono salen de
 * `estadoDgiiBadge()`. ERROR ya no se disfraza de "En proceso", y borrador /
 * nota de venta no fingen tener un estado DGII.
 */
function getStatusBadge(estado: ComprobanteEstado): JSX.Element {
  const { label, tono, aplicaDgii, titulo } = estadoDgiiBadge(estado)

  if (!aplicaDgii) {
    return (
      <span className="text-text-secondary opacity-40 select-none font-medium" title={titulo}>
        {label}
      </span>
    )
  }

  const estilos: Record<string, { wrap: string; icon: string }> = {
    success: { wrap: 'border-green-200 bg-green-50/70 text-green-700', icon: 'text-green-600' },
    warning: { wrap: 'border-warning-200 bg-warning-50/70 text-warning-700', icon: 'text-warning-600' },
    danger: { wrap: 'border-red-200 bg-red-50/70 text-red-700', icon: 'text-red-600' },
    proceso: { wrap: 'border-blue-200 bg-blue-50/70 text-blue-700', icon: 'text-blue-600' },
  }
  const estilo = estilos[tono] ?? estilos.proceso!

  const Icono =
    tono === 'success' ? CheckCircle2
    : tono === 'warning' ? AlertTriangle
    : tono === 'danger' ? (estado === 'ERROR' ? AlertCircle : XCircle)
    : RefreshCw

  return (
    <span
      title={titulo}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-ui-xs font-semibold whitespace-nowrap',
        estilo.wrap,
      )}
    >
      <Icono size={12} className={cn(estilo.icon, 'flex-shrink-0', tono === 'proceso' && 'animate-spin')} />
      {label}
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
          <tr className="border-b border-neutral-200 bg-neutral-50/30 text-ui-sm font-semibold text-text-secondary whitespace-nowrap">
            <th className="px-4 py-3 font-semibold">e-NCF</th>
            <th className="px-4 py-3 font-semibold">Fecha</th>
            <th className="px-4 py-3 font-semibold">Cliente</th>
            <th className="px-4 py-3 font-semibold">Monto</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 font-semibold text-center">Descargar</th>
          </tr>
        </thead>
        <tbody>
          {facturas.map((c) => (
            <tr key={c.id} className="border-b border-neutral-200 last:border-0 hover:bg-neutral-50/30 transition-colors whitespace-nowrap">
              <td className="px-4 py-3.5 font-medium text-text-primary">{c.eNCF || '—'}</td>
              <td className="px-4 py-3.5 text-text-secondary">{formatDate(c.createdAt)}</td>
              <td className="px-4 py-3.5 text-text-primary font-medium max-w-[200px] truncate" title={c.razonSocial || ''}>{c.razonSocial || '—'}</td>
              <td className="px-4 py-3.5 text-text-primary font-bold">{formatCurrency(c.montoTotal)}</td>
              <td className="px-4 py-3.5">{getStatusBadge(c.estado)}</td>
              <td className="px-4 py-3.5 text-center">
                {c.estado === 'ACEPTADO' ? (
                  <button
                    type="button"
                    disabled={downloadingId === c.id}
                    onClick={() => onDownload(c)}
                    className="text-text-secondary hover:text-brand-500 disabled:opacity-50 transition-colors focus:outline-none inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-neutral-100/50"
                  >
                    {downloadingId === c.id ? <Spinner size={14} /> : <Download size={16} />}
                  </button>
                ) : (
                  <span className="text-text-secondary opacity-40 select-none font-medium">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
