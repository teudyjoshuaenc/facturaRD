'use client'

import type { JSX } from 'react'
import { Plus, FileText, Zap, Search, Bell, Activity, ShieldCheck, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useUI } from '@/lib/context/UIContext'

interface Props {
  pageTitle: string
  pageSubtitle: string
  certDias?: number | null
  dgiiConectado?: boolean
  automatizacionActivos?: number
  notificacionesCount?: number
  onEmitir: () => void
  showEmitir: boolean
}

export function TopBar({
  pageTitle,
  pageSubtitle,
  certDias = 12,
  dgiiConectado = true,
  automatizacionActivos = 4,
  notificacionesCount = 7,
  onEmitir,
  showEmitir,
}: Props): JSX.Element {
  const { facturacionMode, setFacturacionMode, globalSearch, setGlobalSearch } = useUI()

  const isDashboardOrEmitir = pageTitle === 'Dashboard' || pageTitle === 'Emitir Factura'

  return (
    <header className="hidden border-b border-border-subtle bg-white px-6 py-3.5 md:flex md:items-center md:justify-between h-16 shrink-0">
      {/* Left side: title/subtitle OR global search */}
      {isDashboardOrEmitir ? (
        <div className="flex items-baseline gap-2.5 text-left">
          <h1 className="text-body-base font-bold text-text-primary tracking-tight">{pageTitle}</h1>
          {pageSubtitle && (
            <span className="text-ui-sm text-text-secondary font-medium">{pageSubtitle}</span>
          )}
        </div>
      ) : (
        <div className="relative w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Buscar o ejecutar — e-NCF, RNC, acciones... ⌘K"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50/50 pl-9 pr-3 text-ui-sm text-text-primary placeholder:text-text-tertiary focus:border-brand-500 focus:outline-none"
          />
        </div>
      )}

      {/* Right side: standard actions vs mode toggle */}
      <div className="flex items-center gap-3">
        {pageTitle === 'Emitir Factura' ? (
          <div className="flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 shadow-sm h-9 items-center">
            <button
              type="button"
              onClick={() => setFacturacionMode('estandar')}
              className={cn(
                'flex items-center gap-1.5 rounded-md h-8 px-4 text-ui-sm font-semibold transition-all active:scale-[0.97] duration-150',
                facturacionMode === 'estandar'
                  ? 'bg-white text-brand-500 shadow-sm border border-neutral-200/50'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              Estándar
            </button>
            <button
              type="button"
              onClick={() => setFacturacionMode('rapido')}
              className={cn(
                'flex items-center gap-1.5 rounded-md h-8 px-4 text-ui-sm font-semibold transition-all active:scale-[0.97] duration-150',
                facturacionMode === 'rapido'
                  ? 'bg-white text-brand-500 shadow-sm border border-neutral-200/50'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              <Zap size={14} />
              Rapido
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* DGII Status chip */}
            <span className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50/50 px-2.5 py-1 text-ui-xs font-semibold text-green-700">
              <Activity size={13} className="text-green-600" />
              DGII <span className="text-green-600 font-bold">Conectado</span>
            </span>

            {/* Certificado status chip */}
            <span className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50/50 px-2.5 py-1 text-ui-xs font-semibold text-orange-700">
              <ShieldCheck size={13} className="text-orange-600" />
              Certificado <span className="text-orange-600 font-bold">{certDias} días</span>
            </span>

            {/* Automatizacion chip */}
            <span className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/50 px-2.5 py-1 text-ui-xs font-semibold text-blue-700">
              <ToggleRight size={13} className="text-blue-600" />
              Automatización <span className="text-blue-600 font-bold">{automatizacionActivos} activos</span>
            </span>

            {/* Notification Bell */}
            <button
              type="button"
              className="relative p-2 text-text-secondary hover:text-text-primary hover:bg-neutral-50 rounded-lg transition-colors focus:outline-none"
            >
              <Bell size={18} />
              {notificacionesCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger-500 text-[9px] font-bold text-white leading-none">
                  {notificacionesCount}
                </span>
              )}
            </button>

            {/* Emitir Factura CTA button */}
            {showEmitir && (
              <Button variant="primary" size="md" onClick={onEmitir} className="h-9 px-3.5 font-semibold">
                <Plus size={16} className="mr-1" />
                Emitir Factura
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
