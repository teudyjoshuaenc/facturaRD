'use client'

import type { JSX } from 'react'
import { cn } from '@/lib/utils'
import type { Contacto } from '@/hooks/useContactos'

interface ClienteCardProps {
  contacto: Contacto
  selected: boolean
  onClick: () => void
}

export function ClienteCard({ contacto, selected, onClick }: ClienteCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col justify-center items-start text-left gap-[2px] rounded-[10px] p-[18px] w-full lg:w-[444px] h-[97px] border-2 transition-all duration-150',
        selected
          ? 'border-[#0379D5] bg-[#0379D5]/5 shadow-sm'
          : 'border-[#E2E8F0] bg-white hover:border-[#0379D5]/40',
      )}
    >
      {/* Name */}
      <span className="text-[14px] font-semibold text-[#333333] leading-[21px] font-sans truncate w-full">
        {contacto.nombre}
      </span>

      {/* RNC */}
      <p className="text-[12px] font-normal text-[#64748B] leading-[18px] font-sans">
        RNC: {contacto.rnc.length === 9 
          ? contacto.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3') 
          : contacto.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')}
      </p>

      {/* Email */}
      <span className="text-[12px] font-normal text-[#94A3B8] leading-[18px] font-sans truncate w-full">
        {contacto.email || 'Sin correo electrónico'}
      </span>
    </button>
  )
}
