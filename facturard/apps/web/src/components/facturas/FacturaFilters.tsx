import type { JSX } from 'react'
import { Search, ChevronRight, Calendar } from 'lucide-react'
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
    <div className="flex flex-wrap items-center gap-3.5 bg-white p-3.5 rounded-xl border border-neutral-200 shadow-sm w-full">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[240px]">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          size={16}
        />
        <input
          type="text"
          placeholder="Buscar por cliente, RNC o e-NCF..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
        />
      </div>

      {/* Tipo Dropdown */}
      <div className="relative">
        <select
          value={tipoFilter}
          onChange={(e) => onTipoFilterChange(e.target.value)}
          className="h-10 rounded-lg border border-neutral-200 bg-white pl-3.5 pr-9 text-body-sm font-medium text-text-primary focus:outline-none focus:border-brand-500 appearance-none cursor-pointer hover:bg-neutral-50 transition-colors"
        >
          <option value="todos">Tipo</option>
          <option value="E31">E31 (Crédito Fiscal)</option>
          <option value="E32">E32 (Consumo)</option>
          <option value="E33">E33 (Nota de Débito)</option>
          <option value="E34">E34 (Nota de Crédito)</option>
          <option value="E43">E43 (Gastos Menores)</option>
        </select>
        <ChevronRight
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
        />
      </div>

      {/* Estado Dropdown */}
      <div className="relative">
        <select
          value={estadoFilter}
          onChange={(e) => onEstadoChange(e.target.value as EstadoFilter)}
          className="h-10 rounded-lg border border-neutral-200 bg-white pl-3.5 pr-9 text-body-sm font-medium text-text-primary focus:outline-none focus:border-brand-500 appearance-none cursor-pointer hover:bg-neutral-50 transition-colors"
        >
          <option value="todos">Estado</option>
          <option value="ACEPTADO">Aceptado</option>
          <option value="PENDIENTE">En proceso</option>
          <option value="RECHAZADO">Rechazado</option>
        </select>
        <ChevronRight
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
        />
      </div>

      {/* Date Range Group */}
      <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 h-10 min-w-[260px]">
        <Calendar size={14} className="text-text-tertiary flex-shrink-0" />
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="text-body-sm text-text-primary bg-transparent focus:outline-none w-full placeholder:text-text-tertiary"
          placeholder="dd/mm/aaaa"
        />
        <span className="text-text-tertiary px-1 font-medium">-</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="text-body-sm text-text-primary bg-transparent focus:outline-none w-full placeholder:text-text-tertiary"
          placeholder="dd/mm/aaaa"
        />
      </div>

      {/* Price Range Input Group */}
      <div className="flex items-center rounded-lg border border-neutral-200 bg-white px-3.5 h-10 gap-1.5 min-w-[200px]">
        <span className="text-body-sm text-text-tertiary font-semibold">RD$</span>
        <input
          type="number"
          placeholder="Mín"
          value={minAmount}
          onChange={(e) => onMinAmountChange(e.target.value)}
          className="text-body-sm text-text-primary bg-transparent focus:outline-none w-full placeholder:text-text-tertiary"
        />
        <span className="text-text-tertiary px-1 font-medium">-</span>
        <input
          type="number"
          placeholder="Máx"
          value={maxAmount}
          onChange={(e) => onMaxAmountChange(e.target.value)}
          className="text-body-sm text-text-primary bg-transparent focus:outline-none w-full placeholder:text-text-tertiary"
        />
      </div>
    </div>
  )
}
