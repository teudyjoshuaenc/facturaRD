'use client'

import { useState, useEffect } from 'react'
import type { JSX } from 'react'
import { Building2, User, CreditCard, Mail, Phone, Edit, MapPin, AlignLeft, ChevronDown, Check } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NuevoContactoData } from '@/hooks/useContactos'
import { Select } from '@/components/ui/select'
import { useRncValidation } from '@/hooks/useRncValidation'
import { Spinner } from '@/components/ui/spinner'
import { PROVINCIAS_MUNICIPIOS } from '@/lib/provincias-rd'

interface EditarClienteModalProps {
  open: boolean
  onClose: () => void
  contacto: any | null
  onSave: (id: string, data: NuevoContactoData) => void
}

function formatRncInput(value: string): string {
  const clean = value.replace(/\D/g, '')
  if (clean.length <= 9) {
    return clean.replace(/(\d{3})(\d{0,5})(\d{0,1})/, (_, p1, p2, p3) => {
      let res = p1
      if (p2) res += '-' + p2
      if (p3) res += '-' + p3
      return res
    })
  } else {
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

export function EditarClienteModal({ open, onClose, contacto, onSave }: EditarClienteModalProps): JSX.Element {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<'CLIENTE' | 'PROVEEDOR' | 'CONSUMIDOR_FINAL'>('CLIENTE')
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
    if (contacto) {
      setNombre(contacto.razonSocial || contacto.nombre || '')
      setTipo(contacto.tipo || 'CLIENTE')
      setRnc(contacto.rnc ? formatRncInput(contacto.rnc) : '')
      setIdExtranjero(contacto.identificadorExtranjero || contacto.idExtranjero || '')
      setTelefono(contacto.telefono ? formatPhoneInput(contacto.telefono) : '')
      setComentarios(contacto.comentarios || '')
      setEmail(contacto.email || '')
      setDireccion(contacto.direccion || '')
      setProvincia(contacto.provincia || '')
      setMunicipio(contacto.municipio || '')
    } else {
      reset()
    }
  }, [contacto, open])

  useEffect(() => {
    if (contacto && open) {
      // Preserve municipio if it belongs to selected province
      if (provincia && PROVINCIAS_MUNICIPIOS[provincia]?.includes(contacto.municipio)) {
        setMunicipio(contacto.municipio)
      } else {
        setMunicipio('')
      }
    } else {
      setMunicipio('')
    }
  }, [provincia, contacto, open])

  function reset(): void {
    setNombre('')
    setTipo('CLIENTE')
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

  const cleanRnc = rnc.replace(/\D/g, '')
  const isEligibleForValidation = tipo !== 'CONSUMIDOR_FINAL' && (cleanRnc.length === 9 || cleanRnc.length === 11)
  const { status: rncStatus, razonSocial: validatedRazonSocial, error: rncError } = useRncValidation(
    isEligibleForValidation ? cleanRnc : ''
  )

  useEffect(() => {
    if (isEligibleForValidation && rncStatus === 'valid' && validatedRazonSocial) {
      setNombre(validatedRazonSocial)
      setNombreTouched(true)
    }
  }, [rncStatus, validatedRazonSocial, isEligibleForValidation])

  function handleSave(): void {
    if (!nombre.trim() || !contacto) return
    const cleanRnc = rnc.replace(/\D/g, '')
    onSave(contacto.id, {
      nombre,
      rnc: cleanRnc,
      email,
      telefono: telefono.replace(/\D/g, ''),
      tipo,
      idExtranjero,
      direccion,
      provincia,
      municipio,
      comentarios
    })
    onClose()
  }

  function handleClose(): void {
    reset()
    onClose()
  }

  const isRncOrIdExtranjeroValid = rnc.replace(/\D/g, '').length >= 9 || idExtranjero.trim().length > 0
  const isValid = nombre.trim().length > 0 && (tipo === 'CONSUMIDOR_FINAL' || isRncOrIdExtranjeroValid)
  
  const showRncError = rncTouched && tipo !== 'CONSUMIDOR_FINAL' && !idExtranjero.trim() && rnc.replace(/\D/g, '').length < 9
  const validationError = tipo !== 'CONSUMIDOR_FINAL' && rncStatus === 'invalid' ? rncError : ''
  const displayRncError = showRncError ? "Campo Requerido" : validationError
  const showNombreError = nombreTouched && !nombre.trim()

  const municipiosDisponibles = provincia ? (PROVINCIAS_MUNICIPIOS[provincia] || []) : []

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Editar Contacto"
      subtitle="Complete o actualice la información del contacto"
      icon={<Edit size={20} />}
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
              className="flex items-center justify-center gap-[4px] h-[42px] px-[20px] rounded-[10px] bg-[#0379D5] text-white text-[14px] font-normal whitespace-nowrap"
            >
              <Edit size={16} />
              Guardar Cambios
            </Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-[20px] select-none text-left pt-2">
        {/* Tipo de Contacto Dropdown */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-ui-sm font-semibold text-[#64748B] font-sans">Tipo de Contacto *</label>
          <Select
            value={tipo}
            onChange={(val) => setTipo(val as any)}
            options={[
              { value: 'CLIENTE', label: 'Cliente' },
              { value: 'PROVEEDOR', label: 'Proveedor' },
              { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' },
            ]}
            placeholder="Seleccionar tipo"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          
          {/* Left Column */}
          <div className="flex flex-col gap-4">
            {/* Rnc / Cédula */}
            <Input
              label={tipo === 'CONSUMIDOR_FINAL' ? "Rnc / Cédula" : "Rnc / Cédula *"}
              placeholder="Ej: 130-56789-1"
              leftIcon={<CreditCard size={16} className="text-[#64748B]" />}
              rightIcon={
                rncStatus === 'loading' ? (
                  <Spinner size={16} />
                ) : rncStatus === 'valid' ? (
                  <Check size={16} className="text-green-600" />
                ) : null
              }
              inputMode="numeric"
              maxLength={13}
              value={rnc}
              onChange={(e) => {
                setRnc(formatRncInput(e.target.value))
                setRncTouched(true)
              }}
              onBlur={() => setRncTouched(true)}
              {...(displayRncError ? { error: displayRncError } : {})}
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
              label="Nombre o Razón Social *"
              placeholder="Ej: Distribuidora López SRL"
              leftIcon={<Building2 size={16} className="text-[#64748B]" />}
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value)
                setNombreTouched(true)
              }}
              onBlur={() => setNombreTouched(true)}
              {...(showNombreError ? { error: "Campo Requerido" } : {})}
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
              <Select
                value={provincia}
                onChange={setProvincia}
                options={Object.keys(PROVINCIAS_MUNICIPIOS).map((prov) => ({ value: prov, label: prov }))}
                placeholder="Seleccionar"
              />
            </div>

            {/* Municipio */}
            <div className="flex flex-col gap-1.5">
              <label className="text-ui-sm font-semibold text-[#64748B] font-sans">Municipio</label>
              <Select
                value={municipio}
                disabled={!provincia}
                onChange={setMunicipio}
                options={municipiosDisponibles.map((muni) => ({ value: muni, label: muni }))}
                placeholder="Seleccionar"
              />
            </div>
          </div>

          {/* Comentarios */}
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
