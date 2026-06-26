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
import type { ComprobanteFormData, ItemRow, TipoECF } from '@/hooks/useNuevaFactura'

const TIPOS_ECF: { value: TipoECF; label: string }[] = [
  { value: 'E31', label: 'E31 — Factura de Crédito Fiscal' },
  { value: 'E32', label: 'E32 — Factura de Consumo' },
  { value: 'E33', label: 'E33 — Nota de Débito' },
  { value: 'E34', label: 'E34 — Nota de Crédito' },
  { value: 'E41', label: 'E41 — Comprobante de Compras' },
  { value: 'E43', label: 'E43 — Gastos Menores' },
  { value: 'E44', label: 'E44 — Regímenes Especiales' },
  { value: 'E45', label: 'E45 — Gubernamental' },
  { value: 'E46', label: 'E46 — Exportaciones' },
  { value: 'E47', label: 'E47 — Pagos al Exterior' },
]

interface TipoConfig {
  showRNC: boolean
  rncRequired: boolean
  showRazonSocial: boolean
  showIdExtranjero: boolean
  showPais: boolean
  paisRequired: boolean
  showTipoIngresos: boolean
  showReferencia: boolean
  referenciaRequired: boolean
  labelRNC?: string
  labelRazonSocial?: string
}

const TIPO_CONFIG: Record<TipoECF, TipoConfig> = {
  E31: { showRNC: true,  rncRequired: true,  showRazonSocial: true,  showIdExtranjero: false, showPais: false, paisRequired: false, showTipoIngresos: true,  showReferencia: false, referenciaRequired: false },
  E32: { showRNC: true,  rncRequired: false, showRazonSocial: true,  showIdExtranjero: true,  showPais: false, paisRequired: false, showTipoIngresos: true,  showReferencia: false, referenciaRequired: false },
  E33: { showRNC: true,  rncRequired: false, showRazonSocial: true,  showIdExtranjero: false, showPais: false, paisRequired: false, showTipoIngresos: true,  showReferencia: true,  referenciaRequired: true  },
  E34: { showRNC: true,  rncRequired: false, showRazonSocial: true,  showIdExtranjero: false, showPais: false, paisRequired: false, showTipoIngresos: true,  showReferencia: true,  referenciaRequired: true  },
  E41: { showRNC: true,  rncRequired: true,  showRazonSocial: true,  showIdExtranjero: false, showPais: false, paisRequired: false, showTipoIngresos: false, showReferencia: false, referenciaRequired: false, labelRNC: 'RNC del proveedor *', labelRazonSocial: 'Razón social del proveedor *' },
  E43: { showRNC: false, rncRequired: false, showRazonSocial: false, showIdExtranjero: false, showPais: false, paisRequired: false, showTipoIngresos: false, showReferencia: false, referenciaRequired: false },
  E44: { showRNC: true,  rncRequired: false, showRazonSocial: true,  showIdExtranjero: false, showPais: false, paisRequired: false, showTipoIngresos: true,  showReferencia: false, referenciaRequired: false },
  E45: { showRNC: true,  rncRequired: true,  showRazonSocial: true,  showIdExtranjero: false, showPais: false, paisRequired: false, showTipoIngresos: true,  showReferencia: false, referenciaRequired: false, labelRNC: 'RNC del ente gubernamental *', labelRazonSocial: 'Nombre del ente gubernamental *' },
  E46: { showRNC: false, rncRequired: false, showRazonSocial: true,  showIdExtranjero: true,  showPais: true,  paisRequired: false, showTipoIngresos: true,  showReferencia: false, referenciaRequired: false, labelRazonSocial: 'Nombre del comprador en el exterior *' },
  E47: { showRNC: false, rncRequired: false, showRazonSocial: true,  showIdExtranjero: true,  showPais: true,  paisRequired: true,  showTipoIngresos: false, showReferencia: false, referenciaRequired: false, labelRazonSocial: 'Nombre del beneficiario (opcional)' },
}

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

  const [tipoECF, setTipoECF] = useState<TipoECF>('E31')
  const [rncComprador, setRncComprador] = useState('')
  const [razonSocialComprador, setRazonSocialComprador] = useState('')
  const [identificadorExtranjero, setIdentificadorExtranjero] = useState('')
  const [paisComprador, setPaisComprador] = useState('')
  const [fechaEmision, setFechaEmision] = useState(todayISO())
  const [condicionPago, setCondicionPago] = useState<'CONTADO' | 'CREDITO'>('CONTADO')
  const [tipoIngresos, setTipoIngresos] = useState<'01' | '02' | '03' | '04' | '05' | '06'>('01')
  const [ncfModificado, setNcfModificado] = useState('')
  const [fechaNCFModificado, setFechaNCFModificado] = useState('')
  const [codigoModificacion, setCodigoModificacion] = useState<'' | '1' | '2' | '3' | '4' | '5'>('')
  const [items, setItems] = useState<ItemRow[]>([
    { key: `${baseId}-0`, nombreItem: '', cantidad: 1, precioUnitarioItem: 0, indicadorFacturacion: 'I1', indicadorBienoServicio: 2 },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const cfg = TIPO_CONFIG[tipoECF]
  const { status: rncStatus, razonSocial: rncName } = useRncValidation(cfg.showRNC ? rncComprador : '')

  useEffect(() => {
    if (rncStatus === 'valid') setRazonSocialComprador(rncName)
  }, [rncStatus, rncName])

  useEffect(() => {
    setRncComprador('')
    setRazonSocialComprador('')
    setIdentificadorExtranjero('')
    setPaisComprador('')
    setNcfModificado('')
    setFechaNCFModificado('')
    setCodigoModificacion('')
  }, [tipoECF])

  const isValid: boolean = (() => {
    if (!items.every(i => i.nombreItem.trim().length > 0 && i.cantidad > 0 && i.precioUnitarioItem >= 0)) return false
    if (cfg.showRNC && cfg.rncRequired && !rncComprador.trim()) return false
    if (cfg.showRazonSocial && tipoECF !== 'E47' && !razonSocialComprador.trim()) return false
    if (cfg.paisRequired && !paisComprador.trim()) return false
    if (cfg.referenciaRequired && (!ncfModificado.trim() || !fechaNCFModificado || !codigoModificacion)) return false
    return true
  })()

  const handleItemsChange = useCallback((newItems: ItemRow[]) => setItems(newItems), [])

  async function handleSubmit(): Promise<void> {
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        tipoECF,
        rncComprador,
        identificadorExtranjero,
        razonSocialComprador,
        paisComprador,
        fechaEmision,
        condicionPago,
        tipoIngresos,
        ncfModificado,
        fechaNCFModificado,
        codigoModificacion,
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
        <Card className="flex flex-col gap-4">
          <h2 className="text-h6 text-text-primary">Datos del comprobante</h2>

          <Select
            label="Tipo e-CF *"
            value={tipoECF}
            onChange={(e) => setTipoECF(e.target.value as TipoECF)}
          >
            {TIPOS_ECF.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>

          <Input
            label="Fecha de emisión *"
            type="date"
            value={fechaEmision}
            onChange={(e) => setFechaEmision(e.target.value)}
          />

          {cfg.showTipoIngresos && (
            <Select
              label="Tipo de ingresos *"
              value={tipoIngresos}
              onChange={(e) => setTipoIngresos(e.target.value as typeof tipoIngresos)}
            >
              <option value="01">01 — Ingresos por operaciones (N/C)</option>
              <option value="02">02 — Ingresos financieros</option>
              <option value="03">03 — Ingresos extraordinarios</option>
              <option value="04">04 — Ingresos por arrendamientos</option>
              <option value="05">05 — Ingresos por venta activos depreciables</option>
              <option value="06">06 — Otros ingresos</option>
            </Select>
          )}

          <Select
            label="Condición de pago *"
            value={condicionPago}
            onChange={(e) => setCondicionPago(e.target.value as 'CONTADO' | 'CREDITO')}
          >
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </Select>

          {cfg.showRNC && (
            <div className="relative">
              <Input
                label={cfg.labelRNC ?? (cfg.rncRequired ? 'RNC del comprador *' : 'RNC del comprador')}
                placeholder="9 u 11 dígitos"
                inputMode="numeric"
                maxLength={11}
                value={rncComprador}
                onChange={(e) => setRncComprador(e.target.value.replace(/\D/g, '').slice(0, 11))}
              />
              {rncStatus === 'loading' && <div className="absolute right-3 top-9"><Spinner size={18} /></div>}
              {rncStatus === 'valid' && <div className="absolute right-3 top-9"><CheckCircle2 className="text-success-500" size={18} /></div>}
            </div>
          )}
          {cfg.showRNC && rncStatus === 'invalid' && (
            <p className="-mt-2 text-ui-xs text-danger-600">RNC no encontrado en la DGII</p>
          )}

          {cfg.showIdExtranjero && (
            <Input
              label="Identificador extranjero"
              placeholder="Número de ID del comprador extranjero"
              value={identificadorExtranjero}
              onChange={(e) => setIdentificadorExtranjero(e.target.value)}
            />
          )}

          {cfg.showRazonSocial && (
            <Input
              label={cfg.labelRazonSocial ?? 'Razón social *'}
              placeholder="Nombre del cliente o beneficiario"
              value={razonSocialComprador}
              onChange={(e) => setRazonSocialComprador(e.target.value)}
            />
          )}

          {cfg.showPais && (
            <Input
              label={cfg.paisRequired ? 'País *' : 'País'}
              placeholder="Código ISO del país (ej: US, ES, MX)"
              maxLength={3}
              value={paisComprador}
              onChange={(e) => setPaisComprador(e.target.value.toUpperCase())}
            />
          )}

          {cfg.showReferencia && (
            <>
              <hr className="border-border-subtle" />
              <p className="text-ui-sm font-medium text-text-primary">
                Información de referencia{cfg.referenciaRequired ? ' *' : ' (opcional)'}
              </p>
              <Input
                label={`NCF modificado${cfg.referenciaRequired ? ' *' : ''}`}
                placeholder="E310000000001"
                value={ncfModificado}
                onChange={(e) => setNcfModificado(e.target.value)}
              />
              <Input
                label={`Fecha del NCF modificado${cfg.referenciaRequired ? ' *' : ''}`}
                type="date"
                value={fechaNCFModificado}
                onChange={(e) => setFechaNCFModificado(e.target.value)}
              />
              <Select
                label={`Código de modificación${cfg.referenciaRequired ? ' *' : ''}`}
                value={codigoModificacion}
                onChange={(e) => setCodigoModificacion(e.target.value as typeof codigoModificacion)}
              >
                <option value="">Seleccionar...</option>
                <option value="1">1 — Anulación total</option>
                <option value="2">2 — Corrección de montos</option>
                <option value="3">3 — Corrección de texto</option>
                <option value="4">4 — Reemplazo NCF contingencia</option>
                <option value="5">5 — Referencia factura de consumo</option>
              </Select>
            </>
          )}
        </Card>

        <Card>
          <ItemsTable items={items} onChange={handleItemsChange} />
        </Card>
      </div>

      {error && <p className="text-ui-sm text-danger-600">{error}</p>}

      <div>
        <Button variant="primary" size="lg" disabled={!isValid || submitting} onClick={handleSubmit}>
          {submitting ? <Spinner size={18} className="text-white" /> : 'Emitir Comprobante'}
        </Button>
      </div>
    </div>
  )
}
