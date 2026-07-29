'use client'

import { useEffect, useState, type JSX } from 'react'
import { Plus, X } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { usePresupuestoConfig, useGuardarPresupuestoConfig, type IngresoLinea, type CostoFijoLinea } from '@/hooks/usePresupuesto'
import { toast } from 'sonner'

const fmt = (v: number) => 'RD$ ' + Math.round(v).toLocaleString('es-DO')

export function PresupuestoTab(): JSX.Element {
  const { data: config, isLoading } = usePresupuestoConfig()
  const guardar = useGuardarPresupuestoConfig()

  const [ingresos, setIngresos] = useState<IngresoLinea[]>([])
  const [costosFijos, setCostosFijos] = useState<CostoFijoLinea[]>([])
  const [varPct, setVarPct] = useState(0)
  const [colchonMeses, setColchonMeses] = useState(3)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!config) return
    setIngresos(config.ingresos)
    setCostosFijos(config.costosFijos)
    setVarPct(config.varPct)
    setColchonMeses(config.colchonMeses)
    setDirty(false)
  }, [config])

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center p-16">
        <Spinner size={28} />
      </div>
    )
  }

  const ingresoMensual = ingresos.reduce((a, x) => a + x.montoMensual, 0)
  const fijoMensual = costosFijos.reduce((a, x) => a + x.montoMensual, 0)

  function markDirty(): void {
    setDirty(true)
  }

  async function guardarCambios(): Promise<void> {
    try {
      await guardar.mutateAsync({
        sector: config!.sector,
        moneda: config!.moneda,
        mesFiscalInicio: config!.mesFiscalInicio,
        colchonMeses,
        metaMargenPct: config!.metaMargenPct,
        varPct,
        cxcInicial: config!.cxcInicial,
        cxpInicial: config!.cxpInicial,
        ingresos,
        costosFijos,
      })
      setDirty(false)
      toast.success('Presupuesto actualizado')
    } catch {
      toast.error('No se pudo guardar el presupuesto')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {dirty && (
        <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <span className="text-body-sm text-brand-700">Tenés cambios sin guardar.</span>
          <Button variant="primary" size="sm" onClick={guardarCambios} disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Entradas previstas</CardTitle>
          <CardDescription>Edita cualquier monto: la proyección se recalcula al guardar.</CardDescription>
        </CardHeader>
        <div className="mb-4 flex gap-3 rounded-xl bg-brand-50 px-4 py-3 text-body-sm text-text-secondary">
          <span className="text-brand-600">⚡</span>
          <span>
            <b className="text-brand-700">Origen: manual.</b> Al conectar tu software de facturación FacturaRD, las facturas emitidas
            actualizarán estas entradas solas y aquí solo ajustarás lo proyectado. <span className="rounded-full bg-brand-100 px-2 py-0.5 text-ui-xs font-bold text-brand-600">Fase 2</span>
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {ingresos.map((ing, i) => (
            <div key={i} className="grid grid-cols-[1fr_140px_100px_32px] items-center gap-2">
              <Input
                value={ing.nombre}
                placeholder="Fuente de ingreso"
                onChange={(e) => { setIngresos((arr) => arr.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x))); markDirty() }}
              />
              <Input
                type="number" min={0} value={ing.montoMensual || ''} placeholder="Monto mensual"
                onChange={(e) => { setIngresos((arr) => arr.map((x, j) => (j === i ? { ...x, montoMensual: Number(e.target.value) } : x))); markDirty() }}
              />
              <Input
                type="number" step={0.5} value={ing.crecimientoPct || ''} placeholder="% crecimiento"
                onChange={(e) => { setIngresos((arr) => arr.map((x, j) => (j === i ? { ...x, crecimientoPct: Number(e.target.value) } : x))); markDirty() }}
              />
              <button
                type="button"
                onClick={() => { setIngresos((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr)); markDirty() }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-danger-50 hover:text-danger-600"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => { setIngresos((arr) => [...arr, { nombre: '', montoMensual: 0, crecimientoPct: 0 }]); markDirty() }}
            className="mt-1 flex w-fit items-center gap-1.5 text-body-sm font-semibold text-brand-600 hover:underline"
          >
            <Plus size={15} /> Agregar fuente
          </button>
        </div>
        <div className="mt-4 flex gap-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div><p className="text-ui-xs font-semibold uppercase text-text-secondary">Ingreso mensual</p><p className="text-h6 font-bold">{fmt(ingresoMensual)}</p></div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Salidas fijas</CardTitle>
          <CardDescription>Costos que pagas cada mes sin importar las ventas.</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-2">
          {costosFijos.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_140px_32px] items-center gap-2">
              <Input
                value={c.nombre} placeholder="Concepto"
                onChange={(e) => { setCostosFijos((arr) => arr.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x))); markDirty() }}
              />
              <Input
                value={c.categoria ?? ''} placeholder="Categoría (ej. Personal)"
                onChange={(e) => { setCostosFijos((arr) => arr.map((x, j) => (j === i ? { ...x, categoria: e.target.value } : x))); markDirty() }}
              />
              <Input
                type="number" min={0} value={c.montoMensual || ''} placeholder="Monto mensual"
                onChange={(e) => { setCostosFijos((arr) => arr.map((x, j) => (j === i ? { ...x, montoMensual: Number(e.target.value) } : x))); markDirty() }}
              />
              <button
                type="button"
                onClick={() => { setCostosFijos((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr)); markDirty() }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-danger-50 hover:text-danger-600"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => { setCostosFijos((arr) => [...arr, { nombre: '', categoria: 'General', montoMensual: 0 }]); markDirty() }}
            className="mt-1 flex w-fit items-center gap-1.5 text-body-sm font-semibold text-brand-600 hover:underline"
          >
            <Plus size={15} /> Agregar costo fijo
          </button>
        </div>
        <div className="mt-4 flex gap-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div><p className="text-ui-xs font-semibold uppercase text-text-secondary">Costo fijo mensual</p><p className="text-h6 font-bold">{fmt(fijoMensual)}</p></div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parámetros</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Costo variable sobre ventas (%)" type="number" min={0} max={100} value={varPct}
            onChange={(e) => { setVarPct(Number(e.target.value)); markDirty() }}
          />
          <Input
            label="Colchón de seguridad (meses)" type="number" min={0} max={12} value={colchonMeses}
            onChange={(e) => { setColchonMeses(Number(e.target.value)); markDirty() }}
          />
        </div>
      </Card>
    </div>
  )
}
