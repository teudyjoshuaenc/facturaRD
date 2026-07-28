'use client'

import type { JSX } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
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
    <Card className="h-full rounded-[20px] p-5 sm:p-6 flex flex-col gap-5 bg-white border border-neutral-200 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col text-left gap-1">
          <h3 className="text-body-base font-bold text-text-primary">Ingresos vs. Gastos</h3>
          <p className="text-ui-xs text-text-secondary font-medium">Últimos 6 meses</p>
          <p className="mt-1 text-[28px] font-bold leading-none tracking-tight text-text-primary">{formatCurrencyCompact(totalIng - totalEgr)}</p>
          <span className="text-ui-xs text-text-secondary">Resultado neto del período</span>
        </div>
        <Link
          href="/finanzas"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 px-3.5 py-2 text-ui-xs font-bold text-text-primary transition-colors hover:border-brand-300 hover:text-brand-600"
        >
          Ver reporte <ChevronRight size={13} />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex h-[180px] items-center justify-center">
          <Spinner size={24} />
        </div>
      ) : (
        <>
          <div className="flex flex-1 items-end gap-2">
            {data.map((d, i) => (
              <div key={d.label} className="flex flex-1 flex-col items-center justify-end gap-2 self-stretch">
                <div className="flex h-[150px] w-full items-end justify-center gap-1.5">
                  <div
                    className="animate-grow-y w-3.5 rounded-full bg-success-500 transition-[opacity] hover:opacity-80 sm:w-4"
                    style={{ height: `${(d.ingresos / max) * 100}%`, minHeight: d.ingresos > 0 ? 4 : 0, animationDelay: `${i * 60}ms` }}
                    title={`Ingresos: ${formatCurrency(d.ingresos)}`}
                  />
                  <div
                    className="animate-grow-y w-3.5 rounded-full bg-neutral-300 transition-[opacity] hover:opacity-80 sm:w-4"
                    style={{ height: `${(d.egresos / max) * 100}%`, minHeight: d.egresos > 0 ? 4 : 0, animationDelay: `${i * 60 + 30}ms` }}
                    title={`Gastos: ${formatCurrency(d.egresos)}`}
                  />
                </div>
                <span className="text-[11px] font-medium text-text-secondary">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 border-t border-neutral-100 pt-3">
            <span className="flex items-center gap-1.5 text-ui-xs font-semibold text-text-secondary">
              <span className="h-2.5 w-2.5 rounded-full bg-success-500" /> Ingresos · {formatCurrencyCompact(totalIng)}
            </span>
            <span className="flex items-center gap-1.5 text-ui-xs font-semibold text-text-secondary">
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" /> Gastos · {formatCurrencyCompact(totalEgr)}
            </span>
          </div>
        </>
      )}
    </Card>
  )
}
