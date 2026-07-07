'use client'

import { useState, useMemo } from 'react'
import type { JSX } from 'react'
import Image from 'next/image'
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
import { DetailPanel } from '@/components/contacto/DetailPanel'

type ValidationFilter = 'todos' | 'VALIDO' | 'NO_ENCONTRADO'
type EstadoFilter = 'todos' | 'ACTIVO' | 'INACTIVO' | 'OCASIONAL'
type TipoFilter = 'todos' | 'EMPRESA' | 'PERSONA'
type TipoFiscalFilter = 'todos' | 'RNC' | 'CEDULA'

export default function ContactosPage(): JSX.Element {
  const { contactos, crearContacto } = useContactos()
  const { globalSearch } = useUI()
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos')
  const [tipoFiscalFilter, setTipoFiscalFilter] = useState<TipoFiscalFilter>('todos')
  const [validationFilter, setValidationFilter] = useState<ValidationFilter>('todos')
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('todos')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [openModal, setOpenModal] = useState(false)
  const [selectedContacto, setSelectedContacto] = useState<any | null>(null)

  // Mock initial dataset matching Foto 1 to make it high-fidelity
  const extendedContactos = useMemo(() => {
    const list = [
      { id: 'mock-c1', nombre: 'Distribuidora López SRL', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'VALIDO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'ACTIVO' },
      { id: 'mock-c2', nombre: 'Importadora Caribe', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'VALIDO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'INACTIVO' },
      { id: 'mock-c3', nombre: 'Comercial Díaz & Asoc.', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'VALIDO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'ACTIVO' },
      { id: 'mock-c4', nombre: 'Tech Solutions DO', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'NO_ENCONTRADO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'OCASIONAL' },
      { id: 'mock-c5', nombre: 'Tech Solutions DO', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'NO_ENCONTRADO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'OCASIONAL' },
      { id: 'mock-c6', nombre: 'Importadora Caribe', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'VALIDO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'ACTIVO' },
      { id: 'mock-c7', nombre: 'Tech Solutions DO', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'NO_ENCONTRADO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'OCASIONAL' },
      { id: 'mock-c8', nombre: 'Importadora Caribe', rnc: '130874562', email: 'info@distlopez.com.do', tipo: 'EMPRESA', validacion: 'VALIDO', totalFacturado: 125400, fecha: '2026-04-20', estado: 'ACTIVO' },
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

    if (tipoFilter !== 'todos') {
      list = list.filter((c) => c.tipo === tipoFilter)
    }

    if (tipoFiscalFilter !== 'todos') {
      list = list.filter((c) => {
        const cleanRnc = c.rnc.replace(/-/g, '')
        return tipoFiscalFilter === 'RNC' ? cleanRnc.length === 9 : cleanRnc.length === 11
      })
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
  }, [extendedContactos, search, globalSearch, tipoFilter, tipoFiscalFilter, validationFilter, estadoFilter, startDate, endDate])

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
          <h2 className="text-h4 font-semibold text-[#333] text-[24px]">Contactos</h2>
          <p className="text-[14px] text-[#64748b] leading-[21px]">
            {filtered.length} entidades fiscales · 2 con incidencias
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={() => window.location.reload()}
            className="bg-white border border-[#d0d5dd] rounded-[10px] w-11 h-11 flex items-center justify-center hover:bg-neutral-50 transition-colors"
            title="Refrescar"
          >
            <Image src="/icons/refresh.svg" alt="Refrescar" width={16} height={16} />
          </button>
          
          {/* Import Button */}
          <button
            onClick={() => alert('Importando contactos...')}
            className="bg-white border border-[#d0d5dd] rounded-[10px] h-11 px-4 flex items-center gap-2 hover:bg-neutral-50 transition-colors"
            title="Importar"
          >
            <Image src="/icons/import.svg" alt="Importar" width={16} height={16} />
            <span className="text-[#64748b] text-[14px] font-normal">Importar</span>
          </button>

          {/* Export Button */}
          <button
            onClick={() => alert('Exportando contactos...')}
            className="bg-white border border-[#d0d5dd] rounded-[10px] h-11 px-4 flex items-center gap-2 hover:bg-neutral-50 transition-colors"
            title="Exportar"
          >
            <Image src="/icons/export.svg" alt="Exportar" width={16} height={16} />
            <span className="text-[#64748b] text-[14px] font-normal">Exportar</span>
          </button>

          {/* Nuevo Contacto Button */}
          <button
            onClick={() => setOpenModal(true)}
            className="bg-[#0379d5] hover:bg-[#0262ad] shadow-[0px_1px_1.5px_rgba(0,0,0,0.1),0px_1px_1px_rgba(0,0,0,0.1)] h-11 px-4 rounded-[10px] flex items-center gap-2.5 transition-colors"
          >
            <Image src="/icons/plus.svg" alt="Nuevo" width={16} height={16} />
            <span className="font-['Montserrat'] font-semibold text-[14px] text-white">
              Nuevo contacto
            </span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-[12px] items-center bg-white p-[17px] rounded-[14px] border border-[#e4e7ec] shadow-sm w-full font-sans">
        {/* Search Input */}
        <div className="relative border border-[#e2e8f0] bg-neutral-50 rounded-[10px] h-[44px] flex items-center px-[12px] gap-[10px] w-[240px]">
          <Image src="/icons/search.svg" alt="Buscar" width={16} height={16} />
          <input
            type="text"
            placeholder="Buscar por cliente, RNC o e-NCF..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="flex-1 font-['Open_Sans'] font-normal leading-[normal] text-text-primary text-[14px] placeholder-[#99a1af] bg-transparent focus:outline-none"
          />
        </div>

        {/* Tipo Selector */}
        <div className="relative bg-white border border-[#e2e8f0] rounded-[10px] h-[44px] w-[84px] flex items-center justify-between px-[13px]">
          <select
            value={tipoFilter}
            onChange={(e) => {
              setTipoFilter(e.target.value as TipoFilter)
              setPage(1)
            }}
            className="w-full h-full bg-transparent font-['Open_Sans'] font-semibold text-[13px] text-[#333] focus:outline-none appearance-none cursor-pointer pr-4"
          >
            <option value="todos">Tipo</option>
            <option value="EMPRESA">Empresa</option>
            <option value="PERSONA">Persona</option>
          </select>
          <div className="absolute right-[13px] pointer-events-none w-[14px] h-[14px] flex items-center justify-center">
            <Image src="/icons/chevron_down.svg" alt="select" width={10} height={10} />
          </div>
        </div>

        {/* Tipo Fiscal Selector */}
        <div className="relative bg-white border border-[#e2e8f0] rounded-[10px] h-[44px] w-[126px] flex items-center justify-between px-[13px]">
          <select
            value={tipoFiscalFilter}
            onChange={(e) => {
              setTipoFiscalFilter(e.target.value as TipoFiscalFilter)
              setPage(1)
            }}
            className="w-full h-full bg-transparent font-['Open_Sans'] font-semibold text-[13px] text-[#333] focus:outline-none appearance-none cursor-pointer pr-4"
          >
            <option value="todos">Tipo fiscal</option>
            <option value="RNC">RNC</option>
            <option value="CEDULA">Cédula</option>
          </select>
          <div className="absolute right-[13px] pointer-events-none w-[14px] h-[14px] flex items-center justify-center">
            <Image src="/icons/chevron_down.svg" alt="select" width={10} height={10} />
          </div>
        </div>

        {/* Validacion DGII Selector */}
        <div className="relative bg-white border border-[#e2e8f0] rounded-[10px] h-[44px] w-[182px] flex items-center justify-between px-[13px]">
          <select
            value={validationFilter}
            onChange={(e) => {
              setValidationFilter(e.target.value as ValidationFilter)
              setPage(1)
            }}
            className="w-full h-full bg-transparent font-['Open_Sans'] font-semibold text-[13px] text-[#333] focus:outline-none appearance-none cursor-pointer pr-4"
          >
            <option value="todos">Validación DGII</option>
            <option value="VALIDO">Válido</option>
            <option value="NO_ENCONTRADO">No encontrado</option>
          </select>
          <div className="absolute right-[13px] pointer-events-none w-[14px] h-[14px] flex items-center justify-center">
            <Image src="/icons/chevron_down.svg" alt="select" width={10} height={10} />
          </div>
        </div>

        {/* Estado Selector */}
        <div className="relative bg-white border border-[#e2e8f0] rounded-[10px] h-[44px] w-[126px] flex items-center justify-between px-[13px]">
          <select
            value={estadoFilter}
            onChange={(e) => {
              setEstadoFilter(e.target.value as EstadoFilter)
              setPage(1)
            }}
            className="w-full h-full bg-transparent font-['Open_Sans'] font-semibold text-[13px] text-[#333] focus:outline-none appearance-none cursor-pointer pr-4"
          >
            <option value="todos">Estado</option>
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
            <option value="OCASIONAL">Ocasional</option>
          </select>
          <div className="absolute right-[13px] pointer-events-none w-[14px] h-[14px] flex items-center justify-center">
            <Image src="/icons/chevron_down.svg" alt="select" width={10} height={10} />
          </div>
        </div>

        {/* Date Range Picker Container */}
        <div className="flex-1 bg-white border border-[#e2e8f0] rounded-[10px] h-[44px] flex items-center px-[13px] justify-between gap-2 min-w-[260px]">
          <div className="flex items-center gap-[10px] w-full">
            <Image src="/icons/calendar.svg" alt="Calendario" width={14} height={14} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPage(1)
              }}
              className="text-[12px] font-['Open_Sans'] font-normal leading-[19.5px] text-[#99a1af] bg-transparent focus:outline-none w-full"
            />
            <span className="text-[#99a1af] font-['Open_Sans'] font-normal text-[16px] leading-[24px]">–</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(1)
              }}
              className="text-[12px] font-['Open_Sans'] font-normal leading-[19.5px] text-[#99a1af] bg-transparent focus:outline-none w-full"
            />
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden font-sans">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm min-w-[1200px]">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-neutral-50/50 text-[13px] font-semibold text-text-secondary h-10">
                <th className="px-4 py-2 font-semibold">Nombre / Razón social</th>
                <th className="px-4 py-2 font-semibold">Tipo</th>
                <th className="px-4 py-2 font-semibold">Tipo fiscal</th>
                <th className="px-4 py-2 font-semibold">RNC / Cédula</th>
                <th className="px-4 py-2 font-semibold">Validación</th>
                <th className="px-4 py-2 font-semibold">e-CF</th>
                <th className="px-4 py-2 font-semibold">Última actividad</th>
                <th className="px-4 py-2 font-semibold">Estado</th>
                <th className="px-4 py-2 font-semibold text-right pr-6">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => {
                const isEmpresa = c.tipo === 'EMPRESA'
                const formattedRnc = c.rnc.length === 9
                  ? c.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
                  : c.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')
                
                const isRnc = c.rnc.replace(/-/g, '').length === 9

                return (
                  <tr 
                    key={c.id} 
                    onClick={() => setSelectedContacto(selectedContacto?.id === c.id ? null : c)}
                    className={`border-b border-[#f1f5f9] last:border-0 hover:bg-neutral-50/30 transition-colors cursor-pointer ${selectedContacto?.id === c.id ? 'bg-neutral-50' : ''}`}
                  >
                    {/* Nombre / Razon social */}
                    <td className="px-4 py-3.5 flex items-center gap-2">
                      <div className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#eff4ff] text-text-secondary flex-shrink-0">
                        <Image src="/icons/building.svg" alt="Building" width={16} height={16} />
                        {/* Dot indicator (Active/Inactive) */}
                        <span className={`absolute bottom-[-1px] right-[-1px] h-3 w-3 rounded-full border-2 border-white ${c.estado === 'ACTIVO' ? 'bg-[#067647]' : c.estado === 'OCASIONAL' ? 'bg-orange-500' : 'bg-neutral-400'}`} />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-semibold text-text-primary text-[12px] leading-tight line-clamp-1 w-[150px]">
                          {c.nombre}
                        </span>
                        <span className="text-[12px] text-[#64748b] leading-tight">
                          {c.tipo === 'EMPRESA' ? 'Cliente' : 'Contacto'}
                        </span>
                      </div>
                    </td>

                    {/* Tipo */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center bg-[rgba(100,116,139,0.1)] text-[#64748b] text-[12px] font-normal px-2.5 py-1 rounded-[10px]">
                        {c.tipo === 'EMPRESA' ? 'Cliente' : 'Contacto'}
                      </span>
                    </td>

                    {/* Tipo fiscal */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center bg-[rgba(6,118,71,0.1)] text-[#067647] text-[12px] font-normal px-2.5 py-1 rounded-[10px]">
                        {isRnc ? 'RNC' : 'ID extranjero'}
                      </span>
                    </td>

                    {/* RNC / Cedula */}
                    <td className="px-4 py-3.5 text-text-primary font-normal text-[12px] tracking-[1.2px]">
                      {formattedRnc}
                    </td>

                    {/* Validacion */}
                    <td className="px-4 py-3.5">
                      {c.validacion === 'VALIDO' ? (
                        <span className="inline-flex items-center gap-1.5 text-[#067647] text-[12px] font-normal">
                          <CheckCircle2 size={14} className="text-[#067647]" />
                          Válido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-orange-700 text-[12px] font-normal">
                          <AlertTriangle size={14} className="text-orange-600" />
                          No encontrado
                        </span>
                      )}
                    </td>

                    {/* e-CF */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center bg-[rgba(100,116,139,0.1)] text-[#64748b] text-[12px] px-2.5 py-1 rounded-[10px]">
                        {c.tipo === 'EMPRESA' ? 'E31' : 'E32'}
                      </span>
                    </td>

                    {/* Ultima actividad */}
                    <td className="px-4 py-3.5 text-[#64748b] text-[12px]">
                      {c.fecha}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3.5">
                      {c.estado === 'ACTIVO' ? (
                        <span className="inline-flex items-center bg-[rgba(6,118,71,0.1)] text-[#067647] text-[12px] font-normal px-2.5 py-1 rounded-[10px]">
                          Activo
                        </span>
                      ) : c.estado === 'OCASIONAL' ? (
                        <span className="inline-flex items-center bg-orange-50 text-orange-700 text-[12px] font-normal px-2.5 py-1 rounded-[10px]">
                          Ocasional
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-neutral-50 text-neutral-600 text-[12px] font-normal px-2.5 py-1 rounded-[10px]">
                          Inactivo
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3.5 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          title="Enviar correo"
                          onClick={() => alert('Enviando estado de cuenta...')}
                          className="text-text-secondary hover:text-[#0379d5] transition-colors focus:outline-none"
                        >
                          <Send size={15} />
                        </button>
                        <button
                          type="button"
                          title="Opciones"
                          className="text-text-secondary hover:text-[#0379d5] transition-colors focus:outline-none"
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
                  <td colSpan={9} className="px-4 py-12 text-center text-body-sm text-text-secondary">
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

      <DetailPanel
        contacto={selectedContacto}
        onClose={() => setSelectedContacto(null)}
        onEmitirFactura={(c) => alert(`Emitiendo factura para ${c.nombre}`)}
        onCrearCotizacion={(c) => alert(`Creando cotización para ${c.nombre}`)}
        onRegistrarCompra={(c) => alert(`Registrando compra para ${c.nombre}`)}
      />
    </div>
  )
}
