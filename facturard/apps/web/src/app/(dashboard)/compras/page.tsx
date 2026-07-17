'use client'

import { useState, useMemo, useRef } from 'react'
import type { JSX } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Search,
  Plus,
  FileCheck,
  RotateCw,
  Download,
  Calendar,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingDown,
  MoreHorizontal,
  XCircle,
  Eye,
  Check,
  FileText
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { EditActionButton, RefreshActionButton, ExportActionButton } from '@/components/ui/table-actions'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const tipoGastoOptions = [
  { value: 'todos', label: 'Tipo de gasto' },
  { value: 'RECEPCION_DGII', label: 'e-CF Recibido (DGII)' },
  { value: 'GASTO_MENOR', label: 'Gasto Menor' },
  { value: 'SIN_COMPROBANTE', label: 'Sin Comprobante' },
]

const estadoAprobacionOptions = [
  { value: 'todos', label: 'Estado Aprobación' },
  { value: 'APROBADO_COMERCIAL', label: 'Aprobado Comercial' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'RECHAZADO', label: 'Rechazado' },
]
import { formatCurrency, formatDate } from '@/lib/comprobantes'

type EstadoAprobacion = 'todos' | 'APROBADO_COMERCIAL' | 'PENDIENTE' | 'RECHAZADO'
type TipoCompra = 'todos' | 'RECEPCION_DGII' | 'GASTO_MENOR' | 'SIN_COMPROBANTE'

interface Compra {
  id: string
  ncf: string
  proveedor: string
  rnc: string
  fecha: string
  monto: number
  tipo: 'RECEPCION_DGII' | 'GASTO_MENOR' | 'SIN_COMPROBANTE'
  estado: 'APROBADO_COMERCIAL' | 'PENDIENTE' | 'RECHAZADO'
}

const MOCK_COMPRAS: Compra[] = [
  { id: 'cmp-1', ncf: 'E410000001024', proveedor: 'Claro Dominicana', rnc: '101014234', fecha: '2026-07-01', monto: 15400.00, tipo: 'RECEPCION_DGII', estado: 'APROBADO_COMERCIAL' },
  { id: 'cmp-2', ncf: 'E410000005411', proveedor: 'EDESUR Dominicana', rnc: '101824332', fecha: '2026-07-02', monto: 23150.00, tipo: 'RECEPCION_DGII', estado: 'PENDIENTE' },
  { id: 'cmp-3', ncf: 'GASTO-000214', proveedor: 'Suministros Oficina El Sol', rnc: '130874562', fecha: '2026-07-03', monto: 4500.00, tipo: 'GASTO_MENOR', estado: 'APROBADO_COMERCIAL' },
  { id: 'cmp-4', ncf: 'E410000009871', proveedor: 'Papelería Dominicana', rnc: '101742991', fecha: '2026-06-25', monto: 12800.00, tipo: 'RECEPCION_DGII', estado: 'RECHAZADO' },
  { id: 'cmp-5', ncf: 'INTERNO-0092', proveedor: 'Mensajería Express del Caribe', rnc: '102941121', fecha: '2026-07-04', monto: 1800.00, tipo: 'SIN_COMPROBANTE', estado: 'APROBADO_COMERCIAL' },
  { id: 'cmp-6', ncf: 'E410000001103', proveedor: 'Ferretería Americana', rnc: '101024511', fecha: '2026-07-05', monto: 87500.00, tipo: 'RECEPCION_DGII', estado: 'PENDIENTE' },
]

export default function ComprasPage(): JSX.Element {
  const startDateRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)

  const searchParams = useSearchParams()
  const initialSearch = searchParams.get('search') || ''

  const [search, setSearch] = useState(initialSearch)
  const [estadoFilter, setEstadoFilter] = useState<EstadoAprobacion>('todos')
  const [tipoFilter, setTipoFilter] = useState<TipoCompra>('todos')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    setSelectedIds(new Set())
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
    }, 500)
  }

  // Filtered list
  const filtered = useMemo(() => {
    let list = [...MOCK_COMPRAS]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.proveedor.toLowerCase().includes(q) ||
          c.ncf.toLowerCase().includes(q) ||
          c.rnc.includes(q)
      )
    }

    if (estadoFilter !== 'todos') {
      list = list.filter((c) => c.estado === estadoFilter)
    }

    if (tipoFilter !== 'todos') {
      list = list.filter((c) => c.tipo === tipoFilter)
    }

    if (startDate) {
      list = list.filter((c) => c.fecha >= startDate)
    }
    if (endDate) {
      list = list.filter((c) => c.fecha <= endDate)
    }

    return list
  }, [search, estadoFilter, tipoFilter, startDate, endDate])

  // Pagination
  const paginated = useMemo(() => {
    const offset = (page - 1) * 10
    return filtered.slice(offset, offset + 10)
  }, [filtered, page])

  const totalPages = Math.ceil(filtered.length / 10) || 1

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalAmount = MOCK_COMPRAS.reduce((sum, c) => sum + c.monto, 0)
    const pending = MOCK_COMPRAS.filter((c) => c.estado === 'PENDIENTE').length
    const approved = MOCK_COMPRAS.filter((c) => c.estado === 'APROBADO_COMERCIAL').length
    const rejected = MOCK_COMPRAS.filter((c) => c.estado === 'RECHAZADO').length

    return { totalAmount, pending, approved, rejected }
  }, [])

  return (
    <div className="flex flex-col gap-6 text-left w-full">
      {/* Header and CTA */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h4 font-semibold text-[#333] text-[24px]">Recepción y Compras</h2>
          <p className="text-[14px] text-[#64748b] leading-[21px]">
            Monitorea los e-CF recibidos de tus proveedores y gestiona aprobaciones comerciales
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* EDIT/PENCIL BUTTON - visible only in normal mode */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-left flex items-center justify-center overflow-hidden h-[52px] -my-1 -mx-0.5",
            isSelectionMode ? "w-0 opacity-0 -translate-x-4 scale-0 -mr-2" : "w-[48px] opacity-100 translate-x-0 scale-100"
          )}>
            <EditActionButton
              onClick={toggleSelectionMode}
              title="Activar selección"
              className="w-11 h-11 border-[#d0d5dd]"
            />
          </div>

          {/* RELOAD/REFRESH BUTTON - always visible */}
          <RefreshActionButton
            onClick={handleRefresh}
            isLoading={isRefreshing}
            className="w-11 h-11 border-[#d0d5dd]"
          />

          {/* EXPORT BUTTON - visible only in selection mode */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-right flex items-center justify-center overflow-hidden h-[52px] -my-1 -mx-0.5",
            isSelectionMode ? "w-[118px] opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 translate-x-4 scale-0 -mr-2"
          )}>
            <ExportActionButton
              onClick={() => {
                if (isSelectionMode) {
                  const selectedList = filtered.filter(c => selectedIds.has(c.id))
                  toast.success(`Exportando ${selectedList.length} compras seleccionadas...`)
                } else {
                  alert('Exportando compras...')
                }
              }}
              disabled={isSelectionMode && selectedIds.size === 0}
              title="Exportar"
              className="h-11 w-[114px] justify-center border-[#d0d5dd]"
            />
          </div>

          {/* CANCELAR BUTTON - visible only in selection mode, styled red */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-right flex items-center justify-center overflow-hidden h-[52px] -my-1 -mx-0.5",
            isSelectionMode ? "w-[114px] opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 translate-x-4 scale-0 -mr-2"
          )}>
            <button
              onClick={toggleSelectionMode}
              className="h-11 px-[17px] flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-semibold rounded-[10px] transition-all focus:outline-none shrink-0 w-[110px] font-sans text-[14px] border-none"
            >
              Cancelar
            </button>
          </div>

          {/* REGISTRAR GASTO BUTTON - visible only in normal mode */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-left flex items-center justify-center overflow-hidden h-[52px] -my-1 -mx-0.5",
            isSelectionMode ? "w-0 opacity-0 -translate-x-4 scale-0" : "w-[164px] opacity-100 translate-x-0 scale-100"
          )}>
            <button
              onClick={() => alert('Registrar Gasto Menor (Próximamente)...')}
              className="bg-[#0379d5] hover:bg-[#0262ad] shadow-[0px_1px_1.5px_rgba(0,0,0,0.1),0px_1px_1px_rgba(0,0,0,0.1)] h-11 px-4 rounded-[10px] flex items-center gap-2.5 transition-colors shrink-0 w-[160px] justify-center"
            >
              <Plus size={16} className="text-white" />
              <span className="font-sans font-semibold text-[14px] text-white whitespace-nowrap">
                Registrar Gasto
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
        {/* Card 1 */}
        <Card className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider">Total Compras y Gastos</span>
          <span className="text-[22px] font-bold text-text-primary">{formatCurrency(metrics.totalAmount)}</span>
          <span className="text-[11px] text-text-secondary mt-1">Acumulado del mes</span>
        </Card>

        {/* Card 2 */}
        <Card className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider">Aprobados Comercial</span>
          <span className="text-[22px] font-bold text-[#067647]">{metrics.approved}</span>
          <span className="text-[11px] text-green-600 mt-1">Conformidad enviada a la DGII</span>
        </Card>

        {/* Card 3 */}
        <Card className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider">Pendientes Aprobación</span>
          <span className="text-[22px] font-bold text-orange-600">{metrics.pending}</span>
          <span className="text-[11px] text-orange-500 mt-1">Tienen 3 días límite para aprobar</span>
        </Card>

        {/* Card 4 */}
        <Card className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-sm flex flex-col gap-2">
          <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider">Discrepancias / Rechazos</span>
          <span className="text-[22px] font-bold text-danger-600">{metrics.rejected}</span>
          <span className="text-[11px] text-danger-500 mt-1">Requieren rectificación</span>
        </Card>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-[12px] items-center bg-white p-[17px] rounded-[14px] border border-[#e4e7ec] shadow-sm w-full font-sans">
        {/* Search Input */}
        <div className="relative border border-[#e2e8f0] bg-neutral-50 rounded-[10px] h-[44px] flex items-center px-[12px] gap-[10px] w-[280px]">
          <Search size={16} className="text-[#99a1af]" />
          <input
            type="text"
            placeholder="Buscar por proveedor, RNC o NCF..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="flex-1 font-['Open_Sans'] font-normal leading-[normal] text-text-primary text-[14px] placeholder-[#99a1af] bg-transparent focus:outline-none"
          />
        </div>

        {/* Tipo de Documento Selector */}
        <Select
          value={tipoFilter}
          onChange={(val) => {
            setTipoFilter(val as TipoCompra)
            setPage(1)
          }}
          options={tipoGastoOptions}
          className="w-[160px]"
          triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50"
        />

        {/* Estado Selector */}
        <Select
          value={estadoFilter}
          onChange={(val) => {
            setEstadoFilter(val as EstadoAprobacion)
            setPage(1)
          }}
          options={estadoAprobacionOptions}
          className="w-[180px]"
          triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50"
        />

        {/* Date Range Picker */}
        <div className="relative flex-1 bg-white border border-[#e2e8f0] rounded-[10px] h-[44px] flex items-center px-[13px] justify-between gap-2 min-w-[260px]">
          {/* Visual Display */}
          <div className="flex items-center gap-[10px] w-full text-[12px] font-sans font-normal text-[#99a1af] select-none pointer-events-none">
            <Calendar size={14} className="text-[#99a1af] flex-shrink-0" />
            <span className={startDate ? "text-[#333333]" : "text-[#99a1af]"}>
              {startDate ? formatDate(startDate) : 'DD/MM/AAAA'}
            </span>
            <span className="text-[#99a1af] font-normal text-[16px]">–</span>
            <span className={endDate ? "text-[#333333]" : "text-[#99a1af]"}>
              {endDate ? formatDate(endDate) : 'DD/MM/AAAA'}
            </span>
          </div>

          {/* Invisible inputs on top */}
          <div className="absolute inset-0 flex">
            <div
              onClick={() => {
                try {
                  startDateRef.current?.showPicker()
                } catch (e) {
                  startDateRef.current?.focus()
                }
              }}
              className="w-1/2 h-full cursor-pointer"
            />
            <div
              onClick={() => {
                try {
                  endDateRef.current?.showPicker()
                } catch (e) {
                  endDateRef.current?.focus()
                }
              }}
              className="w-1/2 h-full cursor-pointer"
            />
            <input
              ref={startDateRef}
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPage(1)
              }}
              className="absolute -z-10 opacity-0 invisible w-0 h-0"
            />
            <input
              ref={endDateRef}
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(1)
              }}
              className="absolute -z-10 opacity-0 invisible w-0 h-0"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden font-sans">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm min-w-[1000px]">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-neutral-50/50 text-[13px] font-semibold text-text-secondary h-10 select-none">
                <th className={cn("p-0 text-center align-middle transition-all duration-300 ease-in-out border-b border-[#f1f5f9] bg-neutral-50/50", isSelectionMode ? "w-10" : "w-0")}>
                  <div className={cn(
                    "transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-center h-10 pl-4 origin-left",
                    isSelectionMode ? "w-10 opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 -translate-x-4 scale-0"
                  )}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
                      checked={paginated.length > 0 && paginated.every(c => selectedIds.has(c.id))}
                      onChange={() => {
                        const allSelected = paginated.every(c => selectedIds.has(c.id))
                        if (allSelected) {
                          setSelectedIds(prev => {
                            const next = new Set(prev)
                            paginated.forEach(c => next.delete(c.id))
                            return next
                          })
                        } else {
                          setSelectedIds(prev => {
                            const next = new Set(prev)
                            paginated.forEach(c => next.add(c.id))
                            return next
                          })
                        }
                      }}
                    />
                  </div>
                </th>
                <th className="px-4 py-2 font-semibold">NCF / Código</th>
                <th className="px-4 py-2 font-semibold">Proveedor</th>
                <th className="px-4 py-2 font-semibold">RNC Proveedor</th>
                <th className="px-4 py-2 font-semibold">Fecha</th>
                <th className="px-4 py-2 font-semibold">Monto</th>
                <th className="px-4 py-2 font-semibold">Tipo</th>
                <th className="px-4 py-2 font-semibold">Aprobación Comercial</th>
                <th className="px-4 py-2 font-semibold text-right pr-6">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => {
                const formattedRnc = c.rnc.length === 9
                  ? c.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
                  : c.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')

                const isSelected = selectedIds.has(c.id)

                return (
                  <tr
                    key={c.id}
                    onClick={() => {
                      if (isSelectionMode) {
                        setSelectedIds(prev => {
                          const next = new Set(prev)
                          if (next.has(c.id)) {
                            next.delete(c.id)
                          } else {
                            next.add(c.id)
                          }
                          return next
                        })
                      } else {
                        alert(`Detalle de e-CF ${c.ncf}`)
                      }
                    }}
                    className={`border-b border-[#f1f5f9] last:border-0 hover:bg-neutral-50/30 transition-colors cursor-pointer ${isSelected ? 'bg-[rgba(3,121,213,0.05)] hover:bg-[rgba(3,121,213,0.08)]' : 'bg-white'}`}
                  >
                    <td className={cn("p-0 text-center align-middle transition-all duration-300 ease-in-out border-b border-[#f1f5f9]", isSelectionMode ? "w-10" : "w-0")} onClick={(e) => e.stopPropagation()}>
                      <div className={cn(
                        "transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-center h-[52px] pl-4 origin-left",
                        isSelectionMode ? "w-10 opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 -translate-x-4 scale-0"
                      )}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedIds(prev => {
                              const next = new Set(prev)
                              if (next.has(c.id)) {
                                next.delete(c.id)
                              } else {
                                next.add(c.id)
                              }
                              return next
                            })
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-[#333] text-[13px]">
                      {c.ncf}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-text-primary text-[13px]">
                      {c.proveedor}
                    </td>
                    <td className="px-4 py-3.5 text-text-primary font-normal text-[12px] tracking-[1px]">
                      {formattedRnc}
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary text-[12px]">
                      {formatDate(c.fecha)}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-text-primary text-[13px]">
                      {formatCurrency(c.monto)}
                    </td>
                    <td className="px-4 py-3.5 text-[12px]">
                      {c.tipo === 'RECEPCION_DGII' && (
                        <span className="bg-purple-50 text-purple-700 border border-purple-200 font-semibold px-2 py-0.5 rounded-lg">
                          e-CF Recibido
                        </span>
                      )}
                      {c.tipo === 'GASTO_MENOR' && (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 font-semibold px-2 py-0.5 rounded-lg">
                          Gasto Menor
                        </span>
                      )}
                      {c.tipo === 'SIN_COMPROBANTE' && (
                        <span className="bg-neutral-100 text-neutral-700 border border-neutral-200 font-semibold px-2 py-0.5 rounded-lg">
                          Sin Comprobante
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {c.estado === 'APROBADO_COMERCIAL' && (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
                          <CheckCircle2 size={12} />
                          Aprobado
                        </span>
                      )}
                      {c.estado === 'PENDIENTE' && (
                        <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 text-[11px] font-semibold px-2 py-0.5 rounded-lg animate-pulse">
                          <Clock size={12} />
                          Pendiente
                        </span>
                      )}
                      {c.estado === 'RECHAZADO' && (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
                          <XCircle size={12} />
                          Rechazado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right pr-6">
                      <div className="flex items-center justify-end gap-2.5">
                        {c.estado === 'PENDIENTE' && (
                          <button
                            type="button"
                            onClick={() => alert(`Aprobando comercialmente e-CF ${c.ncf}...`)}
                            className="text-[#067647] hover:text-[#055734] text-[12px] font-semibold flex items-center gap-1 transition-colors border border-green-200 bg-green-50 px-2.5 py-1 rounded-lg"
                            title="Aprobación Comercial"
                          >
                            <Check size={13} />
                            <span>Aprobar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => alert(`Detalles de compra ${c.ncf}`)}
                          className="text-text-secondary hover:text-brand-500 transition-colors"
                          title="Ver"
                        >
                          <Eye size={15} />
                        </button>
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
                    No se encontraron compras o gastos.
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
