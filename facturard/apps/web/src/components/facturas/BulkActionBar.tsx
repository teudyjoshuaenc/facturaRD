'use client'

import type { JSX } from 'react'
import { Mail, Download, FileUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BulkAccion {
  key: string
  label: string
  icon: typeof Mail
  onClick: () => void
  /** Motivo por el que no se puede hacer ahora. Si viene, la acción se apaga y se EXPLICA. */
  motivoBloqueo?: string
  destacada?: boolean
}

interface Props {
  seleccionadas: number
  acciones: BulkAccion[]
  onLimpiar: () => void
}

/**
 * Barra de acciones en lote. Aparece SÓLO cuando hay filas seleccionadas, al pie
 * de la tabla y no en el header: las acciones viven junto a las filas sobre las
 * que actúan.
 *
 * Es una lista de acciones, no un conjunto de botones cableados: agregar una
 * acción nueva (descargar, anular, exportar…) es agregar un objeto al array
 * desde la página. Una acción que no se puede ejecutar NO se esconde: se apaga
 * y dice por qué.
 */
export function BulkActionBar({ seleccionadas, acciones, onLimpiar }: Props): JSX.Element | null {
  if (seleccionadas === 0) return null

  // El primer motivo de bloqueo se muestra junto al contador: es la explicación
  // que el usuario necesita sin tener que pasar el mouse por encima de nada.
  const bloqueoVisible = acciones.find((a) => a.destacada && a.motivoBloqueo)?.motivoBloqueo

  return (
    <div className="flex flex-wrap items-center justify-between gap-[12px] border-t border-[#e2e8f0] bg-[#f8fafc] px-[20px] py-[12px]">
      <div className="flex min-w-0 items-baseline gap-[8px] font-sans">
        <span className="text-[13px] font-semibold text-[#333]">
          {seleccionadas} seleccionada{seleccionadas === 1 ? '' : 's'}
        </span>
        {bloqueoVisible && (
          <span className="truncate text-[12px] leading-[18px] text-[#b42318]">· {bloqueoVisible}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-[8px]">
        {acciones.map((accion) => {
          const Icono = accion.icon
          const bloqueada = !!accion.motivoBloqueo
          return (
            <button
              key={accion.key}
              type="button"
              onClick={accion.onClick}
              disabled={bloqueada}
              title={accion.motivoBloqueo}
              className={cn(
                'flex h-[38px] items-center justify-center gap-[8px] rounded-[10px] px-[16px] font-sans text-[13px] transition-all focus:outline-none',
                accion.destacada
                  ? 'bg-[#0379d5] font-semibold text-white hover:bg-[#0262ad]'
                  : 'border border-[#d0d5dd] bg-white text-[#64748b] hover:bg-neutral-50',
                bloqueada && 'cursor-not-allowed opacity-50 hover:bg-inherit',
              )}
            >
              <Icono size={14} className="shrink-0" />
              <span className="whitespace-nowrap">{accion.label}</span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={onLimpiar}
          className="flex h-[38px] items-center justify-center gap-[6px] rounded-[10px] px-[12px] font-sans text-[13px] text-[#64748b] transition-colors hover:bg-neutral-100 focus:outline-none"
        >
          <X size={14} className="shrink-0" />
          <span className="whitespace-nowrap">Limpiar</span>
        </button>
      </div>
    </div>
  )
}

export const ICONOS_BULK = { correo: Mail, descargar: Download, exportar: FileUp }
