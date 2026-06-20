import React from 'react'
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
  factura: Comprobante
  downloadingId: string | null
  onDownload: (c: Comprobante) => void
  onViewDetail: (id: string) => void
}

const FacturaRow = React.memo(function FacturaRow({
  factura: c,
  downloadingId,
  onDownload,
  onViewDetail,
}: Props): JSX.Element {
  const itbis = Number(c.montoTotal) * 18 / 118

  return (
    <tr className="border-b border-border-subtle last:border-0">
      <td className="px-4 py-3 font-medium text-text-primary">{c.eNCF}</td>
      <td className="px-4 py-3 text-text-secondary">{c.tipoECF}</td>
      <td className="px-4 py-3 text-text-secondary">{formatDate(c.createdAt)}</td>
      <td className="px-4 py-3 text-text-primary">{c.razonSocial}</td>
      <td className="px-4 py-3 text-text-secondary">{c.rnc || '—'}</td>
      <td className="px-4 py-3 text-text-primary">{formatCurrency(c.montoTotal)}</td>
      <td className="px-4 py-3 text-text-secondary">{formatCurrency(itbis)}</td>
      <td className="px-4 py-3">
        <Badge variant={ESTADO_BADGE_VARIANT[c.estado]}>{ESTADO_LABELS[c.estado]}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onViewDetail(c.id)}>
            Ver detalle
          </Button>
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
        </div>
      </td>
    </tr>
  )
})

export { FacturaRow }
