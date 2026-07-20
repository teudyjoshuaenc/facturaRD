'use client'

import type { JSX } from 'react'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrency } from '@/lib/comprobantes'
import { CATEGORIA_LABELS, type CategoriaRow } from '@/hooks/useFinanzas'

interface Props {
  categorias: CategoriaRow[]
  isLoading?: boolean
}

export function CategoriasBreakdown({ categorias, isLoading }: Props): JSX.Element {
  const maxAbs = Math.max(1, ...categorias.map((c) => Math.abs(c.neto)))

  return (
    <Card className="p-5 flex flex-col gap-4 bg-white border border-neutral-200 shadow-sm rounded-xl">
      <div className="flex flex-col text-left">
        <h3 className="text-body-base font-bold text-text-primary">Por categoría</h3>
        <p className="text-ui-xs text-text-secondary font-medium">Movimientos manuales del período</p>
      </div>

      {isLoading ? (
        <div className="flex h-[160px] items-center justify-center">
          <Spinner size={24} />
        </div>
      ) : categorias.length === 0 ? (
        <div className="flex h-[160px] items-center justify-center text-body-sm text-text-secondary">
          Sin movimientos manuales
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {categorias.map((c) => {
            const positivo = c.neto >= 0
            const pct = (Math.abs(c.neto) / maxAbs) * 100
            return (
              <div key={c.categoria} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-ui-sm font-semibold text-text-primary">{CATEGORIA_LABELS[c.categoria]}</span>
                  <span className={`text-ui-sm font-bold ${positivo ? 'text-success-700' : 'text-danger-700'}`}>
                    {positivo ? '+' : '−'}
                    {formatCurrency(Math.abs(c.neto))}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full rounded-full ${positivo ? 'bg-success-500' : 'bg-danger-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
