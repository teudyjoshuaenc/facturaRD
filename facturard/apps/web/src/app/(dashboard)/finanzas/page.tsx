'use client'

import { useEffect, useMemo, useState, type JSX } from 'react'
import { Plus, Download, TrendingUp, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { FinanzasMetrics } from '@/components/finanzas/FinanzasMetrics'
import { FlujoChart } from '@/components/finanzas/FlujoChart'
import { CategoriasBreakdown } from '@/components/finanzas/CategoriasBreakdown'
import { CapitalCard } from '@/components/finanzas/CapitalCard'
import { TransaccionesTable } from '@/components/finanzas/TransaccionesTable'
import { MovimientoModal } from '@/components/finanzas/MovimientoModal'
import { PresupuestoTab } from '@/components/presupuesto/PresupuestoTab'
import { ProyeccionTab } from '@/components/presupuesto/ProyeccionTab'
import { ConfiguracionPresupuestoTab } from '@/components/presupuesto/ConfiguracionPresupuestoTab'
import { PresupuestoOnboardingWizard } from '@/components/presupuesto/PresupuestoOnboardingWizard'
import { descargarTransaccionesCsv } from '@/lib/finanzas-export'
import {
  useFinanzasResumen,
  useFinanzasFlujo,
  useFinanzasCategorias,
  useMovimientos,
  useTransacciones,
  useEliminarMovimiento,
  useCapital,
  fetchTransaccionesExport,
  type Vista,
  type MovimientoFinanciero,
  type Transaccion,
  type TransaccionOrigen,
} from '@/hooks/useFinanzas'
import { usePresupuestoConfig, useComparacion } from '@/hooks/usePresupuesto'
import { useAuth } from '@/lib/context/AuthContext'
import { toast } from 'sonner'

type FinanzasTab = 'resumen' | 'presupuesto' | 'proyeccion' | 'configuracion'

const monthOptions = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]
const yearOptions = [
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
  { value: '2027', label: '2027' },
]
const tipoOptions = [
  { value: '', label: 'Todo' },
  { value: 'INGRESO', label: 'Ingresos' },
  { value: 'EGRESO', label: 'Egresos' },
]
const origenOptions = [
  { value: '', label: 'Todos los orígenes' },
  { value: 'FACTURA', label: 'Facturas' },
  { value: 'COMPRA', label: 'Compras' },
  { value: 'NOTA_VENTA', label: 'Notas de venta' },
  { value: 'NOTA_CREDITO', label: 'Notas de crédito' },
  { value: 'MOVIMIENTO', label: 'Manuales' },
]
const MES_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function FinanzasPage(): JSX.Element {
  const now = new Date()
  const [tab, setTab] = useState<FinanzasTab>('resumen')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [autoPrompted, setAutoPrompted] = useState(false)
  const presupuestoConfig = usePresupuestoConfig()
  const capital = useCapital()
  const { tenant } = useAuth()

  // Se persiste en localStorage (por tenant) — si el usuario cierra el wizard
  // sin terminar, NO vuelve a aparecer solo en la próxima visita/recarga.
  // Solo vuelve a abrirse con una acción explícita ("Configurar ahora" /
  // "Rehacer preguntas iniciales").
  const wizardDismissKey = `frd_presupuesto_wizard_dismissed_${tenant?.id ?? 'anon'}`

  // Primera visita al módulo con el presupuesto sin configurar → dispara el
  // wizard solo, sin esperar a que el usuario entre a la tab Presupuesto.
  useEffect(() => {
    if (autoPrompted || presupuestoConfig.isLoading || !presupuestoConfig.data) return
    setAutoPrompted(true)
    if (!presupuestoConfig.data.configurado && localStorage.getItem(wizardDismissKey) !== '1') {
      setWizardOpen(true)
    }
  }, [autoPrompted, presupuestoConfig.isLoading, presupuestoConfig.data, wizardDismissKey])

  function handleCloseWizard(): void {
    setWizardOpen(false)
    if (!presupuestoConfig.data?.configurado) localStorage.setItem(wizardDismissKey, '1')
  }
  const [vista, setVista] = useState<Vista>('devengado')
  const [year, setYear] = useState(String(now.getFullYear()))
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [origenFiltro, setOrigenFiltro] = useState('')
  const [txPage, setTxPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<MovimientoFinanciero | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MovimientoFinanciero | null>(null)
  const [exporting, setExporting] = useState(false)

  const { monthDesde, monthHasta, yearDesde, yearHasta } = useMemo(() => {
    const lastDay = new Date(Number(year), Number(month), 0).getDate()
    return {
      monthDesde: `${year}-${month}-01`,
      monthHasta: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
      yearDesde: `${year}-01-01`,
      yearHasta: `${year}-12-31`,
    }
  }, [year, month])

  // Reinicia la página del feed cuando cambian período, vista o filtros.
  useEffect(() => setTxPage(1), [month, year, vista, tipoFiltro, origenFiltro])

  const resumen = useFinanzasResumen({ desde: monthDesde, hasta: monthHasta })
  const comparacion = useComparacion(`${year}-${month}`, tab === 'resumen' && !!presupuestoConfig.data?.configurado)
  const flujo = useFinanzasFlujo({ desde: yearDesde, hasta: yearHasta, agrupacion: 'mes', vista })
  const categorias = useFinanzasCategorias({ desde: monthDesde, hasta: monthHasta })
  const movimientos = useMovimientos({ desde: monthDesde, hasta: monthHasta, limit: 100 })
  const transacciones = useTransacciones({
    desde: monthDesde,
    hasta: monthHasta,
    vista,
    page: txPage,
    limit: 15,
    ...(tipoFiltro ? { tipo: tipoFiltro as 'INGRESO' | 'EGRESO' } : {}),
    ...(origenFiltro ? { origen: origenFiltro as TransaccionOrigen } : {}),
  })
  const eliminar = useEliminarMovimiento()

  const v = resumen.data?.[vista]
  const vistaLabel = vista === 'devengado' ? 'Devengado' : 'Cobrado'
  const periodoLabel = `${monthOptions.find((m) => m.value === month)?.label} ${year}`
  const feed = transacciones.data

  // Resuelve el MovimientoFinanciero completo de una fila manual (para editar sin
  // perder metodoPago); si no está en la consulta, lo reconstruye de la fila.
  function toMovimiento(t: Transaccion): MovimientoFinanciero | null {
    if (!t.movimientoId) return null
    const full = movimientos.data?.data.find((m) => m.id === t.movimientoId)
    if (full) return full
    return {
      id: t.movimientoId,
      tenantId: '',
      tipo: t.monto >= 0 ? 'INGRESO' : 'EGRESO',
      categoria: t.categoria ?? 'OTROS',
      monto: Math.abs(t.monto),
      moneda: 'DOP',
      fecha: t.fecha,
      descripcion: t.descripcion,
      metodoPago: null,
      createdAt: t.fecha,
      updatedAt: t.fecha,
    }
  }

  function nuevoMovimiento(): void {
    setEditTarget(null)
    setModalOpen(true)
  }
  function editarTransaccion(t: Transaccion): void {
    setEditTarget(toMovimiento(t))
    setModalOpen(true)
  }
  async function confirmarEliminar(): Promise<void> {
    if (!deleteTarget) return
    await eliminar.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }
  async function exportar(): Promise<void> {
    setExporting(true)
    try {
      const rows = await fetchTransaccionesExport({
        desde: monthDesde,
        hasta: monthHasta,
        vista,
        ...(tipoFiltro ? { tipo: tipoFiltro as 'INGRESO' | 'EGRESO' } : {}),
        ...(origenFiltro ? { origen: origenFiltro as TransaccionOrigen } : {}),
      })
      if (rows.length === 0) {
        toast.info('No hay transacciones para exportar en este período')
        return
      }
      descargarTransaccionesCsv(rows, `finanzas-${year}-${month}.csv`)
      toast.success(`${rows.length} transacciones exportadas`)
    } catch {
      toast.error('No se pudo exportar')
    } finally {
      setExporting(false)
    }
  }

  if (!tenant?.finanzasHabilitado) {
    return (
      <>
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border-subtle bg-background-canvas p-12 text-center">
          <Wallet size={32} className="text-text-tertiary" />
          <div className="flex flex-col gap-1">
            <h2 className="text-h5 font-bold text-text-primary">Finanzas no está activado</h2>
            <p className="max-w-md text-body-sm text-text-secondary">
              Responde unas preguntas sobre tu capital y presupuesto para activar tu panel financiero.
            </p>
          </div>
          <Button variant="primary" onClick={() => setWizardOpen(true)}>Activar mi flujo de caja</Button>
        </div>

        <PresupuestoOnboardingWizard
          open={wizardOpen}
          onClose={handleCloseWizard}
          config={presupuestoConfig.data}
          saldoActual={capital.data ? Number(capital.data.monto) : 0}
        />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 pb-5">
        {tab === 'presupuesto' || tab === 'proyeccion' ? (
          <div className="flex flex-col gap-1">
            <h2 className="text-h4 font-bold text-text-primary">{tenant?.razonSocial ?? 'Mi empresa'}</h2>
            <p className="text-body-sm text-text-secondary">
              {presupuestoConfig.data?.sector ?? 'Sin sector'} · Ejercicio desde {MES_LABELS[presupuestoConfig.data?.mesFiscalInicio ?? 0]} · Moneda {presupuestoConfig.data?.moneda ?? 'DOP'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <h2 className="text-h4 font-bold text-text-primary">Finanzas</h2>
            <p className="text-body-sm text-text-secondary">Flujo de caja del negocio: ingresos, egresos y capital.</p>
          </div>
        )}
        {(tab === 'presupuesto' || tab === 'proyeccion') && (
          <Button variant="secondary" onClick={() => setTab('configuracion')} className="gap-1.5">
            ⚙ Configuración
          </Button>
        )}
        {tab === 'resumen' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[210px]">
              <ToggleGroup<Vista>
                value={vista}
                onChange={setVista}
                options={[
                  { value: 'devengado', label: 'Devengado' },
                  { value: 'cobrado', label: 'Cobrado' },
                ]}
              />
            </div>
            <Select
              value={month}
              onChange={setMonth}
              options={monthOptions}
              className="w-36"
              triggerClassName="h-10 border-neutral-200 bg-white font-semibold text-text-primary hover:bg-neutral-50"
            />
            <Select
              value={year}
              onChange={setYear}
              options={yearOptions}
              className="w-24"
              triggerClassName="h-10 border-neutral-200 bg-white font-semibold text-text-primary hover:bg-neutral-50"
            />
          </div>
        )}
      </div>

      {/* Tabs de sección */}
      <div className="w-full max-w-[560px]">
        <ToggleGroup<FinanzasTab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'resumen', label: 'Resumen' },
            { value: 'presupuesto', label: 'Presupuesto' },
            { value: 'proyeccion', label: 'Proyección' },
            { value: 'configuracion', label: 'Configuración' },
          ]}
        />
      </div>

      {tab === 'resumen' && (
      <>
      {/* KPIs */}
      <FinanzasMetrics
        ingresos={v?.ingresos ?? 0}
        egresos={v?.egresos ?? 0}
        balance={v?.balance ?? 0}
        capitalAcumulado={v?.capitalAcumulado ?? 0}
        vistaLabel={vistaLabel}
      />

      {/* Flujo (año completo) */}
      <FlujoChart serie={flujo.data?.serie ?? []} isLoading={flujo.isLoading} vistaLabel={vistaLabel} />

      {/* Capital + categorías: fila propia, para dejar la tabla a ancho completo.
          Flujo top-down: números (KPIs) → tendencia (gráfico) → desglose (capital/
          categorías) → detalle (transacciones). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CapitalCard />
        <div className="lg:col-span-2">
          <CategoriasBreakdown categorias={categorias.data?.categorias ?? []} isLoading={categorias.isLoading} />
        </div>
      </div>

      {/* Real vs. presupuesto — solo si el tenant ya configuró su presupuesto. */}
      {presupuestoConfig.data?.configurado && comparacion.data && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-body-base font-bold text-text-primary">Real vs. presupuesto</h3>
          <p className="mb-4 text-ui-xs text-text-secondary">{periodoLabel}</p>
          <div className="flex flex-col gap-3">
            {[
              ['Entradas · presup.', comparacion.data.presupuestado.ingresos, 'bg-success-300'],
              ['Entradas · real', comparacion.data.real.ingresos, 'bg-success-600'],
              ['Salidas · presup.', comparacion.data.presupuestado.egresos, 'bg-cta-500/50'],
              ['Salidas · real', comparacion.data.real.egresos, 'bg-cta-600'],
            ].map(([label, valor, color]) => {
              const max = Math.max(
                comparacion.data!.presupuestado.ingresos,
                comparacion.data!.real.ingresos,
                comparacion.data!.presupuestado.egresos,
                comparacion.data!.real.egresos,
                1,
              )
              const v = Number(valor)
              return (
                <div key={label as string} className="grid grid-cols-[140px_1fr_110px] items-center gap-3 text-body-sm">
                  <span className="text-text-secondary">{label as string}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                    <span className={`block h-full rounded-full ${color as string}`} style={{ width: `${(v / max) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold text-text-primary">
                    {'RD$ ' + Math.round(v).toLocaleString('es-DO')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Transacciones — ancho completo (ya no comparte fila con el aside, así el
          "Origen" no se colapsa cuando el "Detalle" es largo). */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col text-left">
              <h3 className="text-body-base font-bold text-text-primary">Transacciones</h3>
              <p className="text-ui-xs text-text-secondary font-medium">
                {periodoLabel} · {vistaLabel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={tipoFiltro}
                onChange={setTipoFiltro}
                options={tipoOptions}
                className="w-28"
                triggerClassName="h-10 border-neutral-200 bg-white font-semibold text-text-primary hover:bg-neutral-50"
              />
              <Select
                value={origenFiltro}
                onChange={setOrigenFiltro}
                options={origenOptions}
                className="w-44"
                triggerClassName="h-10 border-neutral-200 bg-white font-semibold text-text-primary hover:bg-neutral-50"
              />
              <Button
                variant="secondary"
                onClick={exportar}
                disabled={exporting}
                className="h-10 shrink-0"
                title="Exportar a Excel (CSV)"
              >
                <Download size={16} />
                {exporting ? 'Exportando…' : 'Exportar'}
              </Button>
              <Button variant="primary" onClick={nuevoMovimiento} className="h-10 shrink-0">
                <Plus size={16} />
                Registrar
              </Button>
            </div>
          </div>

          <TransaccionesTable
            transacciones={feed?.data ?? []}
            isLoading={transacciones.isLoading}
            onEdit={editarTransaccion}
            onDelete={(t) => setDeleteTarget(toMovimiento(t))}
          />

          {/* Paginación */}
          {feed && feed.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-ui-xs text-text-secondary">
                {feed.total} transacciones · página {feed.page} de {feed.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={txPage <= 1}
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={txPage >= feed.totalPages}
                  onClick={() => setTxPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <MovimientoModal open={modalOpen} onClose={() => setModalOpen(false)} movimiento={editTarget} />

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar movimiento"
        subtitle="Esta acción no se puede deshacer"
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarEliminar} disabled={eliminar.isPending}>
              {eliminar.isPending ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </div>
        }
      >
        <p className="text-body-sm text-text-secondary">
          ¿Seguro que deseas eliminar este movimiento manual? Solo se pueden eliminar movimientos manuales; las
          facturas y compras no se tocan.
        </p>
      </Modal>
      </>
      )}

      {(tab === 'presupuesto' || tab === 'proyeccion') && !presupuestoConfig.isLoading && presupuestoConfig.data && !presupuestoConfig.data.configurado ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <TrendingUp size={22} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-h6 font-bold text-text-primary">Aún no configuraste tu presupuesto</p>
            <p className="max-w-[420px] text-body-sm text-text-secondary">
              Respondé unas preguntas rápidas sobre tus ingresos, costos fijos y colchón de seguridad, y armamos tu
              proyección de caja a 12 meses.
            </p>
          </div>
          <Button variant="primary" onClick={() => setWizardOpen(true)}>Configurar ahora</Button>
        </div>
      ) : (
        <>
          {tab === 'presupuesto' && <PresupuestoTab />}
          {tab === 'proyeccion' && <ProyeccionTab />}
        </>
      )}

      {tab === 'configuracion' && (
        <ConfiguracionPresupuestoTab onEditarEntradas={() => setTab('presupuesto')} onRehacer={() => setWizardOpen(true)} />
      )}

      <PresupuestoOnboardingWizard
        open={wizardOpen}
        onClose={handleCloseWizard}
        config={presupuestoConfig.data}
        saldoActual={capital.data ? Number(capital.data.monto) : 0}
      />
    </div>
  )
}
