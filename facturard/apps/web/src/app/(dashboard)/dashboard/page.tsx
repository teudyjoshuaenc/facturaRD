'use client'

import type { JSX } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, TrendingUp, TrendingDown, Scale, ChevronRight, AlertCircle, AlertTriangle } from 'lucide-react'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { FacturasTable } from '@/components/dashboard/FacturasTable'
import { Button } from '@/components/ui/button'
import { useDashboardComprobantes, useMonthMetrics, useCumplimiento } from '@/hooks/useComprobantes'
import { useFinanzasResumen } from '@/hooks/useFinanzas'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrencyCompact } from '@/lib/comprobantes'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 items-start text-left">
      {/* Columna principal (span 3) */}
      <div className="lg:col-span-3 flex flex-col gap-6 min-w-0">
        {/* Métricas reales del mes */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Ingresos"
            value={flujoLoading ? '…' : formatCurrencyCompact(flujo?.ingresos ?? 0)}
            icon={TrendingUp}
            subtitle={label}
          />
          <MetricCard
            title="Gastos"
            value={flujoLoading ? '…' : formatCurrencyCompact(flujo?.egresos ?? 0)}
            icon={TrendingDown}
            subtitle={label}
          />
          <MetricCard
            title="Balance"
            value={flujoLoading ? '…' : formatCurrencyCompact(flujo?.balance ?? 0)}
            icon={Scale}
            subtitle={balancePositivo ? 'Flujo positivo' : 'Flujo negativo'}
          />
          <MetricCard
            title="Facturas emitidas"
            value={metricsLoading ? '…' : totalFacturadas}
            icon={FileText}
            subtitle={label}
          />
        </div>

        {/* Facturas recientes */}
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle p-4 bg-white">
            <h2 className="text-body-base font-bold text-text-primary">Facturas recientes</h2>
            <Link href="/facturas" className="text-ui-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors">
              Ver todas
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

      {/* Sidebar (span 1) */}
      <div className="flex flex-col gap-6">
        {/* Alertas */}
        <div className="rounded-xl border border-border bg-white shadow-sm p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-body-sm font-bold text-text-primary">Alertas</h3>
            {alerts.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-danger-50 text-[10px] font-bold text-danger-600">
                {alerts.length}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2.5">
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
        <div className="rounded-xl border border-border bg-white shadow-sm p-4 flex flex-col gap-4">
          <h3 className="text-body-sm font-bold text-text-primary">Acciones rápidas</h3>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Crear factura', path: '/nueva-factura' },
              { label: 'Crear cotización', path: '/cotizaciones/nueva' },
              { label: 'Registrar movimiento', path: '/finanzas' },
              { label: 'Agregar contacto', path: '/contacto?new=true' },
            ].map((action, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => router.push(action.path)}
                className="w-full text-left px-3.5 py-2.5 border border-neutral-100 hover:border-brand-300 hover:bg-neutral-50/50 hover:text-brand-600 rounded-lg text-ui-sm font-semibold text-text-primary transition-all duration-200"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
