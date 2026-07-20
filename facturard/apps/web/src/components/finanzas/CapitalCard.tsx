'use client'

import { useState, type JSX } from 'react'
import { PiggyBank, Pencil } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { formatCurrency, formatDate } from '@/lib/comprobantes'
import { useCapital, useSetCapital } from '@/hooks/useFinanzas'

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function CapitalCard(): JSX.Element {
  const { data: capital } = useCapital()
  const setCapital = useSetCapital()
  const [open, setOpen] = useState(false)
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())

  const montoActual = capital ? Number(capital.monto) : 0

  function abrir(): void {
    setMonto(montoActual ? String(montoActual) : '')
    setFecha(capital?.fecha ? capital.fecha.slice(0, 10) : hoyISO())
    setOpen(true)
  }

  async function guardar(): Promise<void> {
    const valor = Number(monto)
    if (Number.isNaN(valor) || valor < 0) return
    await setCapital.mutateAsync({ monto: valor, fecha })
    setOpen(false)
  }

  return (
    <>
      <Card className="p-5 flex flex-col gap-3 bg-white border border-neutral-200 shadow-sm rounded-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 bg-[#f9f5ff] text-[#6941c6]">
              <PiggyBank size={14} />
            </div>
            <span className="text-[12px] font-semibold text-[#475467]">Capital inicial</span>
          </div>
          <button
            type="button"
            onClick={abrir}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-100 hover:text-brand-500"
            title="Editar capital inicial"
            aria-label="Editar capital inicial"
          >
            <Pencil size={14} />
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[24px] font-bold text-[#101828] leading-tight">{formatCurrency(montoActual)}</span>
          <span className="text-[12px] text-[#475467] font-normal">
            {capital?.fecha ? `Desde ${formatDate(capital.fecha)}` : 'Sin fecha de partida'}
          </span>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Capital inicial"
        subtitle="Saldo de partida del negocio"
        icon={<PiggyBank size={20} />}
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={guardar} disabled={setCapital.isPending}>
              {setCapital.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        }
      >
        <Input
          label="Monto (RD$)"
          type="number"
          min={0}
          step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0.00"
        />
        <Input label="Fecha de partida" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Modal>
    </>
  )
}
