'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import { X, Download, Send, ChevronLeft, ChevronRight, RotateCw, Mail, Plus } from 'lucide-react'
import { FacturaFilters } from '@/components/facturas/FacturaFilters'
import { FacturaRow } from '@/components/facturas/FacturaRow'
import { DetailPanel } from '@/components/facturas/DetailPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ReenviarModal } from '@/components/facturas/ReenviarModal'
import { ConfirmReemitirModal } from '@/components/facturas/ConfirmReemitirModal'
import { Comprobante } from '@/lib/comprobantes'
import { useComprobantes, useEnviarComprobante } from '@/hooks/useComprobantes'
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

  const handleBulkExport = () => {
    const selectedList = comprobantes.filter(c => selectedIds.has(c.id))
    if (selectedList.length === 0) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Por favor permita las ventanas emergentes para exportar a PDF')
      return
    }

    const htmlContent = `
      <html>
        <head>
          <title>Exportación de Facturas</title>
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
          <h1>Reporte de Facturas</h1>
          <table>
            <thead>
              <tr>
                <th>e-NCF / Folio</th>
                <th>Cliente</th>
                <th>RNC</th>
                <th>Fecha</th>
                <th>ITBIS</th>
                <th>Estado</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${selectedList.map(c => {
                const itbisVal = Number(c.montoTotal || 0) * 18 / 118
                const folioVal = c.eNCF || c.folioInterno || 'NV'
                const cleanRnc = c.rnc ? (c.rnc.length === 9 ? c.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3') : c.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')) : '—'
                return "<tr>" +
                  "<td><b>" + folioVal + "</b></td>" +
                  "<td>" + (c.razonSocial || '—') + "</td>" +
                  "<td>" + cleanRnc + "</td>" +
                  "<td>" + formatDate(c.createdAt) + "</td>" +
                  "<td>" + formatCurrency(itbisVal) + "</td>" +
                  "<td>" + (ESTADO_LABELS[c.estado] || c.estado) + "</td>" +
                  "<td>" + formatCurrency(c.montoTotal) + "</td>" +
                  "</tr>"
              }).join('')}
              <tr class="total-row">
                <td colspan="6" style="text-align: right;">Total General:</td>
                <td>${formatCurrency(selectedList.reduce((sum, c) => sum + Number(c.montoTotal || 0), 0))}</td>
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

  const handleBulkDownload = () => {
    toast.success(`Descargando ${selectedIds.size} facturas seleccionadas...`)
  }

  const [reenviarComprobante, setReenviarComprobante] = useState<Comprobante | null>(null)
  const enviarComprobante = useEnviarComprobante()
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
          {/* EDIT/PENCIL BUTTON - visible only in normal mode */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-left flex items-center justify-center overflow-hidden h-[52px] -my-1 -mx-0.5",
            isSelectionMode ? "w-0 opacity-0 -translate-x-4 scale-0 -mr-[8px]" : "w-[48px] opacity-100 translate-x-0 scale-100"
          )}>
            <EditActionButton
              onClick={toggleSelectionMode}
              title="Activar selección"
            />
          </div>

          {/* REFRESH/RELOAD BUTTON - always visible */}
          <RefreshActionButton onClick={() => refetch()} isLoading={isFetching} />

          {/* SELECTION ACTIONS CONTAINER */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-right flex items-center gap-[8px] overflow-hidden h-[52px] -my-1 -mx-0.5 px-0.5",
            isSelectionMode ? "w-[497px] opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 translate-x-4 scale-0 -mr-[8px]"
          )}>
            <ExportActionButton
              onClick={handleBulkExport}
              disabled={selectedIds.size === 0}
              title="Exportar comprobantes"
              className="w-[114px] justify-center"
            />
            {/* Envío masivo: PENDIENTE de backend (el endpoint es 1 comprobante
                por llamada). Se deja visible pero deshabilitado — antes simulaba
                un envío exitoso que nunca ocurría. */}
            <button
              type="button"
              disabled
              title="Próximamente: el envío en lote aún no está disponible"
              className="h-[44px] px-[17px] flex items-center justify-center gap-[9px] border border-[#d0d5dd] rounded-[10px] text-[#64748b] opacity-50 cursor-not-allowed transition-all focus:outline-none shrink-0 bg-white w-[110px] font-sans font-normal text-[14px] leading-[21px]"
            >
              <Mail size={14} className="text-[#64748b] shrink-0" />
              <span className="font-normal text-[#64748b] text-[14px] leading-[21px] whitespace-nowrap">
                Reenviar
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

          {/* CREAR FACTURA BUTTON - visible only in normal mode, slides/collapses left-to-right (origin-left) */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-left flex items-center justify-center overflow-hidden h-[52px] -my-1 -mx-0.5",
            isSelectionMode ? "w-0 opacity-0 -translate-x-4 scale-0" : "w-[144px] opacity-100 translate-x-0 scale-100"
          )}>
            <button
              onClick={() => router.push('/nueva-factura')}
              className="bg-[#0379d5] hover:bg-[#0262ad] shadow-[0px_1px_1.5px_rgba(0,0,0,0.1),0px_1px_1px_rgba(0,0,0,0.1)] h-11 px-4 rounded-[10px] flex items-center gap-2 transition-all focus:outline-none shrink-0 w-[140px] justify-center"
            >
              <Plus size={16} className="text-white shrink-0" />
              <span className="font-semibold text-[14px] text-white whitespace-nowrap">
                Crear factura
              </span>
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
                <table className="w-full min-w-[1080px] text-left border-collapse table-fixed">
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
                      <th className="px-[16px] py-[10px] w-[110px] min-w-[110px] font-normal">e-NCF</th>
                      <th className="px-[16px] py-[10px] w-[160px] min-w-[160px] font-normal">Cliente</th>
                      <th className="px-[16px] py-[10px] w-[110px] min-w-[110px] font-normal">RNC</th>
                      <th className="px-[16px] py-[10px] w-[130px] min-w-[130px] font-normal">Total</th>
                      <th className="px-[16px] py-[10px] w-[120px] min-w-[120px] font-normal">ITBIS</th>
                      <th className="px-[16px] py-[10px] w-[95px] min-w-[95px] font-normal">Fecha</th>
                      <th className="px-[8px] py-[10px] w-[195px] min-w-[195px] font-normal">Estado DGII</th>
                      <th className="px-[8px] py-[10px] w-[145px] min-w-[145px] font-normal">Acciones</th>
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
                        isSelectionMode={isSelectionMode}
                        isSelectedInBulk={selectedIds.has(c.id)}
                        onToggleSelectInBulk={() => {
                          setSelectedIds(prev => {
                            const next = new Set(prev)
                            if (next.has(c.id)) {
                              next.delete(c.id)
                            } else {
                              next.add(c.id)
                            }
                            return next
                          })
                        }}
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
          title="Enviar factura"
          destinatario={reenviarComprobante.datos?.receptor?.email || ''}
          onSend={async ({ asunto, mensaje }) => {
            await enviarComprobante.mutateAsync({
              comprobanteId: reenviarComprobante.id,
              canal: 'email',
              ...(asunto.trim() ? { asunto: asunto.trim() } : {}),
              ...(mensaje.trim() ? { mensaje: mensaje.trim() } : {}),
            })
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

