'use client'

import { useEffect, useState, type JSX } from 'react'
import { Plus, X, TrendingUp } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useGuardarPresupuestoConfig, type IngresoLinea, type CostoFijoLinea, type PresupuestoConfig } from '@/hooks/usePresupuesto'
import { useSetCapital } from '@/hooks/useFinanzas'
import { cn } from '@/lib/utils'

interface PresupuestoOnboardingWizardProps {
  open: boolean
  onClose: () => void
  /** Config actual — si ya existe (flujo "Rehacer preguntas"), precarga el wizard con ella. */
  config?: PresupuestoConfig | undefined
  saldoActual?: number | undefined
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const SECTORES = ['Servicios', 'Tecnología', 'Comercio / Retail', 'Restaurante', 'Manufactura', 'Construcción', 'Salud', 'Otro']
const REF_VAR = [
  ['Servicios / consultoría', 15],
  ['Software / SaaS', 20],
  ['Comercio / retail', 60],
  ['Restaurante', 35],
  ['Manufactura', 55],
] as const
const STEPS = 6
const MAX_SECTOR_OTRO = 12
const fmt = (v: number) => 'RD$ ' + Math.round(v).toLocaleString('es-DO')

function defaultCostosFijos(): CostoFijoLinea[] {
  return [
    { nombre: 'Nómina', categoria: 'Personal', montoMensual: 0 },
    { nombre: 'Alquiler', categoria: 'Local', montoMensual: 0 },
    { nombre: 'Servicios (luz, agua, internet)', categoria: 'Servicios', montoMensual: 0 },
    { nombre: 'Software y herramientas', categoria: 'Tecnología', montoMensual: 0 },
  ]
}

export function PresupuestoOnboardingWizard({ open, onClose, config, saldoActual }: PresupuestoOnboardingWizardProps): JSX.Element | null {
  const guardar = useGuardarPresupuestoConfig()
  const setCapital = useSetCapital()

  const [step, setStep] = useState(0)
  const [sector, setSector] = useState('Servicios')
  const [sectorOtro, setSectorOtro] = useState('')
  const [moneda, setMoneda] = useState('DOP')
  const [mesFiscalInicio, setMesFiscalInicio] = useState(0)
  const [saldo, setSaldo] = useState(0)
  const [cxc, setCxc] = useState(0)
  const [cxp, setCxp] = useState(0)
  const [ingresos, setIngresos] = useState<IngresoLinea[]>([{ nombre: 'Ventas de servicios', montoMensual: 0, crecimientoPct: 0 }])
  const [costosFijos, setCostosFijos] = useState<CostoFijoLinea[]>(defaultCostosFijos())
  const [varPct, setVarPct] = useState(25)
  const [colchonMeses, setColchonMeses] = useState(3)
  const [metaMargenPct, setMetaMargenPct] = useState(20)

  useEffect(() => {
    if (!open) return
    setStep(0)
    if (config?.configurado) {
      const sectorGuardado = config.sector ?? 'Servicios'
      if (sectorGuardado !== 'Otro' && !SECTORES.includes(sectorGuardado as (typeof SECTORES)[number])) {
        setSector('Otro')
        setSectorOtro(sectorGuardado.slice(0, MAX_SECTOR_OTRO))
      } else {
        setSector(sectorGuardado)
        setSectorOtro('')
      }
      setMoneda(config.moneda)
      setMesFiscalInicio(config.mesFiscalInicio)
      setCxc(config.cxcInicial)
      setCxp(config.cxpInicial)
      setIngresos(config.ingresos.length ? config.ingresos : [{ nombre: 'Ventas de servicios', montoMensual: 0, crecimientoPct: 0 }])
      setCostosFijos(config.costosFijos.length ? config.costosFijos : defaultCostosFijos())
      setVarPct(config.varPct)
      setColchonMeses(config.colchonMeses)
      setMetaMargenPct(config.metaMargenPct)
    }
    setSaldo(saldoActual ?? 0)
  }, [open, config, saldoActual])

  if (!open) return null

  const ingresoMensual = ingresos.reduce((a, x) => a + x.montoMensual, 0)
  const fijoMensual = costosFijos.reduce((a, x) => a + x.montoMensual, 0)
  const puntoEquilibrio = 1 - varPct / 100 > 0 ? fijoMensual / (1 - varPct / 100) : 0
  const netoMensual = ingresoMensual - fijoMensual - (ingresoMensual * varPct) / 100

  const sectorFinal = sector === 'Otro' ? sectorOtro.trim() || 'Otro' : sector

  async function handleFinish(): Promise<void> {
    await guardar.mutateAsync({
      sector: sectorFinal, moneda, mesFiscalInicio, colchonMeses, metaMargenPct, varPct,
      cxcInicial: cxc, cxpInicial: cxp, ingresos, costosFijos,
    })
    await setCapital.mutateAsync({ monto: saldo, fecha: new Date().toISOString().slice(0, 10) })
    onClose()
  }

  const saving = guardar.isPending || setCapital.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configura tu presupuesto"
      subtitle={`Paso ${step + 1} de ${STEPS}`}
      icon={<TrendingUp size={20} />}
      className="max-w-[760px]"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="secondary" onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))} disabled={saving}>
            {step === 0 ? 'Cancelar' : '← Atrás'}
          </Button>
          <div className="flex items-center gap-2">
            {/* Nada en este wizard es obligatorio — "Omitir" lo deja explícito
                en los pasos que son puro dato opcional (no en el setup base
                ni en el paso final, que ya trae recomendados). */}
            {step >= 1 && step <= 4 && (
              <Button variant="ghost" onClick={() => setStep((s) => s + 1)} disabled={saving}>
                Omitir
              </Button>
            )}
            {step < STEPS - 1 ? (
              <Button variant="primary" onClick={() => setStep((s) => s + 1)}>Continuar →</Button>
            ) : (
              <Button variant="primary" onClick={handleFinish} disabled={saving}>
                {saving ? 'Activando…' : 'Activar mi panel financiero →'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* Rail de progreso */}
      <div className="flex gap-1.5 -mt-1">
        {Array.from({ length: STEPS }, (_, i) => (
          <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i <= step ? 'bg-brand-500' : 'bg-neutral-200')} />
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-body-sm text-text-secondary">Con esto preparamos tu año fiscal y la moneda de tus reportes de presupuesto.</p>
          <div className="grid grid-cols-2 gap-4">
            <Select value={moneda} onChange={setMoneda} options={[{ value: 'DOP', label: 'DOP — Peso dominicano' }, { value: 'USD', label: 'USD — Dólar' }, { value: 'EUR', label: 'EUR — Euro' }]} />
            <Select value={String(mesFiscalInicio)} onChange={(v) => setMesFiscalInicio(Number(v))} options={MESES.map((m, i) => ({ value: String(i), label: m }))} />
          </div>
          <div>
            <p className="mb-2 text-body-sm font-semibold text-text-secondary">Sector</p>
            <div className="flex flex-wrap gap-2">
              {SECTORES.map((s) => (
                <button key={s} type="button" onClick={() => setSector(s)} className={cn('rounded-full border px-3.5 py-2 text-body-sm transition-colors', sector === s ? 'border-brand-500 bg-brand-500 text-white' : 'border-neutral-200 bg-white hover:border-brand-300')}>
                  {s}
                </button>
              ))}
            </div>
            {sector === 'Otro' && (
              <div className="mt-2">
                <Input
                  placeholder="¿Cuál? (máx. 12 caracteres)"
                  maxLength={MAX_SECTOR_OTRO}
                  value={sectorOtro}
                  onChange={(e) => setSectorOtro(e.target.value.slice(0, MAX_SECTOR_OTRO))}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <p className="text-body-sm text-text-secondary">Suma lo que hay en caja y en todas las cuentas bancarias. Es el punto cero desde donde arranca la proyección.</p>
          <Input label="Efectivo en caja y bancos" type="number" min={0} value={saldo || ''} onChange={(e) => setSaldo(Number(e.target.value))} placeholder="0" />
          <Input label="Lo que te deben tus clientes hoy (opcional)" type="number" min={0} value={cxc || ''} onChange={(e) => setCxc(Number(e.target.value))} placeholder="0" />
          <Input label="Lo que debes a proveedores hoy (opcional)" type="number" min={0} value={cxp || ''} onChange={(e) => setCxp(Number(e.target.value))} placeholder="0" />
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <p className="text-body-sm text-text-secondary">Agrega tus fuentes de ingreso recurrentes con lo que entra en un mes normal. &quot;Crecimiento&quot; es opcional: cuánto sube esa fuente cada mes, en %.</p>
          <div className="flex flex-col gap-2">
            {ingresos.map((ing, i) => (
              <div key={i} className="grid grid-cols-[1fr_130px_90px_32px] gap-2 items-center">
                <Input value={ing.nombre} placeholder="Ej. Venta de servicios" onChange={(e) => setIngresos((arr) => arr.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} />
                <Input type="number" min={0} value={ing.montoMensual || ''} placeholder="Monto" onChange={(e) => setIngresos((arr) => arr.map((x, j) => (j === i ? { ...x, montoMensual: Number(e.target.value) } : x)))} />
                <Input type="number" step={0.5} value={ing.crecimientoPct || ''} placeholder="% crec." onChange={(e) => setIngresos((arr) => arr.map((x, j) => (j === i ? { ...x, crecimientoPct: Number(e.target.value) } : x)))} />
                <button type="button" onClick={() => setIngresos((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr))} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-danger-50 hover:text-danger-600">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setIngresos((arr) => [...arr, { nombre: '', montoMensual: 0, crecimientoPct: 0 }])} className="flex w-fit items-center gap-1.5 text-body-sm font-semibold text-brand-600 hover:underline">
            <Plus size={15} /> Agregar otra fuente de ingreso
          </button>
          <div className="mt-2 flex gap-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div><p className="text-body-sm font-semibold uppercase text-text-secondary">Ingreso mensual</p><p className="text-body-sm font-bold">{fmt(ingresoMensual)}</p></div>
            <div><p className="text-body-sm font-semibold uppercase text-text-secondary">Proyectado 12 meses (sin crecimiento)</p><p className="text-body-sm font-bold">{fmt(ingresoMensual * 12)}</p></div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3">
          <p className="text-body-sm text-text-secondary">Los costos fijos no dependen de cuánto vendas. Precargamos los más comunes: ajusta los montos y borra lo que no aplique.</p>
          <div className="flex flex-col gap-2">
            {costosFijos.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_130px_32px] gap-2 items-center">
                <Input value={c.nombre} placeholder="Ej. Alquiler" onChange={(e) => setCostosFijos((arr) => arr.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} />
                <Input type="number" min={0} value={c.montoMensual || ''} placeholder="Monto" onChange={(e) => setCostosFijos((arr) => arr.map((x, j) => (j === i ? { ...x, montoMensual: Number(e.target.value) } : x)))} />
                <button type="button" onClick={() => setCostosFijos((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr))} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-danger-50 hover:text-danger-600">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setCostosFijos((arr) => [...arr, { nombre: '', categoria: 'General', montoMensual: 0 }])} className="flex w-fit items-center gap-1.5 text-body-sm font-semibold text-brand-600 hover:underline">
            <Plus size={15} /> Agregar otro costo fijo
          </button>
          <div className="mt-2 flex gap-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div><p className="text-body-sm font-semibold uppercase text-text-secondary">Costo fijo mensual</p><p className="text-body-sm font-bold">{fmt(fijoMensual)}</p></div>
            <div><p className="text-body-sm font-semibold uppercase text-text-secondary">Punto de equilibrio</p><p className="text-body-sm font-bold">{fmt(puntoEquilibrio)}</p></div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <p className="text-body-sm text-text-secondary">Los costos variables suben y bajan con las ventas: materia prima, comisiones, procesamiento de pagos. Exprésalo como % de tus ingresos.</p>
          <Input label="Costo variable sobre ventas (%)" type="number" min={0} max={100} value={varPct || ''} placeholder="0" onChange={(e) => setVarPct(Number(e.target.value))} />
          <div>
            <p className="mb-2 text-body-sm font-semibold text-text-secondary">¿No estás seguro? Referencias rápidas</p>
            <div className="flex flex-wrap gap-2">
              {REF_VAR.map(([label, pct]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setVarPct(pct)}
                  className={cn(
                    'rounded-full border px-3.5 py-2 text-body-sm transition-colors',
                    varPct === pct ? 'border-brand-500 bg-brand-500 text-white' : 'border-neutral-200 bg-white hover:border-brand-300',
                  )}
                >
                  {label} · {pct}%
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div><p className="text-body-sm font-semibold uppercase text-text-secondary">Margen bruto estimado</p><p className="text-body-sm font-bold">{(100 - varPct).toFixed(0)}%</p></div>
            <div><p className="text-body-sm font-semibold uppercase text-text-secondary">Resultado mensual</p><p className={cn('text-body-sm font-bold', netoMensual >= 0 ? 'text-success-600' : 'text-danger-600')}>{fmt(netoMensual)}</p></div>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col gap-4">
          <p className="text-body-sm text-text-secondary">Te avisaremos apenas la proyección indique que tu caja va a bajar de este nivel, con meses de anticipación.</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-ui-sm font-semibold text-text-secondary">Colchón de seguridad</label>
              <Select value={String(colchonMeses)} onChange={(v) => setColchonMeses(Number(v))} options={[{ value: '1', label: '1 mes' }, { value: '2', label: '2 meses' }, { value: '3', label: '3 meses (recomendado)' }, { value: '6', label: '6 meses' }]} />
            </div>
            <Input label="Margen neto objetivo (%)" type="number" min={0} max={90} value={metaMargenPct} onChange={(e) => setMetaMargenPct(Number(e.target.value))} />
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-body-sm text-text-secondary">
            Con esto queda montada tu base de seguimiento. Al activar entrás a tu panel de Proyección, donde vas a poder seguir mes a mes tus ingresos y egresos.
          </div>
        </div>
      )}
    </Modal>
  )
}
