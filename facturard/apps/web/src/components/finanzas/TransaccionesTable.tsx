'use client'

import type { JSX } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { ColResizer } from '@/components/ui/col-resizer'
import { useResizableColumns, type ResizableColumn } from '@/hooks/useResizableColumns'
import { formatCurrency, formatDate } from '@/lib/comprobantes'
import { ORIGEN_LABELS, CATEGORIA_LABELS, type Transaccion, type TransaccionOrigen } from '@/hooks/useFinanzas'

const ORIGEN_VARIANT: Record<TransaccionOrigen, 'success' | 'danger' | 'info' | 'warning' | 'neutral'> = {
  FACTURA: 'info',
  NOTA_VENTA: 'info',
  NOTA_CREDITO: 'warning',
  COMPRA: 'neutral',
  MOVIMIENTO: 'neutral',
  COBRO: 'success',
  PAGO: 'danger',
}

// Anchos redimensionables (persistidos por el usuario). "detalle" es la ancha.
const COLUMNS: ResizableColumn[] = [
  { key: 'fecha', width: 120, min: 90 },
  { key: 'origen', width: 150, min: 110 },
  { key: 'detalle', width: 520, min: 160 },
  { key: 'monto', width: 150, min: 110 },
  { key: 'acciones', width: 110, min: 90 },
]

interface Props {
  transacciones: Transaccion[]
  isLoading?: boolean
  onEdit: (t: Transaccion) => void
  onDelete: (t: Transaccion) => void
}

export function TransaccionesTable({ transacciones, isLoading, onEdit, onDelete }: Props): JSX.Element {
  const { widths, startResize } = useResizableColumns('finanzas-transacciones', COLUMNS)

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed text-left text-body-sm">
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: widths[c.key] }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/50 text-ui-sm font-semibold text-text-secondary">
              <th className="relative px-4 py-3 font-semibold whitespace-nowrap">
                Fecha
                <ColResizer onStart={(e) => startResize('fecha', e)} />
              </th>
              <th className="relative px-4 py-3 font-semibold whitespace-nowrap">
                Origen
                <ColResizer onStart={(e) => startResize('origen', e)} />
              </th>
              <th className="relative px-4 py-3 font-semibold">
                Detalle
                <ColResizer onStart={(e) => startResize('detalle', e)} />
              </th>
              <th className="relative px-4 py-3 font-semibold text-right whitespace-nowrap">
                Monto
                <ColResizer onStart={(e) => startResize('monto', e)} />
              </th>
              <th className="px-4 py-3 font-semibold text-right pr-6 whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12">
                  <div className="flex items-center justify-center">
                    <Spinner size={26} />
                  </div>
                </td>
              </tr>
            ) : transacciones.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-text-secondary">
                  Sin transacciones en el período
                </td>
              </tr>
            ) : (
              transacciones.map((t) => {
                const ingreso = t.monto >= 0
                const esManual = t.origen === 'MOVIMIENTO'
                const detalle = t.descripcion || (t.categoria ? CATEGORIA_LABELS[t.categoria] : '') || '—'
                return (
                  <tr key={t.id} className="border-b border-neutral-200 last:border-0 hover:bg-neutral-50/30 transition-colors">
                    <td className="px-4 py-3.5 text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis">{formatDate(t.fecha)}</td>
                    <td className="px-4 py-3.5 overflow-hidden">
                      <Badge variant={ORIGEN_VARIANT[t.origen]} className="text-ui-xs whitespace-nowrap">
                        {ORIGEN_LABELS[t.origen]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 overflow-hidden">
                      <div className="flex min-w-0 flex-col">
                        {/* Trunca al ancho de la columna (redimensionable). */}
                        <span className="block truncate text-text-primary font-medium" title={detalle}>
                          {detalle}
                        </span>
                        {t.referencia && (
                          <span className="block truncate text-ui-xs text-text-tertiary font-mono">{t.referencia}</span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-3.5 text-right font-bold whitespace-nowrap overflow-hidden text-ellipsis ${ingreso ? 'text-success-700' : 'text-danger-700'}`}>
                      {ingreso ? '+' : '−'}
                      {formatCurrency(Math.abs(t.monto))}
                    </td>
                    <td className="px-4 py-3.5 text-right pr-6">
                      {esManual ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEdit(t)}
                            title="Editar"
                            aria-label="Editar movimiento"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-100 hover:text-brand-500"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(t)}
                            title="Eliminar"
                            aria-label="Eliminar movimiento"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-danger-50 hover:text-danger-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-ui-xs text-text-tertiary">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
