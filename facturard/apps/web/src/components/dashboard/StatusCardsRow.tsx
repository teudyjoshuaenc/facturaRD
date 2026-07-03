'use client'

import React from 'react'
import type { JSX } from 'react'
import { Wifi, ShieldCheck, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Variant colour maps ──────────────────────────────────── */

const bgMap = {
  success: 'bg-success-50',
  warning: 'bg-warning-50',
  danger: 'bg-danger-50',
  info: 'bg-info-50',
} as const

const borderMap = {
  success: 'border-success-200',
  warning: 'border-warning-200',
  danger: 'border-danger-200',
  info: 'border-info-200',
} as const

const iconBgMap = {
  success: 'bg-success-100 text-success-600',
  warning: 'bg-warning-100 text-warning-600',
  danger: 'bg-danger-100 text-danger-600',
  info: 'bg-info-100 text-info-600',
} as const

const dotMap = {
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
} as const

const badgeTextMap = {
  success: 'text-success-700',
  warning: 'text-warning-700',
  danger: 'text-danger-700',
  info: 'text-info-700',
} as const

type Variant = keyof typeof bgMap

/* ── Single Card ──────────────────────────────────────────── */

interface StatusCardProps {
  icon: React.ElementType
  title: string
  statusLabel: string
  subtitle: string
  variant: Variant
}

function StatusCard({ icon: Icon, title, statusLabel, subtitle, variant }: StatusCardProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border px-4 py-3',
        bgMap[variant],
        borderMap[variant],
      )}
    >
      {/* Top row: icon + title + status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconBgMap[variant])}>
            <Icon size={16} />
          </div>
          <span className="text-ui-default font-semibold text-text-primary">{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', dotMap[variant])} />
          <span className={cn('text-ui-sm font-medium', badgeTextMap[variant])}>{statusLabel}</span>
        </div>
      </div>
      {/* Subtitle */}
      <p className="text-ui-sm text-text-secondary">{subtitle}</p>
    </div>
  )
}

/* ── Row of three status cards ───────────────────────────── */

interface StatusCardsRowProps {
  dgiiConectado: boolean
  certDias: number | null
  secuenciasActivas: string[]
}

const StatusCardsRow = React.memo(function StatusCardsRow({
  dgiiConectado,
  certDias,
  secuenciasActivas,
}: StatusCardsRowProps): JSX.Element {
  // Certificate variant
  const certVariant: Variant =
    certDias === null || certDias <= 0
      ? 'danger'
      : certDias <= 30
        ? 'warning'
        : 'success'

  const certLabel =
    certDias === null
      ? 'Sin certificado'
      : certDias <= 0
        ? 'Vencido'
        : certDias <= 30
          ? 'Por vencer'
          : 'Activo'

  const certSubtitle =
    certDias === null
      ? 'No hay certificado configurado'
      : certDias <= 0
        ? 'Certificado vencido — Renovar ahora'
        : certDias <= 30
          ? `Expira en ${certDias} días — Renovar ahora`
          : `Válido por ${certDias} días`

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Conexión DGII */}
      <StatusCard
        icon={Wifi}
        title="Conexión DGII"
        statusLabel={dgiiConectado ? 'Conectado' : 'Desconectado'}
        subtitle={dgiiConectado ? 'Última sincronización hace 2 min' : 'Sin conexión al servidor DGII'}
        variant={dgiiConectado ? 'success' : 'danger'}
      />

      {/* Certificado Digital */}
      <StatusCard
        icon={ShieldCheck}
        title="Certificado Digital"
        statusLabel={certLabel}
        subtitle={certSubtitle}
        variant={certVariant}
      />

      {/* Secuencias e-NCF */}
      <StatusCard
        icon={Hash}
        title="Secuencias e-NCF"
        statusLabel={secuenciasActivas.length > 0 ? 'Activas' : 'Sin secuencias'}
        subtitle={
          secuenciasActivas.length > 0
            ? `${secuenciasActivas.join(', ')} configuradas`
            : 'No hay secuencias configuradas'
        }
        variant={secuenciasActivas.length > 0 ? 'info' : 'danger'}
      />
    </div>
  )
})

export { StatusCardsRow }
