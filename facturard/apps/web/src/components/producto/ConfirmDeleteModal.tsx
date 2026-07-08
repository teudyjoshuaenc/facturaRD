'use client'

import React from 'react'
import type { JSX } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

interface Producto {
  id: string
  nombre: string
  tipo: 'BIEN' | 'SERVICIO'
  codigo: string
  precio: number
  indicadorFacturacion: string
  precioFinal: number
  uso: number
  estado: string
}

interface ConfirmDeleteModalProps {
  open: boolean
  producto: Producto | null
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmDeleteModal({
  open,
  producto,
  onClose,
  onConfirm,
}: ConfirmDeleteModalProps): JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Eliminar producto"
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
            Eliminar
          </Button>
        </div>
      }
    >
      <div className="py-2 text-left">
        <p className="text-[14px] text-[#64748b] leading-[22px] font-sans">
          Vas a eliminar{' '}
          <span className="font-bold text-[#333]">{producto?.nombre || 'este producto'}</span>
          . Esta acción no se puede deshacer.
          {producto && (
            <>
              {' '}Ha sido usado en{' '}
              <span className="font-bold text-[#333]">{producto.uso}</span>{' '}
              facturas.
            </>
          )}
        </p>
      </div>
    </Modal>
  )
}
