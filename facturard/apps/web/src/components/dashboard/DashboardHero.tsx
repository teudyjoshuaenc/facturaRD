import type { JSX } from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { formatCurrencyCompact } from '@/lib/comprobantes'
import { cn } from '@/lib/utils'

interface DashboardHeroProps {
  periodoLabel: string
  balance: number
  ingresos: number
  egresos: number
  isLoading?: boolean
}

const RING_SIZE = 104
const RING_STROKE = 10
const RING_R = (RING_SIZE - RING_STROKE) / 2
const RING_C = 2 * Math.PI * RING_R

export function DashboardHero({ periodoLabel, balance, ingresos, egresos, isLoading }: DashboardHeroProps): JSX.Element {
  const positivo = balance >= 0
  const margenPct = ingresos > 0 ? Math.max(0, Math.min(100, (balance / ingresos) * 100)) : 0
  const dash = (margenPct / 100) * RING_C

  return (
    <div className="animate-fade-in-up relative overflow-hidden rounded-[24px] border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-white p-6 sm:p-8 shadow-sm">
      {/* Textura de puntos — llena el fondo sin verse como un bloque vacío */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{ backgroundImage: 'radial-gradient(#0379D5 1px, transparent 1px)', backgroundSize: '18px 18px', maskImage: 'radial-gradient(ellipse 420px 260px at 88% 30%, black, transparent)' }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-brand-500/10 blur-2xl" aria-hidden />

      <div className="relative flex flex-wrap items-center justify-between gap-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-ui-xs font-bold uppercase tracking-wide text-brand-600">Resumen del mes</span>
            <h2 className="text-h4 font-bold text-text-primary">{periodoLabel}</h2>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-ui-xs font-semibold uppercase tracking-wide text-text-secondary">Balance del mes</span>
            <p className="text-[36px] font-bold leading-none tracking-tight text-text-primary sm:text-[42px]">
              {isLoading ? '…' : formatCurrencyCompact(balance)}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1.5 text-ui-sm font-bold text-success-700">
              <ArrowUpRight size={14} /> {isLoading ? '…' : formatCurrencyCompact(ingresos)} ingresos
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-50 px-3 py-1.5 text-ui-sm font-bold text-danger-700">
              <ArrowDownRight size={14} /> {isLoading ? '…' : formatCurrencyCompact(egresos)} gastos
            </span>
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-ui-sm font-bold',
              positivo ? 'bg-brand-100 text-brand-700' : 'bg-warning-100 text-warning-700',
            )}>
              {positivo ? 'Flujo positivo' : 'Flujo negativo'}
            </span>
          </div>
        </div>

        {/* Anillo de margen — decorativo Y con dato real, no un bloque vacío */}
        <div className="animate-scale-in relative hidden shrink-0 flex-col items-center gap-2 rounded-[20px] border border-brand-100 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:flex" style={{ animationDelay: '150ms' }}>
          <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
            <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
              <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} fill="none" stroke="#E6F2FB" strokeWidth={RING_STROKE} />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                fill="none"
                stroke="#0379D5"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${RING_C - dash}`}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                className="transition-[stroke-dasharray] duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[20px] font-bold leading-none text-text-primary">{isLoading ? '…' : `${margenPct.toFixed(0)}%`}</span>
            </div>
          </div>
          <span className="text-ui-xs font-semibold uppercase tracking-wide text-text-secondary">Margen</span>
        </div>
      </div>
    </div>
  )
}
