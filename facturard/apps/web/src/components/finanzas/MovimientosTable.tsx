'use client'

import type { JSX } from 'react'
import { Pencil, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrency, formatDate } from '@/lib/comprobantes'
import { CATEGORIA_LABELS, type MovimientoFinanciero } from '@/hooks/useFinanzas'

interface Props {
  movimientos: MovimientoFinanciero[]
  isLoading?: boolean
  onEdit: (m: MovimientoFinanciero) => void
  onDelete: (m: MovimientoFinanciero) => void
}

export function MovimientosTable({ movimientos, isLoading, onEdit, onDelete }: Props): JSX.Element {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-body-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/50 text-ui-sm font-semibold text-text-secondary">
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Categoría</th>
              <th className="px-4 py-3 font-semibold">Descripción</th>
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
            ) : movimientos.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-text-secondary">
                  Sin movimientos manuales en el período
                </td>
              </tr>
            ) : (
              movimientos.map((m) => {
                const ingreso = m.tipo === 'INGRESO'
                return (
                  <tr
                    key={m.id}
                    className="border-b border-neutral-200 last:border-0 hover:bg-neutral-50/30 transition-colors"
                  >
                    <td className="px-4 py-3.5 text-text-secondary whitespace-nowrap">{formatDate(m.fecha)}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-text-primary font-medium">
                        {ingreso ? (
                          <ArrowUpRight size={15} className="text-success-600 shrink-0" />
                        ) : (
                          <ArrowDownRight size={15} className="text-danger-600 shrink-0" />
                        )}
                        {CATEGORIA_LABELS[m.categoria]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary max-w-[280px] truncate" title={m.descripcion ?? ''}>
                      {m.descripcion || '—'}
                    </td>
                    <td
                      className={`px-4 py-3.5 text-right font-bold whitespace-nowrap ${ingreso ? 'text-success-700' : 'text-danger-700'}`}
                    >
                      {ingreso ? '+' : '−'}
                      {formatCurrency(Number(m.monto))}
                    </td>
                    <td className="px-4 py-3.5 text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEdit(m)}
                          title="Editar"
                          aria-label="Editar movimiento"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-100 hover:text-brand-500"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(m)}
                          title="Eliminar"
                          aria-label="Eliminar movimiento"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-danger-50 hover:text-danger-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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
