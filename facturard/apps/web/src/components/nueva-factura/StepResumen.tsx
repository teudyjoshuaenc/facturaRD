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
  E31: 'B01 - Factura de Crédito Fiscal Electrónica',
  E32: 'B02 - Factura de Consumo Electrónica',
  E33: 'B03 - Nota de Débito Electrónica',
  E34: 'B04 - Nota de Crédito Electrónica',
  E41: 'B11 - Comprobante de Compras Electrónico',
  E43: 'B13 - Gastos Menores Electrónico',
  E44: 'B14 - Regímenes Especiales Electrónico',
  E45: 'B15 - Gubernamental Electrónico',
  E46: 'B16 - Exportaciones Electrónico',
  E47: 'B17 - Pagos al Exterior Electrónico',
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
    let gravado18 = 0
    let gravado16 = 0
    let gravado0 = 0
    let itbis18 = 0
    let itbis16 = 0
    let itbis0 = 0
    let subtotalExento = 0
    let totalItbisRetenido = 0
    let totalIsrRetenido = 0

    for (const item of items) {
      const base = item.cantidad * item.precioUnitarioItem
      const desc = item.descuento ?? 0
      const baseNet = Math.max(0, base - desc)

      if (item.indicadorFacturacion === 'I1') {
        gravado18 += baseNet
        itbis18 += baseNet * 0.18
      } else if (item.indicadorFacturacion === 'I2') {
        gravado16 += baseNet
        itbis16 += baseNet * 0.16
      } else if (item.indicadorFacturacion === 'I3') {
        gravado0 += baseNet
        itbis0 += baseNet * 0
      } else if (item.indicadorFacturacion === 'I4' || item.indicadorFacturacion === 'E') {
        subtotalExento += baseNet
      }

      totalItbisRetenido += item.itbisRetenido ?? 0
      totalIsrRetenido += item.isrRetenido ?? 0
    }

    const subtotalGravado = gravado18 + gravado16 + gravado0
    const subtotalItbis = itbis18 + itbis16 + itbis0
    const montoTotal = Math.max(0, subtotalGravado + subtotalExento + subtotalItbis - totalItbisRetenido - totalIsrRetenido)

    return {
      gravado18,
      gravado16,
      gravado0,
      itbis18,
      itbis16,
      itbis0,
      subtotalGravado,
      subtotalItbis,
      subtotalExento,
      totalItbisRetenido,
      totalIsrRetenido,
      montoTotal
    }
  }, [items])

  function renderTotalRow(label: string, value: number, isGrandTotal = false) {
    const formatted = value > 0 ? formatCurrency(value) : ''
    return (
      <div className={cn(
        "flex justify-between items-center py-1.5 text-body-sm font-sans select-none",
        isGrandTotal 
          ? "border-t border-neutral-200 pt-3 mt-1.5 font-bold text-text-primary text-[15px]" 
          : "font-medium text-text-secondary border-b border-neutral-200/40 last:border-none"
      )}>
        <span className={cn(isGrandTotal ? "text-text-primary" : "text-[#333333]")}>{label}</span>
        <span className={cn(isGrandTotal ? "text-[#0379D5]" : "text-text-secondary")}>{formatted || '-'}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 select-none text-left">
      <h3 className="text-h4 font-bold text-text-primary">Confirmar Factura</h3>

      {/* Main Details Container with light greyish bg */}
      <div className="flex flex-col gap-6 bg-neutral-50/70 border border-neutral-100 p-6 rounded-2xl">
        
        {/* Cliente Section */}
        {cliente && (
          <div className="flex flex-col gap-1.5 border-b border-neutral-200/40 pb-4">
            <span className="text-ui-xs font-semibold text-text-secondary uppercase tracking-wider">Cliente</span>
            <span className="text-body-md font-bold text-text-primary">{cliente.nombre}</span>
            <span className="text-ui-sm text-text-secondary">
              RNC: {cliente.rnc.length === 9 
                ? cliente.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3') 
                : cliente.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')}
            </span>
          </div>
        )}

        {/* NCF & Método Pago Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-neutral-200/40 pb-4">
          <div className="flex flex-col gap-1">
            <span className="text-ui-xs font-semibold text-text-secondary uppercase tracking-wider">Tipo e-CF</span>
            <span className="text-body-sm font-bold text-text-primary">{SHORTHAND_NCF[tipoECF] || tipoECF}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-ui-xs font-semibold text-text-secondary uppercase tracking-wider">Tipo de Pago</span>
            <span className="text-body-sm font-bold text-text-primary">{PAGO_LABELS[condicionPago] || condicionPago}</span>
          </div>
        </div>

        {/* Credit terms if applicable */}
        {condicionPago === 'CREDITO' && (fechaLimite || terminoPago) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-neutral-200/40 pb-4">
            {fechaLimite && (
              <div className="flex flex-col gap-1">
                <span className="text-ui-xs font-semibold text-text-secondary uppercase tracking-wider">Fecha Límite</span>
                <span className="text-body-sm font-bold text-text-primary">{formatDateSpanish(fechaLimite)}</span>
              </div>
            )}
            {terminoPago && (
              <div className="flex flex-col gap-1">
                <span className="text-ui-xs font-semibold text-text-secondary uppercase tracking-wider">Término de Pago</span>
                <span className="text-body-sm font-bold text-text-primary">{terminoPago}</span>
              </div>
            )}
          </div>
        )}

        {/* Productos Section */}
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

        {/* Totales Section */}
        <div className="flex flex-col gap-1.5 pt-2 font-sans w-full">
          {renderTotalRow("SubTotal Gravado", totals.subtotalGravado)}
          {renderTotalRow("SubTotal ITBIS", totals.subtotalItbis)}
          {renderTotalRow("SubTotal Exento", totals.subtotalExento)}
          {renderTotalRow("Propina Legal 10%", 0)}
          {renderTotalRow("Total ITBIS Retenido", totals.totalItbisRetenido)}
          {renderTotalRow("Total ISR Retenido", totals.totalIsrRetenido)}
          {renderTotalRow("Monto Total", totals.montoTotal, true)}
        </div>

        {/* Notas Section */}
        {notas && notas.trim().length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-neutral-200/40 pt-4">
            <span className="text-ui-xs font-semibold text-text-secondary uppercase tracking-wider">Notas</span>
            <p className="text-body-sm text-text-secondary font-medium whitespace-pre-wrap">{notas}</p>
          </div>
        )}
      </div>

      {/* Back button (full-width) */}
      <div className="flex justify-center pt-2">
        <Button variant="secondary" size="lg" onClick={onBack} className="w-full h-12 text-body-sm font-semibold bg-white border border-neutral-200 hover:bg-neutral-50 transition-colors">
          Atrás
        </Button>
      </div>
    </div>
  )
}
