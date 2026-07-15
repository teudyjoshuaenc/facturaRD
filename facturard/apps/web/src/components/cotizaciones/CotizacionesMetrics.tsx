'use client'

import React from 'react'
import type { JSX } from 'react'
import { TrendingUp, Clock, CheckCircle2, FileText, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/comprobantes'

interface Metrics {
  totalAmount: number
  totalCount: number
  pendientes: number
  aprobadas: number
  convertidas: number
  vencidas: number
}

interface Props {
  metrics: Metrics
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  iconBg,
  iconColor
}: {
  title: string
  value: string | number
  description: string
  icon: any
  iconBg: string
  iconColor: string
}): JSX.Element {
  const valStr = String(value)
  let fontSizeClass = 'text-[24px]'
  if (valStr.length > 18) {
    fontSizeClass = 'text-[15px]'
  } else if (valStr.length > 15) {
    fontSizeClass = 'text-[18px]'
  } else if (valStr.length > 12) {
    fontSizeClass = 'text-[20px]'
  }

  return (
    <Card className="bg-white border border-neutral-200 p-5 rounded-[12px] shadow-sm flex flex-col gap-2.5 text-left font-sans">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
          <Icon size={14} />
        </div>
        <span className="text-[12px] font-semibold text-[#475467]">{title}</span>
      </div>
      <div className="flex flex-col gap-1 mt-1">
        <span className={`${fontSizeClass} font-bold text-[#101828] leading-tight truncate`} title={valStr}>{value}</span>
        <span className="text-[12px] text-[#475467] font-normal leading-normal">{description}</span>
      </div>
    </Card>
  )
}

export function CotizacionesMetrics({ metrics }: Props): JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full select-none">
      <MetricCard
        title="Total cotizado"
        value={formatCurrency(metrics.totalAmount)}
        description={`${metrics.totalCount} cotizaciones`}
        icon={TrendingUp}
        iconBg="bg-[#eff8ff]"
        iconColor="text-[#175cd3]"
      />
      <MetricCard
        title="Pendientes"
        value={String(metrics.pendientes)}
        description="En espera de respuesta"
        icon={Clock}
        iconBg="bg-[#fef6ee]"
        iconColor="text-[#b93815]"
      />
      <MetricCard
        title="Aprobadas"
        value={String(metrics.aprobadas)}
        description="Listas para facturar"
        icon={CheckCircle2}
        iconBg="bg-[#ecfdf3]"
        iconColor="text-[#027a48]"
      />
      <MetricCard
        title="Convertidas"
        value={String(metrics.convertidas)}
        description="Ya facturadas"
        icon={FileText}
        iconBg="bg-[#f9f5ff]"
        iconColor="text-[#6941c6]"
      />
      <MetricCard
        title="Vencidas"
        value={String(metrics.vencidas)}
        description="Requieren seguimiento"
        icon={AlertTriangle}
        iconBg="bg-[#fef3f2]"
        iconColor="text-[#b42318]"
      />
    </div>
  )
}
