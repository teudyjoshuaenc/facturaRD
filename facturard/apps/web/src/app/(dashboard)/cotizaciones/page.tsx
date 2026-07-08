'use client'

import { useState, useMemo } from 'react'
import type { JSX } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Search,
  Plus,
  FileText,
  RotateCw,
  Download,
  Calendar,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  MoreHorizontal,
  XCircle,
  Eye,
  ArrowRight
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { RefreshActionButton, ExportActionButton } from '@/components/ui/table-actions'

const estadoOptions = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'ENVIADA', label: 'Enviada' },
  { value: 'ACEPTADA', label: 'Aceptada' },
  { value: 'RECHAZADA', label: 'Rechazada' },
  { value: 'VENCIDA', label: 'Vencida' },
]
import { formatCurrency, formatDate } from '@/lib/comprobantes'

type EstadoFilter = 'todos' | 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA'

interface Cotizacion {
  id: string
  numero: string
  cliente: string
  rnc: string
  fecha: string
  vencimiento: string
  monto: number
  estado: 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA'
}

const MOCK_COTIZACIONES: Cotizacion[] = [
  { id: 'cot-1', numero: 'COT-000001', cliente: 'Distribuidora López SRL', rnc: '130874562', fecha: '2026-07-01', vencimiento: '2026-07-31', monto: 125400.00, estado: 'ACEPTADA' },
  { id: 'cot-2', numero: 'COT-000002', cliente: 'Importadora Caribe', rnc: '131223445', fecha: '2026-07-02', vencimiento: '2026-08-02', monto: 85200.00, estado: 'ENVIADA' },
  { id: 'cot-3', numero: 'COT-000003', cliente: 'Comercial Díaz & Asoc.', rnc: '130982231', fecha: '2026-07-03', vencimiento: '2026-08-03', monto: 34000.00, estado: 'BORRADOR' },
  { id: 'cot-4', numero: 'COT-000004', cliente: 'Tech Solutions DO', rnc: '132984551', fecha: '2026-06-15', vencimiento: '2026-07-15', monto: 450000.00, estado: 'VENCIDA' },
  { id: 'cot-5', numero: 'COT-000005', cliente: 'Farmacia del Pueblo', rnc: '101020304', fecha: '2026-07-05', vencimiento: '2026-08-05', monto: 12500.00, estado: 'ENVIADA' },
  { id: 'cot-6', numero: 'COT-000006', cliente: 'Supermercado Nacional', rnc: '101882231', fecha: '2026-07-05', vencimiento: '2026-08-05', monto: 672000.00, estado: 'ACEPTADA' },
  { id: 'cot-7', numero: 'COT-000007', cliente: 'Inversiones Dominicanas', rnc: '130773341', fecha: '2026-07-06', vencimiento: '2026-08-06', monto: 93400.00, estado: 'RECHAZADA' },
]

export default function CotizacionesPage(): JSX.Element {
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get('search') || ''

  const [search, setSearch] = useState(initialSearch)
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('todos')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
    }, 500)
  }

  // Filtered list
  const filtered = useMemo(() => {
    let list = [...MOCK_COTIZACIONES]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.cliente.toLowerCase().includes(q) ||
          c.numero.toLowerCase().includes(q) ||
          c.rnc.includes(q)
      )
    }

    if (estadoFilter !== 'todos') {
      list = list.filter((c) => c.estado === estadoFilter)
    }

    if (startDate) {
      list = list.filter((c) => c.fecha >= startDate)
    }
    if (endDate) {
      list = list.filter((c) => c.fecha <= endDate)
    }

    return list
  }, [search, estadoFilter, startDate, endDate])

  // Pagination
  const paginated = useMemo(() => {
    const offset = (page - 1) * 10
    return filtered.slice(offset, offset + 10)
  }, [filtered, page])

  const totalPages = Math.ceil(filtered.length / 10) || 1

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalAmount = MOCK_COTIZACIONES.reduce((sum, c) => sum + c.monto, 0)
    const active = MOCK_COTIZACIONES.filter((c) => c.estado === 'ENVIADA' || c.estado === 'BORRADOR').length
    const accepted = MOCK_COTIZACIONES.filter((c) => c.estado === 'ACEPTADA').length
    const expired = MOCK_COTIZACIONES.filter((c) => c.estado === 'VENCIDA').length

    return { totalAmount, active, accepted, expired }
  }, [])

  return (
    <div className="flex flex-col gap-6 text-left w-full">
      {/* Header and CTA */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h4 font-semibold text-[#333] text-[24px]">Cotizaciones</h2>
          <p className="text-[14px] text-[#64748b] leading-[21px]">
            Gestiona presupuestos y conviértelos en comprobantes fiscales con un clic
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <RefreshActionButton
            onClick={handleRefresh}
            isLoading={isRefreshing}
            className="w-11 h-11 border-[#d0d5dd]"
          />

          {/* Export Button */}
          <ExportActionButton
            onClick={() => alert('Exportando cotizaciones...')}
            title="Exportar"
            className="h-11 border-[#d0d5dd]"
          />

          {/* Nueva Cotización Button */}
          <button
            onClick={() => alert('Nueva cotización (Próximamente)...')}
            className="bg-[#0379d5] hover:bg-[#0262ad] shadow-[0px_1px_1.5px_rgba(0,0,0,0.1),0px_1px_1px_rgba(0,0,0,0.1)] h-11 px-4 rounded-[10px] flex items-center gap-2.5 transition-colors"
          >
            <Plus size={16} className="text-white" />
            <span className="font-sans font-semibold text-[14px] text-white">
              Nueva cotización
            </span>
          </button>
        </div>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
        {/* Card 1 */}
        <Card className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider">Total Cotizado</span>
          <span className="text-[22px] font-bold text-text-primary">{formatCurrency(metrics.totalAmount)}</span>
          <span className="text-[11px] text-green-600 flex items-center gap-1 mt-1">
            <TrendingUp size={12} />
            +18.4% este mes
          </span>
        </Card>

        {/* Card 2 */}
        <Card className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider">Pendientes / Enviadas</span>
          <span className="text-[22px] font-bold text-text-primary">{metrics.active}</span>
          <span className="text-[11px] text-text-secondary mt-1">Esperando respuesta del cliente</span>
        </Card>

        {/* Card 3 */}
        <Card className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider">Aceptadas</span>
          <span className="text-[22px] font-bold text-[#067647]">{metrics.accepted}</span>
          <span className="text-[11px] text-green-600 mt-1">Listas para facturación electrónica</span>
        </Card>

        {/* Card 4 */}
        <Card className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider">Vencidas</span>
          <span className="text-[22px] font-bold text-danger-600">{metrics.expired}</span>
          <span className="text-[11px] text-danger-500 mt-1">Requieren seguimiento</span>
        </Card>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-[12px] items-center bg-white p-[17px] rounded-[14px] border border-[#e4e7ec] shadow-sm w-full font-sans justify-between">
        {/* Search Input */}
        <div className="relative border border-[#e2e8f0] bg-white rounded-[10px] h-[44px] flex items-center px-[12px] gap-[10px] flex-1 min-w-[280px]">
          <Search size={16} className="text-[#99a1af]" />
          <input
            type="text"
            placeholder="Buscar por cliente, RNC o folio..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="flex-1 font-['Open_Sans'] font-normal leading-[normal] text-text-primary text-[14px] placeholder-[#99a1af] bg-transparent focus:outline-none"
          />
        </div>

        {/* Estado Selector */}
        <Select
          value={estadoFilter}
          onChange={(val) => {
            setEstadoFilter(val as EstadoFilter)
            setPage(1)
          }}
          options={estadoOptions}
          className="w-[180px] shrink-0"
          triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden font-sans">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm min-w-[1000px]">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-neutral-50/50 text-[13px] font-semibold text-text-secondary h-10">
                <th className="px-4 py-2 font-semibold">Folio</th>
                <th className="px-4 py-2 font-semibold">Cliente</th>
                <th className="px-4 py-2 font-semibold">RNC / Cédula</th>
                <th className="px-4 py-2 font-semibold">Fecha Emisión</th>
                <th className="px-4 py-2 font-semibold">Vencimiento</th>
                <th className="px-4 py-2 font-semibold">Monto Total</th>
                <th className="px-4 py-2 font-semibold">Estado</th>
                <th className="px-4 py-2 font-semibold text-right pr-6">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => {
                const formattedRnc = c.rnc.length === 9
                  ? c.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
                  : c.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')

                return (
                  <tr
                    key={c.id}
                    className="border-b border-[#f1f5f9] last:border-0 hover:bg-neutral-50/30 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-bold text-brand-600 text-[13px]">
                      {c.numero}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-text-primary text-[13px]">
                      {c.cliente}
                    </td>
                    <td className="px-4 py-3.5 text-text-primary font-normal text-[12px] tracking-[1px]">
                      {formattedRnc}
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary text-[12px]">
                      {formatDate(c.fecha)}
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary text-[12px]">
                      {formatDate(c.vencimiento)}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-text-primary text-[13px]">
                      {formatCurrency(c.monto)}
                    </td>
                    <td className="px-4 py-3.5">
                      {c.estado === 'ACEPTADA' && (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
                          <CheckCircle2 size={12} />
                          Aceptada
                        </span>
                      )}
                      {c.estado === 'ENVIADA' && (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
                          <Clock size={12} />
                          Enviada
                        </span>
                      )}
                      {c.estado === 'BORRADOR' && (
                        <span className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-700 border border-neutral-200 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
                          <FileText size={12} />
                          Borrador
                        </span>
                      )}
                      {c.estado === 'RECHAZADA' && (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
                          <XCircle size={12} />
                          Rechazada
                        </span>
                      )}
                      {c.estado === 'VENCIDA' && (
                        <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
                          <AlertTriangle size={12} />
                          Vencida
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right pr-6">
                      <div className="flex items-center justify-end gap-2.5">
                        {c.estado === 'ACEPTADA' ? (
                          <button
                            type="button"
                            onClick={() => alert(`Facturando cotización ${c.numero}...`)}
                            className="text-[#0379d5] hover:text-[#0262ad] text-[12px] font-semibold flex items-center gap-1 transition-colors"
                            title="Facturar e-CF"
                          >
                            <span>Facturar</span>
                            <ArrowRight size={13} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => alert(`Viendo detalles de ${c.numero}`)}
                            className="text-text-secondary hover:text-brand-500 transition-colors"
                            title="Ver"
                          >
                            <Eye size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-text-secondary hover:text-[#0379d5] transition-colors"
                          title="Acciones"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-body-sm text-text-secondary">
                    No se encontraron cotizaciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3.5 bg-white">
          <p className="text-ui-sm text-text-secondary">{filtered.length} resultados</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-text-secondary hover:bg-neutral-50 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-ui-sm font-bold text-white shadow-sm">
              {page}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-text-secondary hover:bg-neutral-50 disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
