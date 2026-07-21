'use client'

import type { JSX } from 'react'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrency } from '@/lib/comprobantes'
import type { FlujoPunto } from '@/hooks/useFinanzas'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// "2026-07" → "Jul" · "2026-W30" → "S30"
function periodoLabel(p: string): string {
  const semana = p.match(/^\d{4}-W(\d{2})$/)
  if (semana) return `S${Number(semana[1])}`
  const mes = p.match(/^\d{4}-(\d{2})$/)
  if (mes) return MESES[Number(mes[1]) - 1] ?? p
  return p
}

interface Props {
  serie: FlujoPunto[]
  isLoading?: boolean
  vistaLabel: string
}

export function FlujoChart({ serie, isLoading, vistaLabel }: Props): JSX.Element {
  const max = Math.max(1, ...serie.map((p) => Math.max(p.ingresos, p.egresos)))
  const minWidth = Math.max(560, serie.length * 56)

  return (
    <Card className="p-5 flex flex-col gap-4 bg-white border border-neutral-200 shadow-sm rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col text-left">
          <h3 className="text-body-base font-bold text-text-primary">Flujo de caja</h3>
          <p className="text-ui-xs text-text-secondary font-medium">Ingresos vs egresos · {vistaLabel}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-ui-xs font-semibold text-text-secondary">
            <span className="h-2.5 w-2.5 rounded-full bg-success-500" /> Ingresos
          </span>
          <span className="flex items-center gap-1.5 text-ui-xs font-semibold text-text-secondary">
            <span className="h-2.5 w-2.5 rounded-full bg-danger-500" /> Egresos
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[220px] items-center justify-center">
          <Spinner size={26} />
        </div>
      ) : serie.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-body-sm text-text-secondary">
          Sin movimientos en el período
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex items-end gap-3 pt-2" style={{ minWidth }}>
            {serie.map((p) => {
              const iPct = (p.ingresos / max) * 100
              const ePct = (Math.max(p.egresos, 0) / max) * 100
              return (
                <div key={p.periodo} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-[180px] w-full items-end justify-center gap-1.5">
                    <div
                      className="w-4 rounded-t-[3px] bg-success-500 transition-all hover:opacity-80 sm:w-5"
                      style={{ height: `${iPct}%`, minHeight: p.ingresos > 0 ? 3 : 0 }}
                      title={`Ingresos: ${formatCurrency(p.ingresos)}`}
                    />
                    <div
                      className="w-4 rounded-t-[3px] bg-danger-500 transition-all hover:opacity-80 sm:w-5"
                      style={{ height: `${ePct}%`, minHeight: p.egresos > 0 ? 3 : 0 }}
                      title={`Egresos: ${formatCurrency(p.egresos)}`}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-text-secondary">{periodoLabel(p.periodo)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
