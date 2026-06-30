'use client'

import type { JSX } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Banknote, Receipt, ChevronRight, AlertCircle, AlertTriangle } from 'lucide-react'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { StatusCardsRow } from '@/components/dashboard/StatusCardsRow'
import { FacturasTable } from '@/components/dashboard/FacturasTable'
import { Button } from '@/components/ui/button'
import { useDashboardComprobantes, useMonthMetrics } from '@/hooks/useComprobantes'
import { useCertificadoStatus } from '@/hooks/useCertificado'
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 items-start text-left">
      {/* Column 1: Main Operation Dashboard (Span 3 on large screens) */}
      <div className="lg:col-span-3 flex flex-col gap-6">
        {/* Status cards row */}
        <StatusCardsRow
          dgiiConectado={true}
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
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-danger-50 text-[10px] font-bold text-danger-600">
              4
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {/* Alerta 1 */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-danger-50/50 border border-danger-100/50 hover:bg-danger-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-danger-100 text-danger-600 flex-shrink-0">
                  <AlertCircle size={15} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-ui-xs font-semibold text-danger-700 leading-tight">
                    Certificado digital expira en 3 días
                  </span>
                  <span className="text-[10px] text-danger-600/70 font-medium">Hace 1h</span>
                </div>
              </div>
              <ChevronRight size={14} className="text-danger-400 flex-shrink-0" />
            </div>

            {/* Alerta 2 */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-danger-50/50 border border-danger-100/50 hover:bg-danger-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-danger-100 text-danger-600 flex-shrink-0">
                  <AlertCircle size={15} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-ui-xs font-semibold text-danger-700 leading-tight">
                    2 facturas rechazadas por DGII
                  </span>
                  <span className="text-[10px] text-danger-600/70 font-medium">Hace 2h</span>
                </div>
              </div>
              <ChevronRight size={14} className="text-danger-400 flex-shrink-0" />
            </div>

            {/* Alerta 3 */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-warning-50/50 border border-warning-100/50 hover:bg-warning-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning-100 text-warning-600 flex-shrink-0">
                  <AlertTriangle size={15} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-ui-xs font-semibold text-warning-700 leading-tight">
                    Fecha límite reporte mensual: 28 abril
                  </span>
                  <span className="text-[10px] text-warning-600/70 font-medium">Hace 5h</span>
                </div>
              </div>
              <ChevronRight size={14} className="text-warning-400 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Widget 2: Acciones Rápidas */}
        <div className="rounded-xl border border-border bg-white shadow-sm p-4 flex flex-col gap-4">
          <h3 className="text-body-sm font-bold text-text-primary">Acciones Rápidas</h3>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Factura de Crédito Fiscal (B01)', mode: 'estandar' },
              { label: 'Factura de Consumo (B02)', mode: 'estandar' },
              { label: 'Nota de Débito (B03)', mode: 'estandar' },
              { label: 'Factura Gubernamental (B14)', mode: 'estandar' },
            ].map((action, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => router.push('/nueva-factura')}
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
            {[
              { time: '14:32', msg: 'B0100000147 aceptada', color: 'bg-green-500' },
              { time: '14:30', msg: 'B0100000146 aceptada', color: 'bg-green-500' },
              { time: '13:45', msg: 'B0100000145 en proceso', color: 'bg-blue-500' },
              { time: '12:10', msg: 'B0100000144 rechazada', color: 'bg-red-500' },
            ].map((activity, idx) => (
              <div key={idx} className="flex items-center gap-3 relative">
                {/* Timeline dot */}
                <div className={`absolute -left-[13px] h-2 w-2 rounded-full ${activity.color} ring-4 ring-white`} />
                <span className="text-[10px] font-bold text-text-secondary leading-none">
                  {activity.time}
                </span>
                <span className="text-ui-xs font-semibold text-text-primary truncate leading-none">
                  {activity.msg}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
