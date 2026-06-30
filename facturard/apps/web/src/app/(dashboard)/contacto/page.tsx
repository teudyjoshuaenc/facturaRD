'use client'

import { useState, useMemo } from 'react'
import type { JSX } from 'react'
import {
  Search,
  Plus,
  Building2,
  Mail,
  RotateCw,
  Download,
  Calendar,
  ChevronRight,
  Send,
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronLeft
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useContactos } from '@/hooks/useContactos'
import { NuevoClienteModal } from '@/components/nueva-factura/NuevoClienteModal'
import { formatCurrency } from '@/lib/comprobantes'

import { useUI } from '@/lib/context/UIContext'

type ValidationFilter = 'todos' | 'VALIDO' | 'NO_ENCONTRADO'
type EstadoFilter = 'todos' | 'ACTIVO' | 'INACTIVO' | 'OCASIONAL'

export default function ContactosPage(): JSX.Element {
  const { contactos, crearContacto } = useContactos()
  const { globalSearch } = useUI()
  const [search, setSearch] = useState('')
  const [validationFilter, setValidationFilter] = useState<ValidationFilter>('todos')
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('todos')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [openModal, setOpenModal] = useState(false)

  // Mock initial dataset matching Foto 1 to make it high-fidelity
  const extendedContactos = useMemo(() => {
    const list = [
      { id: 'c1', nombre: 'Distribuidora López SRL', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'VALIDO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'ACTIVO' },
      { id: 'c2', nombre: 'Importadora Caribe', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'VALIDO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'INACTIVO' },
      { id: 'c3', nombre: 'Comercial Díaz & Asoc.', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'VALIDO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'ACTIVO' },
      { id: 'c4', nombre: 'Tech Solutions DO', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'NO_ENCONTRADO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'OCASIONAL' },
      { id: 'c5', nombre: 'Tech Solutions DO', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'NO_ENCONTRADO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'OCASIONAL' },
      { id: 'c6', nombre: 'Importadora Caribe', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'VALIDO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'ACTIVO' },
      { id: 'c7', nombre: 'Tech Solutions DO', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'NO_ENCONTRADO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'OCASIONAL' },
      { id: 'c8', nombre: 'Importadora Caribe', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'VALIDO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'ACTIVO' },
    ]
    // Append user-registered contacts
    contactos.forEach((c) => {
      if (!list.some((item) => item.rnc === c.rnc)) {
        list.push({
          id: c.id,
          nombre: c.nombre,
          rnc: c.rnc,
          email: c.email || 'info@distlopez.com.do',
          tipo: c.tipo,
          validacion: 'VALIDO',
          totalFacturado: 0,
          fecha: '2026-04-20',
          estado: 'ACTIVO',
        })
      }
    })
    return list
  }, [contactos])

  // Filter logic
  const filtered = useMemo(() => {
    let list = [...extendedContactos]
    const activeSearch = (search.trim() ? search : globalSearch).toLowerCase()

    if (activeSearch) {
      list = list.filter(
        (c) =>
          c.nombre.toLowerCase().includes(activeSearch) ||
          c.rnc.includes(activeSearch)
      )
    }

    if (validationFilter !== 'todos') {
      list = list.filter((c) => c.validacion === validationFilter)
    }

    if (estadoFilter !== 'todos') {
      list = list.filter((c) => c.estado === estadoFilter)
    }

    if (startDate) {
      const parts = startDate.split('-').map(Number)
      const start = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1, 0, 0, 0, 0)
      list = list.filter((c) => new Date(c.fecha) >= start)
    }
    if (endDate) {
      const parts = endDate.split('-').map(Number)
      const end = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1, 23, 59, 59, 999)
      list = list.filter((c) => new Date(c.fecha) <= end)
    }

    return list
  }, [extendedContactos, search, globalSearch, validationFilter, estadoFilter, startDate, endDate])

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
          <h2 className="text-h4 font-bold text-text-primary">Contactos</h2>
          <p className="text-body-sm text-text-secondary">
            {filtered.length} entidades fiscales · 2 con incidencias
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.location.reload()}
            className="h-10 w-10 p-0 flex items-center justify-center border border-neutral-200 hover:bg-neutral-50"
            title="Refrescar"
          >
            <RotateCw size={16} className="text-text-secondary" />
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="h-10 border border-neutral-200 hover:bg-neutral-50 px-4"
            title="Exportar"
          >
            <Download size={16} className="mr-1.5" />
            Exportar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => setOpenModal(true)}
            className="h-10 px-4 bg-brand-500 text-white font-semibold"
          >
            <Plus size={16} className="mr-1.5" />
            Nuevo contacto
          </Button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3.5 bg-white p-3.5 rounded-xl border border-neutral-200 shadow-sm w-full">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={16} />
          <input
            type="text"
            placeholder="Buscar por cliente, RNC o e-NCF..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
          />
        </div>

        {/* Validacion Selector */}
        <div className="relative">
          <select
            value={validationFilter}
            onChange={(e) => {
              setValidationFilter(e.target.value as ValidationFilter)
              setPage(1)
            }}
            className="h-10 rounded-lg border border-neutral-200 bg-white pl-3.5 pr-9 text-body-sm font-medium text-text-primary focus:outline-none focus:border-brand-500 appearance-none cursor-pointer hover:bg-neutral-50 transition-colors"
          >
            <option value="todos">Validacion</option>
            <option value="VALIDO">Válido</option>
            <option value="NO_ENCONTRADO">No encontrado</option>
          </select>
          <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
        </div>

        {/* Estado Selector */}
        <div className="relative">
          <select
            value={estadoFilter}
            onChange={(e) => {
              setEstadoFilter(e.target.value as EstadoFilter)
              setPage(1)
            }}
            className="h-10 rounded-lg border border-neutral-200 bg-white pl-3.5 pr-9 text-body-sm font-medium text-text-primary focus:outline-none focus:border-brand-500 appearance-none cursor-pointer hover:bg-neutral-50 transition-colors"
          >
            <option value="todos">Estado</option>
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
            <option value="OCASIONAL">Ocasional</option>
          </select>
          <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
        </div>

        {/* Date Picker Group */}
        <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 h-10 min-w-[260px]">
          <Calendar size={14} className="text-text-tertiary flex-shrink-0" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              setPage(1)
            }}
            className="text-body-sm text-text-primary bg-transparent focus:outline-none w-full placeholder:text-text-tertiary"
          />
          <span className="text-text-tertiary px-1 font-medium">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              setPage(1)
            }}
            className="text-body-sm text-text-primary bg-transparent focus:outline-none w-full placeholder:text-text-tertiary"
          />
        </div>
      </div>

      {/* Directory Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/50 text-ui-sm font-semibold text-text-secondary">
                <th className="px-4 py-3 font-semibold">Nombre / Razón social</th>
                <th className="px-4 py-3 font-semibold">RNC / Cédula</th>
                <th className="px-4 py-3 font-semibold">Validación</th>
                <th className="px-4 py-3 font-semibold">Total facturado</th>
                <th className="px-4 py-3 font-semibold">Última actividad</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right pr-6">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => {
                const isEmpresa = c.tipo === 'EMPRESA'
                const formattedRnc = c.rnc.length === 9
                  ? c.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
                  : c.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')

                return (
                  <tr key={c.id} className="border-b border-neutral-200 last:border-0 hover:bg-neutral-50/30 transition-colors">
                    <td className="px-4 py-3 flex items-center gap-3">
                      <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-text-secondary flex-shrink-0">
                        <Building2 size={16} />
                        {/* Dot indicator (Active/Inactive) */}
                        <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white ${c.estado === 'ACTIVO' ? 'bg-green-500' : c.estado === 'OCASIONAL' ? 'bg-orange-500' : 'bg-neutral-400'}`} />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-semibold text-text-primary text-body-sm line-clamp-1">
                          {c.nombre}
                        </span>
                        <span className="text-[10px] text-text-secondary font-medium mt-0.2 capitalize">
                          {c.tipo.toLowerCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-text-primary font-semibold text-body-sm">
                      {formattedRnc}
                    </td>
                    <td className="px-4 py-3.5">
                      {c.validacion === 'VALIDO' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200/50 px-2 py-0.5 text-ui-xs font-semibold text-green-700">
                          <CheckCircle2 size={11} className="text-green-600" />
                          Válido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200/50 px-2 py-0.5 text-ui-xs font-semibold text-orange-700">
                          <AlertTriangle size={11} className="text-orange-600" />
                          No encontrado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-text-primary font-bold text-body-sm">
                      {c.totalFacturado === 0 ? '0.00' : formatCurrency(c.totalFacturado)}
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary text-body-sm">
                      {c.fecha}
                    </td>
                    <td className="px-4 py-3.5">
                      {c.estado === 'ACTIVO' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200/50 px-2.5 py-0.5 text-ui-xs font-semibold text-green-700">
                          <CheckCircle2 size={11} className="text-green-600" />
                          Activo
                        </span>
                      ) : c.estado === 'OCASIONAL' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200/50 px-2.5 py-0.5 text-ui-xs font-semibold text-orange-700">
                          <AlertTriangle size={11} className="text-orange-600" />
                          Ocasional
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-50 border border-neutral-200/50 px-2.5 py-0.5 text-ui-xs font-semibold text-neutral-600">
                          <XCircle size={11} className="text-neutral-500" />
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right pr-6">
                      <div className="flex items-center justify-end gap-3.5">
                        <button
                          type="button"
                          title="Enviar correo"
                          onClick={() => alert('Enviando estado de cuenta...')}
                          className="text-text-secondary hover:text-brand-500 transition-colors focus:outline-none"
                        >
                          <Send size={15} />
                        </button>
                        <button
                          type="button"
                          title="Opciones"
                          className="text-text-secondary hover:text-brand-500 transition-colors focus:outline-none"
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
                  <td colSpan={7} className="px-4 py-12 text-center text-body-sm text-text-secondary">
                    No se encontraron clientes en tu directorio.
                  </td>
                </tr>
              )}
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

      <NuevoClienteModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSave={crearContacto}
      />
    </div>
  )
}
