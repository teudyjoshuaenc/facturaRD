import type { JSX } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { EstadoFilter } from '@/hooks/useComprobantes'

interface Props {
  estadoFilter: EstadoFilter
  search: string
  onEstadoChange: (v: EstadoFilter) => void
  onSearchChange: (v: string) => void
}

export function FacturaFilters({ estadoFilter, search, onEstadoChange, onSearchChange }: Props): JSX.Element {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          size={16}
        />
        <Input
          style={{ paddingLeft: '2.25rem' }}
          placeholder="Buscar por e-NCF o cliente"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Select
        className="sm:w-56"
        value={estadoFilter}
        onChange={(e) => onEstadoChange(e.target.value as EstadoFilter)}
      >
        <option value="todos">Todos los estados</option>
        <option value="ACEPTADO">Aceptado</option>
        <option value="PENDIENTE">Pendiente</option>
        <option value="RECHAZADO">Rechazado</option>
      </Select>
    </div>
  )
}
