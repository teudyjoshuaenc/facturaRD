'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import { X, Download, Send, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'
import { FacturaFilters } from '@/components/facturas/FacturaFilters'
import { FacturaRow } from '@/components/facturas/FacturaRow'
import { DetailPanel } from '@/components/facturas/DetailPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ReenviarModal } from '@/components/facturas/ReenviarModal'
import { ConfirmReemitirModal } from '@/components/facturas/ConfirmReemitirModal'
import { Comprobante } from '@/lib/comprobantes'
import { useComprobantes } from '@/hooks/useComprobantes'
import { api, getErrorMessage } from '@/lib/api'
import { toast } from 'sonner'
import { EditActionButton, RefreshActionButton, ExportActionButton } from '@/components/ui/table-actions'
import { cn } from '@/lib/utils'
import { useEmissionStatus } from '@/hooks/useEmissionStatus'
import {
  ESTADO_LABELS,
  ESTADO_BADGE_VARIANT,
  TIPO_ECF_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/comprobantes'

export default function FacturasPage(): JSX.Element {
  const router = useRouter()
  const {
    comprobantes,
    paginationData,
    isLoading,
    page,
    setPage,
    estadoFilter,
    setEstadoFilter,
    search,
    setSearch,
    tipoFilter,
    setTipoFilter,
    claseFilter,
    setClaseFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    minAmount,
    setMinAmount,
    maxAmount,
    setMaxAmount,
    selectedId,
    setSelectedId,
    detail,
    detailLoading,
    downloadingId,
    handleDownload,
    isFetching,
    refetch,
  } = useComprobantes()

  const { blockingReason } = useEmissionStatus()

  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    setSelectedIds(new Set())
  }

  const handleBulkSend = () => {
    toast.success(`Enviando ${selectedIds.size} facturas seleccionadas...`)
  }

  const handleBulkDownload = () => {
    toast.success(`Descargando ${selectedIds.size} facturas seleccionadas...`)
  }

  const [reenviarComprobante, setReenviarComprobante] = useState<Comprobante | null>(null)
  const [comprobanteToEmit, setComprobanteToEmit] = useState<Comprobante | null>(null)
  const [emittingId, setEmittingId] = useState<string | null>(null)

  async function executeEmit(c: Comprobante) {
    setEmittingId(c.id)
    try {
      await api.post(`/comprobantes/${c.id}/emitir`)
      toast.success('Comprobante emitido exitosamente')
      refetch()
      setSelectedId(null)
    } catch (err) {
      toast.error('Error al emitir comprobante', { description: getErrorMessage(err) })
    } finally {
      setEmittingId(null)
      setComprobanteToEmit(null)
    }
  }

  async function handleEmitir(c: Comprobante) {
    if (emittingId) return
    if (blockingReason) {
      toast.error('Emisión bloqueada', { description: blockingReason })
      return
    }
    setComprobanteToEmit(c)
  }

  async function handleDelete(c: Comprobante) {
    if (!window.confirm(`¿Eliminar la nota de venta ${c.folioInterno ?? ''}? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/comprobantes/${c.id}`)
      toast.success('Nota de venta eliminada')
      if (selectedId === c.id) setSelectedId(null)
      refetch()
    } catch (err) {
      toast.error('No se pudo eliminar', { description: getErrorMessage(err) })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header row: count + actions */}
      <div className="flex items-center justify-between select-none">
        <div className="flex flex-col items-start font-sans">
          <h1 className="text-[24px] font-semibold leading-[36px] text-[#333333]">
            Facturas
          </h1>
          <p className="text-[14px] font-normal leading-[21px] text-[#64748b] mt-0.5">
            {paginationData ? `${paginationData.total} facturas` : `${comprobantes.length} facturas`} · {comprobantes.length} visibles
          </p>
        </div>
        <div className="flex items-center gap-[8px]">
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push('/nueva-factura')}
            className="h-9 px-4 font-semibold"
          >
            + Crear factura
          </Button>
          <EditActionButton onClick={() => {
            if (!selectedId) {
              toast.error('Seleccione un comprobante para editar')
              return
            }
            router.push(`/nueva-factura?id=${selectedId}`)
          }} />
          <RefreshActionButton onClick={() => refetch()} isLoading={isFetching} />

          {/* SELECTION ACTIONS CONTAINER */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-right flex items-center gap-[8px] overflow-hidden h-[52px] -my-1 -mx-0.5 px-0.5",
            isSelectionMode ? "w-[497px] opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 translate-x-4 scale-0 -mr-[8px]"
          )}>
            <ExportActionButton
              onClick={() => {
                if (isSelectionMode) {
                  const selectedList = comprobantes.filter(c => selectedIds.has(c.id))
                  toast.success(`Exportando ${selectedList.length} facturas seleccionadas...`)
                } else {
                  alert('Exportar comprobantes')
                }
              }}
              disabled={isSelectionMode && selectedIds.size === 0}
              title="Exportar comprobantes"
              className="w-[114px] justify-center"
            />
            <button
              onClick={handleBulkSend}
              disabled={selectedIds.size === 0}
              className="h-[44px] px-[17px] flex items-center justify-center gap-[9px] border border-[#d0d5dd] rounded-[10px] hover:bg-neutral-50 text-[#64748b] disabled:opacity-50 transition-all focus:outline-none shrink-0 bg-white w-[110px] font-sans font-normal text-[14px] leading-[21px]"
            >
              <Send size={14} className="text-[#64748b] shrink-0" />
              <span className="font-normal text-[#64748b] text-[14px] leading-[21px] whitespace-nowrap">
                Enviar
              </span>
            </button>
            <button
              onClick={handleBulkDownload}
              disabled={selectedIds.size === 0}
              className="h-[44px] px-[17px] flex items-center justify-center gap-[9px] border border-[#d0d5dd] rounded-[10px] hover:bg-neutral-50 text-[#64748b] disabled:opacity-50 transition-all focus:outline-none shrink-0 bg-white w-[135px] font-sans font-normal text-[14px] leading-[21px]"
            >
              <Download size={14} className="text-[#64748b] shrink-0" />
              <span className="font-normal text-[#64748b] text-[14px] leading-[21px] whitespace-nowrap">
                Descargar
              </span>
            </button>
            <button
              onClick={toggleSelectionMode}
              className="h-[44px] px-[17px] flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-semibold rounded-[10px] transition-all focus:outline-none shrink-0 w-[110px] font-sans text-[14px] border-none"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      {/* Main split layout grid */}
      <div className={`flex items-start w-full transition-all duration-300 ease-in-out ${selectedId ? 'gap-[24px]' : 'gap-0'}`}>
        {/* Left Side: Filters + Table */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <FacturaFilters
            estadoFilter={estadoFilter}
            search={search}
            onEstadoChange={setEstadoFilter}
            onSearchChange={setSearch}
            tipoFilter={tipoFilter}
            onTipoFilterChange={setTipoFilter}
            claseFilter={claseFilter}
            onClaseFilterChange={setClaseFilter}
            startDate={startDate}
            onStartDateChange={setStartDate}
            endDate={endDate}
            onEndDateChange={setEndDate}
            minAmount={minAmount}
            onMinAmountChange={setMinAmount}
            maxAmount={maxAmount}
            onMaxAmountChange={setMaxAmount}
          />

          <div className="rounded-[14px] border border-[#e2e8f0] bg-white shadow-sm overflow-hidden flex flex-col">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Spinner size={28} />
              </div>
            ) : comprobantes.length === 0 ? (
              <div className="flex items-center justify-center p-12 text-center text-body-sm text-text-secondary">
                No se encontraron comprobantes
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[12px] font-normal text-[#64748b] h-[40px] select-none">
                      <th className={cn("p-0 text-center align-middle transition-all duration-300 ease-in-out border-b border-[#e2e8f0] bg-[#f8fafc]", isSelectionMode ? "w-10" : "w-0")}>
                        <div className={cn(
                          "transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-center h-[40px] pl-4 origin-left",
                          isSelectionMode ? "w-10 opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 -translate-x-4 scale-0"
                        )}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
                            checked={comprobantes.length > 0 && comprobantes.every(c => selectedIds.has(c.id))}
                            onChange={() => {
                              const allSelected = comprobantes.every(c => selectedIds.has(c.id))
                              if (allSelected) {
                                setSelectedIds(prev => {
                                  const next = new Set(prev)
                                  comprobantes.forEach(c => next.delete(c.id))
                                  return next
                                })
                              } else {
                                setSelectedIds(prev => {
                                  const next = new Set(prev)
                                  comprobantes.forEach(c => next.add(c.id))
                                  return next
                                })
                              }
                            }}
                          />
                        </div>
                      </th>
                      <th className="px-[16px] py-[10px] w-[90px] min-w-[90px] font-normal">e-NCF</th>
                      <th className="px-[16px] py-[10px] w-[120px] min-w-[120px] font-normal">Cliente</th>
                      <th className="px-[16px] py-[10px] w-[70px] min-w-[70px] font-normal">RNC</th>
                      <th className="px-[16px] py-[10px] w-[85px] min-w-[85px] font-normal">Total</th>
                      <th className="px-[16px] py-[10px] w-[81px] min-w-[81px] font-normal">ITBIS</th>
                      <th className="px-[16px] py-[10px] w-[80px] min-w-[80px] font-normal">Fecha</th>
                      <th className="px-[16px] py-[10px] w-[106px] min-w-[106px] font-normal">Estado DGII</th>
                      <th className="px-[16px] py-[10px] w-[112px] min-w-[112px] font-normal">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comprobantes.map((c) => (
                      <FacturaRow
                        key={c.id}
                        factura={c}
                        downloadingId={downloadingId}
                        onDownload={handleDownload}
                        onViewDetail={setSelectedId}
                        selected={selectedId === c.id}
                        onReenviar={setReenviarComprobante}
                        onEmitir={handleEmitir}
                        onDelete={handleDelete}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Custom Pagination styled exactly like Figma */}
            <div className="border-[#f1f5f9] border-t flex h-[57px] items-center justify-between px-[20px] bg-white select-none">
              <p className="text-[13px] font-sans font-normal text-[#64748b]">
                {paginationData ? `${paginationData.total} resultados` : `${comprobantes.length} resultados`}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="flex h-8 w-8 items-center justify-center text-[#64748b] hover:bg-neutral-50 disabled:opacity-50 transition-colors focus:outline-none rounded-[4px]"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#0379d5] text-[13px] font-normal text-white font-sans">
                  {page}
                </span>
                <button
                  type="button"
                  disabled={paginationData ? page >= paginationData.totalPages : true}
                  onClick={() => setPage(page + 1)}
                  className="flex h-8 w-8 items-center justify-center text-[#64748b] hover:bg-neutral-50 disabled:opacity-50 transition-colors focus:outline-none rounded-[4px]"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Animated DetailPanel */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${selectedId ? 'w-[360px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
            }`}
        >
          <DetailPanel
            open={!!selectedId}
            onClose={() => setSelectedId(null)}
            comprobante={detail}
            loading={detailLoading}
            onDownload={handleDownload}
            downloading={!!downloadingId}
            onReenviar={setReenviarComprobante}
            onEmitir={handleEmitir}
          />
        </div>
      </div>

      {reenviarComprobante && (
        <ReenviarModal
          isOpen={!!reenviarComprobante}
          onClose={() => setReenviarComprobante(null)}
          defaultEmail={reenviarComprobante.datos?.receptor?.email || ''}
          onSend={async (data) => {
            await new Promise((r) => setTimeout(r, 1000))
            alert(`Comprobante reenviado exitosamente a: ${data.para}`)
          }}
        />
      )}

      <ConfirmReemitirModal
        open={comprobanteToEmit !== null}
        onClose={() => setComprobanteToEmit(null)}
        onConfirm={() => {
          if (comprobanteToEmit) {
            executeEmit(comprobanteToEmit)
          }
        }}
      />
    </div>
  )
}

