'use client'

import type { JSX } from 'react'
import { X, Download, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'
import { FacturaFilters } from '@/components/facturas/FacturaFilters'
import { FacturaRow } from '@/components/facturas/FacturaRow'
import { DetailPanel } from '@/components/facturas/DetailPanel'
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
          {/* Edit / pencil button */}
          <Button
            variant="secondary"
            className="h-[44px] w-[44px] p-0 flex items-center justify-center border border-[#d0d5dd] rounded-[10px] hover:bg-neutral-50 text-[#64748b] transition-colors"
            title="Editar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip_pencil)">
                <path d="M14.116 4.54133C14.4685 4.18895 14.6665 3.71098 14.6666 3.21257C14.6667 2.71416 14.4687 2.23614 14.1163 1.88367C13.7639 1.53119 13.286 1.33314 12.7876 1.33308C12.2892 1.33302 11.8111 1.53095 11.4587 1.88333L2.56133 10.7827C2.40655 10.937 2.29208 11.127 2.228 11.336L1.34733 14.2373C1.3301 14.295 1.3288 14.3562 1.34357 14.4146C1.35833 14.4729 1.38861 14.5262 1.4312 14.5687C1.47378 14.6112 1.52708 14.6414 1.58544 14.6561C1.6438 14.6707 1.70504 14.6693 1.76267 14.652L4.66467 13.772C4.87345 13.7085 5.06345 13.5947 5.218 13.4407L14.116 4.54133Z" stroke="#64748B" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
              </g>
              <defs>
                <clipPath id="clip_pencil">
                  <rect width="16" height="16" fill="white" />
                </clipPath>
              </defs>
            </svg>
          </Button>
          {/* Refresh button */}
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
            className="h-[44px] w-[44px] p-0 flex items-center justify-center border border-[#d0d5dd] rounded-[10px] hover:bg-neutral-50 text-[#64748b] transition-colors"
            title="Refrescar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 8C2 6.4087 2.63214 4.88258 3.75736 3.75736C4.88258 2.63214 6.4087 2 8 2C9.67737 2.00631 11.2874 2.66082 12.4933 3.82667L14 5.33333" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 2V5.33333H10.6667" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 8C14 9.5913 13.3679 11.1174 12.2426 12.2426C11.1174 13.3679 9.5913 14 8 14C6.32263 13.9937 4.71265 13.3392 3.50667 12.1733L2 10.6667" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.33333 10.6667H2V14" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
          {/* Export button */}
          <Button
            variant="secondary"
            className="h-[44px] px-[16px] flex items-center justify-center border border-[#d0d5dd] rounded-[10px] hover:bg-neutral-50 text-[#64748b] font-normal text-[14px] transition-colors font-sans gap-2"
            title="Exportar comprobantes"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 1.33333H4C3.64638 1.33333 3.30724 1.47381 3.05719 1.72386C2.80714 1.97391 2.66667 2.31304 2.66667 2.66667V13.3333C2.66667 13.687 2.80714 14.0261 3.05719 14.2761C3.30724 14.5262 3.64638 14.6667 4 14.6667H12C12.3536 14.6667 12.6928 14.5262 12.9428 14.2761C13.1929 14.0261 13.3333 13.687 13.3333 13.3333V4.66667L10 1.33333Z" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9.33333 1.33333V4C9.33333 4.35362 9.47381 4.69276 9.72386 4.94281C9.97391 5.19286 10.313 5.33333 10.6667 5.33333H13.3333" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 12V8" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 10L8 12L10 10" stroke="#64748B" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Exportar</span>
          </Button>
        </div>
      </div>

      {/* Main split layout grid */}
      <div className="flex gap-[24px] items-start w-full">
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
                      <th className="px-[16px] py-[10px] w-[150px] min-w-[150px] font-normal">Cliente</th>
                      <th className="px-[16px] py-[10px] w-[95px] min-w-[95px] font-normal">RNC</th>
                      <th className="px-[16px] py-[10px] w-[95px] min-w-[95px] font-normal">Total</th>
                      <th className="px-[16px] py-[10px] w-[85px] min-w-[85px] font-normal">ITBIS</th>
                      <th className="px-[16px] py-[10px] w-[80px] min-w-[80px] font-normal">Fecha</th>
                      <th className="px-[16px] py-[10px] w-[100px] min-w-[100px] font-normal">Estado DGII</th>
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
          />
        </div>
      </div>
    </div>
  )
}

