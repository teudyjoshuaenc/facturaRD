'use client'

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import type { JSX } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import {
  Search,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Pencil,
  FileCheck,
  Clock
} from 'lucide-react'
import { Select } from '@/components/ui/select'
import { CotizacionesHeader } from '@/components/cotizaciones/CotizacionesHeader'
import { CotizacionesMetrics } from '@/components/cotizaciones/CotizacionesMetrics'
import { formatCurrency } from '@/lib/comprobantes'
import { toast } from 'sonner'
import { useCotizaciones } from '@/hooks/useCotizaciones'
import type { Cotizacion } from '@/hooks/useCotizaciones'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const LIMIT = 10

const estadoOptions = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'ENVIADA', label: 'Enviada' },
  { value: 'APROBADA', label: 'Aprobada' },
  { value: 'RECHAZADA', label: 'Rechazada' },
  { value: 'CONVERTIDA', label: 'Convertida en factura' },
  { value: 'VENCIDA', label: 'Vencida' },
]

type EstadoFilter = 'todos' | 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'CONVERTIDA' | 'VENCIDA'

function formatCotDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const clean = dateStr.includes('T') ? dateStr.split('T')[0]! : dateStr
  const parts = clean.split('-')
  if (parts.length !== 3) return dateStr
  const [year = '2026', month = '01', day = '01'] = parts
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const mIdx = parseInt(month, 10) - 1
  const mName = months[mIdx] ?? 'ene'
  return `${parseInt(day, 10)} ${mName} de ${year}`
}

function formatCotRnc(rncStr: string | null | undefined): string {
  if (!rncStr) return '—'
  const clean = rncStr.replace(/\D/g, '')
  if (clean.length === 9) {
    return `${clean.substring(0, 1)}-${clean.substring(1, 3)}-${clean.substring(3, 8)}-${clean.substring(8, 9)}`
  }
  if (clean.length === 11) {
    return `${clean.substring(0, 3)}-${clean.substring(3, 10)}-${clean.substring(10, 11)}`
  }
  return rncStr
}

function EstadoBadge({ estado }: { estado: Cotizacion['estado'] }): JSX.Element {
  switch (estado) {
    case 'APROBADA':
      return (
        <span className="inline-flex items-center gap-1 bg-[#ecfdf3] text-[#067647] border border-[#d3f9d8] text-[11px] font-semibold px-2 py-0.5 rounded-lg">
          <CheckCircle2 size={12} className="text-[#067647]" />
          Aprobada
        </span>
      )
    case 'ENVIADA':
      return (
        <span className="inline-flex items-center gap-1 bg-[#fffbeb] text-[#b45309] border border-[#fde68a] text-[11px] font-semibold px-2 py-0.5 rounded-lg">
          Enviada
        </span>
      )
    case 'BORRADOR':
      return (
        <span className="inline-flex items-center gap-1 bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0] text-[11px] font-semibold px-2 py-0.5 rounded-lg">
          Borrador
        </span>
      )
    case 'CONVERTIDA':
      return (
        <span className="inline-flex items-center gap-1 bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe] text-[11px] font-semibold px-2 py-0.5 rounded-lg">
          Convertida en factura
        </span>
      )
    case 'VENCIDA':
      return (
        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
          <AlertTriangle size={12} />
          Vencida
        </span>
      )
    case 'RECHAZADA':
      return (
        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
          Rechazada
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0] text-[11px] font-semibold px-2 py-0.5 rounded-lg">
          {estado}
        </span>
      )
  }
}

function CotizacionesPageInner(): JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('todos')
  const [page, setPage] = useState(1)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { cotizaciones, loading, error, total, totalPages, fetchCotizaciones, deleteCotizacion } = useCotizaciones()

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (cotizaciones.length === 0) return
    const allSelected = cotizaciones.every(c => selectedIds.has(c.id))
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        cotizaciones.forEach(c => next.delete(c.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        cotizaciones.forEach(c => next.add(c.id))
        return next
      })
    }
  }

  const handleBulkSend = () => {
    toast.success(`Enviando ${selectedIds.size} cotizaciones seleccionadas...`)
  }

  const handleBulkDownload = () => {
    toast.success(`Descargando ${selectedIds.size} cotizaciones seleccionadas...`)
  }

  const handleBulkExport = () => {
    const selectedList = cotizaciones.filter(c => selectedIds.has(c.id))
    if (selectedList.length === 0) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Por favor permita las ventanas emergentes para exportar a PDF')
      return
    }

    const htmlContent = `
      <html>
        <head>
          <title>Exportación de Cotizaciones</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 40px; color: #333; }
            h1 { font-size: 22px; margin-bottom: 24px; border-bottom: 2px solid #eaeaea; padding-bottom: 12px; color: #111; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border-bottom: 1px solid #eaeaea; padding: 12px 10px; text-align: left; font-size: 13px; }
            th { background-color: #fafafa; font-weight: 600; color: #666; border-top: 1px solid #eaeaea; }
            .total-row { font-weight: bold; background-color: #fafafa; }
            .footer { margin-top: 40px; font-size: 11px; color: #888; text-align: right; }
          </style>
        </head>
        <body>
          <h1>Reporte de Cotizaciones</h1>
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>RNC</th>
                <th>Fecha</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${selectedList.map(c => `
                <tr>
                  <td><b>${c.folio}</b></td>
                  <td>${c.contacto?.nombre || '—'}</td>
                  <td>${c.contacto?.rnc || '—'}</td>
                  <td>${formatCotDate(c.createdAt)}</td>
                  <td>${formatCotDate(c.fechaVigencia)}</td>
                  <td>${c.estado}</td>
                  <td>${formatCurrency(c.total)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="6" style="text-align: right;">Total General:</td>
                <td>${formatCurrency(selectedList.reduce((sum, c) => sum + Number(c.total || 0), 0))}</td>
              </tr>
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

  // Debounced search fetch
  const doFetch = useCallback(() => {
    const q: Parameters<typeof fetchCotizaciones>[0] = { page, limit: LIMIT }
    if (search.trim()) q.search = search.trim()
    if (estadoFilter !== 'todos') q.estado = estadoFilter
    fetchCotizaciones(q)
    setSelectedIds(new Set())
  }, [fetchCotizaciones, page, search, estadoFilter])

  useEffect(() => {
    const t = setTimeout(doFetch, 350)
    return () => clearTimeout(t)
  }, [doFetch])

  const handleRefresh = () => {
    doFetch()
  }

  // Compute metrics from live data
  const metrics = useMemo(() => {
    const totalAmount = cotizaciones.reduce((acc, c) => acc + Number(c.total || 0), 0)
    const totalCount = total
    const pendientes = cotizaciones.filter((c) => c.estado === 'BORRADOR' || c.estado === 'ENVIADA').length
    const aprobadas = cotizaciones.filter((c) => c.estado === 'APROBADA').length
    const convertidas = cotizaciones.filter((c) => c.estado === 'CONVERTIDA').length
    const vencidas = cotizaciones.filter((c) => c.estado === 'VENCIDA').length
    return { totalAmount, totalCount, pendientes, aprobadas, convertidas, vencidas }
  }, [cotizaciones, total])



  return (
    <div className="flex flex-col gap-6 text-left w-full">
      <CotizacionesHeader
        onRefresh={handleRefresh}
        isRefreshing={loading}
        onExport={handleBulkExport}
        onNew={() => router.push('/cotizaciones/nueva')}
        isSelectionMode={isSelectionMode}
        onToggleSelectionMode={toggleSelectionMode}
        selectedCount={selectedIds.size}
        onBulkSend={handleBulkSend}
        onBulkDownload={handleBulkDownload}
      />

      {/* Summary Cards Row */}
      <CotizacionesMetrics metrics={metrics} />

      {/* Filter Row */}
      <div className="flex flex-wrap gap-[12px] items-center bg-white p-[17px] rounded-[14px] border border-[#e4e7ec] shadow-sm w-full font-sans justify-between">
        {/* Search Input */}
        <div className="relative border border-[#e2e8f0] bg-white rounded-[10px] h-[44px] flex items-center px-[12px] gap-[10px] flex-1 min-w-[280px]">
          <Search size={16} className="text-[#99a1af]" />
          <input
            type="text"
            placeholder="Buscar por cliente, RNC o folio..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="flex-1 font-['Open_Sans'] font-normal leading-[normal] text-text-primary text-[14px] placeholder-[#99a1af] bg-transparent focus:outline-none"
          />
        </div>

        {/* Estado Selector */}
        <Select
          value={estadoFilter}
          onChange={(val) => {
            setEstadoFilter(val as EstadoFilter)
            setPage(1)
          }}
          options={estadoOptions}
          className="w-[200px] shrink-0"
          triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden font-sans">
        {error && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-100 text-red-700 text-[13px] flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm min-w-[1000px] select-none">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-neutral-50/50 text-[13px] font-semibold text-text-secondary h-10">
                <th className={cn("p-0 text-center align-middle transition-all duration-300 ease-in-out border-b border-[#f1f5f9] bg-neutral-50/50", isSelectionMode ? "w-10" : "w-0")}>
                  <div className={cn(
                    "transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-center h-10 pl-4 origin-left",
                    isSelectionMode ? "w-10 opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 -translate-x-4 scale-0"
                  )}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
                      checked={cotizaciones.length > 0 && cotizaciones.every(c => selectedIds.has(c.id))}
                      onChange={handleSelectAll}
                    />
                  </div>
                </th>
                <th className="px-4 py-2 font-semibold">Folio</th>
                <th className="px-4 py-2 font-semibold">Cliente</th>
                <th className="px-4 py-2 font-semibold">Fecha</th>
                <th className="px-4 py-2 font-semibold">Vencimiento</th>
                <th className="px-4 py-2 font-semibold">Total</th>
                <th className="px-4 py-2 font-semibold">Estado</th>
                <th className="px-4 py-2 font-semibold">Ítems</th>
                <th className="px-4 py-2 font-semibold text-right pr-6">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && cotizaciones.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex justify-center">
                      <Spinner size={24} />
                    </div>
                  </td>
                </tr>
              )}
              {!loading && cotizaciones.length === 0 && !error && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-body-sm text-text-secondary">
                    <div className="flex flex-col items-center gap-2">
                      <Clock size={28} className="text-neutral-300" />
                      <p>No se encontraron cotizaciones.</p>
                      <button
                        type="button"
                        onClick={() => router.push('/cotizaciones/nueva')}
                        className="mt-1 text-[#0379d5] font-semibold text-[13px] hover:underline"
                      >
                        Crear la primera cotización →
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {cotizaciones.map((c) => {
                const isSelected = selectedIds.has(c.id)
                const clienteNombre = c.contacto?.nombre ?? '—'
                const clienteRnc = c.contacto?.rnc ?? ''
                return (
                  <tr
                    key={c.id}
                    onClick={() => {
                      if (isSelectionMode) {
                        toggleSelect(c.id)
                      } else {
                        router.push(`/cotizaciones/${c.id}`)
                      }
                    }}
                    className={`border-b border-[#f1f5f9] last:border-0 hover:bg-[#f8fafc] cursor-pointer transition-colors h-[52px] bg-white`}
                  >
                    <td className={cn("p-0 text-center align-middle transition-all duration-300 ease-in-out border-b border-[#f1f5f9]", isSelectionMode ? "w-10" : "w-0")} onClick={(e) => e.stopPropagation()}>
                      <div className={cn(
                        "transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-center h-[52px] pl-4 origin-left",
                        isSelectionMode ? "w-10 opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 -translate-x-4 scale-0"
                      )}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelect(c.id)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-text-primary text-[13px] align-middle">
                      {c.folio}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col text-left">
                        <span className="font-semibold text-text-primary text-[13px] leading-tight">
                          {clienteNombre}
                        </span>
                        {clienteRnc && (
                          <span className="text-[11px] text-[#64748b] leading-tight mt-0.5">
                            {formatCotRnc(clienteRnc)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary text-[12px] align-middle">
                      {formatCotDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary text-[12px] align-middle">
                      {formatCotDate(c.fechaVigencia)}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-text-primary text-[13px] align-middle">
                      {formatCurrency(c.total)}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <EstadoBadge estado={c.estado} />
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary text-[12px] align-middle">
                      {c.items?.length ?? 0} ítem{(c.items?.length ?? 0) !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3.5 text-right pr-6 align-middle" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => router.push(`/cotizaciones/nueva?cloneId=${c.id}`)}
                          className="text-[#64748b] hover:text-[#333] transition-colors focus:outline-none"
                          title="Duplicar"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/cotizaciones/nueva?id=${c.id}`)}
                          className="text-[#64748b] hover:text-[#333] transition-colors focus:outline-none"
                          title="Editar"
                          disabled={c.estado === 'CONVERTIDA'}
                        >
                          <Pencil size={14} className={c.estado === 'CONVERTIDA' ? 'opacity-30' : ''} />
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const res = await api.post(`/cotizaciones/${c.id}/convertir`, { emitir: false })
                              const comp = res.data.comprobante
                              toast.success('Cotización convertida a borrador de factura')
                              router.push(`/nueva-factura?id=${comp.id}`)
                            } catch (err) {
                              toast.error('Error al convertir la cotización')
                            }
                          }}
                          className="text-[#0379d5] hover:text-[#0262ad] transition-colors focus:outline-none"
                          title="Convertir en factura"
                          disabled={c.estado === 'CONVERTIDA'}
                        >
                          <FileCheck size={14} className={c.estado === 'CONVERTIDA' ? 'opacity-30' : ''} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3.5 bg-white">
          <p className="text-ui-sm text-text-secondary">{total} resultado{total !== 1 ? 's' : ''}</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-text-secondary hover:bg-neutral-50 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-ui-sm font-bold text-white shadow-sm">
              {page}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-text-secondary hover:bg-neutral-50 disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CotizacionesPage(): JSX.Element {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} />
      </div>
    }>
      <CotizacionesPageInner />
    </Suspense>
  )
}
