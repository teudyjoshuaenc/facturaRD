'use client'

import { type JSX } from 'react'
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useProyeccion, usePresupuestoConfig } from '@/hooks/usePresupuesto'
import { useCapital } from '@/hooks/useFinanzas'
import { ProyeccionChart } from './ProyeccionChart'
import { cn } from '@/lib/utils'

const fmt = (v: number): string => {
  const s = v < 0 ? '-' : ''
  return s + 'RD$ ' + Math.abs(Math.round(v)).toLocaleString('es-DO')
}

export function ProyeccionTab(): JSX.Element {
  const { data: config, isLoading: loadingConfig } = usePresupuestoConfig()
  const { data: proy, isLoading: loadingProy } = useProyeccion()
  const { data: capital } = useCapital()

  if (loadingConfig || loadingProy || !proy || !config) {
    return (
      <div className="flex items-center justify-center p-16">
        <Spinner size={28} />
      </div>
    )
  }

  const saldoHoy = capital ? Number(capital.monto) : 0
  const saldoFinal = proy.resumen.saldoFinal
  const dif = saldoFinal - saldoHoy
  const pct = saldoHoy > 0 ? (dif / saldoHoy) * 100 : 0

  const eMes = proy.resumen.totalEntradas / 12
  const sMes = proy.resumen.totalSalidas / 12
  const rMes = proy.resumen.totalNeto / 12
  const fijoAnual = proy.filas[0]!.fijo * 12
  const variableAnualReal = proy.resumen.totalSalidas - fijoAnual

  const cats = new Map<string, number>()
  config.costosFijos.forEach((c) => {
    const k = c.categoria || c.nombre || 'Otros'
    cats.set(k, (cats.get(k) ?? 0) + c.montoMensual)
  })
  const catEntries = [...cats.entries()].sort((a, b) => b[1] - a[1])
  const catMax = Math.max(...catEntries.map(([, v]) => v), 1)

  return (
    <div className="flex flex-col gap-6">
      {/* Hero: saldo hoy vs 12 meses */}
      <Card className="flex flex-wrap items-end gap-8 p-6">
        <div className="min-w-[220px] flex-1">
          <p className="mb-2 text-ui-xs font-bold uppercase tracking-wide text-text-secondary">Dinero disponible hoy</p>
          <p className="text-[40px] font-bold leading-none tracking-tight text-text-primary">{fmt(saldoHoy)}</p>
        </div>
        <div className="min-w-[220px] border-l border-neutral-200 pl-8">
          <p className="mb-2 text-ui-xs font-bold uppercase tracking-wide text-text-secondary">Así cierras en 12 meses</p>
          <p className="text-h5 font-bold tracking-tight text-ia-500">{fmt(saldoFinal)}</p>
          <span className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-ui-xs font-bold', dif >= 0 ? 'bg-success-50 text-success-700' : 'bg-cta-50 text-cta-600')}>
            {dif >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {dif >= 0 ? '+' : ''}{fmt(dif)}{saldoHoy > 0 ? ` · ${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%` : ''}
          </span>
        </div>
      </Card>

      {/* Entradas · Salidas · Resultado */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-t-[3px] border-t-success-500 p-5">
          <h4 className="mb-2.5 flex items-center gap-1.5 text-ui-sm font-bold uppercase tracking-wide text-success-700"><TrendingUp size={14} /> Entradas</h4>
          <p className="text-[27px] font-bold leading-tight tracking-tight">{fmt(eMes)}</p>
          <p className="mt-0.5 text-ui-xs text-text-secondary">al mes, en promedio</p>
          <div className="mt-3 flex justify-between border-t border-neutral-100 pt-2.5 text-body-sm text-text-secondary">
            <span>En el año</span><b className="text-text-primary">{fmt(proy.resumen.totalEntradas)}</b>
          </div>
        </Card>
        <Card className="border-t-[3px] border-t-cta-500 p-5">
          <h4 className="mb-2.5 flex items-center gap-1.5 text-ui-sm font-bold uppercase tracking-wide text-cta-600"><TrendingDown size={14} /> Salidas</h4>
          <p className="text-[27px] font-bold leading-tight tracking-tight">{fmt(sMes)}</p>
          <p className="mt-0.5 text-ui-xs text-text-secondary">al mes, en promedio</p>
          <div className="mt-3 flex justify-between border-t border-neutral-100 pt-2.5 text-body-sm text-text-secondary">
            <span>Costos fijos</span><b className="text-text-primary">{fmt(fijoAnual)}</b>
          </div>
          <div className="mt-1.5 flex justify-between text-body-sm text-text-secondary">
            <span>Costos variables ({config.varPct}%)</span><b className="text-text-primary">{fmt(variableAnualReal)}</b>
          </div>
        </Card>
        <Card className="border-t-[3px] border-t-ia-500 p-5">
          <h4 className="mb-2.5 text-ui-sm font-bold uppercase tracking-wide text-ia-500">◆ Resultado</h4>
          <p className={cn('text-[27px] font-bold leading-tight tracking-tight', rMes >= 0 ? 'text-success-600' : 'text-cta-600')}>{fmt(rMes)}</p>
          <p className="mt-0.5 text-ui-xs text-text-secondary">te queda al mes</p>
          <div className="mt-3 flex justify-between border-t border-neutral-100 pt-2.5 text-body-sm text-text-secondary">
            <span>Margen</span><b className="text-text-primary">{proy.resumen.margenPct.toFixed(1)}% <span className="font-normal text-text-secondary">· meta {config.metaMargenPct}%</span></b>
          </div>
        </Card>
      </div>

      {/* Alertas */}
      <div className="flex flex-col gap-2.5">
        {proy.alertas.quiebre ? (
          <div className="flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3.5 text-body-sm">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-danger-600" />
            <div><b className="text-danger-700">Tu caja se agota en {proy.alertas.quiebre.mes}.</b> <span className="text-text-secondary">Con el presupuesto actual el saldo llega a {fmt(proy.alertas.quiebre.saldo)}.</span></div>
          </div>
        ) : proy.alertas.riesgoColchon && proy.alertas.riesgoColchon.indice === 0 && saldoHoy < proy.resumen.colchonMonto ? (
          <div className="flex items-start gap-3 rounded-xl border border-cta-500/40 bg-cta-50 px-4 py-3.5 text-body-sm">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-cta-600" />
            <div><b className="text-cta-600">Ya estás por debajo de tu colchón de seguridad.</b> <span className="text-text-secondary">Tu reserva objetivo es {fmt(proy.resumen.colchonMonto)} ({config.colchonMeses} meses de gastos) y hoy tienes {fmt(saldoHoy)}. Te faltan {fmt(proy.resumen.colchonMonto - saldoHoy)} para alcanzarla.</span></div>
          </div>
        ) : proy.alertas.riesgoColchon ? (
          <div className="flex items-start gap-3 rounded-xl border border-cta-500/40 bg-cta-50 px-4 py-3.5 text-body-sm">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-cta-600" />
            <div><b className="text-cta-600">En {proy.alertas.riesgoColchon.mes} bajas de tu colchón de seguridad.</b> <span className="text-text-secondary">Tu reserva objetivo es {fmt(proy.resumen.colchonMonto)} y la proyección marca {fmt(proy.alertas.riesgoColchon.saldo)}.</span></div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-success-200 bg-success-50 px-4 py-3.5 text-body-sm">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success-600" />
            <div><b className="text-success-700">Tu caja se mantiene sobre el colchón todo el año.</b> <span className="text-text-secondary">Cierras con {fmt(saldoFinal)}, por encima de tu reserva de {fmt(proy.resumen.colchonMonto)}.</span></div>
          </div>
        )}
        {proy.resumen.margenPct < config.metaMargenPct && proy.resumen.totalEntradas > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-cta-500/40 bg-cta-50 px-4 py-3.5 text-body-sm">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-cta-600" />
            <div><b className="text-cta-600">Margen por debajo de tu meta.</b> <span className="text-text-secondary">Proyectas {proy.resumen.margenPct.toFixed(1)}% y tu objetivo es {config.metaMargenPct}%.</span></div>
          </div>
        )}
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle>Proyección de caja · 12 meses</CardTitle>
          <CardDescription>Saldo acumulado según tu presupuesto. La línea punteada es tu colchón de seguridad.</CardDescription>
        </CardHeader>
        <div className="mb-3 flex flex-wrap gap-5 text-ui-xs text-text-secondary">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ia-500" />Saldo proyectado</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-cta-500" />Colchón / mes bajo el colchón</span>
        </div>
        <ProyeccionChart filas={proy.filas} colchonMonto={proy.resumen.colchonMonto} saldoHoy={saldoHoy} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>En qué se va el dinero</CardTitle>
            <CardDescription>Costos fijos por categoría, mensual.</CardDescription>
          </CardHeader>
          {catEntries.length === 0 ? (
            <p className="py-6 text-center text-body-sm text-text-secondary">Aún no has cargado costos fijos.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {catEntries.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[110px_1fr_90px] items-center gap-3 text-body-sm">
                  <span className="truncate text-text-secondary">{k}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-cta-500" style={{ width: `${(v / catMax) * 100}%` }} /></span>
                  <span className="text-right text-text-primary">{fmt(v)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen del año</CardTitle>
            <CardDescription>Totales proyectados a 12 meses.</CardDescription>
          </CardHeader>
          <table className="w-full text-body-sm">
            <tbody>
              <tr className="border-b border-neutral-100"><td className="py-2.5 text-text-secondary">Entradas</td><td className="py-2.5 text-right font-semibold text-success-600">{fmt(proy.resumen.totalEntradas)}</td></tr>
              <tr className="border-b border-neutral-100"><td className="py-2.5 text-text-secondary">Costos fijos</td><td className="py-2.5 text-right">{fmt(fijoAnual)}</td></tr>
              <tr className="border-b border-neutral-100"><td className="py-2.5 text-text-secondary">Costos variables ({config.varPct}%)</td><td className="py-2.5 text-right">{fmt(variableAnualReal)}</td></tr>
              <tr className="border-b border-neutral-100"><td className="py-2.5 text-text-secondary">Total salidas</td><td className="py-2.5 text-right font-semibold text-cta-600">{fmt(proy.resumen.totalSalidas)}</td></tr>
              <tr className="border-b border-neutral-100"><td className="py-2.5 font-bold text-text-primary">Resultado del año</td><td className={cn('py-2.5 text-right font-bold', proy.resumen.totalNeto >= 0 ? 'text-success-600' : 'text-cta-600')}>{fmt(proy.resumen.totalNeto)}</td></tr>
              <tr><td className="py-2.5 text-text-secondary">Punto de equilibrio mensual</td><td className="py-2.5 text-right">{fmt(proy.resumen.puntoEquilibrio)}</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      {/* Detalle mes a mes */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle mes a mes</CardTitle>
          <CardDescription>Los meses marcados en naranja caen por debajo de tu colchón de seguridad.</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-ui-xs uppercase text-text-secondary">
                <th className="px-2 py-2 text-left font-semibold">Mes</th>
                <th className="px-2 py-2 text-right font-semibold">Entradas</th>
                <th className="px-2 py-2 text-right font-semibold">Fijos</th>
                <th className="px-2 py-2 text-right font-semibold">Variables</th>
                <th className="px-2 py-2 text-right font-semibold">Neto</th>
                <th className="px-2 py-2 text-right font-semibold">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {proy.filas.map((f) => {
                const risk = f.saldo < proy.resumen.colchonMonto
                return (
                  <tr key={f.indice} className={cn('border-b border-neutral-100 last:border-0', risk && 'bg-cta-50/60')}>
                    <td className="px-2 py-2.5">{f.mes}{risk && <span className="ml-1.5 text-cta-600">⚠</span>}</td>
                    <td className="px-2 py-2.5 text-right text-success-600">{fmt(f.entra)}</td>
                    <td className="px-2 py-2.5 text-right">{fmt(f.fijo)}</td>
                    <td className="px-2 py-2.5 text-right">{fmt(f.variable)}</td>
                    <td className={cn('px-2 py-2.5 text-right', f.neto >= 0 ? 'text-success-600' : 'text-cta-600')}>{fmt(f.neto)}</td>
                    <td className="px-2 py-2.5 text-right font-semibold">{fmt(f.saldo)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
