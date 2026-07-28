'use client'

import { useMemo, type JSX } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, TrendingUp, TrendingDown, Scale, ChevronRight, AlertCircle, AlertTriangle, Plus, FileSpreadsheet, Wallet, UserPlus, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { FacturasTable } from '@/components/dashboard/FacturasTable'
import { IngresosGastosChart } from '@/components/dashboard/IngresosGastosChart'
import { GastosDonut } from '@/components/dashboard/GastosDonut'
import { DashboardHero } from '@/components/dashboard/DashboardHero'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useDashboardComprobantes, useMonthMetrics, useCumplimiento } from '@/hooks/useComprobantes'
import { useFinanzasResumen, useFinanzasFlujo, useTransacciones, CATEGORIA_LABELS } from '@/hooks/useFinanzas'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrencyCompact } from '@/lib/comprobantes'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const MESES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function monthRange(): { fechaDesde: string; fechaHasta: string; label: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return {
    fechaDesde: `${y}-${m}-01`,
    fechaHasta: `${y}-${m}-${d}`,
    label: `${MESES[now.getMonth()]} ${y}`,
  }
}

// Mismo tramo del día (1 → hoy) pero del mes anterior, para comparar manzanas
// con manzanas (no el mes anterior completo contra lo que va del mes actual).
function prevMonthRange(): { fechaDesde: string; fechaHasta: string } {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const y = prev.getFullYear()
  const m = String(prev.getMonth() + 1).padStart(2, '0')
  const diaHasta = Math.min(now.getDate(), new Date(y, prev.getMonth() + 1, 0).getDate())
  return {
    fechaDesde: `${y}-${m}-01`,
    fechaHasta: `${y}-${m}-${String(diaHasta).padStart(2, '0')}`,
  }
}

function pctChange(actual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return ((actual - anterior) / Math.abs(anterior)) * 100
}

// invertirBueno: true para "egresos", donde BAJAR es la buena noticia (se
// invierte el color, no el signo mostrado).
function TrendBadge({ delta, invertirBueno = false }: { delta: number | null; invertirBueno?: boolean }): JSX.Element | null {
  if (delta === null) return null
  const subio = delta >= 0
  const esBueno = invertirBueno ? !subio : subio
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${esBueno ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>
      {subio ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
    </span>
  )
}

export default function DashboardPage(): JSX.Element {
  const router = useRouter()
  const { fechaDesde, fechaHasta, label } = monthRange()

  const { comprobantes, isLoading: tableLoading, downloadingId, handleDownload } =
    useDashboardComprobantes({ limit: 10 })

  const { totalFacturadas, isLoading: metricsLoading } = useMonthMetrics({ fechaDesde, fechaHasta })

  // Flujo de caja real del mes (ingresos, gastos, balance) — lo que de verdad usas.
  const resumen = useFinanzasResumen({ desde: fechaDesde, hasta: fechaHasta })
  const flujo = resumen.data?.devengado
  const flujoLoading = resumen.isLoading

  // Mismo tramo del mes anterior, solo para los badges "vs. mes anterior" de
  // las tarjetas — comparación real, no inventada.
  const { fechaDesde: prevDesde, fechaHasta: prevHasta } = prevMonthRange()
  const resumenPrev = useFinanzasResumen({ desde: prevDesde, hasta: prevHasta })
  const flujoPrev = resumenPrev.data?.devengado
  const deltaIngresos = flujoPrev ? pctChange(flujo?.ingresos ?? 0, flujoPrev.ingresos) : null
  const deltaEgresos = flujoPrev ? pctChange(flujo?.egresos ?? 0, flujoPrev.egresos) : null
  const deltaBalance = flujoPrev ? pctChange(flujo?.balance ?? 0, flujoPrev.balance) : null

  // Gráfico 1: ingresos vs gastos de los últimos 6 meses.
  const ejes6 = useMemo(() => {
    const now = new Date()
    const arr: { periodo: string; label: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      arr.push({
        periodo: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: MESES_SHORT[d.getMonth()] ?? '',
      })
    }
    return arr
  }, [])
  const desde6 = `${ejes6[0]?.periodo ?? fechaDesde.slice(0, 7)}-01`
  const flujo6 = useFinanzasFlujo({ desde: desde6, hasta: fechaHasta, agrupacion: 'mes', vista: 'devengado' })
  const ingresosGastos = useMemo(() => {
    const byPeriodo = new Map((flujo6.data?.serie ?? []).map((s) => [s.periodo, s]))
    return ejes6.map((e) => ({
      label: e.label,
      ingresos: byPeriodo.get(e.periodo)?.ingresos ?? 0,
      egresos: byPeriodo.get(e.periodo)?.egresos ?? 0,
    }))
  }, [flujo6.data, ejes6])

  // Gráfico 2: en qué gastas este mes (compras + gastos manuales), donut por categoría.
  const gastosMes = useTransacciones({ desde: fechaDesde, hasta: fechaHasta, vista: 'devengado', tipo: 'EGRESO', limit: 5000 })
  const gastosPorCat = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of gastosMes.data?.data ?? []) {
      // Las notas de crédito reducen ingreso, no son un gasto → fuera del donut
      // (así el total cuadra con el KPI "Gastos").
      if (t.origen === 'NOTA_CREDITO') continue
      const label =
        t.origen === 'MOVIMIENTO' ? (t.categoria ? CATEGORIA_LABELS[t.categoria] : 'Otros') : t.origen === 'COMPRA' ? 'Compras' : 'Otros'
      map.set(label, (map.get(label) ?? 0) + Math.abs(t.monto))
    }
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [gastosMes.data])

  const { cumplimiento, isLoading: complianceLoading } = useCumplimiento()

  // Alertas: solo lo accionable. Se omite la de "sin certificado" (esperada para
  // quien no factura fiscalmente); se conservan rechazos, cert por vencer y reportes.
  const alerts: { id: string; type: 'critical' | 'warning'; message: string; time: string; path: string }[] = []
  if (cumplimiento) {
    const { certificado, comprobantesConProblema, secuencias, reportesPendientes } = cumplimiento
    if (certificado.existe && certificado.vencido) {
      alerts.push({ id: 'cert-vencido', type: 'critical', message: 'Certificado digital vencido', time: 'Urgente', path: '/certificado-digital' })
    } else if (certificado.existe && certificado.diasRestantes !== null && certificado.diasRestantes <= 60) {
      alerts.push({
        id: 'cert-expira',
        type: certificado.diasRestantes <= 15 ? 'critical' : 'warning',
        message: `Certificado digital expira en ${certificado.diasRestantes} días`,
        time: 'Urgente',
        path: '/certificado-digital',
      })
    }
    if (comprobantesConProblema?.count > 0) {
      alerts.push({ id: 'rechazos', type: 'critical', message: `${comprobantesConProblema.count} factura(s) rechazada(s) por DGII`, time: 'Reciente', path: '/facturas?estado=RECHAZADO' })
    }
    secuencias?.forEach((s) => {
      if (s.porAgotarse) {
        alerts.push({ id: `sec-${s.tipoECF}`, type: 'warning', message: `Secuencia ${s.tipoECF} por vencer o agotarse`, time: 'Reciente', path: '/cumplimiento' })
      }
    })
    if (reportesPendientes?.pendientes?.length > 0) {
      alerts.push({ id: 'reportes-pendientes', type: 'warning', message: `Reportes pendientes: ${reportesPendientes.pendientes.join(', ')}`, time: 'Pendiente', path: '/cumplimiento' })
    }
  }

  const balancePositivo = (flujo?.balance ?? 0) >= 0

  return (
    <div className="flex flex-col gap-6 text-left">
      <DashboardHero
        periodoLabel={label}
        balance={flujo?.balance ?? 0}
        ingresos={flujo?.ingresos ?? 0}
        egresos={flujo?.egresos ?? 0}
        isLoading={flujoLoading}
      />

      {/* Alertas + Acciones rápidas — mismo tipo de card, misma fila, misma altura */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 items-stretch">
        {/* Alertas */}
        <div className="animate-fade-in-up h-full rounded-[20px] border border-neutral-200 bg-white shadow-sm p-4 sm:p-5 flex flex-col gap-4" style={{ animationDelay: '140ms' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-body-sm font-bold text-text-primary">Alertas</h3>
            {alerts.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-danger-50 text-[10px] font-bold text-danger-600">
                {alerts.length}
              </span>
            )}
          </div>
          <div className="flex flex-1 flex-col justify-center gap-2.5">
            {complianceLoading ? (
              <div className="flex items-center justify-center py-4">
                <Spinner size={16} />
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-5 text-center bg-green-50/20 border border-green-100/50 rounded-lg">
                <span className="text-[12px] font-semibold text-green-700">¡Todo al día!</span>
                <span className="text-[10px] text-green-600/70 font-medium mt-0.5">No hay alertas activas</span>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => router.push(alert.path)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    alert.type === 'critical'
                      ? 'bg-danger-50/50 border-danger-100/50 hover:bg-danger-50'
                      : 'bg-warning-50/50 border-warning-100/50 hover:bg-warning-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${
                      alert.type === 'critical' ? 'bg-danger-100 text-danger-600' : 'bg-warning-100 text-warning-600'
                    }`}>
                      {alert.type === 'critical' ? <AlertCircle size={15} /> : <AlertTriangle size={15} />}
                    </div>
                    <div className="flex flex-col text-left min-w-0">
                      <span className={`text-ui-xs font-semibold leading-tight truncate ${
                        alert.type === 'critical' ? 'text-danger-700' : 'text-warning-700'
                      }`}>
                        {alert.message}
                      </span>
                      <span className={`text-[10px] font-medium ${
                        alert.type === 'critical' ? 'text-danger-600/70' : 'text-warning-600/70'
                      }`}>
                        {alert.time}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className={alert.type === 'critical' ? 'text-danger-400 flex-shrink-0' : 'text-warning-400 flex-shrink-0'} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="animate-fade-in-up h-full rounded-[20px] border border-neutral-200 bg-white shadow-sm p-4 sm:p-5 flex flex-col gap-4" style={{ animationDelay: '200ms' }}>
          <h3 className="text-body-sm font-bold text-text-primary">Acciones rápidas</h3>
          <div className="grid flex-1 grid-cols-2 gap-2.5">
            {[
              { label: 'Crear factura', path: '/nueva-factura', icon: Plus, tone: 'bg-brand-50 text-brand-600' },
              { label: 'Crear cotización', path: '/cotizaciones/nueva', icon: FileSpreadsheet, tone: 'bg-ia-50 text-ia-500' },
              { label: 'Registrar movimiento', path: '/finanzas', icon: Wallet, tone: 'bg-success-50 text-success-600' },
              { label: 'Agregar contacto', path: '/contacto?new=true', icon: UserPlus, tone: 'bg-cta-50 text-cta-600' },
            ].map((action, i) => (
              <button
                key={action.path}
                type="button"
                onClick={() => router.push(action.path)}
                className="group animate-fade-in-up flex flex-col items-start justify-center gap-2.5 rounded-2xl border border-neutral-100 p-3.5 text-left transition-all duration-200 hover:border-brand-200 hover:bg-neutral-50/60 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]"
                style={{ animationDelay: `${260 + i * 50}ms` }}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${action.tone}`}>
                  <action.icon size={15} />
                </span>
                <span className="text-ui-xs font-semibold leading-tight text-text-primary">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Métricas reales del mes */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="animate-fade-in-up" style={{ animationDelay: '60ms' }}>
            <MetricCard
              title="Ingresos"
              value={flujoLoading ? '…' : formatCurrencyCompact(flujo?.ingresos ?? 0)}
              icon={TrendingUp}
              subtitle={`${label} · vs. mes anterior`}
              tone="success"
              badge={<TrendBadge delta={deltaIngresos} />}
            />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
            <MetricCard
              title="Gastos"
              value={flujoLoading ? '…' : formatCurrencyCompact(flujo?.egresos ?? 0)}
              icon={TrendingDown}
              subtitle={`${label} · vs. mes anterior`}
              tone="danger"
              badge={<TrendBadge delta={deltaEgresos} invertirBueno />}
            />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '180ms' }}>
            <MetricCard
              title="Balance"
              value={flujoLoading ? '…' : formatCurrencyCompact(flujo?.balance ?? 0)}
              icon={Scale}
              subtitle={balancePositivo ? 'Flujo positivo' : 'Flujo negativo'}
              tone="brand"
              badge={<TrendBadge delta={deltaBalance} />}
            />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '240ms' }}>
            <MetricCard
              title="Facturas emitidas"
              value={metricsLoading ? '…' : totalFacturadas}
              icon={FileText}
              subtitle={label}
              tone="neutral"
            />
          </div>
        </div>

        {/* Gráficas hero + Cumplimiento — misma fila, misma altura */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 items-stretch">
          <div className="animate-fade-in-up h-full" style={{ animationDelay: '260ms' }}>
            <IngresosGastosChart data={ingresosGastos} isLoading={flujo6.isLoading} />
          </div>
          <div className="animate-fade-in-up h-full" style={{ animationDelay: '320ms' }}>
            <GastosDonut data={gastosPorCat} isLoading={gastosMes.isLoading} periodo={label} />
          </div>
          <div className="animate-fade-in-up h-full" style={{ animationDelay: '380ms' }}>
            <Card className="h-full rounded-[20px] p-5 sm:p-6 flex flex-col gap-4 bg-white border border-neutral-200 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-body-base font-bold text-text-primary">Cumplimiento</h3>
                {cumplimiento && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    cumplimiento.indicadorGeneral === 'OK'
                      ? 'bg-success-50 text-success-700'
                      : cumplimiento.indicadorGeneral === 'WARN'
                      ? 'bg-warning-50 text-warning-700'
                      : 'bg-danger-50 text-danger-700'
                  }`}>
                    {cumplimiento.indicadorGeneral === 'OK' ? <ShieldCheck size={12} /> : cumplimiento.indicadorGeneral === 'WARN' ? <ShieldAlert size={12} /> : <ShieldX size={12} />}
                    {cumplimiento.indicadorGeneral === 'OK' ? 'Al día' : cumplimiento.indicadorGeneral === 'WARN' ? 'Revisar' : 'Urgente'}
                  </span>
                )}
              </div>

              {complianceLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <Spinner size={16} />
                </div>
              ) : cumplimiento ? (
                <div className="flex flex-1 flex-col justify-center gap-2.5">
                  <div className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2.5">
                    <span className="text-ui-xs font-medium text-text-secondary">Certificado digital</span>
                    <span className={`text-ui-xs font-bold ${cumplimiento.certificado.vencido ? 'text-danger-600' : cumplimiento.certificado.existe ? 'text-success-700' : 'text-text-tertiary'}`}>
                      {cumplimiento.certificado.vencido
                        ? 'Vencido'
                        : cumplimiento.certificado.existe
                        ? cumplimiento.certificado.diasRestantes !== null
                          ? `Vence en ${cumplimiento.certificado.diasRestantes}d`
                          : 'Vigente'
                        : 'Sin certificar'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2.5">
                    <span className="text-ui-xs font-medium text-text-secondary">Secuencias por agotarse</span>
                    <span className="text-ui-xs font-bold text-text-primary">{cumplimiento.secuencias.filter((s) => s.porAgotarse).length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2.5">
                    <span className="text-ui-xs font-medium text-text-secondary">Reportes pendientes</span>
                    <span className="text-ui-xs font-bold text-text-primary">{cumplimiento.reportesPendientes.pendientes.length}</span>
                  </div>
                  <Link href="/cumplimiento" className="mt-1 inline-flex items-center justify-center gap-1 rounded-lg border border-neutral-100 py-2 text-ui-xs font-semibold text-brand-600 transition-colors hover:border-brand-200 hover:bg-brand-50/50">
                    Ver detalle <ChevronRight size={13} />
                  </Link>
                </div>
              ) : (
                <p className="flex flex-1 items-center justify-center text-center text-ui-xs text-text-secondary">No hay datos de cumplimiento aún.</p>
              )}
            </Card>
          </div>
        </div>

        {/* Facturas recientes */}
        <div className="animate-fade-in-up rounded-[20px] border border-neutral-200 bg-white shadow-sm overflow-hidden" style={{ animationDelay: '380ms' }}>
          <div className="flex items-center justify-between border-b border-border-subtle p-4 sm:p-5 bg-white">
            <h2 className="text-body-base font-bold text-text-primary">Facturas recientes</h2>
            <Link href="/facturas" className="inline-flex items-center gap-1 text-ui-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors">
              Ver todas <ChevronRight size={14} />
            </Link>
          </div>

          {comprobantes.length === 0 && !tableLoading ? (
            <div className="flex flex-col items-center gap-4 p-12 text-center">
              <p className="text-body-base text-text-secondary">No has emitido facturas todavía</p>
              <Button variant="primary" onClick={() => router.push('/nueva-factura')}>
                Emitir primera factura
              </Button>
            </div>
          ) : (
            <FacturasTable
              facturas={comprobantes}
              isLoading={tableLoading}
              downloadingId={downloadingId}
              onDownload={handleDownload}
            />
          )}
        </div>
    </div>
  )
}
