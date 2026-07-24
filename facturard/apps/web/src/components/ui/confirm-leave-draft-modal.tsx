'use client'

import type { JSX } from 'react'
import { Save } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Spinner } from '@/components/ui/spinner'

interface Props {
  open: boolean
  /** Sustantivo femenino del documento: "factura" | "cotización" | "nota de venta". */
  documento: string
  saving?: boolean
  /** Seguir editando (cerrar sin salir). */
  onSeguir: () => void
  /** Salir sin guardar. */
  onDescartar: () => void
  /** Guardar como borrador y salir. */
  onGuardar: () => void
}

/**
 * Diálogo al salir de un formulario con datos sin guardar.
 *
 * Dos acciones con color explícito para que no se lean iguales:
 *  - Descartar        → rojo (destructivo: se pierde el trabajo).
 *  - Guardar borrador → azul (acción primaria/segura).
 * "Seguir editando" no existe como botón: la X (y el fondo) ya cierran el modal
 * sin salir, que es exactamente lo mismo.
 */
export function ConfirmLeaveDraftModal({
  open,
  documento,
  saving = false,
  onSeguir,
  onDescartar,
  onGuardar,
}: Props): JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onSeguir}
      title="¿Guardar como borrador?"
      icon={<Save size={20} className="text-[#0379D5]" />}
      className="max-w-[460px]"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          {/* Destructivo — rojo */}
          <button
            type="button"
            onClick={onDescartar}
            className="h-10 px-4 rounded-[10px] border border-[#fecaca] bg-white text-[13px] font-semibold text-[#dc2626] hover:bg-red-50 transition-colors focus:outline-none cursor-pointer"
          >
            Descartar
          </button>
          {/* Primario — azul */}
          <button
            type="button"
            disabled={saving}
            onClick={onGuardar}
            className="h-10 px-4 rounded-[10px] bg-[#0379D5] text-white text-[13px] font-semibold hover:bg-[#0262ad] transition-colors focus:outline-none cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Spinner size={14} className="text-white" /> : <Save size={14} />}
            Guardar borrador
          </button>
        </div>
      }
    >
      <p className="text-[14px] text-[#64748b] leading-[22px] font-sans text-left">
        Tienes datos sin guardar en esta {documento}. Puedes guardarlos como borrador para retomarla
        luego, o descartarlos y salir.
      </p>
    </Modal>
  )
}
