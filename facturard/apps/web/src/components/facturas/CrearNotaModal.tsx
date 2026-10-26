'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import { AlertTriangle, FileText } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { api, getErrorMessage } from '@/lib/api'
import { type Comprobante, formatCurrency } from '@/lib/comprobantes'
import { toast } from 'sonner'

/**
 * Nota de crédito (E34) / débito (E33) sobre un comprobante ACEPTADO.
 * POST /comprobantes/:id/nota — el backend hereda comprador + referencia fiscal
 * y calcula IndicadorNotaCredito por la regla de 30 días. Emite de inmediato:
 * consume un e-NCF y va a la DGII, por eso hay un paso de confirmación.
 */
export type TipoNota = 'E33' | 'E34'

interface CrearNotaModalProps {
  open: boolean
  onClose: () => void
  tipo: TipoNota
  comprobante: Comprobante
  onCreated: (nota: Comprobante) => void
}

const CODIGO_OPTIONS = [
  { value: '1', label: '1 · Anulación total del comprobante' },
  { value: '2', label: '2 · Corrección de montos' },
  { value: '3', label: '3 · Corrección de texto' },
  { value: '4', label: '4 · Reemplazo de NCF emitido en contingencia' },
  { value: '5', label: '5 · Referencia a factura de consumo' },
]

// RazonModificacion es AlfNum90 en el XSD.
const MAX_RAZON = 90
// El builder XML no escapa entidades: un & o < rompería el XML firmado.
const CARACTERES_PROHIBIDOS = /[<>&]/

// Campos que acepta CreateItemDto (el ValidationPipe rechaza cualquier otro).
const ITEM_KEYS = [
  'numeroLinea', 'productoId', 'indicadorFacturacion', 'nombreItem', 'descripcion',
  'indicadorBienoServicio', 'cantidad', 'unidadMedida', 'precioUnitarioItem',
  'descuentoPorcentaje', 'descuento', 'itbisRetenido', 'isrRetenido',
] as const

interface LineaNota {
  incluir: boolean
  cantidad: string
  precio: string
}

function limpiarItem(it: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of ITEM_KEYS) if (it[k] !== undefined && it[k] !== null) out[k] = it[k]
  return out
}

export function CrearNotaModal({ open, onClose, tipo, comprobante, onCreated }: CrearNotaModalProps): JSX.Element {
  const itemsFuente: any[] = useMemo(() => comprobante.datos?.items ?? [], [comprobante])

  const [codigo, setCodigo] = useState('')
  const [razon, setRazon] = useState('')
  const [lineas, setLineas] = useState<LineaNota[]>([])
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!open) return
    setCodigo('')
    setRazon('')
    setConfirmando(false)
    setLineas(
      itemsFuente.map((it) => ({
        incluir: true,
        cantidad: String(it.cantidad ?? ''),
        precio: String(it.precioUnitarioItem ?? ''),
      })),
    )
  }, [open, itemsFuente])

  // Anulación total = las líneas del original tal cual, sin editar.
  const anulacion = codigo === '1'
  const editado =
    !anulacion &&
    lineas.some(
      (l, i) =>
        !l.incluir ||
        Number(l.cantidad) !== Number(itemsFuente[i]?.cantidad) ||
        Number(l.precio) !== Number(itemsFuente[i]?.precioUnitarioItem),
    )

  const lineasValidas = lineas.every(
    (l) => !l.incluir || (Number(l.cantidad) > 0 && Number(l.precio) > 0),
  )
  const algunaLinea = anulacion || lineas.some((l) => l.incluir)
  const razonInvalida = CARACTERES_PROHIBIDOS.test(razon)

  const errorForm =
    !codigo ? 'Elige el motivo de la nota.'
    : razonInvalida ? 'La razón no puede contener los caracteres < > &.'
    : !algunaLinea ? 'La nota debe tener al menos una línea.'
    : !anulacion && !lineasValidas ? 'Cantidad y precio deben ser mayores que 0.'
    : null

  const subtotalNota = itemsFuente.reduce((sum: number, it: any, i: number) => {
    if (anulacion) return sum + Number(it.cantidad) * Number(it.precioUnitarioItem)
    const l = lineas[i]
    if (!l?.incluir) return sum
    return sum + (Number(l.cantidad) * Number(l.precio) || 0)
  }, 0)

  const titulo = tipo === 'E34' ? 'Nota de crédito (E34)' : 'Nota de débito (E33)'

  const enviar = async () => {
    setEnviando(true)
    try {
      const items = editado
        ? itemsFuente
            .flatMap((it, i) => {
              const l = lineas[i]
              return l?.incluir ? [{ it, l }] : []
            })
            .map(({ it, l }, idx) => ({
              ...limpiarItem(it),
              numeroLinea: idx + 1,
              cantidad: Number(l.cantidad),
              precioUnitarioItem: Math.round(Number(l.precio) * 100) / 100,
            }))
        : undefined

      const res = await api.post<Comprobante & { avisoITBIS?: string }>(`/comprobantes/${comprobante.id}/nota`, {
        tipo,
        codigoModificacion: Number(codigo),
        ...(razon.trim() && { razonModificacion: razon.trim() }),
        ...(items && { items }),
      })
      toast.success(`${titulo} enviada a la DGII`)
      if (res.data.avisoITBIS) toast.warning('Esta nota no rebaja ITBIS', { description: res.data.avisoITBIS })
      onCreated(res.data)
    } catch (err) {
      toast.error(`No se pudo crear la ${tipo === 'E34' ? 'nota de crédito' : 'nota de débito'}`, {
        description: getErrorMessage(err),
      })
      setConfirmando(false)
    } finally {
      setEnviando(false)
    }
  }

  const inputCls =
    'h-[34px] w-full rounded-[8px] border border-[#E2E8F0] bg-white px-2 text-[12px] text-[#333] text-right focus:outline-none focus:border-[#0379D5] disabled:bg-[#F8FAFC] disabled:text-[#94a3b8]'

  return (
    <Modal
      open={open}
      onClose={enviando ? () => {} : onClose}
      title={confirmando ? `¿Emitir ${titulo.toLowerCase()}?` : titulo}
      subtitle={`Sobre ${comprobante.eNCF} · ${comprobante.razonSocial}`}
      icon={confirmando ? <AlertTriangle size={20} /> : <FileText size={20} />}
      className="max-w-[640px]"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <span className="text-[12px] text-[#64748b]">
            {confirmando ? '' : errorForm ?? `Subtotal de la nota: ${formatCurrency(subtotalNota)} + ITBIS`}
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={confirmando ? () => setConfirmando(false) : onClose}
              disabled={enviando}
              className="h-10 rounded-[10px] border-[#e2e8f0] text-[#64748b] text-[13px]"
            >
              {confirmando ? 'Volver' : 'Cancelar'}
            </Button>
            <Button
              onClick={confirmando ? enviar : () => setConfirmando(true)}
              disabled={!!errorForm || enviando}
              className="h-10 rounded-[10px] bg-[#0379D5] hover:bg-[#0379D5]/90 text-white border-0 text-[13px]"
            >
              {enviando && <Spinner size={14} />}
              {confirmando ? 'Emitir a la DGII' : 'Continuar'}
            </Button>
          </div>
        </div>
      }
    >
      {confirmando ? (
        <p className="text-[14px] text-[#64748b] leading-[22px]">
          Se enviará a la DGII una {titulo.toLowerCase()} que referencia a <b>{comprobante.eNCF}</b>, por{' '}
          <b>{formatCurrency(subtotalNota)}</b> + ITBIS. Consumirá un e-NCF de tu secuencia {tipo}. Esta acción no se
          puede deshacer.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-semibold text-[#333]">Motivo</label>
            <Select value={codigo} onChange={setCodigo} options={CODIGO_OPTIONS} placeholder="Selecciona el motivo" />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-semibold text-[#333]">
              Razón <span className="font-normal text-[#94a3b8]">(opcional)</span>
            </label>
            <input
              value={razon}
              onChange={(e) => setRazon(e.target.value)}
              maxLength={MAX_RAZON}
              placeholder="Ej. Devolución parcial de mercancía"
              className="h-[40px] rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 text-[13px] text-[#333] focus:outline-none focus:border-[#0379D5]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-semibold text-[#333]">Líneas</label>
            {anulacion && (
              <p className="text-[12px] text-[#64748b]">La anulación total incluye todas las líneas del original sin cambios.</p>
            )}
            <div className="rounded-[10px] border border-[#E2E8F0] divide-y divide-[#E2E8F0]">
              {itemsFuente.map((it, i) => {
                const l = lineas[i]
                if (!l) return null
                const bloqueada = anulacion || !l.incluir
                return (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <input
                      type="checkbox"
                      checked={anulacion || l.incluir}
                      disabled={anulacion}
                      onChange={(e) =>
                        setLineas((prev) => prev.map((x, j) => (j === i ? { ...x, incluir: e.target.checked } : x)))
                      }
                      className="h-4 w-4 accent-[#0379D5]"
                    />
                    <span className="flex-1 text-[12px] text-[#333] truncate" title={it.nombreItem}>
                      {it.nombreItem}
                    </span>
                    <div className="w-[70px]">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        aria-label="Cantidad"
                        value={anulacion ? String(it.cantidad) : l.cantidad}
                        disabled={bloqueada}
                        onChange={(e) =>
                          setLineas((prev) => prev.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div className="w-[110px]">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label="Precio unitario"
                        value={anulacion ? String(it.precioUnitarioItem) : l.precio}
                        disabled={bloqueada}
                        onChange={(e) =>
                          setLineas((prev) => prev.map((x, j) => (j === i ? { ...x, precio: e.target.value } : x)))
                        }
                        className={inputCls}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] text-[#94a3b8]">Precio unitario sin ITBIS. El comprador y la referencia fiscal se heredan del original.</p>
          </div>
        </>
      )}
    </Modal>
  )
}
