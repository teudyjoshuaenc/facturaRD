'use client'

import { useState, useEffect } from 'react'
import type { JSX } from 'react'
import { Building2, User, CreditCard, Mail, Phone, UserPlus, MapPin, AlignLeft, ChevronDown } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NuevoContactoData } from '@/hooks/useContactos'

interface NuevoClienteModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: NuevoContactoData) => void
}

const PROVINCIAS_MUNICIPIOS: Record<string, string[]> = {
  'Distrito Nacional': ['Santo Domingo de Guzmán'],
  'Santo Domingo': ['Santo Domingo Este', 'Santo Domingo Oeste', 'Santo Domingo Norte', 'Boca Chica', 'San Antonio de Guerra', 'Pedro Brand', 'Los Alcarrizos'],
  'Santiago': ['Santiago de los Caballeros', 'Bisonó', 'Jánico', 'Licey al Medio', 'San José de las Matas', 'Tamboril', 'Villa González', 'Puñal', 'Sabana Iglesia'],
  'La Altagracia': ['Salvaleón de Higüey', 'San Rafael del Yuma'],
  'La Romana': ['La Romana', 'Guaymate', 'Villa Hermosa'],
  'San Pedro de Macorís': ['San Pedro de Macorís', 'Consuelo', 'El Valle', 'Quisqueya', 'Ramón Santana', 'San José de los Llanos'],
  'San Cristóbal': ['San Cristóbal', 'Sabana Grande de Palenque', 'Bajos de Haina', 'Cambita Garabitos', 'Villa Altagracia', 'Yaguate', 'San Gregorio de Nigua', 'Los Cacaos'],
  'Duarte': ['San Francisco de Macorís', 'Arenoso', 'Castillo', 'Las Guáranas', 'Pimentel', 'Villa Riva', 'Hostos']
}

function formatRncInput(value: string): string {
  const clean = value.replace(/\D/g, '')
  if (clean.length <= 9) {
    // Format 9 digits RNC: XXX-XXXXX-X
    return clean.replace(/(\d{3})(\d{0,5})(\d{0,1})/, (_, p1, p2, p3) => {
      let res = p1
      if (p2) res += '-' + p2
      if (p3) res += '-' + p3
      return res
    })
  } else {
    // Format 11 digits Cédula: XXX-XXXXXXX-X
    return clean.slice(0, 11).replace(/(\d{3})(\d{0,7})(\d{0,1})/, (_, p1, p2, p3) => {
      let res = p1
      if (p2) res += '-' + p2
      if (p3) res += '-' + p3
      return res
    })
  }
}

function formatPhoneInput(value: string): string {
  const clean = value.replace(/\D/g, '').slice(0, 10)
  return clean.replace(/(\d{3})(\d{0,3})(\d{0,4})/, (_, p1, p2, p3) => {
    let res = p1
    if (p2) res += '-' + p2
    if (p3) res += '-' + p3
    return res
  })
}

export function NuevoClienteModal({ open, onClose, onSave }: NuevoClienteModalProps): JSX.Element {
  const [nombre, setNombre] = useState('')
  const [rnc, setRnc] = useState('')
  const [idExtranjero, setIdExtranjero] = useState('')
  const [telefono, setTelefono] = useState('')
  const [comentarios, setComentarios] = useState('')
  const [email, setEmail] = useState('')
  const [direccion, setDireccion] = useState('')
  const [provincia, setProvincia] = useState('')
  const [municipio, setMunicipio] = useState('')

  const [rncTouched, setRncTouched] = useState(false)
  const [nombreTouched, setNombreTouched] = useState(false)

  useEffect(() => {
    setMunicipio('')
  }, [provincia])

  function reset(): void {
    setNombre('')
    setRnc('')
    setIdExtranjero('')
    setTelefono('')
    setComentarios('')
    setEmail('')
    setDireccion('')
    setProvincia('')
    setMunicipio('')
    setRncTouched(false)
    setNombreTouched(false)
  }

  function handleSave(): void {
    if (!nombre.trim()) return
    const cleanRnc = rnc.replace(/\D/g, '')
    const resolvedTipo = cleanRnc.length === 9 ? 'EMPRESA' : 'PERSONA'
    onSave({
      nombre,
      rnc: cleanRnc,
      email,
      telefono: telefono.replace(/\D/g, ''),
      tipo: resolvedTipo,
      idExtranjero,
      direccion,
      provincia,
      municipio,
      comentarios
    })
    reset()
    onClose()
  }

  function handleClose(): void {
    reset()
    onClose()
  }

  const isValid = nombre.trim().length > 0 && (rnc.replace(/\D/g, '').length >= 9 || idExtranjero.trim().length > 0)
  
  const showRncError = rncTouched && !idExtranjero.trim() && rnc.replace(/\D/g, '').length < 9
  const showNombreError = nombreTouched && !nombre.trim()

  const municipiosDisponibles = provincia ? (PROVINCIAS_MUNICIPIOS[provincia] || []) : []

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nuevo Cliente"
      subtitle="Registre un nuevo cliente para facturación"
      icon={<UserPlus size={20} />}
      className="max-w-[740px]"
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
              <UserPlus size={16} />
              Guardar Cliente
            </Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-[20px] select-none text-left pt-2">
        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          
          {/* Left Column */}
          <div className="flex flex-col gap-4">
            {/* Rnc / Cédula */}
            <Input
              label="Rnc / Cédula *"
              placeholder="Ej: 130-56789-1"
              leftIcon={<CreditCard size={16} className="text-[#64748B]" />}
              inputMode="numeric"
              maxLength={13}
              value={rnc}
              onChange={(e) => {
                setRnc(formatRncInput(e.target.value))
                setRncTouched(true)
              }}
              onBlur={() => setRncTouched(true)}
              {...(showRncError ? { error: "Este campo es requerido" } : {})}
              className="h-11 rounded-[10px] bg-[#F8FAFC] border-[#E2E8F0] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white"
            />

            {/* ID Extranjero */}
            <Input
              label="ID Extranjero"
              placeholder="Ej: US123456789"
              leftIcon={<User size={16} className="text-[#64748B]" />}
              value={idExtranjero}
              onChange={(e) => setIdExtranjero(e.target.value)}
              className="h-11 rounded-[10px] bg-[#F8FAFC] border-[#E2E8F0] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white"
            />

            {/* Razón Social */}
            <Input
              label="Razón Social *"
              placeholder="Ej: Distribuidora López SRL"
              leftIcon={<Building2 size={16} className="text-[#64748B]" />}
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value)
                setNombreTouched(true)
              }}
              onBlur={() => setNombreTouched(true)}
              {...(showNombreError ? { error: "Este campo es requerido" } : {})}
              className="h-11 rounded-[10px] bg-[#F8FAFC] border-[#E2E8F0] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white"
            />

            {/* Teléfono */}
            <Input
              label="Teléfono"
              placeholder="809-555-0000"
              type="tel"
              leftIcon={<Phone size={16} className="text-[#64748B]" />}
              maxLength={12}
              value={telefono}
              onChange={(e) => setTelefono(formatPhoneInput(e.target.value))}
              className="h-11 rounded-[10px] bg-[#F8FAFC] border-[#E2E8F0] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white"
            />
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-4">
            {/* Correo Electrónico */}
            <Input
              label="Correo Electrónico"
              placeholder="correo@ejemplo.com"
              type="email"
              leftIcon={<Mail size={16} className="text-[#64748B]" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-[10px] bg-[#F8FAFC] border-[#E2E8F0] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white"
            />

            {/* Dirección */}
            <Input
              label="Dirección"
              placeholder="Ej: Av. Winston Churchill #109"
              leftIcon={<MapPin size={16} className="text-[#64748B]" />}
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="h-11 rounded-[10px] bg-[#F8FAFC] border-[#E2E8F0] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white"
            />

            {/* Provincia */}
            <div className="flex flex-col gap-1.5">
              <label className="text-ui-sm font-semibold text-[#64748B] font-sans">Provincia</label>
              <div className="relative w-full">
                <select
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                  className="h-11 w-full rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] text-[12px] text-[#333333] px-4 appearance-none pr-10 cursor-pointer focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-sans"
                >
                  <option value="">Seleccionar</option>
                  {Object.keys(PROVINCIAS_MUNICIPIOS).map((prov) => (
                    <option key={prov} value={prov}>{prov}</option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            {/* Municipio */}
            <div className="flex flex-col gap-1.5">
              <label className="text-ui-sm font-semibold text-[#64748B] font-sans">Municipio</label>
              <div className="relative w-full">
                <select
                  value={municipio}
                  disabled={!provincia}
                  onChange={(e) => setMunicipio(e.target.value)}
                  className="h-11 w-full rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] text-[12px] text-[#333333] px-4 appearance-none pr-10 cursor-pointer focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Seleccionar</option>
                  {municipiosDisponibles.map((muni) => (
                    <option key={muni} value={muni}>{muni}</option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>
          </div>

          {/* Comentarios spanning full width of the popup */}
          <div className="col-span-1 md:col-span-2 flex flex-col gap-1.5 w-full mt-2">
            <label className="text-ui-sm font-semibold text-[#64748B] font-sans">Comentarios</label>
            <div className="relative w-full">
              <div className="absolute left-3.5 top-3 text-text-secondary flex items-center justify-center pointer-events-none">
                <AlignLeft size={16} className="text-[#64748B]" />
              </div>
              <textarea
                placeholder="Ej: Cliente gubernamental, exento de ITBIS..."
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                rows={4}
                className="w-full rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white pl-10 pr-4 py-2.5 resize-none min-h-[100px] font-sans"
              />
            </div>
          </div>

        </div>
      </div>
    </Modal>
  )
}
