import type { JSX } from 'react'
import { Search, ChevronDown, Calendar } from 'lucide-react'
import type { EstadoFilter } from '@/hooks/useComprobantes'

interface Props {
  estadoFilter: EstadoFilter
  search: string
  onEstadoChange: (v: EstadoFilter) => void
  onSearchChange: (v: string) => void
  tipoFilter: string
  onTipoFilterChange: (v: string) => void
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
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  minAmount,
  onMinAmountChange,
  maxAmount,
  onMaxAmountChange,
}: Props): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-[12px] bg-white p-[17px] rounded-[14px] border border-[#e4e7ec] shadow-sm w-full font-sans">
      {/* Search Input */}
      <div className="relative flex-[1_0_0] min-w-[240px] h-[44px]">
        <Search
          className="absolute left-[13px] top-1/2 -translate-y-1/2 text-[#99a1af] pointer-events-none"
          size={16}
        />
        <input
          type="text"
          placeholder="Buscar por cliente, RNC o e-NCF..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-full w-full rounded-[10px] border border-[#e2e8f0] bg-white pl-[38px] pr-3 text-[14px] text-[#333333] placeholder:text-[#99a1af] focus:border-[#0379d5] focus:outline-none transition-colors"
        />
      </div>

      {/* Tipo Dropdown */}
      <div className="relative shrink-0 w-[180px] h-[44px]">
        <select
          value={tipoFilter}
          onChange={(e) => onTipoFilterChange(e.target.value)}
          className="h-full w-full rounded-[10px] border border-[#e2e8f0] bg-white pl-[13px] pr-8 text-[13px] font-semibold text-[#333333] focus:outline-none focus:border-[#0379d5] appearance-none cursor-pointer hover:bg-neutral-50 transition-colors"
        >
          <option value="todos">Tipo</option>
          <option value="E31">E31 – Crédito Fiscal</option>
          <option value="E32">E32 – Consumo</option>
          <option value="E33">E33 – Nota de Débito</option>
          <option value="E34">E34 – Nota de Crédito</option>
          <option value="E41">E41 – Compras</option>
          <option value="E43">E43 – Gastos Menores</option>
          <option value="E44">E44 – Reg. Especiales</option>
          <option value="E45">E45 – Gubernamental</option>
          <option value="E46">E46 – Exportaciones</option>
          <option value="E47">E47 – Pagos al Exterior</option>
        </select>
        <ChevronDown
          size={14}
          className="absolute right-[13px] top-1/2 -translate-y-1/2 text-[#99a1af] pointer-events-none"
        />
      </div>

      {/* Estado Dropdown */}
      <div className="relative shrink-0 w-[126px] h-[44px]">
        <select
          value={estadoFilter}
          onChange={(e) => onEstadoChange(e.target.value as EstadoFilter)}
          className="h-full w-full rounded-[10px] border border-[#e2e8f0] bg-white pl-[13px] pr-8 text-[13px] font-semibold text-[#333333] focus:outline-none focus:border-[#0379d5] appearance-none cursor-pointer hover:bg-neutral-50 transition-colors"
        >
          <option value="todos">Estado</option>
          <option value="ACEPTADO">Aceptado</option>
          <option value="PENDIENTE">En proceso</option>
          <option value="RECHAZADO">Rechazado</option>
        </select>
        <ChevronDown
          size={14}
          className="absolute right-[13px] top-1/2 -translate-y-1/2 text-[#99a1af] pointer-events-none"
        />
      </div>

      {/* Date Range Group */}
      <div className="flex flex-[1_0_0] min-w-[260px] h-[44px] items-center gap-2 rounded-[10px] border border-[#e2e8f0] bg-white px-[13px]">
        <Calendar size={14} className="text-[#99a1af] flex-shrink-0" />
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="text-[12px] text-[#333333] bg-transparent focus:outline-none w-full placeholder:text-[#99a1af] [color-scheme:light]"
          placeholder="dd/mm/aaaa"
        />
        <span className="text-[#99a1af] px-1 font-normal select-none">–</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="text-[12px] text-[#333333] bg-transparent focus:outline-none w-full placeholder:text-[#99a1af] [color-scheme:light]"
          placeholder="dd/mm/aaaa"
        />
      </div>

      {/* Price Range Input Group */}
      <div className="flex flex-[1_0_0] min-w-[200px] h-[44px] items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-[13px]">
        <span className="text-[13px] text-[#99a1af] font-normal select-none">RD$</span>
        <input
          type="number"
          placeholder="Mín"
          value={minAmount}
          onChange={(e) => onMinAmountChange(e.target.value)}
          className="text-[13px] text-[#333333] bg-transparent focus:outline-none w-full placeholder:text-[#99a1af]"
        />
        <span className="text-[#99a1af] px-0.5 font-normal select-none">–</span>
        <input
          type="number"
          placeholder="Máx"
          value={maxAmount}
          onChange={(e) => onMaxAmountChange(e.target.value)}
          className="text-[13px] text-[#333333] bg-transparent focus:outline-none w-full placeholder:text-[#99a1af]"
        />
      </div>
    </div>
  )
}
