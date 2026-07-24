import React from 'react'
import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import {
  Download,
  RotateCw,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  FileSignature,
  Pencil,
  Mail,
  Copy,
  Trash2,
} from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  type Comprobante,
  type ComprobanteEstado,
  estadoDgiiBadge,
  tipoClaseBadge,
  formatCurrency,
  formatDate,
} from '@/lib/comprobantes'

interface Props {
  factura: Comprobante
  downloadingId: string | null
  onDownload: (c: Comprobante) => void
  onViewDetail: (id: string) => void
  selected?: boolean
  onReenviar?: (c: Comprobante) => void
  /** Reintento de un e-CF rechazado/con error: clona a una factura nueva. */
  onReintentar?: (c: Comprobante) => void
  onDelete?: (c: Comprobante) => void
  isSelectedInBulk?: boolean
  onToggleSelectInBulk?: () => void
}

/**
 * Columna "Estado DGII": SOLO el estado del ciclo DGII, y sólo para documentos
 * que viajan a la DGII. Borrador y nota de venta muestran "—" (su naturaleza se
 * ve en la columna Tipo/Clase). El origen (cotización) NO participa aquí.
 * Labels y tonos vienen de `estadoDgiiBadge()` — sin textos propios.
 */
function EstadoDgiiCell({ estado }: { estado: ComprobanteEstado }): JSX.Element {
  const { label, tono, aplicaDgii, titulo } = estadoDgiiBadge(estado)

  if (!aplicaDgii) {
    return (
      <span className="text-[13px] text-[#cbd5e1] font-normal font-sans select-none" title={titulo}>
        {label}
      </span>
    )
  }

  const estilos: Record<string, { wrap: string; icon: string }> = {
    success: { wrap: 'bg-[rgba(6,118,71,0.1)] text-[#067647]', icon: 'text-[#067647]' },
    warning: { wrap: 'bg-[rgba(225,113,0,0.1)] text-[#e17100]', icon: 'text-[#e17100]' },
    danger: { wrap: 'bg-[rgba(180,35,24,0.1)] text-[#b42318]', icon: 'text-[#b42318]' },
    proceso: { wrap: 'bg-[#f1f5f9] text-[#64748b]', icon: 'text-[#64748b]' },
  }
  const estilo = estilos[tono] ?? estilos.proceso!

  const Icono =
    tono === 'success' ? CheckCircle2
    : tono === 'warning' ? AlertTriangle
    : tono === 'danger' ? (estado === 'ERROR' ? AlertCircle : XCircle)
    : RefreshCw

  return (
    <span
      title={titulo}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[10px] px-[10px] py-[5px] text-[12px] font-normal font-sans',
        estilo.wrap,
      )}
    >
      <Icono
        size={14}
        className={cn(estilo.icon, 'flex-shrink-0', tono === 'proceso' && 'animate-spin')}
      />
      {label}
    </span>
  )
}

/**
 * Columna "Tipo / Clase": QUÉ ES el documento — SIEMPRE el tipo. "Nota de venta"
 * para lo no fiscal, o el tipo de e-CF (E31, etc.) para lo fiscal. Que sea un
 * borrador ya lo dice la columna del e-NCF, así que aquí no se rotula "Borrador".
 *
 * Texto plano en negrita, sin pill ni color de fondo (ni el gris de la nota):
 * el tipo es información, no un estado que necesite tono.
 */
function TipoClaseCell({ comprobante }: { comprobante: Comprobante }): JSX.Element {
  const { label, titulo } = tipoClaseBadge(comprobante)
  return (
    <span className="block truncate text-[12px] font-bold text-[#333] font-sans" title={titulo}>
      {label}
    </span>
  )
}

const FacturaRow = React.memo(function FacturaRow({
  factura: c,
  downloadingId,
  onDownload,
  onViewDetail,
  selected = false,
  onReenviar,
  onReintentar,
  onDelete,
  isSelectedInBulk = false,
  onToggleSelectInBulk,
}: Props): JSX.Element {
  const router = useRouter()
  const esNota = c.esFiscal === false

  // Format RNC nicely: e.g. 130-87456-2
  const formattedRnc = c.rnc
    ? c.rnc.length === 9
      ? c.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
      : c.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')
    : '—'

  // El click en la fila SIEMPRE abre el detalle: ya no hay un "modo selección"
  // que le cambie el significado. Seleccionar es marcar el checkbox.
  const handleCellClick = () => onViewDetail(c.id)

  return (
    <tr className={`border-b border-[#f1f5f9] last:border-0 hover:bg-[#f8fafc] transition-colors h-[52px] ${isSelectedInBulk ? 'bg-[rgba(3,121,213,0.05)] hover:bg-[rgba(3,121,213,0.08)]' : selected ? 'bg-[rgba(3,121,213,0.02)] hover:bg-[rgba(3,121,213,0.04)]' : 'bg-white'
      }`}>
      {/* Checkbox SIEMPRE visible: que se pueden seleccionar varias filas tiene
          que verse de entrada, sin descubrir antes ningún botón de "modo". */}
      <td className="w-10 p-0 text-center align-middle border-b border-[#f1f5f9]" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-[52px] w-10 items-center justify-center pl-4">
          <input
            type="checkbox"
            aria-label={`Seleccionar ${c.eNCF || c.folioInterno || 'comprobante'}`}
            className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
            checked={isSelectedInBulk}
            onChange={() => onToggleSelectInBulk?.()}
          />
        </div>
      </td>
      <td
        onClick={handleCellClick}
        className="px-[16px] py-[16px] text-left text-[#333] font-semibold text-[12px] align-middle cursor-pointer whitespace-nowrap"
      >
        {/* Identificador real del documento. El "qué es" (borrador / nota) vive
            en la columna Tipo/Clase — aquí ya no se repite. */}
        <div className="flex items-center gap-1">
          {/* Sólo identificadores REALES. Un borrador (fiscal o de nota de
              venta) todavía no tiene ninguno: e-NCF se asigna al emitir y el
              folio NV- al finalizar la nota. Sin identificador se rotula
              "Borrador" (cursiva + rojo) en vez de dejar la celda con un guion. */}
          <span className="truncate">
            {c.eNCF
              ? c.eNCF
              : c.folioInterno
                ? <span className="text-[#475569] font-semibold">{c.folioInterno}</span>
                : <span className="italic font-normal text-[#e11d48]">Borrador</span>}
          </span>
          {/* Procedencia (no es estado ni tipo): marca discreta, nunca sustituye nada. */}
          {c.cotizacionId && (
            <span title="Convertida desde cotización" className="flex-shrink-0 leading-none">
              <FileSignature size={12} className="text-[#0379d5] opacity-70" />
            </span>
          )}
        </div>
      </td>
      <td
        onClick={handleCellClick}
        className="px-[16px] py-[16px] text-left align-middle cursor-pointer"
      >
        <div className="w-full truncate text-[#333] font-normal text-[12px]" title={c.razonSocial}>
          {c.razonSocial}
        </div>
      </td>
      <td
        onClick={handleCellClick}
        className="px-[16px] py-[16px] text-left text-[#333] font-semibold text-[12px] align-middle cursor-pointer whitespace-nowrap"
      >
        {formattedRnc}
      </td>
      <td
        onClick={handleCellClick}
        className="px-[16px] py-[16px] text-left text-[#333] font-semibold text-[12px] align-middle cursor-pointer whitespace-nowrap"
      >
        {formatCurrency(c.montoTotal)}
      </td>
      <td
        onClick={handleCellClick}
        className="px-[16px] py-[16px] text-left text-[#64748b] font-normal text-[12px] align-middle cursor-pointer whitespace-nowrap"
      >
        {formatDate(c.createdAt)}
      </td>
      <td
        onClick={handleCellClick}
        className="px-[8px] py-[16px] text-left align-middle cursor-pointer whitespace-nowrap overflow-hidden"
      >
        <TipoClaseCell comprobante={c} />
      </td>
      <td
        onClick={handleCellClick}
        className="px-[8px] py-[16px] text-left align-middle cursor-pointer whitespace-nowrap"
      >
        <EstadoDgiiCell estado={c.estado} />
      </td>
      <td className="px-[8px] py-[16px] text-right align-middle">
        <div className="flex items-center justify-end gap-[4px] w-full">

          {/* Descargar button */}
          {c.estado !== 'RECHAZADO' && c.estado !== 'ERROR' && (
            <button
              type="button"
              title="Descargar PDF"
              disabled={downloadingId === c.id}
              onClick={() => onDownload(c)}
              className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#333] disabled:opacity-50 transition-colors focus:outline-none flex-shrink-0"
            >
              {downloadingId === c.id ? (
                <Spinner size={14} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0">
                  <path d="M14 10V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.597 14 2 13.403 2 12.6667V10" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 2V10" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4.66666 6.66667L8 10L11.3333 6.66667" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          )}

          {/* Un BORRADOR (fiscal o nota) y una nota de venta comparten acciones:
              Editar + Eliminar. No se ofrece "Emitir" desde la fila: un borrador
              puede estar incompleto; se emite desde el editor tras revisarlo. Un
              draft fiscal no consumió e-NCF, así que es descartable igual que una nota. */}
          {esNota || c.estado === 'DRAFT' ? (
            <>
              {/* Editar */}
              <button
                type="button"
                title={esNota ? 'Editar nota de venta' : 'Editar borrador'}
                onClick={() => router.push(`/nueva-factura?id=${c.id}`)}
                className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#333] transition-colors focus:outline-none flex-shrink-0"
              >
                <Pencil size={14} />
              </button>

              {/* Eliminar (soft delete) */}
              <button
                type="button"
                title={esNota ? 'Eliminar nota de venta' : 'Eliminar borrador'}
                onClick={() => onDelete && onDelete(c)}
                className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#b42318] hover:bg-red-50 transition-colors focus:outline-none flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </>
          ) : c.estado === 'RECHAZADO' || c.estado === 'ERROR' ? (
            /* Reintentar: un e-CF rechazado/con error NO se re-emite (el e-NCF
               quedó quemado). El único reintento real es crear uno NUEVO con los
               mismos datos → clona. Antes había Editar + Emitir aquí, y AMBOS
               fallaban con 409 (el backend solo edita/emite borradores). */
            <button
              type="button"
              title="Reintentar (crea una factura nueva con estos datos)"
              onClick={() => onReintentar && onReintentar(c)}
              className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#0379d5] hover:bg-blue-50 transition-colors focus:outline-none flex-shrink-0"
            >
              <RotateCw size={14} />
            </button>
          ) : (
            /* Reenviar button (Mail icon) */
            <button
              type="button"
              title="Reenviar correo"
              onClick={() => onReenviar && onReenviar(c)}
              className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#333] transition-colors focus:outline-none flex-shrink-0"
            >
              <Mail size={14} />
            </button>
          )}

          {/* Clonar / Facturar formalmente (prefill del form fiscal vía cloneId).
              Se oculta en RECHAZADO/ERROR: ahí "Reintentar" ya clona (evita dos
              botones que hacen lo mismo). */}
          {c.estado !== 'RECHAZADO' && c.estado !== 'ERROR' && (
            <button
              type="button"
              title={esNota ? 'Facturar formalmente (crear e-CF)' : 'Clonar comprobante'}
              onClick={() => router.push(`/nueva-factura?cloneId=${c.id}`)}
              className="flex items-center justify-center w-[28px] h-[28px] rounded-[4px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#333] transition-colors focus:outline-none flex-shrink-0"
            >
              <Copy size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
})

export { FacturaRow }
