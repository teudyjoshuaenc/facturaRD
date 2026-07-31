'use client'

import React from 'react'
import type { JSX } from 'react'
import { Plus, Send, Download, Mail } from 'lucide-react'
import { EditActionButton, RefreshActionButton, ExportActionButton } from '@/components/ui/table-actions'
import { cn } from '@/lib/utils'

interface Props {
  onRefresh: () => void
  isRefreshing: boolean
  onExport: () => void
  onNew: () => void
  isSelectionMode: boolean
  onToggleSelectionMode: () => void
  selectedCount: number
  /** Ya no se usa: el envío de cotizaciones no tiene backend todavía. */
  onBulkSend?: () => void
  onBulkDownload: () => void
  bulkDownloading?: boolean
}

export function CotizacionesHeader({
  onRefresh,
  isRefreshing,
  onExport,
  onNew,
  isSelectionMode,
  onToggleSelectionMode,
  selectedCount,
  onBulkDownload,
  bulkDownloading = false
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
        {/* EDIT/PENCIL BUTTON - visible only in normal mode, slides/collapses left-to-right (origin-left) */}
        <div className={cn(
          "transition-all duration-300 ease-in-out origin-left flex items-center justify-center overflow-hidden h-[52px] -my-1 -mx-0.5",
          isSelectionMode ? "w-0 opacity-0 -translate-x-4 scale-0 -mr-[8px]" : "w-[48px] opacity-100 translate-x-0 scale-100"
        )}>
          <EditActionButton
            onClick={onToggleSelectionMode}
            title="Activar selección"
          />
        </div>

        {/* RELOAD/REFRESH BUTTON - always visible */}
        <RefreshActionButton onClick={onRefresh} isLoading={isRefreshing} />

        {/* SELECTION ACTIONS CONTAINER */}
        <div className={cn(
          "transition-all duration-300 ease-in-out origin-right flex items-center gap-[8px] overflow-hidden h-[52px] -my-1 -mx-0.5 px-0.5",
          isSelectionMode ? "w-[503px] opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 translate-x-4 scale-0 -mr-[8px]"
        )}>
          <ExportActionButton onClick={onExport} disabled={selectedCount === 0} title="Exportar cotizaciones" className="w-[120px] justify-center" />
          {/* Envío de cotizaciones: SIN backend todavía. Deshabilitado en vez de
              simular un envío exitoso que nunca ocurre. */}
          <button
            type="button"
            disabled
            title="Próximamente: el envío de cotizaciones aún no está disponible"
            className="h-[44px] px-[17px] flex items-center justify-center gap-[9px] border border-[#d0d5dd] rounded-[10px] text-[#64748b] opacity-50 cursor-not-allowed transition-all focus:outline-none shrink-0 bg-white w-[110px] font-sans font-normal text-[14px] leading-[21px]"
          >
            <Mail size={14} className="text-[#64748b] shrink-0" />
            <span className="font-normal text-[#64748b] text-[14px] leading-[21px] whitespace-nowrap">
              Reenviar
            </span>
          </button>
          <button
            onClick={onBulkDownload}
            disabled={selectedCount === 0}
            className="h-[44px] px-[17px] flex items-center justify-center gap-[9px] border border-[#d0d5dd] rounded-[10px] hover:bg-neutral-50 text-[#64748b] disabled:opacity-50 transition-all focus:outline-none shrink-0 bg-white w-[135px] font-sans font-normal text-[14px] leading-[21px]"
          >
            <Download size={14} className="text-[#64748b] shrink-0" />
            <span className="font-normal text-[#64748b] text-[14px] leading-[21px] whitespace-nowrap">
              Descargar
            </span>
          </button>
          <button
            onClick={onToggleSelectionMode}
            className="h-[44px] px-[17px] flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-semibold rounded-[10px] transition-all focus:outline-none shrink-0 w-[110px] font-sans text-[14px] border-none"
          >
            Cancelar
          </button>
        </div>

        {/* NUEVA COTIZACIÓN BUTTON - visible only in normal mode, slides/collapses left-to-right (origin-left) */}
        <div className={cn(
          "transition-all duration-300 ease-in-out origin-left flex items-center justify-center overflow-hidden h-[52px] -my-1 -mx-0.5",
          isSelectionMode ? "w-0 opacity-0 -translate-x-4 scale-0" : "w-[164px] opacity-100 translate-x-0 scale-100"
        )}>
          <button
            onClick={onNew}
            className="bg-[#0379d5] hover:bg-[#0262ad] shadow-[0px_1px_1.5px_rgba(0,0,0,0.1),0px_1px_1px_rgba(0,0,0,0.1)] h-11 px-4 rounded-[10px] flex items-center gap-2 transition-all focus:outline-none shrink-0 w-[160px] justify-center"
          >
            <Plus size={16} className="text-white shrink-0" />
            <span className="font-semibold text-[14px] text-white whitespace-nowrap">
              Nueva cotización
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
