import { type JSX, useRef } from 'react'
import { Search, Calendar } from 'lucide-react'
import type { EstadoFilter } from '@/hooks/useComprobantes'
import { Select } from '@/components/ui/select'
import { formatDate } from '@/lib/comprobantes'

const tipoOptions = [
  { value: 'todos', label: 'Tipo' },
  { value: 'E31', label: 'E31 – Crédito Fiscal' },
  { value: 'E32', label: 'E32 – Consumo' },
  { value: 'E33', label: 'E33 – Nota de Débito' },
  { value: 'E34', label: 'E34 – Nota de Crédito' },
  { value: 'E41', label: 'E41 – Compras' },
  { value: 'E43', label: 'E43 – Gastos Menores' },
  { value: 'E44', label: 'E44 – Reg. Especiales' },
  { value: 'E45', label: 'E45 – Gubernamental' },
  { value: 'E46', label: 'E46 – Exportaciones' },
  { value: 'E47', label: 'E47 – Pagos al Exterior' },
]

const estadoOptions = [
  { value: 'todos', label: 'Estado' },
  { value: 'ACEPTADO', label: 'Aceptado' },
  { value: 'PENDIENTE', label: 'En proceso' },
  { value: 'RECHAZADO', label: 'Rechazado' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'COTIZACION_CONVERTIDA', label: 'Cotización convertida' },
]

const claseOptions = [
  { value: 'todos', label: 'Clase' },
  { value: 'fiscal', label: 'Fiscal (e-CF)' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'nota', label: 'Nota de venta' },
]

interface Props {
  estadoFilter: EstadoFilter
  search: string
  onEstadoChange: (v: EstadoFilter) => void
  onSearchChange: (v: string) => void
  tipoFilter: string
  onTipoFilterChange: (v: string) => void
  claseFilter: 'todos' | 'fiscal' | 'borrador' | 'nota'
  onClaseFilterChange: (v: 'todos' | 'fiscal' | 'borrador' | 'nota') => void
  startDate: string
  onStartDateChange: (v: string) => void
  endDate: string
  onEndDateChange: (v: string) => void
  minAmount: string
  onMinAmountChange: (v: string) => void
  maxAmount: string
  onMaxAmountChange: (v: string) => void
}

export function FacturaFilters({
  estadoFilter,
  search,
  onEstadoChange,
  onSearchChange,
  tipoFilter,
  onTipoFilterChange,
  claseFilter,
  onClaseFilterChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  minAmount,
  onMinAmountChange,
  maxAmount,
  onMaxAmountChange,
}: Props): JSX.Element {
  const startDateRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)
  const minAmountRef = useRef<HTMLInputElement>(null)
  const maxAmountRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-[12px] bg-white p-[17px] rounded-[14px] border border-[#e4e7ec] shadow-sm w-full font-sans">
      {/* Row 1: Buscador, Clase, Tipo */}
      <div className="flex flex-wrap items-center gap-[12px] w-full">
        {/* Search Input */}
        <div className="relative w-full sm:flex-1 sm:min-w-[240px] h-[44px]">
          <Search
            className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[#99a1af] pointer-events-none"
            size={16}
          />
          <input
            type="text"
            placeholder="Buscar por cliente, RNC o e-NCF..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-full w-full rounded-[10px] border border-[#e2e8f0] bg-white pl-[38px] pr-3 text-[14px] text-[#333333] placeholder:text-[#99a1af] focus:border-[#0379d5] focus:outline-none transition-colors shadow-sm"
          />
        </div>

        {/* Clase Dropdown */}
        <Select
          value={claseFilter}
          onChange={(val) => onClaseFilterChange(val as 'todos' | 'fiscal' | 'borrador' | 'nota')}
          options={claseOptions}
          className="w-full sm:flex-1 sm:min-w-[132px]"
          triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50"
        />

        {/* Tipo Dropdown */}
        <Select
          value={tipoFilter}
          onChange={onTipoFilterChange}
          options={tipoOptions}
          className="w-full sm:flex-1 sm:min-w-[126px]"
          triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50"
        />
      </div>

      {/* Row 2: Estado, Desde, Hasta, Rango Precios */}
      <div className="flex flex-wrap items-center gap-[12px] w-full">
        {/* Estado Dropdown */}
        <Select
          value={estadoFilter}
          onChange={(val) => onEstadoChange(val as EstadoFilter)}
          options={estadoOptions}
          className="w-full sm:flex-1 sm:min-w-[126px]"
          triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50"
        />

        {/* Desde Group */}
        <div
          onClick={() => {
            try {
              startDateRef.current?.showPicker()
            } catch (e) {
              startDateRef.current?.focus()
            }
          }}
          className="relative w-full sm:flex-1 sm:min-w-[130px] h-[44px] flex items-center rounded-[10px] border border-[#e2e8f0] bg-white px-[10px] cursor-pointer"
        >
          <div className="flex items-center justify-center gap-[8px] w-full text-[12px] font-sans font-normal text-[#99a1af] select-none pointer-events-none whitespace-nowrap">
            <Calendar size={14} className="text-[#99a1af] flex-shrink-0" />
            <span className={startDate ? "text-[#333333]" : "text-[#99a1af]"}>
              {startDate ? formatDate(startDate) : 'Desde'}
            </span>
          </div>
          <input
            ref={startDateRef}
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="absolute -z-10 opacity-0 invisible w-0 h-0"
          />
        </div>

        {/* Hasta Group */}
        <div
          onClick={() => {
            try {
              endDateRef.current?.showPicker()
            } catch (e) {
              endDateRef.current?.focus()
            }
          }}
          className="relative w-full sm:flex-1 sm:min-w-[130px] h-[44px] flex items-center rounded-[10px] border border-[#e2e8f0] bg-white px-[10px] cursor-pointer"
        >
          <div className="flex items-center justify-center gap-[8px] w-full text-[12px] font-sans font-normal text-[#99a1af] select-none pointer-events-none whitespace-nowrap">
            <Calendar size={14} className="text-[#99a1af] flex-shrink-0" />
            <span className={endDate ? "text-[#333333]" : "text-[#99a1af]"}>
              {endDate ? formatDate(endDate) : 'Hasta'}
            </span>
          </div>
          <input
            ref={endDateRef}
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="absolute -z-10 opacity-0 invisible w-0 h-0"
          />
        </div>

        {/* Price Range Input Group */}
        <div className="flex w-full sm:flex-1 sm:min-w-[180px] h-[44px] items-center rounded-[10px] border border-[#e2e8f0] bg-white px-[10px] gap-1">
          <div
            onClick={() => minAmountRef.current?.focus()}
            className="flex-1 min-w-0 flex items-center justify-end gap-[2px] text-[13px] text-[#99a1af] cursor-text"
          >
            <span className="select-none font-normal">$</span>
            <input
              ref={minAmountRef}
              type="number"
              placeholder="Mín"
              value={minAmount}
              onChange={(e) => onMinAmountChange(e.target.value)}
              className="text-[13px] text-[#333333] bg-transparent focus:outline-none placeholder:text-[#99a1af] text-left px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              style={{ width: `${Math.max(3, minAmount.length) + 0.5}ch` }}
            />
          </div>
          <span className="text-[#99a1af] select-none text-[14px] leading-none px-0.5">–</span>
          <div
            onClick={() => maxAmountRef.current?.focus()}
            className="flex-1 min-w-0 flex items-center justify-start gap-[2px] text-[13px] text-[#99a1af] cursor-text"
          >
            <span className="select-none font-normal">$</span>
            <input
              ref={maxAmountRef}
              type="number"
              placeholder="Máx"
              value={maxAmount}
              onChange={(e) => onMaxAmountChange(e.target.value)}
              className="text-[13px] text-[#333333] bg-transparent focus:outline-none placeholder:text-[#99a1af] text-left px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              style={{ width: `${Math.max(3, maxAmount.length) + 0.5}ch` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
