'use client'

import React, { useMemo } from 'react'
import Image from 'next/image'
import type { JSX } from 'react'
import { Wrench, Package, Edit2, Copy, Trash2, X } from 'lucide-react'
import { formatCurrency } from '@/lib/comprobantes'

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

interface ProductDetailPanelProps {
  producto: Producto | null
  onClose: () => void
  onEditar: (producto: Producto) => void
  onDuplicar: (producto: Producto) => void
  onEliminar: (producto: Producto) => void
  onToggleEstado: (producto: Producto) => void
}

const ITBIS_RATES: Record<string, number> = {
  I1: 0.18,
  I2: 0.16,
  I3: 0,
  I4: 0,
  E: 0,
  EXENTO: 0,
}

const ITBIS_LABELS: Record<string, string> = {
  I1: '18%',
  I2: '16%',
  I3: '0%',
  I4: 'Exento',
  E: 'Exento',
  EXENTO: 'Exento',
}

export function ProductDetailPanel({
  producto,
  onClose,
  onEditar,
  onDuplicar,
  onEliminar,
  onToggleEstado,
}: ProductDetailPanelProps): JSX.Element | null {
  if (!producto) return null

  const isService = producto.tipo === 'SERVICIO'
  const ProductIcon = isService ? Wrench : Package

  const rate = ITBIS_RATES[producto.indicadorFacturacion] ?? 0.18
  const itbisLabel = ITBIS_LABELS[producto.indicadorFacturacion] ?? '18%'

  const subtotal = producto.precio
  const itbisAmount = subtotal * rate
  const total = subtotal + itbisAmount

  return (
    <div
      className="w-[400px] bg-white border border-[#e4e7ec] rounded-[16px] shadow-sm flex flex-col justify-between shrink-0 transform transition-transform duration-300 ease-in-out self-start sticky top-[24px]"
    >
      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Header Section */}
        <div className="border-b border-[#e4e7ec] pb-4 pt-3.5 px-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            {/* Avatar & Info */}
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0 w-9 h-9">
                <div className={`absolute inset-0 rounded-[10px] flex items-center justify-center ${isService ? 'bg-[#f5f3ff] text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                  <ProductIcon size={18} />
                </div>
                {/* Status Dot */}
                <div
                  className={`absolute bottom-[-1px] right-[-1px] w-3 h-3 rounded-full border-2 border-white ${
                    producto.estado === 'ACTIVO' ? 'bg-[#067647]' : 'bg-neutral-400'
                  }`}
                />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-semibold text-text-primary text-[14px] leading-tight line-clamp-1 w-[190px]">
                  {producto.nombre}
                </span>
                <span className="text-[11px] text-[#64748b] leading-tight uppercase font-mono mt-0.5">
                  {producto.codigo}
                </span>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1 hover:bg-neutral-100 rounded-lg transition-colors flex items-center justify-center w-7 h-7 text-[#64748b] hover:text-text-primary"
              title="Cerrar panel"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 flex flex-col gap-5 text-left">
          {/* Vista Previa Header */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[#64748b] text-[10px] font-bold tracking-[0.44px] uppercase">
              VISTA PREVIA
            </span>
            <div className="bg-[#f8fafc] border border-[#e4e7ec] p-4 rounded-[14px] flex flex-col gap-3.5">
              <span className="text-[#333] text-[14px] font-semibold line-clamp-1">
                {producto.nombre}
              </span>
              <div className="flex flex-col gap-2.5 text-[13.5px] font-sans">
                <div className="flex items-center justify-between text-[#64748b]">
                  <span>Subtotal</span>
                  <span className="text-[#333] font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-[#64748b]">
                  <span>ITBIS {itbisLabel}</span>
                  <span className="text-[#333] font-medium">{formatCurrency(itbisAmount)}</span>
                </div>
                <div className="border-t border-[#e4e7ec] pt-2.5 flex items-center justify-between font-bold text-[14px]">
                  <span className="text-[#333]">Total</span>
                  <span className="text-[#0379d5]">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Data */}
          <div className="flex flex-col gap-2">
            <span className="text-[#64748b] text-[10px] font-bold tracking-[0.44px] uppercase">
              DETALLES DEL CATÁLOGO
            </span>
            <div className="grid grid-cols-2 gap-y-2.5 text-[12.5px] items-center">
              <span className="text-[#64748b]">Tipo de producto</span>
              <span className="text-text-primary font-medium">{isService ? 'Servicio' : 'Bien'}</span>

              <span className="text-[#64748b]">Uso en facturación</span>
              <span className="text-text-primary font-medium">{producto.uso} facturas</span>

              <span className="text-[#64748b]">Estado del catálogo</span>
              <div>
                <button
                  type="button"
                  onClick={() => onToggleEstado(producto)}
                  className="focus:outline-none"
                >
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border cursor-pointer hover:opacity-85 transition-opacity ${
                      producto.estado === 'ACTIVO'
                        ? 'bg-green-50 text-green-700 border-green-200/50'
                        : 'bg-neutral-50 text-neutral-600 border-neutral-200/50'
                    }`}
                  >
                    {producto.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-[#e4e7ec] p-5 flex flex-col gap-2">
        <button
          onClick={() => onEditar(producto)}
          className="bg-[#0379d5] hover:bg-[#0262ad] text-white rounded-[10px] py-2.5 px-4 font-semibold text-[13px] flex items-center justify-center gap-2 transition-colors w-full"
        >
          <Edit2 size={13} />
          Editar
        </button>

        <div className="flex gap-2.5">
          <button
            onClick={() => onDuplicar(producto)}
            className="flex-1 border border-[#e2e8f0] hover:bg-neutral-50 text-[#333] rounded-[10px] py-2 px-3 text-[12px] flex items-center justify-center gap-2 transition-colors"
          >
            <Copy size={13} />
            duplicar
          </button>
          <button
            onClick={() => onEliminar(producto)}
            className="flex-1 border border-[#fca5a5] hover:bg-red-50 text-red-600 rounded-[10px] py-2 px-3 text-[12px] flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 size={13} />
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
