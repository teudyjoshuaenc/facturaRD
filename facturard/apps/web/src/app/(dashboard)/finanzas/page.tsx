'use client'

import { useMemo, useState, type JSX } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { FinanzasMetrics } from '@/components/finanzas/FinanzasMetrics'
import { FlujoChart } from '@/components/finanzas/FlujoChart'
import { CategoriasBreakdown } from '@/components/finanzas/CategoriasBreakdown'
import { CapitalCard } from '@/components/finanzas/CapitalCard'
import { MovimientosTable } from '@/components/finanzas/MovimientosTable'
import { MovimientoModal } from '@/components/finanzas/MovimientoModal'
import {
  useFinanzasResumen,
  useFinanzasFlujo,
  useFinanzasCategorias,
  useMovimientos,
  useEliminarMovimiento,
  type Vista,
  type MovimientoFinanciero,
  type MovimientoTipo,
} from '@/hooks/useFinanzas'

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
  { value: '', label: 'Todos los tipos' },
  { value: 'INGRESO', label: 'Ingresos' },
  { value: 'EGRESO', label: 'Egresos' },
]

export default function FinanzasPage(): JSX.Element {
  const now = new Date()
  const [vista, setVista] = useState<Vista>('devengado')
  const [year, setYear] = useState(String(now.getFullYear()))
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<MovimientoFinanciero | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MovimientoFinanciero | null>(null)

  const { monthDesde, monthHasta, yearDesde, yearHasta } = useMemo(() => {
    const lastDay = new Date(Number(year), Number(month), 0).getDate()
    return {
      monthDesde: `${year}-${month}-01`,
      monthHasta: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
      yearDesde: `${year}-01-01`,
      yearHasta: `${year}-12-31`,
    }
  }, [year, month])

  const resumen = useFinanzasResumen({ desde: monthDesde, hasta: monthHasta })
  const flujo = useFinanzasFlujo({ desde: yearDesde, hasta: yearHasta, agrupacion: 'mes', vista })
  const categorias = useFinanzasCategorias({ desde: monthDesde, hasta: monthHasta })
  const movimientos = useMovimientos({
    desde: monthDesde,
    hasta: monthHasta,
    ...(tipoFiltro ? { tipo: tipoFiltro as MovimientoTipo } : {}),
    limit: 100,
  })
  const eliminar = useEliminarMovimiento()

  const v = resumen.data?.[vista]
  const vistaLabel = vista === 'devengado' ? 'Devengado' : 'Cobrado'
  const periodoLabel = `${monthOptions.find((m) => m.value === month)?.label} ${year}`

  function nuevoMovimiento(): void {
    setEditTarget(null)
    setModalOpen(true)
  }
  function editarMovimiento(m: MovimientoFinanciero): void {
    setEditTarget(m)
    setModalOpen(true)
  }
  async function confirmarEliminar(): Promise<void> {
    if (!deleteTarget) return
    await eliminar.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h4 font-bold text-text-primary">Finanzas</h2>
          <p className="text-body-sm text-text-secondary">
            Flujo de caja del negocio: ingresos, egresos y capital.
          </p>
        </div>
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
      </div>

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

      {/* Movimientos + aside */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col text-left">
              <h3 className="text-body-base font-bold text-text-primary">Movimientos manuales</h3>
              <p className="text-ui-xs text-text-secondary font-medium">{periodoLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={tipoFiltro}
                onChange={setTipoFiltro}
                options={tipoOptions}
                className="w-40"
                triggerClassName="h-10 border-neutral-200 bg-white font-semibold text-text-primary hover:bg-neutral-50"
              />
              <Button variant="primary" onClick={nuevoMovimiento} className="h-10 shrink-0">
                <Plus size={16} />
                Registrar
              </Button>
            </div>
          </div>
          <MovimientosTable
            movimientos={movimientos.data?.data ?? []}
            isLoading={movimientos.isLoading}
            onEdit={editarMovimiento}
            onDelete={setDeleteTarget}
          />
        </div>

        <aside className="flex flex-col gap-6">
          <CapitalCard />
          <CategoriasBreakdown categorias={categorias.data?.categorias ?? []} isLoading={categorias.isLoading} />
        </aside>
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
          ¿Seguro que deseas eliminar este movimiento manual? No afecta ninguna factura ni reporte fiscal.
        </p>
      </Modal>
    </div>
  )
}
