'use client'

import type { JSX } from 'react'
import { TrendingUp, TrendingDown, Scale, PiggyBank } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/comprobantes'

interface Props {
  ingresos: number
  egresos: number
  balance: number
  capitalAcumulado: number
  vistaLabel: string
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  title: string
  value: string
  description: string
  icon: React.ComponentType<{ size?: number }>
  iconBg: string
  iconColor: string
}): JSX.Element {
  let fontSizeClass = 'text-[24px]'
  if (value.length > 18) fontSizeClass = 'text-[15px]'
  else if (value.length > 15) fontSizeClass = 'text-[18px]'
  else if (value.length > 12) fontSizeClass = 'text-[20px]'

  return (
    <Card className="bg-white border border-neutral-200 p-5 rounded-[12px] shadow-sm flex flex-col gap-2.5 text-left font-sans">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
          <Icon size={14} />
        </div>
        <span className="text-[12px] font-semibold text-[#475467]">{title}</span>
      </div>
      <div className="flex flex-col gap-1 mt-1">
        <span className={`${fontSizeClass} font-bold text-[#101828] leading-tight truncate`} title={value}>
          {value}
        </span>
        <span className="text-[12px] text-[#475467] font-normal leading-normal">{description}</span>
      </div>
    </Card>
  )
}

export function FinanzasMetrics({ ingresos, egresos, balance, capitalAcumulado, vistaLabel }: Props): JSX.Element {
  const balancePositivo = balance >= 0
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full select-none">
      <MetricCard
        title="Ingresos"
        value={formatCurrency(ingresos)}
        description={`Entradas · ${vistaLabel}`}
        icon={TrendingUp}
        iconBg="bg-[#ecfdf3]"
        iconColor="text-[#027a48]"
      />
      <MetricCard
        title="Egresos"
        value={formatCurrency(egresos)}
        description={`Salidas · ${vistaLabel}`}
        icon={TrendingDown}
        iconBg="bg-[#fef3f2]"
        iconColor="text-[#b42318]"
      />
      <MetricCard
        title="Balance del período"
        value={formatCurrency(balance)}
        description={balancePositivo ? 'Flujo neto positivo' : 'Flujo neto negativo'}
        icon={Scale}
        iconBg={balancePositivo ? 'bg-[#eff8ff]' : 'bg-[#fef3f2]'}
        iconColor={balancePositivo ? 'text-[#175cd3]' : 'text-[#b42318]'}
      />
      <MetricCard
        title="Capital acumulado"
        value={formatCurrency(capitalAcumulado)}
        description="Capital inicial + flujo neto"
        icon={PiggyBank}
        iconBg="bg-[#f9f5ff]"
        iconColor="text-[#6941c6]"
      />
    </div>
  )
}
