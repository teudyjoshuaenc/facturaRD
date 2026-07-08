'use client'

import { useState, useMemo } from 'react'
import type { JSX } from 'react'
import {
  Search,
  Plus,
  RotateCw,
  Download,
  ChevronRight,
  Wrench,
  Package,
  TrendingUp,
  Copy,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  ChevronLeft
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useProductos } from '@/hooks/useProductos'
import { NuevoProductoModal } from '@/components/nueva-factura/NuevoProductoModal'
import { formatCurrency } from '@/lib/comprobantes'
import { Select } from '@/components/ui/select'

const tipoOptions = [
  { value: 'todos', label: 'Todos' },
  { value: 'BIEN', label: 'Bien' },
  { value: 'SERVICIO', label: 'Servicio' },
]

const itbisOptions = [
  { value: 'todos', label: 'ITBIS' },
  { value: 'I1', label: '18% incl.' },
  { value: 'I2', label: '16% incl.' },
  { value: 'I3', label: '0%' },
  { value: 'E', label: 'Exento' },
]

const estadoOptions = [
  { value: 'todos', label: 'Estado' },
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'INACTIVO', label: 'Inactivo' },
]

import { useUI } from '@/lib/context/UIContext'

type TipoFilter = 'todos' | 'BIEN' | 'SERVICIO'
type ItbisFilter = 'todos' | 'I1' | 'I2' | 'I3' | 'E'
type EstadoFilter = 'todos' | 'ACTIVO' | 'INACTIVO'

export default function ProductosPage(): JSX.Element {
  const { allProductos, crearProducto } = useProductos()
  const { globalSearch } = useUI()
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos')
  const [itbisFilter, setItbisFilter] = useState<ItbisFilter>('todos')
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('todos')
  const [page, setPage] = useState(1)
  const [openModal, setOpenModal] = useState(false)

  // Mock initial dataset matching Foto 2 to make it high-fidelity
  const extendedProductos = useMemo(() => {
    const list = [
      { id: 'mock-p1', nombre: 'Consultoría tecnológica', codigo: 'SRV-001 · Hora', tipo: 'SERVICIO', precio: 125400, indicadorFacturacion: 'I1', precioFinal: 100299.99, uso: 42, estado: 'ACTIVO' },
      { id: 'mock-p2', nombre: 'Licencia de software anual', codigo: 'SRV-002 · Hora', tipo: 'BIEN', precio: 21271.19, indicadorFacturacion: 'I1', precioFinal: 100299.99, uso: 18, estado: 'ACTIVO' },
      { id: 'mock-p3', nombre: 'Soporte técnico mensual', codigo: 'SRV-003 · Hora', tipo: 'SERVICIO', precio: 15000, indicadorFacturacion: 'I1', precioFinal: 100299.99, uso: 21, estado: 'ACTIVO' },
    ]
    // Append user-registered products
    allProductos.forEach((p) => {
      if (!list.some((item) => item.nombre === p.nombre)) {
        list.push({
          id: p.id,
          nombre: p.nombre,
          codigo: p.codigo ? `${p.codigo} · SKU` : 'GEN-001 · Unidad',
          tipo: p.tipo,
          precio: p.precio,
          indicadorFacturacion: p.indicadorFacturacion,
          precioFinal: p.precio * (p.indicadorFacturacion === 'I1' ? 1.18 : 1),
          uso: 5,
          estado: 'ACTIVO',
        })
      }
    })
    return list
  }, [allProductos])

  // Filter logic
  const filtered = useMemo(() => {
    let list = [...extendedProductos]
    const activeSearch = (search.trim() ? search : globalSearch).toLowerCase()

    if (activeSearch) {
      list = list.filter(
        (p) =>
          p.nombre.toLowerCase().includes(activeSearch) ||
          p.codigo.toLowerCase().includes(activeSearch)
      )
    }

    if (tipoFilter !== 'todos') {
      list = list.filter((p) => p.tipo === tipoFilter)
    }

    if (itbisFilter !== 'todos') {
      list = list.filter((p) => p.indicadorFacturacion === itbisFilter)
    }

    if (estadoFilter !== 'todos') {
      list = list.filter((p) => p.estado === estadoFilter)
    }

    return list
  }, [extendedProductos, search, globalSearch, tipoFilter, itbisFilter, estadoFilter])

  const paginated = useMemo(() => {
    const offset = (page - 1) * 10
    return filtered.slice(offset, offset + 10)
  }, [filtered, page])

  const totalPages = Math.ceil(filtered.length / 10) || 1

  const ITBIS_LABELS: Record<string, string> = { I1: '18%', I2: '16%', I3: '0%', I4: 'Exento', E: 'Exento' }

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Header and CTA */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h4 font-bold text-text-primary">Productos</h2>
          <p className="text-body-sm text-text-secondary">
            {filtered.length} productos y servicios registrados en catálogo
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
            variant="primary"
            size="md"
            onClick={() => setOpenModal(true)}
            className="h-10 px-4 bg-brand-500 text-white font-semibold"
          >
            <Plus size={16} className="mr-1.5" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-[12px] items-center bg-white p-[17px] rounded-[14px] border border-[#e4e7ec] shadow-sm w-full font-sans">
        {/* Search Input */}
        <div className="relative border border-[#e2e8f0] bg-white rounded-[10px] h-[44px] flex items-center px-[12px] gap-[10px] flex-1 min-w-[280px]">
          <Search size={16} className="text-[#99a1af]" />
          <input
            type="text"
            placeholder="Buscar por producto, SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="flex-1 font-['Open_Sans'] font-normal leading-[normal] text-text-primary text-[14px] placeholder-[#99a1af] bg-transparent focus:outline-none"
          />
        </div>

        {/* Tipo Selector */}
        <Select
          value={tipoFilter}
          onChange={(val) => {
            setTipoFilter(val as TipoFilter)
            setPage(1)
          }}
          options={tipoOptions}
          className="w-[126px] shrink-0"
          triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50 px-[13px]"
        />

        {/* ITBIS Selector */}
        <Select
          value={itbisFilter}
          onChange={(val) => {
            setItbisFilter(val as ItbisFilter)
            setPage(1)
          }}
          options={itbisOptions}
          className="w-[126px] shrink-0"
          triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50 px-[13px]"
        />

        {/* Estado Selector */}
        <Select
          value={estadoFilter}
          onChange={(val) => {
            setEstadoFilter(val as EstadoFilter)
            setPage(1)
          }}
          options={estadoOptions}
          className="w-[126px] shrink-0"
          triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50 px-[13px]"
        />
      </div>

      {/* Product List Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/50 text-ui-sm font-semibold text-text-secondary">
                <th className="px-4 py-3 font-semibold">Nombre / Razón social</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Precio</th>
                <th className="px-4 py-3 font-semibold">ITBIS</th>
                <th className="px-4 py-3 font-semibold">Precio final</th>
                <th className="px-4 py-3 font-semibold">Uso</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right pr-6">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((p) => {
                const isService = p.tipo === 'SERVICIO'
                const ProductIcon = isService ? Wrench : Package

                return (
                  <tr key={p.id} className="border-b border-neutral-200 last:border-0 hover:bg-neutral-50/30 transition-colors">
                    <td className="px-4 py-3 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-text-secondary flex-shrink-0">
                        <ProductIcon size={16} className={isService ? 'text-purple-600' : 'text-blue-600'} />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-semibold text-text-primary text-body-sm line-clamp-1">
                          {p.nombre}
                        </span>
                        <span className="text-[10px] text-text-secondary font-medium mt-0.2 uppercase font-mono">
                          {p.codigo}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary text-body-sm">
                      {isService ? 'Servicio' : 'Bien'}
                    </td>
                    <td className="px-4 py-3.5 text-text-primary font-bold text-body-sm">
                      {p.precio === 0 ? '0.00' : formatCurrency(p.precio)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-ui-xs font-bold text-blue-700">
                        {ITBIS_LABELS[p.indicadorFacturacion] || '18%'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-text-primary font-bold text-body-sm">
                      {p.precioFinal === 0 ? '0.00' : formatCurrency(p.precioFinal)}
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary text-body-sm font-semibold">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-green-500" />
                        <span>{p.uso}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {p.estado === 'ACTIVO' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200/50 px-2.5 py-0.5 text-ui-xs font-semibold text-green-700">
                          <CheckCircle2 size={11} className="text-green-600" />
                          Activo
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
                          title="Duplicar"
                          onClick={() => alert('Duplicando producto...')}
                          className="text-text-secondary hover:text-brand-500 transition-colors focus:outline-none"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          type="button"
                          title="Editar"
                          className="text-text-secondary hover:text-brand-500 transition-colors focus:outline-none"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          title="Eliminar"
                          className="text-red-500 hover:text-red-700 transition-colors focus:outline-none"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-body-sm text-text-secondary">
                    No se encontraron productos en el catálogo.
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

      <NuevoProductoModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSave={crearProducto}
      />
    </div>
  )
}
