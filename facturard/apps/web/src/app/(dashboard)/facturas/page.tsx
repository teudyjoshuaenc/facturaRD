'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import { X, Download, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'
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
          <EditActionButton onClick={() => {
            if (!selectedId) {
              toast.error('Seleccione un comprobante para editar')
              return
            }
            router.push(`/nueva-factura?id=${selectedId}`)
          }} />
          <RefreshActionButton onClick={() => refetch()} isLoading={isFetching} />
          <ExportActionButton onClick={() => alert('Exportar comprobantes')} title="Exportar comprobantes" />
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
                    <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[12px] font-normal text-[#64748b] h-[40px]">
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
          className={`transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${
            selectedId ? 'w-[360px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
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

