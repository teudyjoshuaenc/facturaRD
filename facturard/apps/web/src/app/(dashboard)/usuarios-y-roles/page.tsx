'use client'

import { useState, useMemo } from 'react'
import type { JSX } from 'react'
import {
  Plus,
  RotateCw,
  Search,
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

import { useUI } from '@/lib/context/UIContext'

type RoleFilter = 'todos' | 'Administrador' | 'Facturador' | 'Contador' | 'Solo lectura'

export default function UsuariosRolesPage(): JSX.Element {
  const { globalSearch } = useUI()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('todos')
  const [page, setPage] = useState(1)

  const users = useMemo(() => [
    { name: 'María González', email: 'maria@gmail.com', role: 'Administrador', status: 'ACTIVO', activity: 'hace 2 min' },
    { name: 'Carlos Ramírez', email: 'carlos@gmail.com', role: 'Facturador', status: 'ACTIVO', activity: 'hace 2 min' },
    { name: 'Elena Pérez', email: 'elena@gmail.com', role: 'Solo lectura', status: 'PENDIENTE', activity: 'hace 2 min' },
    { name: 'Juan De La Rosa', email: 'juan@gmail.com', role: 'Facturador', status: 'ACTIVO', activity: 'hace 2 min' },
    { name: 'Ana Martínez', email: 'ana@gmail.com', role: 'Contador', status: 'ACTIVO', activity: 'hace 2 min' },
    { name: 'Elena Pérez', email: 'elena2@gmail.com', role: 'Solo lectura', status: 'PENDIENTE', activity: 'hace 2 min' },
    { name: 'Elena Pérez', email: 'elena3@gmail.com', role: 'Solo lectura', status: 'PENDIENTE', activity: 'hace 2 min' },
  ], [])

  const filtered = useMemo(() => {
    let list = [...users]
    const activeSearch = (search.trim() ? search : globalSearch).toLowerCase()

    if (activeSearch) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(activeSearch) ||
          u.email.toLowerCase().includes(activeSearch)
      )
    }
    if (roleFilter !== 'todos') {
      list = list.filter((u) => u.role === roleFilter)
    }
    return list
  }, [users, search, globalSearch, roleFilter])

  const paginated = useMemo(() => {
    const offset = (page - 1) * 10
    return filtered.slice(offset, offset + 10)
  }, [filtered, page])

  const totalPages = Math.ceil(filtered.length / 10) || 1

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Header and CTA */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h4 font-bold text-text-primary">Usuarios y roles</h2>
          <p className="text-body-sm text-text-secondary">
            Controlá quién accede al sistema y qué puede hacer dentro de él.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="md"
            className="h-10 border border-neutral-200 hover:bg-neutral-50 px-4 text-ui-sm font-semibold"
          >
            Matriz de permisos
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => alert('Invitando nuevo usuario...')}
            className="h-10 px-4 bg-brand-500 text-white font-semibold"
          >
            <Plus size={16} className="mr-1.5" />
            Invitar Usuario
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-1 shadow-sm text-left">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Usuarios activos</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-h3 font-bold text-text-primary">4</span>
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 mb-1" />
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-1 shadow-sm text-left">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Invitaciones pendientes</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-h3 font-bold text-text-primary">14</span>
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 mb-1" />
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-1 shadow-sm text-left">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Administradores</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-h3 font-bold text-text-primary">1</span>
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mb-1" />
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-1 shadow-sm text-left">
          <span className="text-[10px] font-bold text-text-secondary uppercase">Asientos disponibles</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-h3 font-bold text-text-primary">18/24</span>
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 mb-1" />
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3.5 rounded-xl border border-neutral-200 shadow-sm w-full">
        {/* Search */}
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={16} />
          <input
            type="text"
            placeholder="Buscar por Nombre o Email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
          />
        </div>

        {/* Pills segmented control filter */}
        <div className="flex flex-wrap items-center gap-1.5 bg-neutral-100 p-0.5 rounded-lg border border-neutral-200/50">
          {(['todos', 'Administrador', 'Facturador', 'Contador', 'Solo lectura'] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => {
                setRoleFilter(role)
                setPage(1)
              }}
              className={`px-3 py-1.5 rounded-md text-ui-sm font-semibold transition-all ${roleFilter === role ? 'bg-white text-brand-600 shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {role === 'todos' ? 'Todos' : role}
            </button>
          ))}
        </div>
      </div>

      {/* Users Directory Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/50 text-ui-sm font-semibold text-text-secondary">
                <th className="px-4 py-3 font-semibold">Usuario</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Última actividad</th>
                <th className="px-4 py-3 font-semibold text-right pr-6">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((u, idx) => {
                const initials = u.name.split(' ').map((n) => n[0]).join('')
                const isActivo = u.status === 'ACTIVO'

                // Role styled tags matching Figma color codes
                const roleColors: Record<string, string> = {
                  Administrador: 'bg-blue-50 border border-blue-200 text-blue-700',
                  Facturador: 'bg-violet-50 border border-violet-200 text-violet-700',
                  Contador: 'bg-rose-50 border border-rose-200 text-rose-700',
                  'Solo lectura': 'bg-neutral-50 border border-neutral-200 text-neutral-600',
                }

                return (
                  <tr key={idx} className="border-b border-neutral-200 last:border-0 hover:bg-neutral-50/30 transition-colors">
                    <td className="px-4 py-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 font-bold text-ui-sm flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-semibold text-text-primary text-body-sm flex items-center gap-1.5">
                          {u.name}
                          {u.role === 'Administrador' && (
                            <span className="text-[8px] bg-blue-100 text-blue-800 font-bold px-1 py-0.2 rounded uppercase">Prop.</span>
                          )}
                        </span>
                        <span className="text-ui-xs text-text-secondary">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Select
                        value={u.role}
                        onChange={() => alert('Modificando rol del usuario...')}
                        options={[
                          { value: 'Administrador', label: 'Administrador' },
                          { value: 'Facturador', label: 'Facturador' },
                          { value: 'Contador', label: 'Contador' },
                          { value: 'Solo lectura', label: 'Solo lectura' },
                        ]}
                        className="w-32"
                        triggerClassName={`h-7 px-2 py-0.5 text-ui-xs font-semibold ${roleColors[u.role] || 'bg-neutral-50 text-neutral-600 border border-neutral-200/50'}`}
                        dropdownClassName="w-32"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      {isActivo ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200/50 px-2.5 py-0.5 text-ui-xs font-semibold text-green-700">
                          <CheckCircle2 size={11} className="text-green-600" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200/50 px-2.5 py-0.5 text-ui-xs font-semibold text-orange-700">
                          <AlertTriangle size={11} className="text-orange-600" />
                          Invitación pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary text-body-sm">
                      {u.activity}
                    </td>
                    <td className="px-4 py-3.5 text-right pr-6">
                      <button className="text-text-secondary hover:text-brand-500 transition-colors focus:outline-none h-8 w-8 hover:bg-neutral-100/50 rounded-lg flex items-center justify-center ml-auto">
                        <MoreHorizontal size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Custom Pagination footer */}
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3.5 bg-white">
          <p className="text-ui-sm text-text-secondary">{filtered.length} resultados</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-text-secondary hover:bg-neutral-50 disabled:opacity-50 transition-colors focus:outline-none"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-ui-sm font-bold text-white shadow-sm shadow-brand-500/10">
              {page}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-text-secondary hover:bg-neutral-50 disabled:opacity-50 transition-colors focus:outline-none"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
