'use client'

import type { JSX } from 'react'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrency, formatCurrencyCompact } from '@/lib/comprobantes'

export interface IngresoGastoMes {
  label: string
  ingresos: number
  egresos: number
}

interface Props {
  data: IngresoGastoMes[]
  isLoading?: boolean
}

export function IngresosGastosChart({ data, isLoading }: Props): JSX.Element {
  const max = Math.max(1, ...data.map((d) => Math.max(d.ingresos, d.egresos)))
  const totalIng = data.reduce((s, d) => s + d.ingresos, 0)
  const totalEgr = data.reduce((s, d) => s + d.egresos, 0)

  return (
    <Card className="p-5 flex flex-col gap-4 bg-white border border-neutral-200 shadow-sm rounded-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col text-left">
          <h3 className="text-body-base font-bold text-text-primary">Ingresos vs Gastos</h3>
          <p className="text-ui-xs text-text-secondary font-medium">Últimos 6 meses</p>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-ui-xs font-semibold text-success-700">{formatCurrencyCompact(totalIng)} in</span>
          <span className="text-ui-xs font-semibold text-danger-700">{formatCurrencyCompact(totalEgr)} out</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[180px] items-center justify-center">
          <Spinner size={24} />
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2">
            {data.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-[150px] w-full items-end justify-center gap-1">
                  <div
                    className="w-3 rounded-t-[3px] bg-success-500 transition-all hover:opacity-80 sm:w-3.5"
                    style={{ height: `${(d.ingresos / max) * 100}%`, minHeight: d.ingresos > 0 ? 3 : 0 }}
                    title={`Ingresos: ${formatCurrency(d.ingresos)}`}
                  />
                  <div
                    className="w-3 rounded-t-[3px] bg-danger-500 transition-all hover:opacity-80 sm:w-3.5"
                    style={{ height: `${(d.egresos / max) * 100}%`, minHeight: d.egresos > 0 ? 3 : 0 }}
                    title={`Gastos: ${formatCurrency(d.egresos)}`}
                  />
                </div>
                <span className="text-[11px] font-medium text-text-secondary">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 border-t border-neutral-100 pt-3">
            <span className="flex items-center gap-1.5 text-ui-xs font-semibold text-text-secondary">
              <span className="h-2.5 w-2.5 rounded-full bg-success-500" /> Ingresos
            </span>
            <span className="flex items-center gap-1.5 text-ui-xs font-semibold text-text-secondary">
              <span className="h-2.5 w-2.5 rounded-full bg-danger-500" /> Gastos
            </span>
          </div>
        </>
      )}
    </Card>
  )
}
