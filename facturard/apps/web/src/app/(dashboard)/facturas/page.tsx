'use client'

import type { JSX } from 'react'
import { X, Download, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'
import { FacturaFilters } from '@/components/facturas/FacturaFilters'
import { FacturaRow } from '@/components/facturas/FacturaRow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useComprobantes } from '@/hooks/useComprobantes'
import {
  ESTADO_LABELS,
  ESTADO_BADGE_VARIANT,
  TIPO_ECF_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/comprobantes'

export default function FacturasPage(): JSX.Element {
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
  } = useComprobantes()

  return (
    <div className="flex flex-col gap-6">
      {/* Header row: count + actions */}
      <div className="flex items-center justify-between select-none">
        <div className="flex flex-col items-start font-sans">
          <h1 className="text-[24px] font-semibold leading-[36px] text-[#333333]">
            Comprobantes
          </h1>
          <p className="text-[14px] font-normal leading-[21px] text-[#64748b] mt-0.5">
            {paginationData ? `${paginationData.total} comprobantes` : `${comprobantes.length} comprobantes`} · {comprobantes.length} visibles
          </p>
        </div>
        <div className="flex items-center gap-[8px]">
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
            className="h-[44px] w-[44px] p-0 flex items-center justify-center border border-[#d0d5dd] rounded-[10px] hover:bg-neutral-50 text-[#64748b] transition-colors"
            title="Refrescar"
          >
            <RotateCw size={16} />
          </Button>
          <Button
            variant="secondary"
            className="h-[44px] px-[16px] flex items-center justify-center border border-[#d0d5dd] rounded-[10px] hover:bg-neutral-50 text-[#64748b] font-normal text-[14px] transition-colors font-sans gap-2"
            title="Exportar comprobantes"
          >
            <Download size={16} className="text-[#64748b]" />
            <span>Exportar</span>
          </Button>
        </div>
      </div>

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
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[12px] font-normal text-[#64748b] h-[40px]">
                  <th className="px-[16px] py-[10px] w-[90px] min-w-[90px] font-normal">e-NCF</th>
                  <th className="px-[16px] py-[10px] w-[120px] min-w-[120px] font-normal">Cliente</th>
                  <th className="px-[16px] py-[10px] w-[70px] min-w-[70px] font-normal">RNC</th>
                  <th className="px-[16px] py-[10px] w-[85px] min-w-[85px] font-normal">Total</th>
                  <th className="px-[16px] py-[10px] w-[81px] min-w-[81px] font-normal">ITBIS</th>
                  <th className="px-[16px] py-[10px] w-[80px] min-w-[80px] font-normal">Fecha</th>
                  <th className="px-[16px] py-[10px] w-[105.63px] min-w-[105.63px] font-normal">Estado DGII</th>
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

      {/* Modal de detalle */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-h6 text-text-primary">Detalle del comprobante</h2>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-text-tertiary hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>

            {detailLoading || !detail ? (
              <div className="flex items-center justify-center p-8">
                <Spinner size={28} />
              </div>
            ) : (
              <dl className="flex flex-col gap-3 text-body-sm">
                <div className="flex justify-between">
                  <dt className="text-text-secondary">e-NCF</dt>
                  <dd className="font-medium text-text-primary">{detail.eNCF}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Tipo</dt>
                  <dd className="text-text-primary">{TIPO_ECF_LABELS[detail.tipoECF]}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Fecha</dt>
                  <dd className="text-text-primary">{formatDate(detail.createdAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Cliente</dt>
                  <dd className="text-text-primary">{detail.razonSocial}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">RNC</dt>
                  <dd className="text-text-primary">{detail.rnc || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Monto</dt>
                  <dd className="text-text-primary">{formatCurrency(detail.montoTotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">ITBIS</dt>
                  <dd className="text-text-primary">
                    {formatCurrency(Number(detail.montoTotal) * 18 / 118)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Estado</dt>
                  <dd>
                    <Badge variant={ESTADO_BADGE_VARIANT[detail.estado]}>
                      {ESTADO_LABELS[detail.estado]}
                    </Badge>
                  </dd>
                </div>
                {detail.trackId && (
                  <div className="flex justify-between">
                    <dt className="text-text-secondary">Track ID</dt>
                    <dd className="text-text-primary">{detail.trackId}</dd>
                  </div>
                )}
                {detail.mensajeDGII && (
                  <div className="flex flex-col gap-1">
                    <dt className="text-text-secondary">Mensaje DGII</dt>
                    <dd className="text-text-primary">{detail.mensajeDGII}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
