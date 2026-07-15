'use client'

import React from 'react'
import type { JSX } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

interface ConfirmReemitirModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmReemitirModal({
  open,
  onClose,
  onConfirm,
}: ConfirmReemitirModalProps): JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="¿Reemitir factura?"
      subtitle=""
      icon={<AlertTriangle size={20} className="text-[#0379D5]" />}
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
            className="h-10 rounded-[10px] bg-[#0379D5] hover:bg-[#0379D5]/90 text-white border-0 text-[13px]"
          >
            Enviar
          </Button>
        </div>
      }
    >
      <div className="py-2 text-left">
        <p className="text-[14px] text-[#64748b] leading-[22px] font-sans">
          ¿Está seguro de que desea volver a emitir esta factura? Al reemitir un comprobante rechazado o con error, se consumirá una nueva secuencia e-NCF en la DGII.
        </p>
      </div>
    </Modal>
  )
}
