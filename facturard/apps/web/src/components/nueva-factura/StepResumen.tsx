'use client'

import type { JSX } from 'react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/comprobantes'
import type { Contacto } from '@/hooks/useContactos'
import type { TipoECF, ItemRow } from '@/hooks/useNuevaFactura'
import { cn } from '@/lib/utils'

const ITBIS_RATES: Record<string, number> = { I1: 0.18, I2: 0.16, I3: 0, I4: 0, E: 0 }
const ITBIS_LABELS: Record<string, string> = { I1: '18%', I2: '16%', I3: '0%', I4: 'Exento', E: 'Exento' }

const SHORTHAND_NCF: Record<TipoECF, string> = {
  E31: 'B01 - Factura de Crédito Fiscal Electrónica (E31)',
  E32: 'B02 - Factura de Consumo Electrónica (E32)',
  E33: 'B03 - Nota de Débito Electrónica (E33)',
  E34: 'B04 - Nota de Crédito Electrónica (E34)',
  E41: 'B11 - Comprobante de Compras Electrónico (E41)',
  E43: 'B13 - Gastos Menores Electrónico (E43)',
  E44: 'B14 - Regímenes Especiales Electrónico (E44)',
  E45: 'B15 - Gubernamental Electrónico (E45)',
  E46: 'B16 - Exportaciones Electrónico (E46)',
  E47: 'B17 - Pagos al Exterior Electrónico (E47)',
}

const PAGO_LABELS: Record<string, string> = {
  CONTADO: 'Contado',
  CREDITO: 'Crédito',
  GRATUITO: 'Gratuito',
}

interface StepResumenProps {
  cliente: Contacto | null
  tipoECF: TipoECF
  condicionPago: string
  fechaEmision: string
  items: ItemRow[]
  notas?: string
  fechaLimite?: string
  terminoPago?: string
  onBack: () => void
}

function formatDateSpanish(isoDate: string): string {
  if (!isoDate) return ''
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  const [year, month, day] = parts
  return `${day}/${month}/${year}`
}

export function StepResumen({
  cliente,
  tipoECF,
  condicionPago,
  items,
  notas,
  fechaLimite,
  terminoPago,
  onBack,
}: StepResumenProps): JSX.Element {

  // Calculate detailed totals
  const totals = useMemo(() => {
    let sub = 0
    let tax = 0
    let retItbis = 0
    let retIsr = 0
    let descTotal = 0

    for (const item of items) {
      const base = item.cantidad * item.precioUnitarioItem
      const desc = item.descuento ?? 0
      descTotal += desc
      const baseNet = Math.max(0, base - desc)
      sub += baseNet
      tax += baseNet * (ITBIS_RATES[item.indicadorFacturacion] ?? 0)
      retItbis += item.itbisRetenido ?? 0
      retIsr += item.isrRetenido ?? 0
    }

    return {
      subtotal: sub,
      itbis: tax,
      descuento: descTotal,
      itbisRetenido: retItbis,
      isrRetenido: retIsr,
      total: Math.max(0, sub + tax - retItbis - retIsr),
    }
  }, [items])

  function renderTotalRow(label: string, value: number, isGrandTotal = false) {
    const formatted = formatCurrency(value)
    return (
      <div className={cn(
        "flex justify-between items-center py-1.5 text-body-sm font-sans select-none",
        isGrandTotal 
          ? "border-t border-neutral-200 pt-3 mt-1.5 font-bold text-text-primary text-[15px]" 
          : "font-medium text-text-secondary border-b border-neutral-200/40 last:border-none"
      )}>
        <span className={cn(isGrandTotal ? "text-text-primary" : "text-[#333333]")}>{label}</span>
        <span className={cn(isGrandTotal ? "text-[#0379D5]" : "text-text-secondary")}>{formatted}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[24px] select-none text-left w-full font-sans">
      
      {/* Title Header */}
      <div className="border-[#dde5ef] border-b border-solid pb-[11px] w-full">
        <h4 className="font-sans font-semibold text-[#374b6a] text-[13px] uppercase tracking-wider">
          Confirmación del comprobante
        </h4>
      </div>

      {/* Warning Banner */}
      <div className="bg-[#ebf4fd] border border-[rgba(3,121,213,0.2)] border-solid rounded-[10px] w-full px-[21px] py-[17px]">
        <p className="font-sans font-semibold text-[#0379d5] text-[13px] leading-[20.8px]">
          Revisa los datos antes de emitir
        </p>
        <p className="font-sans font-normal text-[13px] text-[rgba(0,0,0,0.8)] leading-[20.8px] mt-[6px]">
          Al confirmar, el comprobante será enviado a la DGII para su validación y no podrá ser modificado. Asegúrate de que todos los datos del documento, comprador y detalle estén correctos.
        </p>
      </div>

      {/* Main Details Container with light greyish bg */}
      <div className="flex flex-col gap-[20px] bg-[#f8fafc] p-[20px] rounded-[14px] w-full">
        
        {/* Cliente Section */}
        {cliente && (
          <div className="flex flex-col gap-[2px] w-full">
            <span className="text-[#94a3b8] text-[12px] font-sans">Cliente</span>
            <span className="text-[#333] text-[15px] font-sans font-normal">{cliente.nombre}</span>
            <span className="text-[#64748b] text-[13px] font-sans">
              RNC: {cliente.rnc.length === 9 
                ? cliente.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3') 
                : cliente.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')}
            </span>
          </div>
        )}

        {/* NCF & Método Pago Row */}
        <div className="flex gap-[24px] items-center w-full font-sans">
          <div className="flex flex-col gap-[4px] flex-1">
            <span className="text-[#94a3b8] text-[12px]">Tipo NCF</span>
            <span className="text-[#333] text-[14px] font-normal">{SHORTHAND_NCF[tipoECF] || tipoECF}</span>
          </div>
          <div className="flex flex-col gap-[4px] flex-1">
            <span className="text-[#94a3b8] text-[12px]">Método Pago</span>
            <span className="text-[#333] text-[14px] font-normal">{PAGO_LABELS[condicionPago] || condicionPago}</span>
          </div>
        </div>

        {/* Credit terms if applicable */}
        {condicionPago === 'CREDITO' && (fechaLimite || terminoPago) && (
          <div className="flex gap-[24px] items-center w-full font-sans">
            {fechaLimite && (
              <div className="flex flex-col gap-[4px] flex-1">
                <span className="text-[#94a3b8] text-[12px]">Fecha Límite</span>
                <span className="text-[#333] text-[14px] font-normal">{formatDateSpanish(fechaLimite)}</span>
              </div>
            )}
            {terminoPago && (
              <div className="flex flex-col gap-[4px] flex-1">
                <span className="text-[#94a3b8] text-[12px]">Término de Pago</span>
                <span className="text-[#333] text-[14px] font-normal">{terminoPago}</span>
              </div>
            )}
          </div>
        )}

        {/* Productos Section (Left untouched) */}
        <div className="flex flex-col gap-2 border-b border-neutral-200/40 pb-4">
          <span className="text-ui-xs font-semibold text-text-secondary uppercase tracking-wider">
            Productos ({items.length})
          </span>
          <div className="flex flex-col border-t border-neutral-200/40">
            {items.map((item) => {
              const base = item.cantidad * item.precioUnitarioItem
              const desc = item.descuento ?? 0
              const baseNet = Math.max(0, base - desc)
              const itemItbis = baseNet * (ITBIS_RATES[item.indicadorFacturacion] ?? 0)
              const retItbis = item.itbisRetenido ?? 0
              const retIsr = item.isrRetenido ?? 0
              const totalLinea = Math.max(0, baseNet + itemItbis - retItbis - retIsr)

              const itbisPercent = ITBIS_LABELS[item.indicadorFacturacion] ?? '0%'
              const typeText = item.indicadorBienoServicio === 1 ? 'Bien' : 'Servicio'

              return (
                <div key={item.key} className="flex justify-between items-center py-3 border-b border-neutral-200/40 last:border-none text-body-sm">
                  <div className="flex flex-wrap items-baseline gap-x-4">
                    <span className="text-text-primary font-semibold">
                      {item.nombreItem}
                    </span>
                    <div className="flex flex-wrap items-baseline gap-x-4 text-[12px] text-text-secondary font-medium font-sans">
                      <span>Cantidad: {item.cantidad}</span>
                      <span>Tipo: {typeText}</span>
                      <span>ITBIS: {itbisPercent}</span>
                      {desc > 0 && <span>Desc: {formatCurrency(desc)}</span>}
                    </div>
                  </div>
                  <span className="font-semibold text-text-primary whitespace-nowrap">{formatCurrency(totalLinea)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Totales Section (Left untouched) */}
        <div className="flex flex-col gap-1.5 pt-2 font-sans w-full">
          {renderTotalRow("Subtotal", totals.subtotal)}
          {renderTotalRow("Descuento", totals.descuento)}
          {renderTotalRow("ITBIS (18%)", totals.itbis)}
          {renderTotalRow("ITBIS Retenido (18%)", totals.itbisRetenido)}
          {renderTotalRow("ISR Retenido", totals.isrRetenido)}
          {!['E41', 'E44', 'E46', 'E47'].includes(tipoECF) && renderTotalRow("Propina Legal", 0)}
          {renderTotalRow("Total", totals.total, true)}
        </div>

        {/* Notas Section */}
        {notas && notas.trim().length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-neutral-200/40 pt-4">
            <span className="text-[#94a3b8] text-[12px] uppercase tracking-wider font-sans">Notas</span>
            <p className="text-body-sm text-[#333] font-medium whitespace-pre-wrap">{notas}</p>
          </div>
        )}
      </div>

      {/* Back button */}
      <div className="flex items-center w-full">
        <button
          type="button"
          onClick={onBack}
          className="w-full h-[48px] rounded-[14px] border border-[#f5f5f5] text-[16px] font-normal text-black bg-white hover:bg-neutral-50 transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  )
}
