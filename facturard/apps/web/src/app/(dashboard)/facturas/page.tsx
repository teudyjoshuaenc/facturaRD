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
      <div className="flex items-center justify-between">
        <p className="text-ui-default font-semibold text-text-secondary">
          {paginationData ? `${paginationData.total} comprobantes` : `${comprobantes.length} comprobantes`} · {comprobantes.length} visibles
        </p>
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
            title="Exportar comprobantes"
          >
            <Download size={16} className="mr-1.5" />
            Exportar
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

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
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
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50 text-ui-sm font-semibold text-text-secondary">
                  <th className="px-4 py-3 font-semibold">e-NCF</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">RNC</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">ITBIS</th>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Estado DGII</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
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
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3.5 bg-white">
          <p className="text-ui-sm text-text-secondary">
            {comprobantes.length} resultados
          </p>
          
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
              disabled={paginationData ? page >= paginationData.totalPages : true}
              onClick={() => setPage(page + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-text-secondary hover:bg-neutral-50 disabled:opacity-50 transition-colors focus:outline-none"
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
