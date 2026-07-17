'use client'

import type { JSX } from 'react'
import { Plus, Search, Activity, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useUI } from '@/lib/context/UIContext'

interface Props {
  pageTitle: string
  pageSubtitle: string
  certDias?: number | null
  dgiiConectado?: boolean
  onEmitir: () => void
  showEmitir: boolean
}

export function TopBar({
  pageTitle,
  pageSubtitle,
  certDias = 12,
  dgiiConectado = true,
  onEmitir,
  showEmitir,
}: Props): JSX.Element {
  const { facturacionMode, setFacturacionMode, globalSearch, setGlobalSearch } = useUI()

  const isDashboardOrEmitir = pageTitle === 'Dashboard' || pageTitle === 'Crear factura'
  const isEmitir = pageTitle === 'Crear factura'

  return (
    <header className="hidden border-b border-border-subtle bg-white px-6 py-3.5 md:flex md:items-center md:justify-between h-[68px] shrink-0">
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

      {/* Right side: standard actions */}
      <div className="flex items-center gap-3">
        {/* DGII Status chip */}
        {!isEmitir && (
          dgiiConectado ? (
            <span className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50/50 px-2.5 py-1 text-ui-xs font-semibold text-green-700">
              <Activity size={13} className="text-green-600" />
              DGII <span className="text-green-600 font-bold">Conectado</span>
            </span>
          ) : (
            <span className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1 text-ui-xs font-semibold text-red-700">
              <Activity size={13} className="text-red-600" />
              DGII <span className="text-red-600 font-bold">Desconectado</span>
            </span>
          )
        )}

        {/* Certificado status chip */}
        {!isEmitir && certDias !== null && (
          <span className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50/50 px-2.5 py-1 text-ui-xs font-semibold text-orange-700">
            <ShieldCheck size={13} className="text-orange-600" />
            Certificado <span className="text-orange-600 font-bold">{certDias} días</span>
          </span>
        )}

            {/* Crear factura CTA button */}
            {showEmitir && (
              <Button variant="primary" size="md" onClick={onEmitir} className="h-9 px-3.5 font-semibold">
                <Plus size={16} className="mr-1" />
                Crear factura
              </Button>
            )}
      </div>
    </header>
  )
}
