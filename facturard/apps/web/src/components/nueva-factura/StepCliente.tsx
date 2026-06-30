'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { Search, Plus, ChevronRight, ChevronDown, Banknote, CreditCard, ArrowLeftRight, Clock, Building2, User, Check } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ClienteCard } from './ClienteCard'
import { NuevoClienteModal } from './NuevoClienteModal'
import { useContactos } from '@/hooks/useContactos'
import type { Contacto, NuevoContactoData } from '@/hooks/useContactos'
import type { TipoECF } from '@/hooks/useNuevaFactura'
import { cn } from '@/lib/utils'

const TIPOS_ECF: { value: TipoECF; label: string }[] = [
  { value: 'E31', label: 'B01 - Factura de Crédito Fiscal' },
  { value: 'E32', label: 'B02 - Factura de Consumo' },
  { value: 'E33', label: 'B03 - Nota de Débito' },
  { value: 'E34', label: 'B04 - Nota de Crédito' },
  { value: 'E41', label: 'B11 - Comprobante de Compras' },
  { value: 'E43', label: 'B13 - Gastos Menores' },
  { value: 'E44', label: 'B14 - Regímenes Especiales' },
  { value: 'E45', label: 'B15 - Gubernamental' },
  { value: 'E46', label: 'B16 - Exportaciones' },
  { value: 'E47', label: 'B17 - Pagos al Exterior' },
]

export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CREDITO'

const CONDICION_PAGO_OPTIONS = [
  { value: 'EFECTIVO' as const, label: 'Efectivo', icon: Banknote },
  { value: 'TARJETA' as const, label: 'Tarjeta', icon: CreditCard },
  { value: 'TRANSFERENCIA' as const, label: 'Transfer.', icon: ArrowLeftRight },
  { value: 'CREDITO' as const, label: 'Crédito', icon: Clock },
]

interface StepClienteProps {
  selectedCliente: Contacto | null
  onSelectCliente: (c: Contacto) => void
  tipoECF: TipoECF
  onTipoECFChange: (t: TipoECF) => void
  condicionPago: PaymentMethod
  onCondicionPagoChange: (c: PaymentMethod) => void
  onNext: () => void
  isQuickMode?: boolean
}

export function StepCliente({
  selectedCliente,
  onSelectCliente,
  tipoECF,
  onTipoECFChange,
  condicionPago,
  onCondicionPagoChange,
  onNext,
  isQuickMode,
}: StepClienteProps): JSX.Element {
  const { contactos, frecuentes, searchQuery, setSearchQuery, crearContacto } = useContactos()
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [showNcfDropdown, setShowNcfDropdown] = useState(false)

  // E43 (Gastos Menores) doesn't require a client
  const skipCliente = tipoECF === 'E43'
  const canProceed = skipCliente || selectedCliente !== null

  function handleNuevoCliente(data: NuevoContactoData): void {
    const nuevo = crearContacto(data)
    onSelectCliente(nuevo)
  }

  const showSearch = searchQuery.trim().length > 0

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Seleccionar cliente */}
        {/* Seleccionar cliente */}
        {!skipCliente && (
          <div className="flex flex-col gap-4 w-[904px]">
            <h3 className="text-[18px] font-semibold text-[#333333] leading-[27px] font-sans">Seleccionar Cliente</h3>

            {/* Search and Button horizontally */}
            <div className="flex gap-[12px] h-[44px] items-center">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-[16px] top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o RNC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-[44px] w-full rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] pl-[40px] pr-4 text-[14px] font-normal leading-[19px] text-[#333333] placeholder:text-[#0A0A0A]/50 focus:border-[#0379D5] focus:bg-white focus:outline-none focus:ring-0 transition-colors"
                />

                {/* Search dropdown (Limit to 5) */}
                {showSearch && (
                  <div className="absolute z-50 mt-1.5 max-h-[337px] w-full md:w-[742px] overflow-y-auto rounded-[14px] border border-neutral-100 bg-white shadow-[0px_25px_50px_-5px_rgba(0,0,0,0.25)] py-0 animate-in fade-in-50 duration-150">
                    {contactos.slice(0, 5).map((c) => {
                      const isSelected = selectedCliente?.id === c.id
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            onSelectCliente(c)
                            setSearchQuery('')
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors focus:bg-[#F0F5FF] focus:outline-none h-[67px] border-b border-[#F3F4F6] last:border-none",
                            isSelected ? "bg-[#F0F5FF]" : "bg-white hover:bg-[#F0F5FF]/50"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                              isSelected ? "bg-[#EFF4FF] text-[#0379D5]" : "bg-[#F3F4F6] text-[#6A7282]"
                            )}>
                              {c.tipo === 'EMPRESA' ? <Building2 size={16} /> : <User size={16} />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[16px] font-semibold text-[#333333] leading-6 truncate">
                                {c.nombre}
                              </span>
                              <span className="text-[13px] font-normal text-[#99A1AF] leading-[20px] mt-0.5">
                                RNC: {c.rnc.length === 9
                                  ? c.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
                                  : c.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <Check size={18} className="text-[#0379D5] flex-shrink-0 stroke-[2.5]" />
                          )}
                        </button>
                      )
                    })}
                    {contactos.length === 0 && (
                      <div className="px-4 py-4 text-center text-body-sm text-text-secondary">
                        No se encontraron clientes
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowNuevoCliente(true)}
                className="h-[44px] w-[150px] bg-[#0379D5] hover:bg-[#0379D5]/90 rounded-[10px] text-[12px] font-semibold text-white flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0"
              >
                <Plus size={16} className="text-white" />
                <span>Nuevo Cliente</span>
              </Button>
            </div>

            {/* Section Title */}
            <p className="text-[12px] font-normal text-black/50 leading-[27px] font-sans">
              Frecuentes
            </p>

            {/* Cards grid */}
            <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
              {frecuentes.map((c) => (
                <ClienteCard
                  key={c.id}
                  contacto={c}
                  selected={selectedCliente?.id === c.id}
                  onClick={() => onSelectCliente(c)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Metodo de Pago & Tipo NCF */}
        <div className="flex flex-row items-center gap-[16px] w-[904px] h-[82.5px] select-none">
          {/* Metodo de Pago */}
          <div className="w-[444px] h-[82.5px] flex flex-col gap-[8px] items-start">
            <h3 className="text-[13px] font-semibold text-[#333333] leading-[20px] font-sans">Metodo de Pago</h3>
            <div className="flex flex-row gap-[8px] w-[444px] h-[54.5px]">
              {CONDICION_PAGO_OPTIONS.map((opt) => {
                const isSelected = condicionPago === opt.value
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onCondicionPagoChange(opt.value)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-[4px] rounded-[10px] py-[8px] px-[4px] w-[105px] h-[54.5px] transition-all duration-200',
                      isSelected
                        ? 'bg-[#0379D5] text-white shadow-[0px_4px_6px_-1px_rgba(21,94,239,0.2)]'
                        : 'bg-[#F9FAFB] text-[#333333] hover:bg-neutral-100'
                    )}
                  >
                    <Icon size={18} className={isSelected ? 'text-white' : 'text-[#333333]'} />
                    <span className={cn(
                      'text-[11px] font-normal leading-[16px] text-center font-sans',
                      isSelected ? 'text-white' : 'text-[#333333]'
                    )}>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tipo NCF */}
          <div className="w-[444px] h-[82.5px] flex flex-col gap-[8px] items-start">
            <h3 className="text-[12px] font-semibold text-[#333333] leading-[20px] tracking-[0.01em] uppercase font-sans">TIPO NCF</h3>
            <div className="relative w-[444px]">
              <button
                type="button"
                onClick={() => setShowNcfDropdown(!showNcfDropdown)}
                className="flex w-[444px] h-[54.5px] items-center justify-between gap-1.5 rounded-[10px] border-[1.25px] border-[#F5F5F5] bg-white px-[16px] text-[13px] font-normal text-[#64748B] cursor-pointer hover:border-brand-500 transition-colors select-none"
              >
                <span className="truncate">{TIPOS_ECF.find((t) => t.value === tipoECF)?.label}</span>
                <ChevronDown size={24} className="text-[#0379D5] flex-shrink-0" />
              </button>
              {showNcfDropdown && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowNcfDropdown(false)} />
                  <div className="absolute right-0 mt-1.5 max-h-[220px] w-[444px] overflow-y-auto rounded-[14px] border border-[#F3F4F6] bg-white shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] z-40 py-0 animate-in fade-in-50 duration-150">
                    {TIPOS_ECF.map((t) => {
                      const isSelected = tipoECF === t.value
                      const displayLabel = t.label
                        .replace('Factura de Crédito Fiscal', 'Crédito Fiscal')
                        .replace('Factura de Consumo', 'Consumidor Final')
                        .replace('Nota de Débito', 'Nota de Débito')
                        .replace('Nota de Crédito', 'Nota de Crédito')
                        .replace('Comprobante de Compras', 'Compras')
                        .replace('Gastos Menores', 'Gastos Menores')
                        .replace('Regímenes Especiales', 'Régimen Especial')
                        .replace('Gubernamental', 'Gubernamental')
                        .replace('Exportaciones', 'Exportación')
                        .replace('Pagos al Exterior', 'Pagos al Exterior')
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => {
                            onTipoECFChange(t.value)
                            setShowNcfDropdown(false)
                          }}
                          className={cn(
                            "flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors focus:bg-[#F0F5FF] focus:outline-none h-[44px] border-b border-neutral-50 last:border-none",
                            isSelected ? "bg-[#F0F5FF] text-brand-600 font-semibold" : "text-[#333333] hover:bg-[#F0F5FF]/50"
                          )}
                        >
                          <span className="text-[12px] font-semibold text-[#333333] truncate leading-6">{displayLabel}</span>
                          {isSelected && (
                            <Check size={16} className="text-[#0379D5] flex-shrink-0 stroke-[2.5]" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Next button (full-width) */}
        {!isQuickMode && (
          <div className="flex justify-center w-[904px] h-[48px]">
            <Button
              variant="primary"
              size="lg"
              disabled={!canProceed}
              onClick={onNext}
              className="w-full h-[48px] rounded-[14px] bg-[#0379D5] hover:bg-[#0379D5]/90 text-[16px] font-normal font-sans text-white flex items-center justify-center gap-2"
            >
              <span>siguiente</span>
              <ChevronRight size={16} className="text-white" />
            </Button>
          </div>
        )}
      </div>

      <NuevoClienteModal
        open={showNuevoCliente}
        onClose={() => setShowNuevoCliente(false)}
        onSave={handleNuevoCliente}
      />
    </>
  )
}
