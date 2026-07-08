'use client'

import React from 'react'
import Image from 'next/image'
import type { JSX } from 'react'

interface Contacto {
  id: string
  nombre: string
  rnc: string
  email: string
  tipo: string
  validacion: string
  totalFacturado: number
  fecha: string
  estado: string
  telefono?: string
  tipoFiscal?: string
  ecfSugerido?: string
  productosFrecuentes?: string[]
  historial?: {
    facturas: number
    cotizaciones: string
    compras: number
  }
}

interface DetailPanelProps {
  contacto: Contacto | null
  onClose: () => void
  onEmitirFactura?: (contacto: Contacto) => void
  onCrearCotizacion?: (contacto: Contacto) => void
  onRegistrarCompra?: (contacto: Contacto) => void
}

export function DetailPanel({
  contacto,
  onClose,
  onEmitirFactura,
  onCrearCotizacion,
  onRegistrarCompra,
}: DetailPanelProps): JSX.Element | null {
  if (!contacto) return null

  // Format RNC for display
  const formattedRnc = contacto.rnc.length === 9
    ? contacto.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
    : contacto.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')

  // Default values matching Figma or fallback properties
  const phoneVal = contacto.telefono || '809-555-0101'
  const tipoFiscalVal = contacto.tipoFiscal || 'RNC'
  const ecfSugeridoVal = contacto.ecfSugerido || (contacto.tipo === 'EMPRESA' ? 'E31' : 'E32')
  const emailVal = contacto.email || 'contabilidad@lopez.com.do'
  const productosFrecuentesVal = contacto.productosFrecuentes || ['Consultoria', 'Consultoria', 'Mantenimiento']
  const historialVal = contacto.historial || {
    facturas: 24,
    cotizaciones: '21 abr 2026',
    compras: 2,
  }

  return (
    <div 
      className="fixed inset-y-0 right-0 z-40 w-[400px] bg-white border-l border-neutral-200 shadow-2xl flex flex-col justify-between transform transition-transform duration-300 ease-in-out"
      style={{ top: '68px', height: 'calc(100vh - 68px)' }}
    >
      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Header Section */}
        <div className="border-b border-[#e4e7ec] pb-4 pt-3.5 px-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            {/* Avatar & Info */}
            <div className="flex items-center gap-2">
              <div className="relative flex-shrink-0 w-9 h-9">
                <div className="absolute inset-0 bg-[#eff4ff] rounded-[10px] flex items-center justify-center">
                  <Image 
                    src="/icons/building.svg" 
                    alt="Building" 
                    width={16} 
                    height={16} 
                  />
                </div>
                {/* Status Dot */}
                <div className={`absolute bottom-[-1px] right-[-1px] w-3 h-3 rounded-full border-2 border-white ${contacto.estado === 'ACTIVO' ? 'bg-[#067647]' : 'bg-neutral-400'}`} />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-semibold text-text-primary text-[12px] leading-tight line-clamp-1 w-[190px]">
                  {contacto.nombre}
                </span>
                <span className="text-[11px] text-[#64748b] leading-tight">
                  {contacto.tipo === 'EMPRESA' ? 'Cliente' : 'Contacto'}
                </span>
              </div>
            </div>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="p-1 hover:bg-neutral-100 rounded-lg transition-colors flex items-center justify-center w-7 h-7"
              title="Cerrar panel"
            >
              <div className="relative w-4 h-4 flex items-center justify-center">
                <Image src="/icons/close_v1.svg" alt="Cerrar" width={8} height={8} className="absolute" />
                <Image src="/icons/close_v2.svg" alt="Cerrar" width={8} height={8} className="absolute" />
              </div>
            </button>
          </div>

          {/* Validation Banner */}
          <div className="bg-[#ecfdf3] rounded-[10px] p-4 text-left">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-semibold text-[#067647] text-[14px] leading-tight">
                RNC validado en DGII
              </span>
            </div>
            <p className="text-[10px] text-black/70 font-normal leading-normal">
              Basado en frecuencia, monto y última factura
            </p>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 flex flex-col gap-5 text-left">
          {/* Datos Fiscales */}
          <div className="flex flex-col gap-2">
            <span className="text-[#64748b] text-[10px] font-bold tracking-[0.44px] uppercase">
              DATOS FISCALES
            </span>
            <div className="grid grid-cols-2 gap-y-2 text-ui-sm">
              <span className="text-[#64748b] text-[12px]">RNC</span>
              <span className="text-text-primary text-[12px] font-medium">{formattedRnc}</span>

              <span className="text-[#64748b] text-[12px]">Tipo fiscal</span>
              <span className="text-text-primary text-[12px] font-medium">{tipoFiscalVal}</span>

              <span className="text-[#64748b] text-[12px] self-center">e-CF sugerido</span>
              <div>
                <span className="inline-block bg-[rgba(100,116,139,0.1)] text-[#64748b] text-[12px] font-semibold px-2.5 py-1 rounded-[10px]">
                  {ecfSugeridoVal}
                </span>
              </div>
            </div>
          </div>

          <Image src="/icons/separator.svg" alt="separator" width={360} height={1} className="w-full" />

          {/* Contacto */}
          <div className="flex flex-col gap-2">
            <span className="text-[#64748b] text-[10px] font-bold tracking-[0.44px] uppercase">
              CONTACTO
            </span>
            <div className="grid grid-cols-2 gap-y-2 text-ui-sm">
              <div className="flex items-center gap-1.5">
                <Image src="/icons/email.svg" alt="Email" width={14} height={14} />
                <span className="text-[#64748b] text-[12px]">Email</span>
              </div>
              <span className="text-text-primary text-[12px] font-medium break-all">{emailVal}</span>

              <div className="flex items-center gap-1.5">
                <Image src="/icons/phone.svg" alt="Phone" width={14} height={14} />
                <span className="text-[#64748b] text-[12px]">Teléfono</span>
              </div>
              <span className="text-text-primary text-[12px] font-medium">{phoneVal}</span>
            </div>
          </div>

          <Image src="/icons/separator.svg" alt="separator" width={360} height={1} className="w-full" />

          {/* Productos Frecuentes */}
          <div className="flex flex-col gap-2">
            <span className="text-[#64748b] text-[10px] font-bold tracking-[0.44px] uppercase">
              productos frecuentes
            </span>
            <div className="flex flex-wrap gap-2">
              {productosFrecuentesVal.map((prod, idx) => (
                <div key={idx} className="bg-[#f8fafc] px-3 py-1 rounded-[10px] border border-neutral-100">
                  <span className="text-[#333] text-[12px] font-semibold">
                    {prod}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Image src="/icons/separator.svg" alt="separator" width={360} height={1} className="w-full" />

          {/* Historial */}
          <div className="flex flex-col gap-2">
            <span className="text-[#64748b] text-[10px] font-bold tracking-[0.44px] uppercase">
              historial
            </span>
            <div className="flex gap-2">
              <div className="flex-1 bg-[#f8fafc] p-3 rounded-[10px] border border-neutral-100 flex flex-col gap-1">
                <span className="text-[#64748b] text-[12px] leading-tight">Facturas</span>
                <span className="text-[#0379d5] text-[14px] font-bold">{historialVal.facturas}</span>
              </div>
              <div className="flex-1 bg-[#f8fafc] p-3 rounded-[10px] border border-neutral-100 flex flex-col gap-1">
                <span className="text-[#64748b] text-[12px] leading-tight">Cotizaciones</span>
                <span className="text-[#0379d5] text-[14px] font-bold whitespace-nowrap">{historialVal.cotizaciones}</span>
              </div>
              <div className="flex-1 bg-[#f8fafc] p-3 rounded-[10px] border border-neutral-100 flex flex-col gap-1">
                <span className="text-[#64748b] text-[12px] leading-tight">Compras</span>
                <span className="text-[#0379d5] text-[14px] font-bold">{historialVal.compras}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-[#e4e7ec] p-5 flex flex-col gap-2">
        <button
          onClick={() => onEmitirFactura?.(contacto)}
          className="bg-[#0379d5] hover:bg-[#0262ad] text-white rounded-[10px] py-2.5 px-4 font-semibold text-[13px] flex items-center justify-center gap-2 transition-colors w-full"
        >
          <Image src="/icons/emit_invoice.svg" alt="Emit" width={12} height={12} />
          Emitir Factura
        </button>

        <div className="flex gap-2.5">
          <button
            onClick={() => onCrearCotizacion?.(contacto)}
            className="flex-1 border border-[#e2e8f0] hover:bg-neutral-50 text-[#333] rounded-[10px] py-2 px-3 text-[12px] flex items-center justify-center gap-2 transition-colors"
          >
            <Image src="/icons/create_quote.svg" alt="Quote" width={12} height={12} />
            Crear cotización
          </button>
          <button
            onClick={() => onRegistrarCompra?.(contacto)}
            className="flex-1 border border-[#e2e8f0] hover:bg-neutral-50 text-[#333] rounded-[10px] py-2 px-3 text-[12px] flex items-center justify-center gap-2 transition-colors"
          >
            <div className="w-3 h-3 flex items-center justify-center">
              <Image src="/icons/register_purchase.svg" alt="Purchase" width={12} height={12} />
            </div>
            Registrar Compra
          </button>
        </div>
      </div>
    </div>
  )
}
