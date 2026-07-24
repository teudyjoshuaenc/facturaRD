'use client'

import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { FacturaFilters } from '@/components/facturas/FacturaFilters'
import { FacturaRow } from '@/components/facturas/FacturaRow'
import { DetailPanel } from '@/components/facturas/DetailPanel'
import { Spinner } from '@/components/ui/spinner'
import { ReenviarModal } from '@/components/facturas/ReenviarModal'
import { BulkActionBar, ICONOS_BULK, type BulkAccion } from '@/components/facturas/BulkActionBar'
import { ConfirmReemitirModal } from '@/components/facturas/ConfirmReemitirModal'
import { ConfirmDeleteModal } from '@/components/ui/confirm-delete-modal'
import { Comprobante } from '@/lib/comprobantes'
import {
  useComprobantes,
  useEnviarComprobante,
  useEnviarLote,
  MAX_COMPROBANTES_POR_CORREO,
} from '@/hooks/useComprobantes'
import { api, getErrorMessage } from '@/lib/api'
import { toast } from 'sonner'
import { RefreshActionButton } from '@/components/ui/table-actions'
import { ColResizer } from '@/components/ui/col-resizer'
import { useResizableColumns, type ResizableColumn } from '@/hooks/useResizableColumns'
import {
  estadoDgiiBadge,
  tipoClaseBadge,
  formatCurrency,
  formatDate,
  tienePdfEnviable,
} from '@/lib/comprobantes'

// Columnas redimensionables de la lista de facturas (la 1ª es el checkbox, fija).
const FACTURAS_COLUMNS: ResizableColumn[] = [
  { key: 'sel', width: 40, min: 40 },
  { key: 'encf', width: 120, min: 90 },
  { key: 'cliente', width: 180, min: 120 },
  { key: 'rnc', width: 120, min: 90 },
  { key: 'total', width: 130, min: 100 },
  { key: 'fecha', width: 100, min: 80 },
  { key: 'tipo', width: 180, min: 120 },
  { key: 'estado', width: 150, min: 110 },
  { key: 'acciones', width: 150, min: 120 },
]

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
    origenFilter,
    setOrigenFilter,
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

  const { widths: colWidths, startResize } = useResizableColumns('facturas', FACTURAS_COLUMNS)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // La selección vive sobre las filas VISIBLES. Al cambiar de página o de
  // filtros se limpia: antes se conservaba en el Set pero las acciones filtraban
  // sobre la página actual, así que lo seleccionado en otra página se descartaba
  // en silencio — el usuario creía estar actuando sobre más de lo que actuaba.
  const filtrosKey = JSON.stringify([
    page, estadoFilter, search, tipoFilter, claseFilter, origenFilter,
    startDate, endDate, minAmount, maxAmount,
  ])
  const filtrosKeyPrevia = useRef(filtrosKey)
  useEffect(() => {
    if (filtrosKeyPrevia.current !== filtrosKey) {
      filtrosKeyPrevia.current = filtrosKey
      setSelectedIds(new Set())
    }
  }, [filtrosKey])

  const seleccionadas = comprobantes.filter((c) => selectedIds.has(c.id))
  const todasSeleccionadas = comprobantes.length > 0 && comprobantes.every((c) => selectedIds.has(c.id))
  const algunaSeleccionada = seleccionadas.length > 0 && !todasSeleccionadas

  const toggleSeleccion = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSeleccionarTodo = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (todasSeleccionadas) comprobantes.forEach((c) => next.delete(c.id))
      else comprobantes.forEach((c) => next.add(c.id))
      return next
    })
  }

  const handleBulkExport = () => {
    const selectedList = seleccionadas
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
                <th>Tipo / Clase</th>
                <th>Estado DGII</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${selectedList.map(c => {
                const itbisVal = Number(c.montoTotal || 0) * 18 / 118
                const folioVal = c.eNCF || c.folioInterno || '—'
                const cleanRnc = c.rnc ? (c.rnc.length === 9 ? c.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3') : c.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')) : '—'
                // Mismas dos dimensiones (y misma fuente de labels) que la tabla.
                const tipoVal = tipoClaseBadge(c).label
                const estadoVal = estadoDgiiBadge(c.estado).label
                return "<tr>" +
                  "<td><b>" + folioVal + "</b></td>" +
                  "<td>" + (c.razonSocial || '—') + "</td>" +
                  "<td>" + cleanRnc + "</td>" +
                  "<td>" + formatDate(c.createdAt) + "</td>" +
                  "<td>" + formatCurrency(itbisVal) + "</td>" +
                  "<td>" + tipoVal + "</td>" +
                  "<td>" + estadoVal + "</td>" +
                  "<td>" + formatCurrency(c.montoTotal) + "</td>" +
                  "</tr>"
              }).join('')}
              <tr class="total-row">
                <td colspan="7" style="text-align: right;">Total General:</td>
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

  const [reenviarComprobante, setReenviarComprobante] = useState<Comprobante | null>(null)
  const [enviarLoteAbierto, setEnviarLoteAbierto] = useState(false)
  const enviarComprobante = useEnviarComprobante()
  const enviarLote = useEnviarLote()

  // Motivo por el que el envío en lote no se puede hacer AHORA. Se calcula para
  // poder escribirlo en pantalla: un botón apagado sin explicación no sirve.
  // La regla la sostiene el backend igual (400 si se salta la UI).
  const sinPdf = seleccionadas.filter((c) => !tienePdfEnviable(c))
  const motivoBloqueoEnvio =
    seleccionadas.length > MAX_COMPROBANTES_POR_CORREO
      ? `Máximo ${MAX_COMPROBANTES_POR_CORREO} facturas por correo · tienes ${seleccionadas.length}`
      : sinPdf.length > 0
        ? `${sinPdf.length} de las seleccionadas no tiene PDF (rechazada o con error)`
        : undefined

  const accionesBulk: BulkAccion[] = [
    {
      key: 'enviar',
      label: 'Enviar por correo',
      icon: ICONOS_BULK.correo,
      destacada: true,
      onClick: () => setEnviarLoteAbierto(true),
      ...(motivoBloqueoEnvio ? { motivoBloqueo: motivoBloqueoEnvio } : {}),
    },
    {
      key: 'exportar',
      label: 'Exportar',
      icon: ICONOS_BULK.exportar,
      onClick: handleBulkExport,
    },
    {
      // Descargar en lote todavía no existe. Antes mostraba un toast de éxito
      // sin descargar nada: apagado hasta que tenga implementación real.
      key: 'descargar',
      label: 'Descargar',
      icon: ICONOS_BULK.descargar,
      onClick: () => undefined,
      motivoBloqueo: 'Próximamente: la descarga en lote aún no está disponible',
    },
  ]
  // La emisión ya no ocurre desde la lista: un borrador se completa y emite
  // desde el editor ("Emitir e-CF"), y los estados no-borrador no se emiten en
  // sitio (rechazado/error → Reintentar; aceptado → Reenviar).

  // Reintento de un e-CF rechazado/con error. NO se re-emite in-place: el e-NCF
  // quedó quemado (el backend solo emite borradores). El reintento real es crear
  // una factura NUEVA con los mismos datos → clona vía ?cloneId=, tras confirmar.
  const [comprobanteToReintentar, setComprobanteToReintentar] = useState<Comprobante | null>(null)

  function handleReintentar(c: Comprobante) {
    setComprobanteToReintentar(c)
  }

  // Borrado de nota de venta: confirma con el modal compartido de la app
  // (el mismo de productos), no con el window.confirm nativo.
  const [comprobanteToDelete, setComprobanteToDelete] = useState<Comprobante | null>(null)

  function handleDelete(c: Comprobante) {
    setComprobanteToDelete(c)
  }

  async function executeDelete(c: Comprobante) {
    try {
      await api.delete(`/comprobantes/${c.id}`)
      // Un fiscal en DRAFT es un borrador; lo no-fiscal es una nota de venta.
      const esBorradorFiscal = c.esFiscal !== false && c.estado === 'DRAFT'
      toast.success(esBorradorFiscal ? 'Borrador eliminado' : 'Nota de venta eliminada')
      if (selectedId === c.id) setSelectedId(null)
      refetch()
    } catch (err) {
      toast.error('No se pudo eliminar', { description: getErrorMessage(err) })
    } finally {
      setComprobanteToDelete(null)
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
        {/* El header ya no esconde la selección detrás de un "modo": los
            checkboxes están siempre en la tabla y las acciones en lote aparecen
            al pie, junto a las filas. */}
        <div className="flex items-center gap-[8px]">
          <RefreshActionButton onClick={() => refetch()} isLoading={isFetching} />

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
            origenFilter={origenFilter}
            onOrigenFilterChange={setOrigenFilter}
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
                <table className="w-full min-w-[1200px] text-left border-collapse table-fixed">
                  {/* Anchos redimensionables (arrastrar el borde del encabezado). */}
                  <colgroup>
                    {FACTURAS_COLUMNS.map((col) => (
                      <col key={col.key} style={{ width: colWidths[col.key] }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[12px] font-normal text-[#64748b] h-[40px] select-none">
                      <th className="p-0 text-center align-middle border-b border-[#e2e8f0] bg-[#f8fafc]">
                        <div className="flex h-[40px] w-10 items-center justify-center pl-4">
                          {/* Estado indeterminado cuando hay selección parcial:
                              comunica "algunas, no todas" sin texto. */}
                          <input
                            type="checkbox"
                            aria-label="Seleccionar todas las filas visibles"
                            title="Seleccionar todas las filas visibles"
                            className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
                            checked={todasSeleccionadas}
                            ref={(el) => {
                              if (el) el.indeterminate = algunaSeleccionada
                            }}
                            onChange={toggleSeleccionarTodo}
                          />
                        </div>
                      </th>
                      <th className="relative px-[16px] py-[10px] font-normal">e-NCF<ColResizer onStart={(e) => startResize('encf', e)} /></th>
                      <th className="relative px-[16px] py-[10px] font-normal">Cliente<ColResizer onStart={(e) => startResize('cliente', e)} /></th>
                      <th className="relative px-[16px] py-[10px] font-normal">RNC<ColResizer onStart={(e) => startResize('rnc', e)} /></th>
                      <th className="relative px-[16px] py-[10px] font-normal">Total<ColResizer onStart={(e) => startResize('total', e)} /></th>
                      <th className="relative px-[16px] py-[10px] font-normal">Fecha<ColResizer onStart={(e) => startResize('fecha', e)} /></th>
                      <th className="relative px-[8px] py-[10px] font-normal">Tipo / Clase<ColResizer onStart={(e) => startResize('tipo', e)} /></th>
                      <th className="relative px-[8px] py-[10px] font-normal">Estado DGII<ColResizer onStart={(e) => startResize('estado', e)} /></th>
                      <th className="px-[8px] py-[10px] font-normal">Acciones</th>
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
                        onReintentar={handleReintentar}
                        onDelete={handleDelete}
                        isSelectedInBulk={selectedIds.has(c.id)}
                        onToggleSelectInBulk={() => toggleSeleccion(c.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Acciones en lote: al pie de la tabla y sólo cuando hay selección. */}
            <BulkActionBar
              seleccionadas={seleccionadas.length}
              acciones={accionesBulk}
              onLimpiar={() => setSelectedIds(new Set())}
            />

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
            onReintentar={handleReintentar}
          />
        </div>
      </div>

      {reenviarComprobante && (
        <ReenviarModal
          isOpen={!!reenviarComprobante}
          onClose={() => setReenviarComprobante(null)}
          title="Enviar factura"
          comprobantes={[reenviarComprobante]}
          // El correo sale del Contacto local (lo resuelve el backend). Antes se
          // leía `datos.receptor.email`, un campo que NADIE escribe: siempre era
          // undefined y el modal decía "no tiene correo" con el botón apagado
          // aunque el contacto sí lo tuviera.
          destinatarioFijo={reenviarComprobante.contactoEmail || ''}
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

      {/* Envío en lote: UN SOLO correo con los PDFs de las seleccionadas. */}
      {enviarLoteAbierto && (
        <ReenviarModal
          isOpen={enviarLoteAbierto}
          onClose={() => setEnviarLoteAbierto(false)}
          comprobantes={seleccionadas}
          onSend={async ({ asunto, mensaje, destinatarios }) => {
            await enviarLote.mutateAsync({
              comprobanteIds: seleccionadas.map((c) => c.id),
              destinatarios,
              ...(asunto.trim() ? { asunto: asunto.trim() } : {}),
              ...(mensaje.trim() ? { mensaje: mensaje.trim() } : {}),
            })
            setSelectedIds(new Set())
          }}
        />
      )}

      <ConfirmDeleteModal
        open={comprobanteToDelete !== null}
        title={comprobanteToDelete?.esFiscal !== false && comprobanteToDelete?.estado === 'DRAFT' ? 'Eliminar borrador' : 'Eliminar nota de venta'}
        itemName={comprobanteToDelete?.folioInterno ?? null}
        fallbackName={comprobanteToDelete?.esFiscal !== false && comprobanteToDelete?.estado === 'DRAFT' ? 'este borrador' : 'esta nota de venta'}
        onClose={() => setComprobanteToDelete(null)}
        onConfirm={() => {
          if (comprobanteToDelete) {
            void executeDelete(comprobanteToDelete)
          }
        }}
      />

      <ConfirmReemitirModal
        open={comprobanteToReintentar !== null}
        mode="reintentar"
        onClose={() => setComprobanteToReintentar(null)}
        onConfirm={() => {
          if (comprobanteToReintentar) {
            router.push(`/nueva-factura?cloneId=${comprobanteToReintentar.id}`)
            setComprobanteToReintentar(null)
          }
        }}
      />
    </div>
  )
}

