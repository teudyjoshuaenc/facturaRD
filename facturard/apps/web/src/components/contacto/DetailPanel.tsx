'use client'

import React from 'react'
import Image from 'next/image'
import type { JSX } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

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
  identificadorExtranjero?: string | null
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
  onEditar?: (contacto: Contacto) => void
  onToggleStatus?: (contacto: Contacto) => void
}

export function DetailPanel({
  contacto,
  onClose,
  onEmitirFactura,
  onCrearCotizacion,
  onRegistrarCompra,
  onEditar,
  onToggleStatus,
}: DetailPanelProps): JSX.Element | null {
  const router = useRouter()

  // Query actual invoices count
  const { data: facturasCount = 0 } = useQuery({
    queryKey: ['comprobantes-count', contacto?.id, contacto?.nombre, contacto?.rnc],
    queryFn: async () => {
      if (!contacto) return 0
      const searchVal = contacto.rnc || contacto.nombre
      const res = await api.get('/comprobantes', {
        params: { search: searchVal, limit: 1 }
      })
      return res.data?.total ?? 0
    },
    enabled: !!contacto,
  })

  // Query actual quotes count
  const { data: cotizacionesCount = 0 } = useQuery({
    queryKey: ['cotizaciones-count', contacto?.id],
    queryFn: async () => {
      if (!contacto) return 0
      const res = await api.get('/cotizaciones', {
        params: { contactoId: contacto.id, limit: 1 }
      })
      return res.data?.total ?? 0
    },
    enabled: !!contacto,
  })

  // Query actual purchases count
  const { data: comprasCount = 0 } = useQuery({
    queryKey: ['compras-count', contacto?.id, contacto?.nombre, contacto?.rnc],
    queryFn: async () => {
      if (!contacto) return 0
      const searchVal = contacto.rnc || contacto.nombre
      const res = await api.get('/compras', {
        params: { search: searchVal, limit: 1 }
      })
      return res.data?.total ?? 0
    },
    enabled: !!contacto,
  })

  if (!contacto) return null

  const currentContacto = contacto

  function validateRnc(actionName: string, proceed: () => void) {
    if (!currentContacto.rnc && !currentContacto.identificadorExtranjero) {
      toast.error(`Error: El NIF/RNC/Cédula es requerido para ${actionName}. Por favor actualice los datos del contacto.`)
      return
    }
    proceed()
  }

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

  const historialVal = {
    facturas: facturasCount,
    cotizaciones: cotizacionesCount > 0 ? `${cotizacionesCount}` : '—',
    compras: comprasCount,
  }

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

            <div className="flex items-center gap-1.5">
               {/* Status Badge Toggle */}
              <button
                type="button"
                onClick={() => onToggleStatus?.(contacto)}
                className="focus:outline-none"
                title={contacto.estado === 'ACTIVO' ? 'Desactivar contacto' : 'Activar contacto'}
              >
                {contacto.estado === 'ACTIVO' ? (
                  <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200/50 px-2.5 py-0.5 text-ui-xs font-semibold text-green-700 hover:bg-green-100 transition-colors cursor-pointer">
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-neutral-50 border border-neutral-200/50 px-2.5 py-0.5 text-ui-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer">
                    Inactivo
                  </span>
                )}
              </button>

              {/* Edit Button */}
              <button
                onClick={() => onEditar?.(contacto)}
                className="p-1 hover:bg-neutral-100 rounded-lg transition-colors flex items-center justify-center w-7 h-7 text-[#64748b] hover:text-text-primary"
                title="Editar contacto"
              >
                <Edit2 size={15} />
              </button>

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
            <div className="flex gap-2 select-none">
              <div
                onClick={() => router.push(`/facturas?search=${contacto.rnc || contacto.nombre}`)}
                className="flex-1 bg-[#f8fafc] p-3 rounded-[10px] border border-neutral-100 flex flex-col gap-1 cursor-pointer hover:bg-neutral-50 hover:border-neutral-200 transition-all"
                title="Ver facturas de este cliente"
              >
                <span className="text-[#64748b] text-[12px] leading-tight">Facturas</span>
                <span className="text-[#0379d5] text-[14px] font-bold">{historialVal.facturas}</span>
              </div>
              <div
                onClick={() => router.push(`/cotizaciones?search=${contacto.rnc || contacto.nombre}`)}
                className="flex-1 bg-[#f8fafc] p-3 rounded-[10px] border border-neutral-100 flex flex-col gap-1 cursor-pointer hover:bg-neutral-50 hover:border-neutral-200 transition-all"
                title="Ver cotizaciones de este cliente"
              >
                <span className="text-[#64748b] text-[12px] leading-tight">Cotizaciones</span>
                <span className="text-[#0379d5] text-[14px] font-bold whitespace-nowrap">{historialVal.cotizaciones}</span>
              </div>
              <div
                onClick={() => router.push(`/compras?search=${contacto.rnc || contacto.nombre}`)}
                className="flex-1 bg-[#f8fafc] p-3 rounded-[10px] border border-neutral-100 flex flex-col gap-1 cursor-pointer hover:bg-neutral-50 hover:border-neutral-200 transition-all"
                title="Ver compras de este cliente"
              >
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
          onClick={() => validateRnc("emitir factura", () => onEmitirFactura?.(contacto))}
          className="bg-[#0379d5] hover:bg-[#0262ad] text-white rounded-[10px] py-2.5 px-4 font-semibold text-[13px] flex items-center justify-center gap-2 transition-colors w-full"
        >
          <Image src="/icons/emit_invoice.svg" alt="Emit" width={12} height={12} />
          Emitir Factura
        </button>

        <div className="flex gap-2.5">
          <button
            onClick={() => validateRnc("crear cotización", () => onCrearCotizacion?.(contacto))}
            className="flex-1 border border-[#e2e8f0] hover:bg-neutral-50 text-[#333] rounded-[10px] py-2 px-3 text-[12px] flex items-center justify-center gap-2 transition-colors"
          >
            <Image src="/icons/create_quote.svg" alt="Quote" width={12} height={12} />
            Crear cotización
          </button>
          <button
            onClick={() => validateRnc("registrar compra", () => onRegistrarCompra?.(contacto))}
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
