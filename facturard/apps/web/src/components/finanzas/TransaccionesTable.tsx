'use client'

import type { JSX } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
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

interface Props {
  transacciones: Transaccion[]
  isLoading?: boolean
  onEdit: (t: Transaccion) => void
  onDelete: (t: Transaccion) => void
}

export function TransaccionesTable({ transacciones, isLoading, onEdit, onDelete }: Props): JSX.Element {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-body-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/50 text-ui-sm font-semibold text-text-secondary">
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Fecha</th>
              <th className="px-4 py-3 font-semibold">Origen</th>
              <th className="px-4 py-3 font-semibold">Detalle</th>
              <th className="px-4 py-3 font-semibold text-right">Monto</th>
              <th className="px-4 py-3 font-semibold text-right pr-6">Acciones</th>
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
                    <td className="px-4 py-3.5 text-text-secondary whitespace-nowrap">{formatDate(t.fecha)}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant={ORIGEN_VARIANT[t.origen]} className="text-ui-xs">
                        {ORIGEN_LABELS[t.origen]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-text-primary font-medium max-w-[320px] truncate" title={detalle}>
                          {detalle}
                        </span>
                        {t.referencia && (
                          <span className="text-ui-xs text-text-tertiary font-mono">{t.referencia}</span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-3.5 text-right font-bold whitespace-nowrap ${ingreso ? 'text-success-700' : 'text-danger-700'}`}>
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
