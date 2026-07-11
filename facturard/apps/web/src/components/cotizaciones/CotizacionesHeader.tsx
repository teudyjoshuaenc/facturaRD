'use client'

import React from 'react'
import type { JSX } from 'react'
import { Plus } from 'lucide-react'
import { EditActionButton, RefreshActionButton, ExportActionButton } from '@/components/ui/table-actions'

interface Props {
  onRefresh: () => void
  isRefreshing: boolean
  onExport: () => void
  onNew: () => void
  onEditSelected?: () => void
}

export function CotizacionesHeader({
  onRefresh,
  isRefreshing,
  onExport,
  onNew,
  onEditSelected
}: Props): JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 pb-5 select-none font-sans">
      <div className="flex flex-col gap-1 text-left">
        <h2 className="text-h4 font-bold text-[#101828] text-[24px] leading-tight">Cotizaciones</h2>
        <p className="text-[14px] text-[#64748b] leading-[21px]">
          Crea, guarda, envía y convierte cotizaciones en facturas cuando el cliente apruebe.
        </p>
      </div>
      <div className="flex items-center gap-[8px]">
        <EditActionButton onClick={onEditSelected || (() => alert('Editar cotización'))} />
        <RefreshActionButton onClick={onRefresh} isLoading={isRefreshing} />
        <ExportActionButton onClick={onExport} title="Exportar cotizaciones" />

        <button
          onClick={onNew}
          className="bg-[#0379d5] hover:bg-[#0262ad] shadow-[0px_1px_1.5px_rgba(0,0,0,0.1),0px_1px_1px_rgba(0,0,0,0.1)] h-11 px-4 rounded-[10px] flex items-center gap-2 transition-colors focus:outline-none shrink-0"
        >
          <Plus size={16} className="text-white" />
          <span className="font-semibold text-[14px] text-white">
            Nueva cotización
          </span>
        </button>
      </div>
    </div>
  )
}
