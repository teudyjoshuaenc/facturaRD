'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import type { JSX } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ItemsTable } from './ItemsTable'
import { useRncValidation } from '@/hooks/useRncValidation'
import { getErrorMessage } from '@/lib/api'
import type { ComprobanteFormData, ItemRow } from '@/hooks/useNuevaFactura'

function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

interface Props {
  onSubmit: (data: ComprobanteFormData) => Promise<string>
  onError?: (message: string) => void
}

export function ComprobanteForm({ onSubmit, onError }: Props): JSX.Element {
  const baseId = useId()

  const [tipoECF, setTipoECF] = useState<'E31' | 'E32'>('E31')
  const [rncComprador, setRncComprador] = useState('')
  const [razonSocialComprador, setRazonSocialComprador] = useState('')
  const [fechaEmision, setFechaEmision] = useState(todayISO())
  const [condicionPago, setCondicionPago] = useState<'CONTADO' | 'CREDITO'>('CONTADO')
  const [items, setItems] = useState<ItemRow[]>([
    { key: `${baseId}-0`, nombreItem: '', cantidad: 1, precioUnitarioItem: 0 },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { status: rncStatus, razonSocial: rncName } = useRncValidation(rncComprador)

  useEffect(() => {
    if (rncStatus === 'valid') {
      setRazonSocialComprador(rncName)
    }
  }, [rncStatus, rncName])

  const rncRequeridoParaE31 = tipoECF === 'E31' && rncComprador.trim().length === 0

  const isValid =
    razonSocialComprador.trim().length > 0 &&
    !rncRequeridoParaE31 &&
    items.every(
      (item) => item.nombreItem.trim().length > 0 && item.cantidad > 0 && item.precioUnitarioItem >= 0,
    )

  const handleItemsChange = useCallback((newItems: ItemRow[]) => {
    setItems(newItems)
  }, [])

  async function handleSubmit(): Promise<void> {
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        tipoECF,
        rncComprador,
        razonSocialComprador,
        fechaEmision,
        condicionPago,
        items,
      })
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      onError?.(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Izquierda — Datos del comprobante */}
        <Card className="flex flex-col gap-4">
          <h2 className="text-h6 text-text-primary">Datos del comprobante</h2>

          <Select
            label="Tipo e-CF *"
            value={tipoECF}
            onChange={(e) => setTipoECF(e.target.value as 'E31' | 'E32')}
          >
            <option value="E32">Factura de Consumo (E32)</option>
            <option value="E31">Factura de Crédito Fiscal (E31)</option>
          </Select>

          <div className="relative">
            <Input
              label="RNC del comprador"
              placeholder="9 u 11 dígitos"
              inputMode="numeric"
              maxLength={11}
              value={rncComprador}
              onChange={(e) => setRncComprador(e.target.value.replace(/\D/g, '').slice(0, 11))}
            />
            {rncStatus === 'loading' && (
              <div className="absolute right-3 top-9">
                <Spinner size={18} />
              </div>
            )}
            {rncStatus === 'valid' && (
              <div className="absolute right-3 top-9">
                <CheckCircle2 className="text-success-500" size={18} />
              </div>
            )}
          </div>
          {rncStatus === 'invalid' && (
            <p className="-mt-2 text-ui-xs text-danger-600">RNC no encontrado en la DGII</p>
          )}
          {rncRequeridoParaE31 && rncStatus === 'idle' && (
            <p className="-mt-2 text-ui-xs text-danger-600">
              El RNC del comprador es requerido para Facturas de Crédito Fiscal (E31)
            </p>
          )}

          <Input
            label="Razón social *"
            placeholder="Nombre del cliente"
            value={razonSocialComprador}
            onChange={(e) => setRazonSocialComprador(e.target.value)}
          />

          <Input
            label="Fecha de emisión *"
            type="date"
            value={fechaEmision}
            onChange={(e) => setFechaEmision(e.target.value)}
          />

          <Select
            label="Condición de pago *"
            value={condicionPago}
            onChange={(e) => setCondicionPago(e.target.value as 'CONTADO' | 'CREDITO')}
          >
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </Select>
        </Card>

        {/* Derecha — Items */}
        <Card>
          <ItemsTable items={items} onChange={handleItemsChange} />
        </Card>
      </div>

      {error && <p className="text-ui-sm text-danger-600">{error}</p>}

      <div>
        <Button variant="primary" size="lg" disabled={!isValid || submitting} onClick={handleSubmit}>
          {submitting ? <Spinner size={18} className="text-white" /> : 'Emitir Factura'}
        </Button>
      </div>
    </div>
  )
}
