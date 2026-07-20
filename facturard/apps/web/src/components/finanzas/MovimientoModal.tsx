'use client'

import { useEffect, useState, type JSX } from 'react'
import { ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ToggleGroup } from '@/components/ui/toggle-group'
import {
  CATEGORIA_OPTIONS,
  useCrearMovimiento,
  useActualizarMovimiento,
  type MovimientoFinanciero,
  type MovimientoTipo,
  type MovimientoCategoria,
} from '@/hooks/useFinanzas'

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  open: boolean
  onClose: () => void
  movimiento?: MovimientoFinanciero | null
}

export function MovimientoModal({ open, onClose, movimiento }: Props): JSX.Element {
  const crear = useCrearMovimiento()
  const actualizar = useActualizarMovimiento()
  const editando = !!movimiento

  const [tipo, setTipo] = useState<MovimientoTipo>('EGRESO')
  const [categoria, setCategoria] = useState<MovimientoCategoria>('NOMINA')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [descripcion, setDescripcion] = useState('')
  const [metodoPago, setMetodoPago] = useState('')

  useEffect(() => {
    if (!open) return
    if (movimiento) {
      setTipo(movimiento.tipo)
      setCategoria(movimiento.categoria)
      setMonto(String(Number(movimiento.monto)))
      setFecha(movimiento.fecha.slice(0, 10))
      setDescripcion(movimiento.descripcion ?? '')
      setMetodoPago(movimiento.metodoPago ?? '')
    } else {
      setTipo('EGRESO')
      setCategoria('NOMINA')
      setMonto('')
      setFecha(hoyISO())
      setDescripcion('')
      setMetodoPago('')
    }
  }, [open, movimiento])

  const valor = Number(monto)
  const valido = !Number.isNaN(valor) && valor > 0 && !!fecha
  const pendiente = crear.isPending || actualizar.isPending

  async function guardar(): Promise<void> {
    if (!valido) return
    const data = {
      tipo,
      categoria,
      monto: valor,
      fecha,
      ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
      ...(metodoPago.trim() ? { metodoPago: metodoPago.trim() } : {}),
    }
    if (movimiento) await actualizar.mutateAsync({ id: movimiento.id, data })
    else await crear.mutateAsync(data)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar movimiento' : 'Registrar movimiento'}
      subtitle="Ingreso o egreso manual de caja"
      icon={<ArrowLeftRight size={20} />}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={!valido || pendiente}>
            {pendiente ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-ui-sm font-semibold text-text-secondary">Tipo</label>
        <ToggleGroup<MovimientoTipo>
          value={tipo}
          onChange={setTipo}
          options={[
            { value: 'INGRESO', label: 'Ingreso', icon: TrendingUp },
            { value: 'EGRESO', label: 'Egreso', icon: TrendingDown },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-ui-sm font-semibold text-text-secondary">Categoría</label>
        <Select value={categoria} onChange={(v) => setCategoria(v as MovimientoCategoria)} options={CATEGORIA_OPTIONS} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Monto (RD$)"
          type="number"
          min={0}
          step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0.00"
        />
        <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>

      <Input
        label="Descripción (opcional)"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Ej. Alquiler local, aporte socio…"
        maxLength={500}
      />
      <Input
        label="Método de pago (opcional)"
        value={metodoPago}
        onChange={(e) => setMetodoPago(e.target.value)}
        placeholder="Efectivo, transferencia, cheque…"
      />
    </Modal>
  )
}
