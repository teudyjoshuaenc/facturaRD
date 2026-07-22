import { type JSX, useRef } from 'react'
import { Search, Calendar } from 'lucide-react'
import { Select } from '@/components/ui/select'
import {
  formatDate,
  CLASE_FILTER_OPTIONS,
  ESTADO_FILTER_OPTIONS,
  ORIGEN_FILTER_OPTIONS,
  TIPO_FILTER_OPTIONS,
  type ClaseFiltro,
  type EstadoFiltro,
  type OrigenFiltro,
} from '@/lib/comprobantes'

// Las opciones salen de lib/comprobantes (fuente única): el filtro de Estado
// cubre TODOS los estados DGII reales, "Borrador"/"Nota de venta" viven sólo en
// Clase, y la procedencia (cotización) es su propio filtro, no un estado.

interface Props {
  estadoFilter: EstadoFiltro
  search: string
  onEstadoChange: (v: EstadoFiltro) => void
  onSearchChange: (v: string) => void
  tipoFilter: string
  onTipoFilterChange: (v: string) => void
  claseFilter: ClaseFiltro
  onClaseFilterChange: (v: ClaseFiltro) => void
  origenFilter: OrigenFiltro
  onOrigenFilterChange: (v: OrigenFiltro) => void
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
  origenFilter,
  onOrigenFilterChange,
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

        {/* Clase Dropdown — QUÉ ES el documento (fiscal / borrador / nota) */}
        <Select
          value={claseFilter}
          onChange={(val) => onClaseFilterChange(val as ClaseFiltro)}
          options={CLASE_FILTER_OPTIONS}
          className="w-full sm:flex-1 sm:min-w-[132px]"
          triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50"
        />

        {/* Tipo Dropdown — sólo los tipos e-CF que el sistema emite hoy */}
        <Select
          value={tipoFilter}
          onChange={onTipoFilterChange}
          options={TIPO_FILTER_OPTIONS}
          className="w-full sm:flex-1 sm:min-w-[126px]"
          triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50"
        />
      </div>

      {/* Row 2: Estado, Desde, Hasta, Rango Precios */}
      <div className="flex flex-wrap items-center gap-[12px] w-full">
        {/* Estado DGII Dropdown — sólo estados reales del ciclo DGII */}
        <Select
          value={estadoFilter}
          onChange={(val) => onEstadoChange(val as EstadoFiltro)}
          options={ESTADO_FILTER_OPTIONS}
          className="w-full sm:flex-1 sm:min-w-[126px]"
          triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50"
        />

        {/* Origen Dropdown — procedencia, eje aparte del estado */}
        <Select
          value={origenFilter}
          onChange={(val) => onOrigenFilterChange(val as OrigenFiltro)}
          options={ORIGEN_FILTER_OPTIONS}
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
