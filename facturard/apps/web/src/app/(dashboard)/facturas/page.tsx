'use client'

import type { JSX } from 'react'
import { X, Download } from 'lucide-react'
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
    selectedId,
    setSelectedId,
    detail,
    detailLoading,
    downloadingId,
    handleDownload,
  } = useComprobantes()

  return (
    <div className="flex flex-col gap-6">
      {/* Header row: count + export */}
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-text-secondary">
          {paginationData ? `${paginationData.total} comprobantes` : ' '}
        </p>
        <Button variant="secondary" size="sm" disabled>
          <Download size={14} />
          Exportar
        </Button>
      </div>

      <FacturaFilters
        estadoFilter={estadoFilter}
        search={search}
        onEstadoChange={setEstadoFilter}
        onSearchChange={setSearch}
      />

      <div className="rounded-xl border border-border bg-white">
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
                <tr className="border-b border-border-subtle bg-background-canvas text-ui-sm text-text-secondary">
                  <th className="px-4 py-2.5 font-medium">e-NCF</th>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">RNC</th>
                  <th className="px-4 py-2.5 font-medium">Monto</th>
                  <th className="px-4 py-2.5 font-medium">ITBIS</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Acciones</th>
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

        {paginationData && paginationData.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
            <p className="text-ui-sm text-text-secondary">
              Página {paginationData.page} de {paginationData.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= paginationData.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
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
