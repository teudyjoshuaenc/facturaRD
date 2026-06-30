'use client'

import type { JSX } from 'react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/comprobantes'
import type { Contacto } from '@/hooks/useContactos'
import type { TipoECF, ItemRow } from '@/hooks/useNuevaFactura'

const ITBIS_RATES: Record<string, number> = { I1: 0.18, I2: 0.16, I3: 0, I4: 0, E: 0 }

const SHORTHAND_NCF: Record<TipoECF, string> = {
  E31: 'B01',
  E32: 'B02',
  E33: 'B03',
  E34: 'B04',
  E41: 'B11',
  E43: 'B13',
  E44: 'B14',
  E45: 'B15',
  E46: 'B16',
  E47: 'B17',
}

const PAGO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  CREDITO: 'Crédito',
}

interface StepResumenProps {
  cliente: Contacto | null
  tipoECF: TipoECF
  condicionPago: string
  fechaEmision: string
  items: ItemRow[]
  notas?: string
  onBack: () => void
}

export function StepResumen({
  cliente,
  tipoECF,
  condicionPago,
  items,
  notas,
  onBack,
}: StepResumenProps): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-h4 font-bold text-text-primary">Confirmar Factura</h3>

      {/* Main Details Container with light greyish bg */}
      <div className="flex flex-col gap-6 bg-neutral-50/70 border border-neutral-100 p-6 rounded-2xl">
        {/* Cliente Section */}
        {cliente && (
          <div className="flex flex-col gap-1.5">
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
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-ui-xs font-semibold text-text-secondary uppercase tracking-wider">Tipo NCF</span>
            <span className="text-body-sm font-bold text-text-primary">{SHORTHAND_NCF[tipoECF] || tipoECF}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-ui-xs font-semibold text-text-secondary uppercase tracking-wider">Método Pago</span>
            <span className="text-body-sm font-bold text-text-primary">{PAGO_LABELS[condicionPago] || condicionPago}</span>
          </div>
        </div>

        {/* Productos Section */}
        <div className="flex flex-col gap-2">
          <span className="text-ui-xs font-semibold text-text-secondary uppercase tracking-wider">
            Productos ({items.length})
          </span>
          <div className="flex flex-col border-t border-neutral-200/40">
            {items.map((item) => {
              const totalLinea = item.cantidad * item.precioUnitarioItem * (1 + (ITBIS_RATES[item.indicadorFacturacion] ?? 0))
              return (
                <div key={item.key} className="flex justify-between items-center py-3 border-b border-neutral-200/40 text-body-sm">
                  <span className="text-text-primary font-semibold">
                    {item.nombreItem} <span className="text-text-tertiary font-normal">× {item.cantidad}</span>
                  </span>
                  <span className="font-semibold text-text-primary">{formatCurrency(totalLinea)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Notas Section */}
        {notas && notas.trim().length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-ui-xs font-semibold text-text-secondary uppercase tracking-wider">Notas</span>
            <p className="text-body-sm text-text-secondary font-medium whitespace-pre-wrap">{notas}</p>
          </div>
        )}
      </div>

      {/* Back button (full-width) */}
      <div className="flex justify-center pt-2">
        <Button variant="secondary" size="lg" onClick={onBack} className="w-full h-12 text-body-sm font-semibold bg-white border border-neutral-200">
          Back
        </Button>
      </div>
    </div>
  )
}
