'use client'

import type { JSX } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Banknote, Receipt, ChevronRight, AlertCircle, AlertTriangle } from 'lucide-react'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { StatusCardsRow } from '@/components/dashboard/StatusCardsRow'
import { FacturasTable } from '@/components/dashboard/FacturasTable'
import { Button } from '@/components/ui/button'
import { useDashboardComprobantes, useMonthMetrics, useCumplimiento } from '@/hooks/useComprobantes'
import { useCertificadoStatus } from '@/hooks/useCertificado'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrencyCompact } from '@/lib/comprobantes'

function monthRange(): { fechaDesde: string; fechaHasta: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return {
    fechaDesde: `${y}-${m}-01`,
    fechaHasta: `${y}-${m}-${d}`,
  }
}

export default function DashboardPage(): JSX.Element {
  const router = useRouter()
  const { fechaDesde, fechaHasta } = monthRange()

  const { comprobantes, isLoading: tableLoading, downloadingId, handleDownload } =
    useDashboardComprobantes({ limit: 10 })

  const { totalFacturadas, montoTotal, itbisRecaudado, isLoading: metricsLoading } =
    useMonthMetrics({ fechaDesde, fechaHasta })

  const { diasParaVencer } = useCertificadoStatus()

  const { cumplimiento, isLoading: complianceLoading } = useCumplimiento()

  // Dynamic alerts
  const alerts = []
  if (cumplimiento) {
    const { certificado, comprobantesConProblema, secuencias, reportesPendientes } = cumplimiento
    if (!certificado.existe) {
      alerts.push({
        id: 'no-cert',
        type: 'critical',
        message: 'No se ha cargado un certificado digital activo',
        time: 'Urgente',
        path: '/certificado-digital',
      })
    } else if (certificado.vencido) {
      alerts.push({
        id: 'cert-vencido',
        type: 'critical',
        message: 'Certificado digital vencido',
        time: 'Urgente',
        path: '/certificado-digital',
      })
    } else if (certificado.diasRestantes !== null && certificado.diasRestantes <= 60) {
      alerts.push({
        id: 'cert-expira',
        type: certificado.diasRestantes <= 15 ? 'critical' : 'warning',
        message: `Certificado digital expira en ${certificado.diasRestantes} días`,
        time: 'Urgente',
        path: '/certificado-digital',
      })
    }

    if (comprobantesConProblema?.count > 0) {
      alerts.push({
        id: 'rechazos',
        type: 'critical',
        message: `${comprobantesConProblema.count} factura(s) rechazada(s) por DGII`,
        time: 'Reciente',
        path: '/facturas?estado=RECHAZADO',
      })
    }

    secuencias?.forEach((s) => {
      if (s.porAgotarse) {
        alerts.push({
          id: `sec-${s.tipoECF}`,
          type: 'warning',
          message: `Secuencia ${s.tipoECF} por vencer o agotarse`,
          time: 'Reciente',
          path: '/cumplimiento',
        })
      }
    })

    if (reportesPendientes?.pendientes?.length > 0) {
      alerts.push({
        id: 'reportes-pendientes',
        type: 'warning',
        message: `Reportes pendientes del período: ${reportesPendientes.pendientes.join(', ')}`,
        time: 'Pendiente',
        path: '/cumplimiento',
      })
    }
  }

  // Dynamic DGII activities
  const activities = comprobantes.slice(0, 5).map((c) => {
    let color = 'bg-blue-500'
    let statusText = 'en proceso'

    if (c.estado === 'ACEPTADO') {
      color = 'bg-green-500'
      statusText = 'aceptada'
    } else if (c.estado === 'ACEPTADO_CONDICIONAL') {
      color = 'bg-warning-500'
      statusText = 'aceptada c/obs'
    } else if (c.estado === 'RECHAZADO') {
      color = 'bg-red-500'
      statusText = 'rechazada'
    }

    const date = new Date(c.createdAt)
    const time = isNaN(date.getTime())
      ? '—:—'
      : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

    return {
      id: c.id,
      time,
      msg: `${c.eNCF || 'e-CF'} ${statusText}`,
      color,
    }
  })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 items-start text-left">
      {/* Column 1: Main Operation Dashboard (Span 3 on large screens) */}
      <div className="lg:col-span-3 flex flex-col gap-6 min-w-0">
        {/* Status cards row */}
        <StatusCardsRow
          dgiiConectado={diasParaVencer !== null}
          certDias={diasParaVencer}
          secuenciasActivas={['B01', 'B02', 'B14', 'B15']}
        />

        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            title="Total facturado"
            value={metricsLoading ? '…' : formatCurrencyCompact(montoTotal)}
            icon={Banknote}
            subtitle="Abril 2026"
          />
          <MetricCard
            title="Facturas emitidas"
            value={metricsLoading ? '…' : totalFacturadas}
            icon={FileText}
            subtitle="Abril 2026"
          />
          <MetricCard
            title="ITBIS recaudado"
            value={metricsLoading ? '…' : formatCurrencyCompact(itbisRecaudado)}
            icon={Receipt}
            subtitle="18% promedio"
          />
        </div>

        {/* Facturas recientes list block */}
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle p-4 bg-white">
            <h2 className="text-body-base font-bold text-text-primary">Facturas Recientes</h2>
            <Link
              href="/facturas"
              className="text-ui-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors"
            >
              Ver todas
            </Link>
          </div>

          {comprobantes.length === 0 && !tableLoading ? (
            <div className="flex flex-col items-center gap-4 p-12 text-center">
              <p className="text-body-base text-text-secondary">
                No has emitido facturas todavía
              </p>
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

      {/* Column 2: Dashboard Sidebar Widgets (Span 1 on large screens) */}
      <div className="flex flex-col gap-6">
        {/* Widget 1: Alertas */}
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
                <span className="text-[10px] text-green-600/70 font-medium mt-0.5">No hay alertas fiscales activas</span>
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

        {/* Widget 2: Acciones Rápidas */}
        <div className="rounded-xl border border-border bg-white shadow-sm p-4 flex flex-col gap-4">
          <h3 className="text-body-sm font-bold text-text-primary">Acciones Rápidas</h3>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Crear factura', path: '/nueva-factura' },
              { label: 'Crear cotización', path: '/cotizaciones/nueva' },
              { label: 'Agregar contacto', path: '/contacto?new=true' },
              { label: 'Agregar producto', path: '/producto?new=true' },
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

        {/* Widget 3: Actividad DGII */}
        <div className="rounded-xl border border-border bg-white shadow-sm p-4 flex flex-col gap-4">
          <h3 className="text-body-sm font-bold text-text-primary">Actividad DGII</h3>
          <div className="flex flex-col gap-3.5 pl-2 relative border-l border-neutral-100 ml-1">
            {tableLoading ? (
              <div className="flex items-center justify-center py-4">
                <Spinner size={16} />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-[11px] text-text-secondary italic pl-1">
                No hay actividad reciente
              </div>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 relative">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[13px] h-2 w-2 rounded-full ${activity.color} ring-4 ring-white`} />
                  <span className="text-[10px] font-bold text-text-secondary leading-none">
                    {activity.time}
                  </span>
                  <span className="text-ui-xs font-semibold text-text-primary truncate leading-none">
                    {activity.msg}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
