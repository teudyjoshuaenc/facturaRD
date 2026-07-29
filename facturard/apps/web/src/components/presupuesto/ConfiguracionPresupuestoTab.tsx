'use client'

import { useEffect, useState, type JSX } from 'react'
import { RotateCcw } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { usePresupuestoConfig, useGuardarPresupuestoConfig } from '@/hooks/usePresupuesto'
import { useCapital, useSetCapital } from '@/hooks/useFinanzas'
import { toast } from 'sonner'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

interface ConfiguracionPresupuestoTabProps {
  onEditarEntradas: () => void
  onRehacer: () => void
}

export function ConfiguracionPresupuestoTab({ onEditarEntradas, onRehacer }: ConfiguracionPresupuestoTabProps): JSX.Element {
  const { data: config, isLoading } = usePresupuestoConfig()
  const { data: capital } = useCapital()
  const guardar = useGuardarPresupuestoConfig()
  const setCapital = useSetCapital()

  const [moneda, setMoneda] = useState('DOP')
  const [mesFiscalInicio, setMesFiscalInicio] = useState(0)
  const [saldo, setSaldo] = useState(0)
  const [cxc, setCxc] = useState(0)
  const [cxp, setCxp] = useState(0)
  const [varPct, setVarPct] = useState(0)
  const [metaMargenPct, setMetaMargenPct] = useState(20)
  const [colchonMeses, setColchonMeses] = useState(3)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!config) return
    setMoneda(config.moneda)
    setMesFiscalInicio(config.mesFiscalInicio)
    setCxc(config.cxcInicial)
    setCxp(config.cxpInicial)
    setVarPct(config.varPct)
    setMetaMargenPct(config.metaMargenPct)
    setColchonMeses(config.colchonMeses)
    setDirty(false)
  }, [config])

  useEffect(() => {
    if (capital) setSaldo(Number(capital.monto))
  }, [capital])

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center p-16">
        <Spinner size={28} />
      </div>
    )
  }

  function markDirty(): void {
    setDirty(true)
  }

  async function guardarCambios(): Promise<void> {
    try {
      await guardar.mutateAsync({
        sector: config!.sector,
        moneda,
        mesFiscalInicio,
        colchonMeses,
        metaMargenPct,
        varPct,
        cxcInicial: cxc,
        cxpInicial: cxp,
        ingresos: config!.ingresos,
        costosFijos: config!.costosFijos,
      })
      if (saldo !== Number(capital?.monto ?? 0)) {
        await setCapital.mutateAsync({ monto: saldo, fecha: new Date().toISOString().slice(0, 10) })
      }
      setDirty(false)
      toast.success('Configuración actualizada')
    } catch {
      toast.error('No se pudo guardar la configuración')
    }
  }

  const saving = guardar.isPending || setCapital.isPending

  return (
    <div className="flex flex-col gap-6">
      {dirty && (
        <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <span className="text-body-sm text-brand-700">Tenés cambios sin guardar.</span>
          <Button variant="primary" size="sm" onClick={guardarCambios} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Perfil del presupuesto</CardTitle>
          <CardDescription>Moneda y año fiscal de este módulo — no afecta tus e-CF, que siempre son en DOP.</CardDescription>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <Select
            value={moneda}
            onChange={(v) => { setMoneda(v); markDirty() }}
            options={[{ value: 'DOP', label: 'DOP — Peso dominicano' }, { value: 'USD', label: 'USD — Dólar' }, { value: 'EUR', label: 'EUR — Euro' }]}
          />
          <Select
            value={String(mesFiscalInicio)}
            onChange={(v) => { setMesFiscalInicio(Number(v)); markDirty() }}
            options={MESES.map((m, i) => ({ value: String(i), label: m }))}
          />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Punto de partida</CardTitle>
          <CardDescription>El efectivo desde el que arranca toda la proyección.</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-4">
          <Input label="Efectivo en caja y bancos hoy" type="number" min={0} value={saldo || ''} onChange={(e) => { setSaldo(Number(e.target.value)); markDirty() }} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Lo que te deben tus clientes" type="number" min={0} value={cxc || ''} onChange={(e) => { setCxc(Number(e.target.value)); markDirty() }} />
            <Input label="Lo que debes a proveedores" type="number" min={0} value={cxp || ''} onChange={(e) => { setCxp(Number(e.target.value)); markDirty() }} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas de tu negocio</CardTitle>
          <CardDescription>Con esto calculamos márgenes y disparamos las alertas.</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Costo variable sobre ventas (%)" type="number" min={0} max={100} value={varPct} onChange={(e) => { setVarPct(Number(e.target.value)); markDirty() }} helperText="Lo que te cuesta producir lo que vendes." />
            <Input label="Margen neto objetivo (%)" type="number" min={0} max={90} value={metaMargenPct} onChange={(e) => { setMetaMargenPct(Number(e.target.value)); markDirty() }} helperText="Te avisamos si la proyección queda por debajo." />
          </div>
          <div className="max-w-[300px]">
            <Select
              value={String(colchonMeses)}
              onChange={(v) => { setColchonMeses(Number(v)); markDirty() }}
              options={[{ value: '1', label: '1 mes' }, { value: '2', label: '2 meses' }, { value: '3', label: '3 meses (recomendado)' }, { value: '6', label: '6 meses' }]}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entradas y salidas</CardTitle>
          <CardDescription>Las fuentes de ingreso y los costos fijos se editan en la tab Presupuesto.</CardDescription>
        </CardHeader>
        <Button variant="secondary" onClick={onEditarEntradas}>Editar entradas y salidas →</Button>
      </Card>

      {/* Sección aparte a propósito: es una acción destructiva-ish (resetea el
          wizard paso a paso) — separarla evita que el usuario la confunda con
          un ajuste más de la config de arriba. */}
      <Card className="border-neutral-200">
        <CardHeader>
          <CardTitle>Empezar de nuevo</CardTitle>
          <CardDescription>Vuelve a hacer las preguntas iniciales una por una. Se conservan los datos que ya cargaste como punto de partida.</CardDescription>
        </CardHeader>
        <Button variant="secondary" onClick={onRehacer} className="gap-1.5">
          <RotateCcw size={15} /> Rehacer preguntas iniciales
        </Button>
      </Card>
    </div>
  )
}
