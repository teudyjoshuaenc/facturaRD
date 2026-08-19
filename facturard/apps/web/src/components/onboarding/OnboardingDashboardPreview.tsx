'use client'

import type { JSX } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { FileText, TrendingUp, TrendingDown, Scale, ChevronRight, ShieldCheck } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/card'
import { DashboardHero } from '@/components/dashboard/DashboardHero'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { IngresosGastosChart } from '@/components/dashboard/IngresosGastosChart'
import { GastosDonut } from '@/components/dashboard/GastosDonut'
import { FacturasTable } from '@/components/dashboard/FacturasTable'
import { useMounted } from '@/hooks/useMounted'
import { formatCurrencyCompact, type Comprobante } from '@/lib/comprobantes'
import type { TenantInfo } from '@/lib/session'

// Copia visual del Dashboard real (mismo sidebar/topbar/tarjetas/gráficos,
// mismos componentes) con data 100% inventada — esta pantalla NUNCA pega a la
// API. Solo existe para que el onboarding se sienta "ya dentro de la app"
// mientras el usuario responde el wizard de presupuesto. El blur/oscurecido lo
// pone el propio backdrop del Modal (backdrop-blur-sm). pointer-events-none en
// el contenedor raíz bloquea cualquier click real sobre el sidebar/topbar/links
// (que en el dashboard real sí navegan).

const MOCK_TENANT: TenantInfo = {
  rnc: '132000000',
  razonSocial: 'Mi Empresa SRL',
  plan: 'PYME',
  finanzasHabilitado: true,
}

const MOCK_INGRESOS_GASTOS = [
  { label: 'Feb', ingresos: 312000, egresos: 198000 },
  { label: 'Mar', ingresos: 356000, egresos: 210000 },
  { label: 'Abr', ingresos: 298000, egresos: 205000 },
  { label: 'May', ingresos: 401000, egresos: 224000 },
  { label: 'Jun', ingresos: 389000, egresos: 216000 },
  { label: 'Jul', ingresos: 458000, egresos: 212000 },
]

const MOCK_GASTOS_DONUT = [
  { label: 'Nómina', value: 128000 },
  { label: 'Compras', value: 52000 },
  { label: 'Alquiler', value: 45000 },
  { label: 'Servicios', value: 18500 },
  { label: 'Otros', value: 20500 },
]

const MOCK_FACTURAS: Comprobante[] = [
  { id: 'f1', tenantId: 't1', eNCF: 'E310000000041', tipoECF: 'E31', estado: 'ACEPTADO', montoTotal: 68000, rnc: '132883225', razonSocial: 'Servicios Alfa SRL', pdfUrl: null, trackId: null, mensajeDGII: null, createdAt: '2026-07-24', updatedAt: '2026-07-24' },
  { id: 'f2', tenantId: 't1', eNCF: 'E310000000040', tipoECF: 'E31', estado: 'ACEPTADO', montoTotal: 35000, rnc: '101234567', razonSocial: 'Comercial Beta EIRL', pdfUrl: null, trackId: null, mensajeDGII: null, createdAt: '2026-07-22', updatedAt: '2026-07-22' },
  { id: 'f3', tenantId: 't1', eNCF: 'E320000000039', tipoECF: 'E32', estado: 'ACEPTADO', montoTotal: 124500, rnc: '', razonSocial: 'Consumidor final', pdfUrl: null, trackId: null, mensajeDGII: null, createdAt: '2026-07-20', updatedAt: '2026-07-20' },
  { id: 'f4', tenantId: 't1', eNCF: 'E310000000038', tipoECF: 'E31', estado: 'ENVIANDO', montoTotal: 12800, rnc: '132445566', razonSocial: 'Gamma Distribuidora SA', pdfUrl: null, trackId: null, mensajeDGII: null, createdAt: '2026-07-18', updatedAt: '2026-07-18' },
  { id: 'f5', tenantId: 't1', eNCF: 'E310000000037', tipoECF: 'E31', estado: 'ACEPTADO', montoTotal: 98000, rnc: '130998877', razonSocial: 'Delta Consultores SRL', pdfUrl: null, trackId: null, mensajeDGII: null, createdAt: '2026-07-15', updatedAt: '2026-07-15' },
]

function noop(): void {}

export function OnboardingDashboardPreview(): JSX.Element | null {
  // Portal a document.body, y solo tras montar en cliente: portalear durante
  // el propio render de hidratación choca con el root de Next (hydration
  // mismatch). Ver useMounted.
  const mounted = useMounted()
  if (!mounted) return null

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-10 flex h-screen w-screen select-none overflow-hidden flex-col bg-background-canvas md:flex-row"
    >
      <MobileHeader onMenuOpen={noop} tenant={MOCK_TENANT} />
      <Sidebar tenant={MOCK_TENANT} activeRoute="/dashboard" />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar pageTitle="Tablero" pageSubtitle={`${MOCK_TENANT.razonSocial} · RNC ${MOCK_TENANT.rnc}`} certDias={312} dgiiConectado />

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 flex justify-center items-start">
          <div className="w-full max-w-[1400px] flex flex-col gap-6 text-left mx-auto">
            <DashboardHero periodoLabel="Julio 2026" balance={246000} ingresos={458000} egresos={212000} />

            {/* Alertas + Acciones rápidas */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 items-stretch">
              <div className="h-full rounded-[20px] border border-neutral-200 bg-white shadow-sm p-4 sm:p-5 flex flex-col gap-4">
                <h3 className="text-body-sm font-bold text-text-primary">Alertas</h3>
                <div className="flex flex-1 flex-col justify-center gap-2.5">
                  <div className="flex flex-col items-center justify-center py-5 text-center bg-green-50/20 border border-green-100/50 rounded-lg">
                    <span className="text-[12px] font-semibold text-green-700">¡Todo al día!</span>
                    <span className="text-[10px] text-green-600/70 font-medium mt-0.5">No hay alertas activas</span>
                  </div>
                </div>
              </div>

              <div className="h-full rounded-[20px] border border-neutral-200 bg-white shadow-sm p-4 sm:p-5 flex flex-col gap-4">
                <h3 className="text-body-sm font-bold text-text-primary">Acciones rápidas</h3>
                <div className="grid flex-1 grid-cols-2 gap-2.5">
                  {[
                    { label: 'Crear factura', icon: FileText, tone: 'bg-brand-50 text-brand-600' },
                    { label: 'Crear cotización', icon: Scale, tone: 'bg-ia-50 text-ia-500' },
                    { label: 'Registrar movimiento', icon: TrendingUp, tone: 'bg-success-50 text-success-600' },
                    { label: 'Agregar contacto', icon: TrendingDown, tone: 'bg-cta-50 text-cta-600' },
                  ].map((action) => (
                    <div key={action.label} className="flex flex-col items-start justify-center gap-2.5 rounded-2xl border border-neutral-100 p-3.5 text-left">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${action.tone}`}>
                        <action.icon size={15} />
                      </span>
                      <span className="text-ui-xs font-semibold leading-tight text-text-primary">{action.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Métricas del mes */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="Ingresos" value={formatCurrencyCompact(458000)} icon={TrendingUp} subtitle="Julio 2026 · vs. mes anterior" tone="success" />
              <MetricCard title="Egresos" value={formatCurrencyCompact(212000)} icon={TrendingDown} subtitle="Julio 2026 · vs. mes anterior" tone="danger" />
              <MetricCard title="Balance" value={formatCurrencyCompact(246000)} icon={Scale} subtitle="Flujo positivo" tone="brand" />
              <MetricCard title="Facturas emitidas" value={41} icon={FileText} subtitle="Julio 2026" tone="neutral" />
            </div>

            {/* Gráficas + Cumplimiento */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 items-stretch">
              <IngresosGastosChart data={MOCK_INGRESOS_GASTOS} />
              <GastosDonut data={MOCK_GASTOS_DONUT} periodo="Julio 2026" />
              <Card className="h-full rounded-[20px] p-5 sm:p-6 flex flex-col gap-4 bg-white border border-neutral-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-body-base font-bold text-text-primary">Cumplimiento</h3>
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold bg-success-50 text-success-700">
                    <ShieldCheck size={12} /> Al día
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-center gap-2.5">
                  <div className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2.5">
                    <span className="text-ui-xs font-medium text-text-secondary">Certificado digital</span>
                    <span className="text-ui-xs font-bold text-success-700">Vence en 312d</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2.5">
                    <span className="text-ui-xs font-medium text-text-secondary">Secuencias por agotarse</span>
                    <span className="text-ui-xs font-bold text-text-primary">0</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2.5">
                    <span className="text-ui-xs font-medium text-text-secondary">Reportes pendientes</span>
                    <span className="text-ui-xs font-bold text-text-primary">0</span>
                  </div>
                  <Link href="/cumplimiento" className="mt-1 inline-flex items-center justify-center gap-1 rounded-lg border border-neutral-100 py-2 text-ui-xs font-semibold text-brand-600">
                    Ver detalle <ChevronRight size={13} />
                  </Link>
                </div>
              </Card>
            </div>

            {/* Facturas recientes */}
            <div className="rounded-[20px] border border-neutral-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-border-subtle p-4 sm:p-5 bg-white">
                <h2 className="text-body-base font-bold text-text-primary">Facturas recientes</h2>
                <Link href="/facturas" className="inline-flex items-center gap-1 text-ui-sm font-semibold text-brand-500">
                  Ver todas <ChevronRight size={14} />
                </Link>
              </div>
              <FacturasTable facturas={MOCK_FACTURAS} isLoading={false} downloadingId={null} onDownload={noop} />
            </div>
          </div>
        </main>
      </div>
    </div>,
    document.body,
  )
}
