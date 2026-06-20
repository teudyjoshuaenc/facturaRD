import type { JSX } from 'react'
import { Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  type Comprobante,
  ESTADO_LABELS,
  ESTADO_BADGE_VARIANT,
  formatCurrency,
  formatDate,
} from '@/lib/comprobantes'

interface Props {
  facturas: Comprobante[]
  isLoading: boolean
  downloadingId: string | null
  onDownload: (c: Comprobante) => void
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
          <tr className="border-b border-border-subtle bg-background-canvas text-ui-sm text-text-secondary">
            <th className="px-4 py-2.5 font-medium">e-NCF</th>
            <th className="px-4 py-2.5 font-medium">Fecha</th>
            <th className="px-4 py-2.5 font-medium">Cliente</th>
            <th className="px-4 py-2.5 font-medium">Monto</th>
            <th className="px-4 py-2.5 font-medium">Estado</th>
            <th className="px-4 py-2.5 font-medium">PDF</th>
          </tr>
        </thead>
        <tbody>
          {facturas.map((c) => (
            <tr key={c.id} className="border-b border-border-subtle last:border-0">
              <td className="px-4 py-3 font-medium text-text-primary">{c.eNCF}</td>
              <td className="px-4 py-3 text-text-secondary">{formatDate(c.createdAt)}</td>
              <td className="px-4 py-3 text-text-primary">{c.razonSocial}</td>
              <td className="px-4 py-3 text-text-primary">{formatCurrency(c.montoTotal)}</td>
              <td className="px-4 py-3">
                <Badge variant={ESTADO_BADGE_VARIANT[c.estado]}>{ESTADO_LABELS[c.estado]}</Badge>
              </td>
              <td className="px-4 py-3">
                {c.estado === 'ACEPTADO' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={downloadingId === c.id}
                    onClick={() => onDownload(c)}
                  >
                    {downloadingId === c.id ? <Spinner size={14} /> : <Download size={14} />}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
