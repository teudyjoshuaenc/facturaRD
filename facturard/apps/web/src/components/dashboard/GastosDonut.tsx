'use client'

import type { JSX } from 'react'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrency, formatCurrencyCompact } from '@/lib/comprobantes'

export interface GastoSlice {
  label: string
  value: number
}

interface Props {
  data: GastoSlice[]
  isLoading?: boolean
  periodo: string
}

const PALETTE = ['#ef4444', '#f59e0b', '#8b5cf6', '#0ea5e9', '#10b981', '#ec4899', '#64748b']

const SIZE = 168
const STROKE = 24
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R
const CENTER = SIZE / 2

export function GastosDonut({ data, isLoading, periodo }: Props): JSX.Element {
  const total = data.reduce((s, d) => s + d.value, 0)
  let acc = 0

  return (
    <Card className="p-5 flex flex-col gap-4 bg-white border border-neutral-200 shadow-sm rounded-xl">
      <div className="flex flex-col text-left">
        <h3 className="text-body-base font-bold text-text-primary">En qué gastas</h3>
        <p className="text-ui-xs text-text-secondary font-medium">{periodo}</p>
      </div>

      {isLoading ? (
        <div className="flex h-[180px] items-center justify-center">
          <Spinner size={24} />
        </div>
      ) : total === 0 ? (
        <div className="flex h-[180px] items-center justify-center text-body-sm text-text-secondary">
          Sin gastos este mes
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <circle cx={CENTER} cy={CENTER} r={R} fill="none" stroke="#F1F5F9" strokeWidth={STROKE} />
              {data.map((d, i) => {
                const dash = (d.value / total) * C
                const offset = -acc
                acc += dash
                return (
                  <circle
                    key={d.label}
                    cx={CENTER}
                    cy={CENTER}
                    r={R}
                    fill="none"
                    stroke={PALETTE[i % PALETTE.length]}
                    strokeWidth={STROKE}
                    strokeDasharray={`${dash} ${C - dash}`}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${CENTER} ${CENTER})`}
                  >
                    <title>{`${d.label}: ${formatCurrency(d.value)}`}</title>
                  </circle>
                )
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Total</span>
              <span className="text-body-base font-bold text-text-primary">{formatCurrencyCompact(total)}</span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2">
            {data.map((d, i) => (
              <div key={d.label} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                  <span className="truncate text-ui-sm font-medium text-text-primary">{d.label}</span>
                </span>
                <span className="flex flex-shrink-0 items-center gap-1.5">
                  <span className="text-ui-sm font-semibold text-text-primary">{formatCurrencyCompact(d.value)}</span>
                  <span className="text-ui-xs text-text-tertiary">{Math.round((d.value / total) * 100)}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
