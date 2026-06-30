'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { PackagePlus, Package, Wrench, Tag, DollarSign, Percent } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ToggleGroup } from '@/components/ui/toggle-group'
import type { NuevoProductoData } from '@/hooks/useProductos'

interface NuevoProductoModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: NuevoProductoData) => void
}

const TIPO_OPTIONS = [
  { value: 'BIEN' as const, label: 'Bien', icon: Package },
  { value: 'SERVICIO' as const, label: 'Servicio', icon: Wrench },
]

const ITBIS_OPTIONS = [
  { value: 'I1' as const, label: '18', icon: Percent },
  { value: 'I4' as const, label: 'Exento' },
]

export function NuevoProductoModal({ open, onClose, onSave }: NuevoProductoModalProps): JSX.Element {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<'BIEN' | 'SERVICIO'>('BIEN')
  const [codigo, setCodigo] = useState('')
  const [precio, setPrecio] = useState('')
  const [indicadorFacturacion, setIndicadorFacturacion] = useState<'I1' | 'I2' | 'I3' | 'I4' | 'E'>('I1')
  const [precioIncluyeItbis, setPrecioIncluyeItbis] = useState(false)

  function reset(): void {
    setNombre('')
    setTipo('BIEN')
    setCodigo('')
    setPrecio('')
    setIndicadorFacturacion('I1')
    setPrecioIncluyeItbis(false)
  }

  function handleSave(): void {
    if (!nombre.trim() || !precio) return
    onSave({
      nombre,
      tipo,
      codigo,
      precio: Number(precio),
      indicadorFacturacion,
      precioIncluyeItbis,
    })
    reset()
    onClose()
  }

  function handleClose(): void {
    reset()
    onClose()
  }

  const isValid = nombre.trim().length > 0 && Number(precio) > 0

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nuevo Producto"
      subtitle="Registre un nuevo producto para facturación"
      icon={<PackagePlus size={20} />}
      className="max-w-[520px]"
      footer={
        <>
          <p className="text-[11px] font-normal text-[#64748B] leading-4 w-[172px]">
            Los campos con * son obligatorios
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={handleClose}
              className="h-[42px] w-[101px] rounded-[10px] border-[#E2E8F0] text-[#64748B] text-[14px] font-normal"
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!isValid}
              onClick={handleSave}
              className="flex items-center justify-center gap-1 h-[42px] w-[168px] rounded-[10px] bg-[#0379D5] text-white text-[14px] font-normal"
            >
              <PackagePlus size={16} />
              Guardar Producto
            </Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-[20px] [&_label]:text-[#64748B] [&_label]:font-normal [&_label]:text-[14px] [&_label]:leading-[20px] [&_label]:font-sans select-none">
        {/* Nombre */}
        <Input
          label="Nombre del Producto / Servicio *"
          placeholder="Ej: Servicio de Consultoría"
          leftIcon={<Package size={16} className="text-[#64748B]" />}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="h-11 rounded-[10px] bg-[#F8FAFC] border-[#E2E8F0] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white"
        />

        {/* Tipo */}
        <div className="flex flex-col gap-[6px] text-left">
          <label className="text-[14px] font-normal text-[#64748B] leading-[20px]">Tipo *</label>
          <ToggleGroup variant="modal" options={TIPO_OPTIONS} value={tipo} onChange={setTipo} />
        </div>

        {/* Código / SKU */}
        <Input
          label="Código / SKU *"
          placeholder="Opcional: SKU-001"
          leftIcon={<Tag size={16} className="text-[#64748B]" />}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="h-11 rounded-[10px] bg-[#F8FAFC] border-[#E2E8F0] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white"
        />

        {/* Precio + ITBIS row */}
        <div className="grid grid-cols-2 gap-5">
          <Input
            label="Precio (DOP) *"
            placeholder="0.00"
            type="number"
            min={0}
            step="any"
            leftIcon={<DollarSign size={16} className="text-[#64748B]" />}
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className="h-11 rounded-[10px] bg-[#F8FAFC] border-[#E2E8F0] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white"
          />
          <div className="flex flex-col gap-[6px] text-left">
            <label className="text-[14px] font-normal text-[#64748B] leading-[20px]">ITBIS</label>
            <ToggleGroup
              variant="modal"
              options={ITBIS_OPTIONS}
              value={indicadorFacturacion as 'I1' | 'I4'}
              onChange={(v) => setIndicadorFacturacion(v)}
            />
          </div>
        </div>

        {/* Precio incluye ITBIS */}
        <label className="flex items-center gap-[7.99px] text-[14px] font-medium text-[#333333] leading-5 cursor-pointer select-none font-sans mt-1">
          <input
            type="checkbox"
            checked={precioIncluyeItbis}
            onChange={(e) => setPrecioIncluyeItbis(e.target.checked)}
            className="h-[18px] w-[18px] rounded-[3px] border-neutral-300 text-brand-500 focus:ring-brand-500/20 bg-black/[0.02]"
          />
          El precio incluye ITBIS
        </label>
      </div>
    </Modal>
  )
}
