'use client'

import React from 'react'
import type { JSX } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

/**
 * `emitir`     → un borrador se envía a la DGII por primera vez.
 * `reintentar` → un e-CF rechazado/con error NO se re-emite (su e-NCF quedó
 *                quemado): se crea una factura NUEVA con los mismos datos.
 */
type ModoConfirm = 'emitir' | 'reintentar'

interface ConfirmReemitirModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  mode?: ModoConfirm
}

const COPY: Record<ModoConfirm, { title: string; body: string; cta: string }> = {
  emitir: {
    title: '¿Emitir factura?',
    body: 'Se enviará a la DGII y se consumirá un e-NCF de tu secuencia. Esta acción no se puede deshacer.',
    cta: 'Emitir',
  },
  reintentar: {
    title: '¿Reintentar factura?',
    body: 'Este comprobante quedó rechazado o con error y su e-NCF no se puede reutilizar. Al reintentar se crea una factura NUEVA con los mismos datos, que consumirá un e-NCF nuevo. La original queda como está.',
    cta: 'Reintentar',
  },
}

export function ConfirmReemitirModal({
  open,
  onClose,
  onConfirm,
  mode = 'reintentar',
}: ConfirmReemitirModalProps): JSX.Element {
  const copy = COPY[mode]
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={copy.title}
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
            {copy.cta}
          </Button>
        </div>
      }
    >
      <div className="py-2 text-left">
        <p className="text-[14px] text-[#64748b] leading-[22px] font-sans">
          {copy.body}
        </p>
      </div>
    </Modal>
  )
}
