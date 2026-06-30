'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { Building2, User, CreditCard, Mail, Phone, UserPlus } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ToggleGroup } from '@/components/ui/toggle-group'
import type { NuevoContactoData } from '@/hooks/useContactos'

interface NuevoClienteModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: NuevoContactoData) => void
}

const TIPO_OPTIONS = [
  { value: 'EMPRESA' as const, label: 'Empresa', icon: Building2 },
  { value: 'PERSONA' as const, label: 'Persona Física', icon: User },
]

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
  const [tipo, setTipo] = useState<'EMPRESA' | 'PERSONA'>('EMPRESA')
  const [nombre, setNombre] = useState('')
  const [rnc, setRnc] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')

  function reset(): void {
    setTipo('EMPRESA')
    setNombre('')
    setRnc('')
    setEmail('')
    setTelefono('')
  }

  function handleSave(): void {
    if (!nombre.trim()) return
    onSave({
      nombre,
      rnc: rnc.replace(/\D/g, ''),
      email,
      telefono: telefono.replace(/\D/g, ''),
      tipo
    })
    reset()
    onClose()
  }

  function handleClose(): void {
    reset()
    onClose()
  }

  const isValid = nombre.trim().length > 0 && rnc.replace(/\D/g, '').length >= 9

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nuevo Cliente"
      subtitle="Registre un nuevo cliente para facturación"
      icon={<UserPlus size={20} />}
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
              <UserPlus size={16} />
              Guardar Cliente
            </Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-[20px] [&_label]:text-[#64748B] [&_label]:font-normal [&_label]:text-[14px] [&_label]:leading-[20px] [&_label]:font-sans select-none">
        {/* Tipo de cliente */}
        <div className="flex flex-col gap-[6px] text-left">
          <label className="text-[14px] font-normal text-[#64748B] leading-[20px]">Tipo de Cliente *</label>
          <ToggleGroup
            variant="modal"
            options={TIPO_OPTIONS}
            value={tipo}
            onChange={(val) => { setTipo(val as 'EMPRESA' | 'PERSONA'); setRnc(''); }}
          />
        </div>

        {/* Razón Social / Nombre */}
        <Input
          label={tipo === 'EMPRESA' ? 'Razón Social *' : 'Nombre Completo *'}
          placeholder={tipo === 'EMPRESA' ? 'Ej: Distribuidora López SRL' : 'Ej: Juan Pérez'}
          leftIcon={tipo === 'EMPRESA' ? <Building2 size={16} className="text-[#64748B]" /> : <User size={16} className="text-[#64748B]" />}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="h-11 rounded-[10px] bg-[#F8FAFC] border-[#E2E8F0] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white"
        />

        {/* RNC / Cédula */}
        <Input
          label={tipo === 'EMPRESA' ? 'RNC *' : 'Cédula *'}
          placeholder={tipo === 'EMPRESA' ? 'Ej: 130-56789-1' : 'Ej: 130-5678912-1'}
          leftIcon={<CreditCard size={16} className="text-[#64748B]" />}
          inputMode="numeric"
          maxLength={tipo === 'EMPRESA' ? 11 : 13}
          value={rnc}
          onChange={(e) => setRnc(formatRncInput(e.target.value))}
          helperText={tipo === 'EMPRESA' ? 'Formato: 000-00000-0' : 'Formato: 000-0000000-0'}
          className="h-11 rounded-[10px] bg-[#F8FAFC] border-[#E2E8F0] text-[12px] text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:bg-white"
        />

        {/* Email */}
        <Input
          label="Correo Electrónico"
          placeholder="correo@ejemplo.com"
          type="email"
          leftIcon={<Mail size={16} className="text-[#64748B]" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
    </Modal>
  )
}
