'use client'

import type { JSX } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Banknote, Receipt } from 'lucide-react'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { StatusCardsRow } from '@/components/dashboard/StatusCardsRow'
import { FacturasTable } from '@/components/dashboard/FacturasTable'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/context/AuthContext'
import { useDashboardComprobantes, useMonthMetrics } from '@/hooks/useComprobantes'
import { useCertificadoStatus } from '@/hooks/useCertificado'
import { formatCurrencyCompact } from '@/lib/comprobantes'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function todayFormatted(): string {
  const text = new Intl.DateTimeFormat('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
  return text.charAt(0).toUpperCase() + text.slice(1)
}

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
  const { tenant } = useAuth()
  const { fechaDesde, fechaHasta } = monthRange()

  const { comprobantes, isLoading: tableLoading, downloadingId, handleDownload } =
    useDashboardComprobantes({ limit: 5 })

  const { totalFacturadas, montoTotal, itbisRecaudado, isLoading: metricsLoading } =
    useMonthMetrics({ fechaDesde, fechaHasta })

  const { diasParaVencer } = useCertificadoStatus()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h3 text-text-primary">
          {greeting()}
          {tenant ? `, ${tenant.razonSocial}` : ''}
        </h1>
        <p className="text-body-sm text-text-secondary">{todayFormatted()}</p>
      </div>

      {/* Status cards row */}
      <StatusCardsRow
        dgiiConectado={true}
        certDias={diasParaVencer}
        secuenciasActivas={['B01', 'B02', 'B14', 'B15']}
      />

      {/* Métricas del mes actual */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title="Total facturado"
          value={metricsLoading ? '…' : formatCurrencyCompact(montoTotal)}
          icon={Banknote}
        />
        <MetricCard
          title="Facturas emitidas"
          value={metricsLoading ? '…' : totalFacturadas}
          icon={FileText}
        />
        <MetricCard
          title="ITBIS recaudado"
          value={metricsLoading ? '…' : formatCurrencyCompact(itbisRecaudado)}
          icon={Receipt}
        />
      </div>

      {/* Facturas recientes */}
      <div className="rounded-xl border border-border bg-white">
        <div className="flex items-center justify-between border-b border-border-subtle p-4">
          <h2 className="text-h6 text-text-primary">Facturas recientes</h2>
          <Link
            href="/facturas"
            className="text-ui-sm text-brand-500 hover:text-brand-600 hover:underline"
          >
            Ver todas →
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
  )
}
