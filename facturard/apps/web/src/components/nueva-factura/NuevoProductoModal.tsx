'use client'

import { useState, useEffect } from 'react'
import type { JSX } from 'react'
import { PackagePlus, Package, Wrench, DollarSign, Percent, ChevronDown, AlignLeft } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ToggleGroup } from '@/components/ui/toggle-group'
import type { NuevoProductoData } from '@/hooks/useProductos'
import type { TipoECF } from '@/hooks/useNuevaFactura'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/comprobantes'

interface NuevoProductoModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: NuevoProductoData) => void
  tipoECF?: TipoECF | undefined
}

const TIPO_OPTIONS = [
  { value: 'BIEN' as const, label: 'Bien', icon: Package },
  { value: 'SERVICIO' as const, label: 'Servicio', icon: Wrench },
]

const ITBIS_OPTIONS = [
  { value: 'I1' as const, label: '18%' },
  { value: 'I2' as const, label: '16%' },
  { value: 'I3' as const, label: '0%' },
  { value: 'I4' as const, label: 'Exento' },
]

const ITBIS_RATES: Record<string, number> = {
  I1: 0.18,
  I2: 0.16,
  I3: 0,
  I4: 0,
  E: 0,
}

const UNIDADES_MEDIDA = [
  { value: '1', label: 'Barril' },
  { value: '2', label: 'Bolsa' },
  { value: '3', label: 'Bote' },
  { value: '4', label: 'Bultos' },
  { value: '5', label: 'Botella' },
  { value: '6', label: 'Caja/Cajón' },
  { value: '7', label: 'Cajetilla' },
  { value: '8', label: 'Centímetro' },
  { value: '9', label: 'Cilindro' },
  { value: '10', label: 'Conjunto' },
  { value: '11', label: 'Contenedor' },
  { value: '12', label: 'Día' },
  { value: '13', label: 'Docena' },
  { value: '14', label: 'Fardo' },
  { value: '15', label: 'Galones' },
  { value: '16', label: 'Grado' },
  { value: '17', label: 'Gramo' },
  { value: '18', label: 'Granel' },
  { value: '19', label: 'Hora' },
  { value: '20', label: 'Huacal' },
  { value: '21', label: 'Kilogramo' },
  { value: '22', label: 'Kilovatio Hora' },
  { value: '23', label: 'Libra' },
  { value: '24', label: 'Litro' },
  { value: '25', label: 'Lote' },
  { value: '26', label: 'Metro' },
  { value: '27', label: 'Metro Cuadrado' },
  { value: '28', label: 'Metro Cúbico' },
  { value: '29', label: 'Millones de Unidades Térmicas' },
  { value: '30', label: 'Minuto' },
  { value: '31', label: 'Paquete' },
  { value: '32', label: 'Par' },
  { value: '33', label: 'Pie' },
  { value: '34', label: 'Pieza' },
  { value: '35', label: 'Rollo' },
  { value: '36', label: 'Sobre' },
  { value: '37', label: 'Segundo' },
  { value: '38', label: 'Tanque' },
  { value: '39', label: 'Tonelada' },
  { value: '40', label: 'Tubo' },
  { value: '41', label: 'Yarda' },
  { value: '42', label: 'Yarda cuadrada' },
  { value: '43', label: 'Unidad' },
  { value: '44', label: 'Elemento' },
  { value: '45', label: 'Millar' },
  { value: '46', label: 'Saco' },
  { value: '47', label: 'Lata' },
  { value: '48', label: 'Display' },
  { value: '49', label: 'Bidón' },
  { value: '50', label: 'Ración' },
  { value: '51', label: 'Quintal' },
  { value: '52', label: 'Toneladas de registro bruto' },
  { value: '53', label: 'Pie Cuadrado' },
  { value: '54', label: 'Pasajero' },
  { value: '55', label: 'Pulgadas' },
  { value: '56', label: 'Parqueo Barcos En Muelle' },
  { value: '57', label: 'Bandeja' },
  { value: '58', label: 'Servicio' },
]

export function NuevoProductoModal({ open, onClose, onSave, tipoECF }: NuevoProductoModalProps): JSX.Element {
  const [nombre, setNombre] = useState('')
  const [nombreTouched, setNombreTouched] = useState(false)
  const [tipo, setTipo] = useState<'BIEN' | 'SERVICIO'>('BIEN')
  const [codigo, setCodigo] = useState('')
  const [unidadMedida, setUnidadMedida] = useState('')
  const [precio, setPrecio] = useState('')
  const [precioTouched, setPrecioTouched] = useState(false)
  const [indicadorFacturacion, setIndicadorFacturacion] = useState<'I1' | 'I2' | 'I3' | 'I4' | 'E'>('I1')
  const [precioIncluyeItbis, setPrecioIncluyeItbis] = useState(false)
  const [descripcion, setDescripcion] = useState('')

  useEffect(() => {
    if (open && (tipoECF === 'E44' || tipoECF === 'E43' || tipoECF === 'E47')) {
      setIndicadorFacturacion('I4')
    }
  }, [open, tipoECF])

  function reset(): void {
    setNombre('')
    setNombreTouched(false)
    setTipo('BIEN')
    setCodigo('')
    setUnidadMedida('')
    setPrecio('')
    setPrecioTouched(false)
    setIndicadorFacturacion(tipoECF === 'E44' || tipoECF === 'E43' || tipoECF === 'E47' ? 'I4' : 'I1')
    setPrecioIncluyeItbis(false)
    setDescripcion('')
  }

  function handleSave(): void {
    if (!nombre.trim() || !precio) return
    onSave({
      nombre,
      tipo,
      codigo,
      precio: Number(precio),
      indicadorFacturacion: indicadorFacturacion === 'I4' ? 'E' : indicadorFacturacion,
      precioIncluyeItbis,
      ...(descripcion ? { descripcion } : {}),
      ...(unidadMedida ? { unidadMedida: Number(unidadMedida) } : {}),
    })
    reset()
    onClose()
  }

  function handleClose(): void {
    reset()
    onClose()
  }

  const isValid = nombre.trim().length > 0 && Number(precio) > 0

  const showNombreError = nombreTouched && !nombre.trim()
  const showPrecioError = precioTouched && (!precio || Number(precio) <= 0)

  // Calculations for preview
  const rateKey = indicadorFacturacion === 'I4' ? 'E' : indicadorFacturacion
  const rate = ITBIS_RATES[rateKey] ?? 0.18
  const itbisLabel = rateKey === 'I1' ? '18%' : rateKey === 'I2' ? '16%' : rateKey === 'I3' ? '0%' : 'Exento'

  const inputPrice = Number(precio) || 0
  let subtotal = 0
  let itbisAmount = 0
  let total = 0

  if (precioIncluyeItbis) {
    total = inputPrice
    subtotal = total / (1 + rate)
    itbisAmount = total - subtotal
  } else {
    subtotal = inputPrice
    itbisAmount = subtotal * rate
    total = subtotal + itbisAmount
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nuevo Producto"
      subtitle="Registre un nuevo producto para facturación"
      icon={<PackagePlus size={20} />}
      className="max-w-[800px]"
      footer={
        <>
          <p className="text-[11px] font-normal text-[#64748B] leading-4 w-[250px]">
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
              Agregar
            </Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col md:flex-row gap-6 select-none text-left pt-2">
        {/* Left Column: Form */}
        <div className="flex-1 flex flex-col gap-4 border-r border-[#e2e8f0] pr-6">
          {/* Nombre / Descripción */}
          <div className="w-full">
            <Input
              label="Descripción *"
              placeholder="Ej: Salami Induveca 1lb"
              leftIcon={<Package size={16} className="text-[#64748B]" />}
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value)
                setNombreTouched(true)
              }}
              onBlur={() => setNombreTouched(true)}
              {...(showNombreError ? { error: "Campo Requerido" } : {})}
              className="h-11 rounded-[10px] bg-[#F8FAFC] border-[#E2E8F0] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white"
            />
          </div>

          {/* Bien o Servicio */}
          <div className="flex flex-col gap-[6px] text-left">
            <label className="text-[14px] font-semibold text-[#64748B] leading-[20px] font-sans">Bien o Servicio *</label>
            <ToggleGroup variant="modal" options={TIPO_OPTIONS} value={tipo} onChange={setTipo} />
          </div>

          {/* Código / SKU */}
          <div className="w-full">
            <Input
              label="Código / SKU"
              placeholder="Ej: PRD-001"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="h-11 rounded-[10px] bg-[#F8FAFC] border-[#E2E8F0] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white"
            />
          </div>

          {/* Precio + ITBIS rates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="w-full">
              <Input
                label="Precio (RD$) *"
                placeholder="0.00"
                type="number"
                min={0}
                step="any"
                leftIcon={<DollarSign size={16} className="text-[#64748B]" />}
                value={precio}
                onChange={(e) => {
                  setPrecio(e.target.value)
                  setPrecioTouched(true)
                }}
                onBlur={() => setPrecioTouched(true)}
                {...(showPrecioError ? { error: "Campo Requerido" } : {})}
                className="h-11 rounded-[10px] bg-[#F8FAFC] border-[#E2E8F0] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white"
              />
            </div>
            <div className="flex flex-col gap-[6px] text-left">
              <label className="text-[14px] font-semibold text-[#64748B] leading-[20px] font-sans">Itbis</label>
              <ToggleGroup
                variant="modal"
                options={
                  tipoECF === 'E44' || tipoECF === 'E43' || tipoECF === 'E47'
                    ? [{ value: 'I4' as const, label: 'Exento' }]
                    : ITBIS_OPTIONS
                }
                value={indicadorFacturacion as 'I1' | 'I2' | 'I3' | 'I4'}
                onChange={(v) => setIndicadorFacturacion(v)}
              />
            </div>
          </div>

          {/* Precio incluye ITBIS checkbox */}
          <label className="flex items-center gap-[7.99px] text-[13.5px] font-medium text-[#333333] leading-5 cursor-pointer select-none font-sans">
            <input
              type="checkbox"
              checked={precioIncluyeItbis}
              onChange={(e) => setPrecioIncluyeItbis(e.target.checked)}
              className="h-[18px] w-[18px] rounded-[3px] border-neutral-300 text-brand-500 focus:ring-brand-500/20 bg-black/[0.02]"
            />
            El precio incluye ITBIS
          </label>

          {/* Unidad de Medida */}
          <div className="flex flex-col gap-[6px] text-left">
            <label className="text-[14px] font-semibold text-[#64748B] leading-[20px] font-sans">Unidad de Medida</label>
            <Select
              value={unidadMedida}
              onChange={setUnidadMedida}
              options={UNIDADES_MEDIDA}
              placeholder="Seleccionar"
            />
          </div>

          {/* Descripción */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-ui-sm font-semibold text-[#64748B] font-sans">Descripción</label>
            <div className="relative w-full">
              <div className="absolute left-3.5 top-3 text-text-secondary flex items-center justify-center pointer-events-none">
                <AlignLeft size={16} className="text-[#64748B]" />
              </div>
              <textarea
                placeholder="Detalles adicionales del producto o servicio"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                className="w-full rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white pl-10 pr-4 py-2.5 resize-none min-h-[80px] font-sans"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Live Preview */}
        <div className="w-full md:w-[260px] flex flex-col gap-4">
          <span className="text-[#64748b] text-[12px] font-semibold uppercase tracking-wider">
            Vista previa
          </span>
          <div className="bg-white border border-[#e4e7ec] p-4 rounded-[14px] flex flex-col gap-3.5 shadow-sm">
            <span className="text-[#333] text-[14px] font-semibold line-clamp-2">
              {nombre || 'Nombre del Producto'}
            </span>
            <div className="flex flex-col gap-2.5 text-[13px] font-sans">
              <div className="flex items-center justify-between text-[#64748b]">
                <span>Subtotal</span>
                <span className="text-[#333] font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-[#64748b]">
                <span>ITBIS {itbisLabel}</span>
                <span className="text-[#333] font-medium">{formatCurrency(itbisAmount)}</span>
              </div>
              <div className="border-t border-[#e4e7ec] pt-2.5 flex items-center justify-between font-bold text-[14px]">
                <span className="text-[#333]">Total</span>
                <span className="text-[#0379d5]">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-[#64748b] font-sans">
            Los cálculos se actualizan en tiempo real.
          </p>
        </div>
      </div>
    </Modal>
  )
}
