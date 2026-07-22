'use client'

import React from 'react'
import type { JSX } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

/**
 * Modal de confirmación de borrado — compartido por toda la app (productos,
 * notas de venta, …). Antes vivía en `components/producto/` y sólo servía para
 * productos; se generalizó para no duplicar diálogos de confirmación.
 */
interface ConfirmDeleteModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  /** Título del modal. Por defecto, el de productos (uso original). */
  title?: string
  /** Nombre del elemento a borrar; se resalta dentro del mensaje. */
  itemName?: string | null
  /** Sustantivo usado cuando no hay `itemName` ("este producto", "esta nota…"). */
  fallbackName?: string
  /** Texto del botón de confirmación. */
  confirmLabel?: string
}

export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  title = 'Eliminar producto',
  itemName,
  fallbackName = 'este producto',
  confirmLabel = 'Eliminar',
}: ConfirmDeleteModalProps): JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle=""
      icon={<Trash2 size={20} className="text-[#d92d20]" />}
      className="max-w-[448px]"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            className="h-10 rounded-[10px] border-[#e2e8f0] text-[#64748b] text-[13px]"
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onConfirm}
            className="h-10 rounded-[10px] bg-[#d92d20] hover:bg-[#b42318] text-white border-0 text-[13px]"
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="py-2 text-left">
        <p className="text-[14px] text-[#64748b] leading-[22px] font-sans">
          Vas a eliminar{' '}
          <span className="font-bold text-[#333]">{itemName || fallbackName}</span>
          . Esta acción no se puede deshacer.
        </p>
      </div>
    </Modal>
  )
}
