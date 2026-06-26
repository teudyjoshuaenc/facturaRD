'use client'

import type { JSX } from 'react'
import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/comprobantes'
import type { ItemRow } from '@/hooks/useNuevaFactura'

const ITBIS_RATES: Record<string, number> = { I1: 0.18, I2: 0.16, I3: 0, I4: 0, E: 0 }

interface Props {
  items: ItemRow[]
  onChange: (items: ItemRow[]) => void
}

export function ItemsTable({ items, onChange }: Props): JSX.Element {
  const { subtotal, itbis, total } = useMemo(() => {
    let sub = 0, tax = 0
    for (const item of items) {
      const monto = item.cantidad * item.precioUnitarioItem
      sub += monto
      tax += monto * (ITBIS_RATES[item.indicadorFacturacion] ?? 0)
    }
    return { subtotal: sub, itbis: tax, total: sub + tax }
  }, [items])

  function updateItem(key: string, patch: Partial<ItemRow>): void {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  function addItem(): void {
    onChange([
      ...items,
      { key: `item-${Date.now()}`, nombreItem: '', cantidad: 1, precioUnitarioItem: 0, indicadorFacturacion: 'I1', indicadorBienoServicio: 2 },
    ])
  }

  function removeItem(key: string): void {
    if (items.length > 1) onChange(items.filter((item) => item.key !== key))
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-h6 text-text-primary">Items</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="text-ui-sm text-text-secondary">
              <th className="py-2 pr-2 font-medium">Descripción</th>
              <th className="py-2 pr-2 font-medium">ITBIS</th>
              <th className="py-2 pr-2 font-medium">Tipo</th>
              <th className="py-2 pr-2 font-medium">Cant.</th>
              <th className="py-2 pr-2 font-medium">Precio Unit.</th>
              <th className="py-2 pr-2 font-medium">Total</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const monto = item.cantidad * item.precioUnitarioItem
              const itemItbis = monto * (ITBIS_RATES[item.indicadorFacturacion] ?? 0)
              return (
                <tr key={item.key} className="border-t border-border-subtle">
                  <td className="py-2 pr-2">
                    <input
                      className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-body-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      placeholder="Descripción"
                      value={item.nombreItem}
                      onChange={(e) => updateItem(item.key, { nombreItem: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      className="rounded-lg border border-neutral-300 px-2 py-1.5 text-body-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      value={item.indicadorFacturacion}
                      onChange={(e) => updateItem(item.key, { indicadorFacturacion: e.target.value as ItemRow['indicadorFacturacion'] })}
                    >
                      <option value="I1">18%</option>
                      <option value="I2">16%</option>
                      <option value="I3">0%</option>
                      <option value="I4">Exento</option>
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      className="rounded-lg border border-neutral-300 px-2 py-1.5 text-body-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      value={item.indicadorBienoServicio}
                      onChange={(e) => updateItem(item.key, { indicadorBienoServicio: Number(e.target.value) as 1 | 2 })}
                    >
                      <option value={1}>Bien</option>
                      <option value={2}>Servicio</option>
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0.001}
                      step="any"
                      className="w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-body-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      value={item.cantidad}
                      onChange={(e) => updateItem(item.key, { cantidad: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="w-28 rounded-lg border border-neutral-300 px-2 py-1.5 text-body-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      value={item.precioUnitarioItem}
                      onChange={(e) => updateItem(item.key, { precioUnitarioItem: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 pr-2 text-text-primary">{formatCurrency(monto + itemItbis)}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      disabled={items.length === 1}
                      className="text-text-tertiary hover:text-danger-500 disabled:opacity-30"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Button variant="secondary" size="sm" onClick={addItem} className="self-start">
        <Plus size={16} />
        Agregar item
      </Button>

      <div className="flex flex-col gap-1 border-t border-border-subtle pt-4 text-body-sm">
        <div className="flex justify-between text-text-secondary">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-text-secondary">
          <span>ITBIS</span>
          <span>{formatCurrency(itbis)}</span>
        </div>
        <div className="flex justify-between text-h6 text-text-primary">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  )
}
