'use client'

import { useState, useMemo, useEffect } from 'react'
import type { JSX } from 'react'
import {
  Search,
  Plus,
  Wrench,
  Package,
  Copy,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProductos } from '@/hooks/useProductos'
import { EditActionButton, RefreshActionButton, ExportActionButton, NewActionButton } from '@/components/ui/table-actions'
import { NuevoProductoModal } from '@/components/nueva-factura/NuevoProductoModal'
import { formatCurrency } from '@/lib/comprobantes'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ProductDetailPanel } from '@/components/producto/ProductDetailPanel'
import { EditarProductoModal } from '@/components/producto/EditarProductoModal'
import { ConfirmDeleteModal } from '@/components/ui/confirm-delete-modal'
import { Modal } from '@/components/ui/modal'
import { useUI } from '@/lib/context/UIContext'
import { toast } from 'sonner'

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

type TipoFilter = 'todos' | 'BIEN' | 'SERVICIO'
type ItbisFilter = 'todos' | 'I1' | 'I2' | 'I3' | 'E'
type EstadoFilter = 'todos' | 'ACTIVO' | 'INACTIVO'

export default function ProductosPage(): JSX.Element {
  const { globalSearch } = useUI()
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos')
  const [itbisFilter, setItbisFilter] = useState<ItbisFilter>('todos')
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('todos')
  const [page, setPage] = useState(1)

  const useProductosParams = useMemo(() => {
    const params: { activo?: boolean } = {}
    if (estadoFilter !== 'todos') {
      params.activo = estadoFilter === 'ACTIVO'
    }
    return params
  }, [estadoFilter])

  const { allProductos, crearProducto, actualizarProducto, eliminarProducto, refetch, isFetching } = useProductos(useProductosParams)
  const [openModal, setOpenModal] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('new=true')) {
      setOpenModal(true)
      const url = new URL(window.location.href)
      url.searchParams.delete('new')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const [selectedProductoId, setSelectedProductoId] = useState<string | null>(null)
  const [editingProducto, setEditingProducto] = useState<any | null>(null)
  const [deletingProducto, setDeletingProducto] = useState<any | null>(null)
  const [togglingProducto, setTogglingProducto] = useState<any | null>(null)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    setSelectedIds(new Set())
  }

  const handleBulkExport = () => {
    const selectedList = filtered.filter(p => selectedIds.has(p.id))
    if (selectedList.length === 0) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Por favor permita las ventanas emergentes para exportar a PDF')
      return
    }

    const htmlContent = `
      <html>
        <head>
          <title>Exportación de Catálogo de Productos</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 40px; color: #333; }
            h1 { font-size: 22px; margin-bottom: 24px; border-bottom: 2px solid #eaeaea; padding-bottom: 12px; color: #111; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border-bottom: 1px solid #eaeaea; padding: 12px 10px; text-align: left; font-size: 13px; }
            th { background-color: #fafafa; font-weight: 600; color: #666; border-top: 1px solid #eaeaea; }
            .footer { margin-top: 40px; font-size: 11px; color: #888; text-align: right; }
          </style>
        </head>
        <body>
          <h1>Catálogo de Productos</h1>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Precio</th>
                <th>ITBIS</th>
                <th>Precio Final</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${selectedList.map(p => {
                const tipoLabel = p.tipo === 'SERVICIO' ? 'Servicio' : 'Bien'
                const itbisLabel = ITBIS_LABELS[p.indicadorFacturacion] || '18%'
                return "<tr>" +
                  "<td><b>" + (p.codigo || '—') + "</b></td>" +
                  "<td>" + (p.nombre || '—') + "</td>" +
                  "<td>" + tipoLabel + "</td>" +
                  "<td>" + formatCurrency(p.precio) + "</td>" +
                  "<td>" + itbisLabel + "</td>" +
                  "<td>" + formatCurrency(p.precioFinal) + "</td>" +
                  "<td>" + (p.estado || '—') + "</td>" +
                  "</tr>"
              }).join('')}
            </tbody>
          </table>
          <div class="footer">
            Generado automáticamente el ${new Date().toLocaleDateString()}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `
    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  const [localMockOverrides, setLocalMockOverrides] = useState<Record<string, any>>({})
  const [deletedMockIds, setDeletedMockIds] = useState<string[]>([])

  // Sólo productos reales de GET /productos (sin fallback mock).
  const extendedProductos = useMemo(
    () =>
      allProductos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        codigo: p.codigo ? `${p.codigo} · SKU` : 'GEN-001 · Unidad',
        tipo: p.tipo,
        precio: p.precio,
        indicadorFacturacion: p.indicadorFacturacion,
        precioFinal: p.precio * (p.indicadorFacturacion === 'I1' ? 1.18 : 1),
        uso: 5,
        estado: p.activo ? 'ACTIVO' : 'INACTIVO',
      })),
    [allProductos],
  )

  const selectedProducto = useMemo(() => {
    if (!selectedProductoId) return null
    return extendedProductos.find((p) => p.id === selectedProductoId) || null
  }, [selectedProductoId, extendedProductos])

  const handleDuplicar = async (producto: any) => {
    try {
      const rawCode = producto.codigo?.split(' · ')[0] || producto.codigo || ''
      const newCodigo = rawCode ? `${rawCode}-COPY` : ''
      await crearProducto({
        nombre: `${producto.nombre} (copia)`,
        tipo: producto.tipo,
        codigo: newCodigo,
        precio: producto.precio,
        indicadorFacturacion: producto.indicadorFacturacion === 'EXENTO' ? 'E' : producto.indicadorFacturacion,
        precioIncluyeItbis: producto.precioIncluyeItbis || false,
        unidadMedida: producto.unidadMedida,
        descripcion: producto.descripcion,
      })
    } catch (error) {
      // Error is handled by hook
    }
  }

  const handleEditSave = async (id: string, data: any) => {
    try {
      await actualizarProducto(id, data)
      setEditingProducto(null)
    } catch (error) {
      // Error is handled by hook
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingProducto) return
    try {
      await eliminarProducto(deletingProducto.id)
      if (selectedProductoId === deletingProducto.id) {
        setSelectedProductoId(null)
      }
      setDeletingProducto(null)
    } catch (error) {
      // Error is handled by hook
    }
  }

  const handleToggleEstado = (producto: any) => {
    setTogglingProducto(producto)
  }

  const confirmToggleEstado = async () => {
    if (!togglingProducto) return
    try {
      const nuevoEstadoActivo = togglingProducto.estado !== 'ACTIVO'
      await actualizarProducto(togglingProducto.id, { activo: nuevoEstadoActivo })
      setTogglingProducto(null)
    } catch (error) {
      // Error is handled by hook
    }
  }

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
  const nameColClass = selectedProducto ? "min-w-[200px]" : "w-[500px] max-w-[500px]"
  const priceColClass = selectedProducto ? "w-[155px] max-w-[155px] truncate" : ""

  return (
    <div className="flex flex-col gap-6 text-left w-full">
      {/* Header and CTA */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h4 font-bold text-text-primary">Productos</h2>
          <p className="text-body-sm text-text-secondary">
            {filtered.length} productos y servicios registrados en catálogo
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* EDIT/PENCIL BUTTON - visible only in normal mode */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-left flex items-center justify-center overflow-hidden h-[48px] -my-1 -mx-0.5",
            isSelectionMode ? "w-0 opacity-0 -translate-x-4 scale-0 -mr-2.5" : "w-[44px] opacity-100 translate-x-0 scale-100"
          )}>
            <EditActionButton
              onClick={toggleSelectionMode}
              title="Activar selección"
              className="h-10 w-10 border-neutral-200"
            />
          </div>

          {/* RELOAD/REFRESH BUTTON - always visible */}
          <RefreshActionButton
            onClick={() => refetch()}
            isLoading={isFetching}
            className="h-10 w-10 border-neutral-200"
          />

          {/* EXPORT BUTTON - visible only in selection mode */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-right flex items-center justify-center overflow-hidden h-[48px] -my-1 -mx-0.5",
            isSelectionMode ? "w-[118px] opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 translate-x-4 scale-0 -mr-2.5"
          )}>
            <ExportActionButton
              onClick={handleBulkExport}
              disabled={selectedIds.size === 0}
              title="Exportar"
              className="h-10 w-[114px] justify-center border-neutral-200"
            />
          </div>

          {/* CANCELAR BUTTON - visible only in selection mode, styled red */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-right flex items-center justify-center overflow-hidden h-[48px] -my-1 -mx-0.5",
            isSelectionMode ? "w-[114px] opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 translate-x-4 scale-0 -mr-2.5"
          )}>
            <button
              onClick={toggleSelectionMode}
              className="h-10 px-[17px] flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-semibold rounded-[10px] transition-all focus:outline-none shrink-0 w-[110px] font-sans text-[14px] border-none"
            >
              Cancelar
            </button>
          </div>

          {/* NUEVO PRODUCTO BUTTON - visible only in normal mode */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-left flex items-center justify-center overflow-hidden h-[48px] -my-1 -mx-0.5",
            isSelectionMode ? "w-0 opacity-0 -translate-x-4 scale-0" : "w-[174px] opacity-100 translate-x-0 scale-100"
          )}>
            <NewActionButton
              onClick={() => setOpenModal(true)}
              label="Nuevo Producto"
              className="h-10 w-[170px] justify-center"
            />
          </div>
        </div>
      </div>

      <div className={cn("flex items-start w-full transition-all duration-300 ease-in-out", selectedProducto ? 'gap-[24px]' : 'gap-0')}>
        <div className="flex-1 flex flex-col gap-6 transition-all duration-300 min-w-0">
          {/* Filter Row */}
          <div className="flex flex-wrap gap-[12px] items-center bg-white p-[17px] rounded-[14px] border border-[#e4e7ec] shadow-sm w-full font-sans">
            {/* Search Input */}
            <div className="relative border border-[#e2e8f0] bg-white rounded-[10px] h-[44px] flex items-center px-[12px] gap-[10px] flex-1 min-w-[150px]">
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
              className="w-[110px] shrink-0"
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
              className="w-[100px] shrink-0"
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
              className="w-[100px] shrink-0"
              triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50 px-[13px]"
            />
          </div>

          {/* Product List Table */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/50 text-ui-sm font-semibold text-text-secondary h-10 select-none">
                    <th className={cn("p-0 text-center align-middle transition-all duration-300 ease-in-out border-b border-neutral-200 bg-neutral-50/50", isSelectionMode ? "w-10" : "w-0")}>
                      <div className={cn(
                        "transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-center h-10 pl-4 origin-left",
                        isSelectionMode ? "w-10 opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 -translate-x-4 scale-0"
                      )}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
                          checked={paginated.length > 0 && paginated.every(p => selectedIds.has(p.id))}
                          onChange={() => {
                            const allSelected = paginated.every(p => selectedIds.has(p.id))
                            if (allSelected) {
                              setSelectedIds(prev => {
                                const next = new Set(prev)
                                paginated.forEach(p => next.delete(p.id))
                                return next
                              })
                            } else {
                              setSelectedIds(prev => {
                                const next = new Set(prev)
                                paginated.forEach(p => next.add(p.id))
                                return next
                              })
                            }
                          }}
                        />
                      </div>
                    </th>
                    <th className={cn("px-4 py-3 font-semibold", nameColClass)}>Nombre / Razón social</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className={cn("px-4 py-3 font-semibold", priceColClass)}>Precio</th>
                    <th className="px-4 py-3 font-semibold">ITBIS</th>
                    <th className={cn("px-4 py-3 font-semibold", priceColClass)}>Precio final</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((p) => {
                    const isService = p.tipo === 'SERVICIO'
                    const ProductIcon = isService ? Wrench : Package

                      const isSelected = selectedIds.has(p.id)

                      return (
                        <tr
                          key={p.id}
                          onClick={() => {
                            if (isSelectionMode) {
                              setSelectedIds(prev => {
                                const next = new Set(prev)
                                if (next.has(p.id)) {
                                  next.delete(p.id)
                                } else {
                                  next.add(p.id)
                                }
                                return next
                              })
                            } else {
                              setSelectedProductoId(p.id)
                            }
                          }}
                          className={`border-b border-neutral-200 last:border-0 hover:bg-neutral-50/30 transition-colors cursor-pointer ${isSelected ? 'bg-[rgba(3,121,213,0.05)] hover:bg-[rgba(3,121,213,0.08)]' : 'bg-white'}`}
                        >
                          <td className={cn("p-0 text-center align-middle transition-all duration-300 ease-in-out border-b border-neutral-200", isSelectionMode ? "w-10" : "w-0")} onClick={(e) => e.stopPropagation()}>
                            <div className={cn(
                              "transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-center h-12 pl-4 origin-left",
                              isSelectionMode ? "w-10 opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 -translate-x-4 scale-0"
                            )}>
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedIds(prev => {
                                    const next = new Set(prev)
                                    if (next.has(p.id)) {
                                      next.delete(p.id)
                                    } else {
                                      next.add(p.id)
                                    }
                                    return next
                                  })
                                }}
                              />
                            </div>
                          </td>
                          <td className={cn("px-4 py-3 flex items-center gap-3", nameColClass)}>
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
                        <td
                          className={cn("px-4 py-3.5 text-text-primary font-bold text-body-sm", priceColClass)}
                          title={p.precio === 0 ? '0.00' : formatCurrency(p.precio)}
                        >
                          {p.precio === 0 ? '0.00' : formatCurrency(p.precio)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-ui-xs font-bold text-blue-700">
                            {ITBIS_LABELS[p.indicadorFacturacion] || '18%'}
                          </span>
                        </td>
                        <td
                          className={cn("px-4 py-3.5 text-text-primary font-bold text-body-sm", priceColClass)}
                          title={p.precioFinal === 0 ? '0.00' : formatCurrency(p.precioFinal)}
                        >
                          {p.precioFinal === 0 ? '0.00' : formatCurrency(p.precioFinal)}
                        </td>

                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleEstado(p)
                            }}
                            className="focus:outline-none"
                          >
                            {p.estado === 'ACTIVO' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200/50 px-2.5 py-0.5 text-ui-xs font-semibold text-green-700 hover:bg-green-100 transition-colors">
                                <CheckCircle2 size={11} className="text-green-600" />
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-50 border border-neutral-200/50 px-2.5 py-0.5 text-ui-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors">
                                <XCircle size={11} className="text-neutral-500" />
                                Inactivo
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3.5">
                            <button
                              type="button"
                              title="Duplicar"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDuplicar(p)
                              }}
                              className="text-text-secondary hover:text-brand-500 transition-colors focus:outline-none"
                            >
                              <Copy size={15} />
                            </button>
                            <button
                              type="button"
                              title="Editar"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingProducto(p)
                              }}
                              className="text-text-secondary hover:text-brand-500 transition-colors focus:outline-none"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              title="Eliminar"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeletingProducto(p)
                              }}
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
                      <td colSpan={7} className="px-4 py-12 text-center text-body-sm text-text-secondary">
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
        </div>

        <div
          className={cn(
            "transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0",
            selectedProducto ? 'w-[400px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
          )}
        >
          {selectedProducto && (
            <ProductDetailPanel
              producto={selectedProducto}
              onClose={() => setSelectedProductoId(null)}
              onEditar={(p) => setEditingProducto(p)}
              onDuplicar={(p) => handleDuplicar(p)}
              onEliminar={(p) => setDeletingProducto(p)}
              onToggleEstado={handleToggleEstado}
            />
          )}
        </div>
      </div>

      <EditarProductoModal
        open={!!editingProducto}
        producto={editingProducto}
        onClose={() => setEditingProducto(null)}
        onSave={handleEditSave}
      />

      <ConfirmDeleteModal
        open={!!deletingProducto}
        itemName={deletingProducto?.nombre ?? null}
        onClose={() => setDeletingProducto(null)}
        onConfirm={handleDeleteConfirm}
      />

      <NuevoProductoModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSave={crearProducto}
      />

      <Modal
        open={togglingProducto !== null}
        onClose={() => setTogglingProducto(null)}
        title={togglingProducto?.estado === 'ACTIVO' ? 'Desactivar producto' : 'Activar producto'}
        subtitle=""
        icon={<AlertTriangle size={20} className="text-[#f79009]" />}
        className="max-w-[448px]"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setTogglingProducto(null)}
              className="h-10 rounded-[10px] border-[#e2e8f0] text-[#64748b] text-[13px]"
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={confirmToggleEstado}
              className="h-10 rounded-[10px] bg-[#0379D5] hover:bg-[#0262ad] text-white border-0 text-[13px]"
            >
              Confirmar
            </Button>
          </div>
        }
      >
        <div className="py-2 text-left">
          <p className="text-[14px] text-[#64748b] leading-[22px] font-sans">
            ¿Estás seguro de que deseas{' '}
            <span className="font-bold text-[#333]">
              {togglingProducto?.estado === 'ACTIVO' ? 'desactivar' : 'activar'}
            </span>{' '}
            el producto{' '}
            <span className="font-bold text-[#333]">{togglingProducto?.nombre}</span>
            {togglingProducto?.codigo ? (
              <>
                {' '}
                (Código/SKU: <span className="font-bold text-[#333]">{togglingProducto.codigo}</span>)
              </>
            ) : ''}
            ?
          </p>
        </div>
      </Modal>
    </div>
  )
}
