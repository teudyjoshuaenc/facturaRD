'use client'

import type { JSX } from 'react'
import { ShieldCheck, Zap, Workflow, Bell, Plus, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  pageTitle: string
  pageSubtitle: string
  certDias: number | null
  dgiiConectado?: boolean
  automatizacionActivos?: number
  notificacionesCount?: number
  onEmitir: () => void
  showEmitir: boolean
}

export function TopBar({
  pageTitle,
  pageSubtitle,
  certDias,
  dgiiConectado = true,
  automatizacionActivos,
  notificacionesCount,
  onEmitir,
  showEmitir,
}: Props): JSX.Element {
  const certOk = certDias !== null && certDias > 30
  const certWarn = certDias !== null && certDias > 0 && certDias <= 30
  const certExp = certDias !== null && certDias <= 0

  return (
    <header className="hidden border-b border-border-subtle bg-white px-6 py-2.5 md:flex md:items-center md:justify-between">
      {/* Title + subtitle inline */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
          <LayoutGrid size={16} className="text-white" />
        </div>
        <h1 className="text-ui-default font-semibold text-text-primary">{pageTitle}</h1>
        {pageSubtitle && (
          <span className="text-body-sm text-text-secondary">{pageSubtitle}</span>
        )}
      </div>

      {/* Status chips + CTA */}
      <div className="flex items-center gap-2">
        {/* DGII status */}
        <div
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-full border px-3',
            dgiiConectado
              ? 'border-success-200 bg-success-50'
              : 'border-danger-200 bg-danger-50',
          )}
        >
          <Zap
            size={14}
            className={dgiiConectado ? 'text-success-500' : 'text-danger-500'}
          />
          <span className="text-ui-sm text-text-primary">DGII</span>
          <span
            className={cn(
              'text-ui-sm',
              dgiiConectado ? 'text-success-600' : 'text-danger-600',
            )}
          >
            {dgiiConectado ? 'Conectado' : 'Desconectado'}
          </span>
        </div>

        {/* Certificate status */}
        {certDias !== null && (
          <div
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-full border px-3',
              certExp
                ? 'border-danger-200 bg-danger-50'
                : certWarn
                  ? 'border-warning-200 bg-warning-50'
                  : 'border-success-200 bg-success-50',
            )}
          >
            {certExp || certWarn ? (
              <ShieldCheck
                size={14}
                className={certExp ? 'text-danger-500' : 'text-warning-500'}
              />
            ) : (
              <ShieldCheck size={14} className="text-success-500" />
            )}
            <span className="text-ui-sm text-text-primary">Certificado</span>
            <span
              className={cn(
                'text-ui-sm',
                certExp
                  ? 'text-danger-600'
                  : certWarn
                    ? 'text-warning-700'
                    : 'text-success-600',
              )}
            >
              {certExp ? 'Vencido' : `${certDias} días`}
            </span>
          </div>
        )}

        {certOk === false && certDias === null && (
          <div className="flex h-8 items-center gap-1.5 rounded-full border border-border-subtle bg-background-canvas px-3">
            <ShieldCheck size={14} className="text-text-secondary" />
            <span className="text-ui-sm text-text-secondary">Sin certificado</span>
          </div>
        )}

        {/* Automatización status */}
        {automatizacionActivos !== undefined && (
          <div className="flex h-8 items-center gap-1.5 rounded-full border border-info-200 bg-info-50 px-3">
            <Workflow size={14} className="text-info-500" />
            <span className="text-ui-sm text-text-primary">Automatización</span>
            <span className="text-ui-sm text-info-600">
              {automatizacionActivos} activos
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-border-subtle" />

        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-100 hover:text-text-primary">
          <Bell size={20} />
          {notificacionesCount !== undefined && notificacionesCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger-500 text-[10px] font-bold text-white ring-2 ring-white">
              {notificacionesCount}
            </span>
          )}
        </button>

        {/* Emitir button */}
        {showEmitir && (
          <Button variant="primary" size="md" onClick={onEmitir}>
            <Plus size={18} strokeWidth={2.5} />
            Emitir Factura
          </Button>
        )}
      </div>
    </header>
  )
}
