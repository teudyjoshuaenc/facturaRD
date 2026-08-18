'use client'

import { useState, type JSX } from 'react'
import { Landmark, Lock, LockOpen } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/comprobantes'
import { useCaja, useAbrirCaja, useCerrarCaja } from '@/hooks/useFinanzas'

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function CajaCard(): JSX.Element {
  const fecha = hoyISO()
  const { data: caja } = useCaja(fecha)
  const abrirCaja = useAbrirCaja()
  const cerrarCaja = useCerrarCaja()

  const [modal, setModal] = useState<'apertura' | 'cierre' | null>(null)
  const [monto, setMonto] = useState('')
  const [notas, setNotas] = useState('')

  function abrirModalApertura(): void {
    setMonto('')
    setNotas('')
    setModal('apertura')
  }
  function abrirModalCierre(): void {
    setMonto('')
    setNotas('')
    setModal('cierre')
  }

  async function confirmarApertura(): Promise<void> {
    const valor = Number(monto)
    if (Number.isNaN(valor) || valor < 0) return
    await abrirCaja.mutateAsync({ fecha, monto: valor, ...(notas.trim() ? { notas: notas.trim() } : {}) })
    setModal(null)
  }

  async function confirmarCierre(): Promise<void> {
    const valor = Number(monto)
    if (Number.isNaN(valor) || valor < 0) return
    await cerrarCaja.mutateAsync({ fecha, montoContado: valor, ...(notas.trim() ? { notas: notas.trim() } : {}) })
    setModal(null)
  }

  const estado = caja?.estado ?? 'NO_ABIERTA'
  const diferencia = caja?.diferencia ?? 0

  return (
    <>
      <Card className="p-5 flex flex-col gap-3 bg-white border border-neutral-200 shadow-sm rounded-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 bg-[#eff8ff] text-[#175cd3]">
              <Landmark size={14} />
            </div>
            <span className="text-[12px] font-semibold text-[#475467]">Caja del día</span>
          </div>
          {estado === 'NO_ABIERTA' && (
            <Button variant="secondary" size="sm" onClick={abrirModalApertura} className="gap-1.5">
              <LockOpen size={13} /> Abrir caja
            </Button>
          )}
          {estado === 'ABIERTA' && (
            <Button variant="secondary" size="sm" onClick={abrirModalCierre} className="gap-1.5">
              <Lock size={13} /> Cerrar caja
            </Button>
          )}
        </div>

        {estado === 'NO_ABIERTA' && (
          <div className="flex flex-col gap-1">
            <span className="text-[24px] font-bold text-[#101828] leading-tight">—</span>
            <span className="text-[12px] text-[#475467] font-normal">Aún no abres la caja de hoy</span>
          </div>
        )}

        {estado === 'ABIERTA' && (
          <div className="flex flex-col gap-1">
            <span className="text-[24px] font-bold text-[#101828] leading-tight">
              {formatCurrency(caja?.montoActual ?? 0)}
            </span>
            <span className="text-[12px] text-[#475467] font-normal">
              Inició con {formatCurrency(caja?.montoApertura ?? 0)} · en vivo
            </span>
          </div>
        )}

        {estado === 'CERRADA' && (
          <div className="flex flex-col gap-1">
            <span className="text-[24px] font-bold text-[#101828] leading-tight">
              {formatCurrency(caja?.montoContado ?? 0)}
            </span>
            <span
              className={`text-[12px] font-medium ${
                diferencia === 0 ? 'text-[#475467]' : diferencia > 0 ? 'text-[#079455]' : 'text-[#d92d20]'
              }`}
            >
              Caja cerrada · {diferencia === 0 ? 'cuadró exacto' : diferencia > 0 ? `sobrante ${formatCurrency(diferencia)}` : `faltante ${formatCurrency(Math.abs(diferencia))}`}
            </span>
          </div>
        )}
      </Card>

      <Modal
        open={modal === 'apertura'}
        onClose={() => setModal(null)}
        title="Abrir caja"
        subtitle="Con cuánto efectivo arranca el día"
        icon={<LockOpen size={20} />}
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmarApertura} disabled={abrirCaja.isPending}>
              {abrirCaja.isPending ? 'Abriendo…' : 'Abrir caja'}
            </Button>
          </div>
        }
      >
        <Input
          label="Monto inicial (RD$)"
          type="number"
          min={0}
          step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0.00"
        />
        <Input
          label="Notas (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej. Cambio inicial de RD$2,000"
          maxLength={500}
        />
      </Modal>

      <Modal
        open={modal === 'cierre'}
        onClose={() => setModal(null)}
        title="Cerrar caja"
        subtitle="Cuánto efectivo contaste al final del día"
        icon={<Lock size={20} />}
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmarCierre} disabled={cerrarCaja.isPending}>
              {cerrarCaja.isPending ? 'Cerrando…' : 'Cerrar caja'}
            </Button>
          </div>
        }
      >
        <p className="text-body-sm text-text-secondary">
          Esperado ahora: <strong>{formatCurrency(caja?.montoActual ?? 0)}</strong>
        </p>
        <Input
          label="Monto contado (RD$)"
          type="number"
          min={0}
          step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0.00"
        />
        <Input
          label="Notas (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej. Faltante por vuelto mal dado"
          maxLength={500}
        />
      </Modal>
    </>
  )
}
