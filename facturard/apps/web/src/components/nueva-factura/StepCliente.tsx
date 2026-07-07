'use client'

import { useState } from 'react'
import type { JSX } from 'react'
import { Search, Plus, ChevronRight, ChevronDown, Building2, User, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NuevoClienteModal } from './NuevoClienteModal'
import { useContactos } from '@/hooks/useContactos'
import type { Contacto, NuevoContactoData } from '@/hooks/useContactos'
import type { TipoECF } from '@/hooks/useNuevaFactura'
import { cn } from '@/lib/utils'



const TIPOS_ECF: { value: TipoECF; label: string }[] = [
  { value: 'E31', label: 'Factura de Crédito Fiscal Electrónica (E31)' },
  { value: 'E32', label: 'Factura de Consumo Electrónica (E32)' },
  { value: 'E33', label: 'Nota de Débito Electrónica (E33)' },
  { value: 'E34', label: 'Nota de Crédito Electrónica (E34)' },
  { value: 'E41', label: 'Comprobante de Compras Electrónico (E41)' },
  { value: 'E43', label: 'Gastos Menores Electrónico (E43)' },
  { value: 'E44', label: 'Regímenes Especiales Electrónico (E44)' },
  { value: 'E45', label: 'Gubernamental Electrónico (E45)' },
  { value: 'E46', label: 'Exportaciones Electrónico (E46)' },
  { value: 'E47', label: 'Pagos al Exterior Electrónico (E47)' },
]

interface StepClienteProps {
  selectedCliente: Contacto | null
  onSelectCliente: (c: Contacto) => void
  tipoECF: TipoECF
  onTipoECFChange: (t: TipoECF) => void
  tipoPago: 'CONTADO' | 'CREDITO' | 'GRATUITO'
  onTipoPagoChange: (t: 'CONTADO' | 'CREDITO' | 'GRATUITO') => void
  tipoIngreso: string
  onTipoIngresoChange: (t: string) => void
  terminoPago: string
  onTerminoPagoChange: (t: string) => void
  fechaEmision: string
  onFechaEmisionChange: (d: string) => void
  fechaLimite: string
  onFechaLimiteChange: (d: string) => void
  ncfModificado: string
  onNcfModificadoChange: (val: string) => void
  fechaNCFModificado: string
  onFechaNCFModificadoChange: (val: string) => void
  codigoModificacion: string
  onCodigoModificacionChange: (val: string) => void
  indicadorNotaCredito: string
  onIndicadorNotaCreditoChange: (val: string) => void
  identificadorExtranjero: string
  onIdentificadorExtranjeroChange: (val: string) => void
  paisComprador: string
  onPaisCompradorChange: (val: string) => void
  total: number
  onNext: () => void
  isQuickMode?: boolean
}

export function StepCliente({
  selectedCliente,
  onSelectCliente,
  tipoECF,
  onTipoECFChange,
  tipoPago,
  onTipoPagoChange,
  tipoIngreso,
  onTipoIngresoChange,
  terminoPago,
  onTerminoPagoChange,
  fechaEmision,
  onFechaEmisionChange,
  fechaLimite,
  onFechaLimiteChange,
  ncfModificado,
  onNcfModificadoChange,
  fechaNCFModificado,
  onFechaNCFModificadoChange,
  codigoModificacion,
  onCodigoModificacionChange,
  indicadorNotaCredito,
  onIndicadorNotaCreditoChange,
  identificadorExtranjero,
  onIdentificadorExtranjeroChange,
  paisComprador,
  onPaisCompradorChange,
  total,
  onNext,
  isQuickMode,
}: StepClienteProps): JSX.Element {
  const { contactos: rawContactos, searchQuery, setSearchQuery, crearContacto } = useContactos()
  const contactos: Contacto[] = rawContactos as any
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [showNcfDropdown, setShowNcfDropdown] = useState(false)

  // E43 (Gastos Menores) doesn't require a client
  const skipCliente = tipoECF === 'E43'

  const tiposConTipoIngresos: TipoECF[] = ['E31', 'E32', 'E33', 'E34', 'E44', 'E45', 'E46']
  const isTipoIngresoRequired = tiposConTipoIngresos.includes(tipoECF)
  const isTipoIngresoValid = !isTipoIngresoRequired || tipoIngreso !== ''

  const isFechaLimiteRequired = tipoPago === 'CREDITO'
  const isFechaLimiteValid = !isFechaLimiteRequired || fechaLimite !== ''

  const isReferenciaRequired = tipoECF === 'E33' || tipoECF === 'E34'
  const isReferenciaValid =
    !isReferenciaRequired ||
    (ncfModificado.trim().length > 0 &&
      fechaNCFModificado.trim().length > 0 &&
      codigoModificacion !== '' &&
      (tipoECF !== 'E34' || indicadorNotaCredito !== ''))

  const isE32UnderLimit = tipoECF === 'E32' && total < 250000
  const isE32OverLimit = tipoECF === 'E32' && total >= 250000

  const isRncRequired = tipoECF === 'E31' || tipoECF === 'E41' || tipoECF === 'E45' || isE32OverLimit
  const isRncValid = !isRncRequired || (selectedCliente !== null && selectedCliente.rnc.trim() !== '')

  const isForeignerType = tipoECF === 'E46' || tipoECF === 'E47'
  const isIdentificadorExtranjeroValid = !isForeignerType || identificadorExtranjero.trim() !== ''

  const isPaisCompradorRequired = tipoECF === 'E47'
  const isPaisCompradorValid = !isPaisCompradorRequired || paisComprador.trim() !== ''

  const canProceed =
    (skipCliente || isE32UnderLimit || (selectedCliente !== null && isRncValid && isIdentificadorExtranjeroValid && isPaisCompradorValid)) &&
    tipoPago &&
    isTipoIngresoValid &&
    isFechaLimiteValid &&
    isReferenciaValid

  async function handleNuevoCliente(data: NuevoContactoData): Promise<void> {
    try {
      const nuevo = await crearContacto(data)
      onSelectCliente(nuevo)
    } catch (e) {
      console.error(e)
    }
  }

  const showSearch = searchQuery.trim().length > 0

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Seleccionar cliente */}
        {!skipCliente && (
          <div className="flex flex-col gap-4 w-[904px]">
            <h3 className="text-[18px] font-semibold text-[#333333] leading-[27px] font-sans text-left">Seleccionar Cliente</h3>

            {isE32OverLimit && !selectedCliente && (
              <p className="text-[12px] font-semibold text-danger-600 text-left animate-in fade-in-50 mb-2">
                La factura de consumo (E32) supera el límite de RD$250,000. Debe seleccionar un cliente con RNC o cédula.
              </p>
            )}

            {isRncRequired && selectedCliente && selectedCliente.rnc.trim() === '' && (
              <p className="text-[12px] font-semibold text-danger-600 animate-in fade-in-50 text-left mt-1 mb-2">
                {tipoECF === 'E32'
                  ? 'El RNC o cédula es obligatorio para comprobantes de consumo (E32) de RD$250,000 o más.'
                  : 'El RNC es obligatorio para comprobantes E31, E41 y E45.'} Por favor, edite o seleccione otro cliente.
              </p>
            )}

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
                    {contactos.slice(0, 5).map((c: Contacto) => {
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
                type="button"
                variant="primary"
                size="md"
                onClick={() => setShowNuevoCliente(true)}
                className="h-[44px] w-[150px] bg-[#0379D5] hover:bg-[#0379D5]/90 rounded-[10px] text-[12px] font-semibold text-white flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0"
              >
                <Plus size={16} className="text-white" />
                <span>Nuevo Cliente</span>
              </Button>
            </div>

            {selectedCliente && isForeignerType && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left mt-2 animate-in fade-in-50">
                <div className="flex flex-col gap-[8px] items-start w-full">
                  <div className="flex justify-between items-center w-full">
                    <label className="text-[12px] font-semibold text-[#333333] uppercase font-sans">
                      Identificador Extranjero *
                    </label>
                    {!identificadorExtranjero && (
                      <span className="text-[11px] font-semibold text-danger-600 animate-in fade-in-50">
                        Requerido
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Ej: ID-987654"
                    value={identificadorExtranjero}
                    onChange={(e) => onIdentificadorExtranjeroChange(e.target.value)}
                    className={cn(
                      "flex w-full h-[54.5px] items-center justify-between gap-1.5 rounded-[10px] border-[1.25px] px-[16px] text-[13px] font-normal transition-colors focus:border-brand-500 focus:outline-none bg-white text-[#333333]",
                      !identificadorExtranjero ? "border-danger-500" : "border-[#F5F5F5]"
                    )}
                  />
                </div>

                <div className="flex flex-col gap-[8px] items-start w-full">
                  <div className="flex justify-between items-center w-full">
                    <label className="text-[12px] font-semibold text-[#333333] uppercase font-sans">
                      País del Comprador {isPaisCompradorRequired ? '*' : '(Opcional)'}
                    </label>
                    {isPaisCompradorRequired && !paisComprador && (
                      <span className="text-[11px] font-semibold text-danger-600 animate-in fade-in-50">
                        Requerido
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Ej: US, ES, FR"
                    value={paisComprador}
                    onChange={(e) => onPaisCompradorChange(e.target.value)}
                    className={cn(
                      "flex w-full h-[54.5px] items-center justify-between gap-1.5 rounded-[10px] border-[1.25px] px-[16px] text-[13px] font-normal transition-colors focus:border-brand-500 focus:outline-none bg-white text-[#333333]",
                      isPaisCompradorRequired && !paisComprador ? "border-danger-500" : "border-[#F5F5F5]"
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Identificación del Documento */}
        <div className="flex flex-col gap-4 w-[904px]">
          <p className="text-[12px] font-normal text-black/50 leading-[27px] font-sans text-left">
            Identificación del Documento
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 text-left select-none w-full">
            
            {/* Tipo e-CF */}
            <div className="flex flex-col gap-[8px] items-start w-full">
              <label className="text-[12px] font-semibold text-[#333333] uppercase font-sans">Tipo e-CF</label>
              <div className="relative w-full">
                <button
                  type="button"
                  onClick={() => setShowNcfDropdown(!showNcfDropdown)}
                  className="flex w-full h-[54.5px] items-center justify-between gap-1.5 rounded-[10px] border-[1.25px] border-[#F5F5F5] bg-white px-[16px] text-[13px] font-normal text-[#64748B] cursor-pointer hover:border-brand-500 transition-colors select-none"
                >
                  <span className="truncate">{TIPOS_ECF.find((t) => t.value === tipoECF)?.label}</span>
                  <ChevronDown size={24} className="text-[#0379D5] flex-shrink-0" />
                </button>
                {showNcfDropdown && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowNcfDropdown(false)} />
                    <div className="absolute right-0 mt-1.5 max-h-[220px] w-full overflow-y-auto rounded-[14px] border border-[#F3F4F6] bg-white shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] z-40 py-0 animate-in fade-in-50 duration-150">
                      {TIPOS_ECF.map((t) => {
                        const isSelected = tipoECF === t.value
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
                            <span className="text-[12px] font-semibold text-[#333333] truncate leading-6">{t.label}</span>
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

            {/* Tipo de Ingreso */}
            <div className="flex flex-col gap-[8px] items-start w-full">
              <div className="flex justify-between items-center w-full select-none">
                <label className="text-[12px] font-semibold text-[#333333] uppercase font-sans">Tipo de Ingreso</label>
                {isTipoIngresoRequired && !tipoIngreso && (
                  <span className="text-[11px] font-semibold text-danger-600 animate-in fade-in-50">Este campo es requerido</span>
                )}
              </div>
              {isTipoIngresoRequired ? (
                <div className="relative w-full">
                  <select
                    value={tipoIngreso}
                    onChange={(e) => onTipoIngresoChange(e.target.value)}
                    className={cn(
                      "h-[54.5px] w-full rounded-[10px] border-[1.25px] bg-white text-[13px] text-[#64748B] px-[16px] appearance-none pr-10 cursor-pointer focus:border-brand-500 focus:bg-white focus:outline-none transition-colors",
                      !tipoIngreso ? "border-danger-500" : "border-[#F5F5F5]"
                    )}
                  >
                    <option value="">Seleccionar</option>
                    <option value="01">Ingresos por Operaciones (No financieros)</option>
                    <option value="02">Ingresos Financieros</option>
                    <option value="03">Ingresos Extraordinarios</option>
                    <option value="04">Ingresos por Arrendamientos</option>
                    <option value="05">Ingresos por Venta de Activo Depreciable</option>
                    <option value="06">Otros Ingresos</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#0379D5] pointer-events-none">
                    <ChevronDown size={20} />
                  </div>
                </div>
              ) : (
                <div className="w-full h-[54.5px] bg-[#F8FAFC] border-[1.25px] border-[#F5F5F5] rounded-[10px] flex items-center px-[16px]">
                  <span className="text-[13px] text-[#64748B]/60 italic">No aplica para este tipo e-CF</span>
                </div>
              )}
            </div>



            {/* Tipo de Pago */}
            <div className="flex flex-col gap-[8px] items-start w-full">
              <div className="flex justify-between items-center w-full select-none">
                <label className="text-[12px] font-semibold text-[#333333] uppercase font-sans">Tipo de Pago</label>
                {!tipoPago && (
                  <span className="text-[11px] font-semibold text-danger-600 animate-in fade-in-50">Este campo es requerido</span>
                )}
              </div>
              <div className="relative w-full">
                <select
                  value={tipoPago}
                  onChange={(e) => onTipoPagoChange(e.target.value as 'CONTADO' | 'CREDITO' | 'GRATUITO')}
                  className={cn(
                    "h-[54.5px] w-full rounded-[10px] border-[1.25px] bg-white text-[13px] text-[#64748B] px-[16px] appearance-none pr-10 cursor-pointer focus:border-brand-500 focus:bg-white focus:outline-none transition-colors",
                    !tipoPago ? "border-danger-500" : "border-[#F5F5F5]"
                  )}
                >
                  <option value="">Seleccionar</option>
                  <option value="CONTADO">Contado</option>
                  <option value="CREDITO">Crédito</option>
                  <option value="GRATUITO">Gratuito</option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#0379D5] pointer-events-none">
                  <ChevronDown size={20} />
                </div>
              </div>
            </div>

            {/* Fecha Límite */}
            <div className="flex flex-col gap-[8px] items-start w-full">
              <div className="flex justify-between items-center w-full select-none">
                <label className={cn(
                  "text-[12px] font-semibold uppercase font-sans transition-colors",
                  tipoPago === 'CREDITO' ? "text-[#333333]" : "text-[#333333]/50"
                )}>
                  Fecha Límite {tipoPago === 'CREDITO' && '*'}
                </label>
                {tipoPago === 'CREDITO' && !fechaLimite && (
                  <span className="text-[11px] font-semibold text-danger-600 animate-in fade-in-50">Este campo es requerido</span>
                )}
              </div>
              <div className="relative w-full">
                <input
                  type="date"
                  value={fechaLimite}
                  disabled={tipoPago !== 'CREDITO'}
                  onChange={(e) => onFechaLimiteChange(e.target.value)}
                  className={cn(
                    "flex w-full h-[54.5px] items-center justify-between gap-1.5 rounded-[10px] border-[1.25px] px-[16px] text-[13px] font-normal transition-colors focus:border-brand-500 focus:outline-none",
                    tipoPago === 'CREDITO'
                      ? cn("bg-white text-[#333333] focus:bg-white", !fechaLimite ? "border-danger-500" : "border-[#F5F5F5]")
                      : "bg-[#F8FAFC] text-[#64748B]/40 border-[#F5F5F5] cursor-not-allowed select-none"
                  )}
                />
              </div>
            </div>

            {/* Término de Pago (Spans both columns) */}
            <div className="flex flex-col gap-[8px] items-start w-full md:col-span-2">
              <label className="text-[12px] font-semibold text-[#333333] uppercase font-sans">Término de Pago</label>
              <input
                type="text"
                placeholder="Ej: Neto 30 días"
                value={terminoPago}
                onChange={(e) => onTerminoPagoChange(e.target.value)}
                className="flex w-full h-[54.5px] items-center justify-between gap-1.5 rounded-[10px] border-[1.25px] border-[#F5F5F5] bg-white px-[16px] text-[13px] font-normal text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:outline-none transition-colors"
              />
            </div>

          </div>
        </div>

        {/* Información de Referencia */}
        {isReferenciaRequired && (
          <div className="flex flex-col gap-4 w-[904px]">
            <p className="text-[12px] font-normal text-black/50 leading-[27px] font-sans text-left">
              Información de Referencia
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 text-left select-none w-full">
              {/* NCF Modificado */}
              <div className="flex flex-col gap-[8px] items-start w-full">
                <div className="flex justify-between items-center w-full select-none">
                  <label className="text-[12px] font-semibold text-[#333333] uppercase font-sans">NCF Modificado *</label>
                  {!ncfModificado && (
                    <span className="text-[11px] font-semibold text-danger-600 animate-in fade-in-50">Este campo es requerido</span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="B01 - Factura de Crédito Fiscal"
                  value={ncfModificado}
                  onChange={(e) => onNcfModificadoChange(e.target.value)}
                  className="flex w-full h-[54.5px] items-center justify-between gap-1.5 rounded-[10px] border-[1.25px] border-[#F5F5F5] bg-white px-[16px] text-[13px] font-normal text-[#333333] placeholder:text-[#64748B]/70 focus:border-brand-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Código Modificación */}
              <div className="flex flex-col gap-[8px] items-start w-full">
                <div className="flex justify-between items-center w-full select-none">
                  <label className="text-[12px] font-semibold text-[#333333] uppercase font-sans">Código Modificación *</label>
                  {!codigoModificacion && (
                    <span className="text-[11px] font-semibold text-danger-600 animate-in fade-in-50">Este campo es requerido</span>
                  )}
                </div>
                <div className="relative w-full">
                  <select
                    value={codigoModificacion}
                    onChange={(e) => onCodigoModificacionChange(e.target.value)}
                    className={cn(
                      "h-[54.5px] w-full rounded-[10px] border-[1.25px] bg-white text-[13px] text-[#64748B] px-[16px] appearance-none pr-10 cursor-pointer focus:border-brand-500 focus:bg-white focus:outline-none transition-colors",
                      !codigoModificacion ? "border-danger-500" : "border-[#F5F5F5]"
                    )}
                  >
                    <option value="">Seleccionar</option>
                    <option value="1">1 - Anulación total</option>
                    <option value="2">2 - Corrección de montos</option>
                    <option value="3">3 - Corrección de texto</option>
                    <option value="4">4 - Reemplazo de NCF</option>
                    <option value="5">5 - Ref. factura consumo</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#0379D5] pointer-events-none">
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>

              {/* Fecha NCF Modificado */}
              <div className="flex flex-col gap-[8px] items-start w-full">
                <div className="flex justify-between items-center w-full select-none">
                  <label className="text-[12px] font-semibold text-[#333333] uppercase font-sans">Fecha NCF Modificado *</label>
                  {!fechaNCFModificado && (
                    <span className="text-[11px] font-semibold text-danger-600 animate-in fade-in-50">Este campo es requerido</span>
                  )}
                </div>
                <div className="relative w-full">
                  <input
                    type="date"
                    value={fechaNCFModificado}
                    onChange={(e) => onFechaNCFModificadoChange(e.target.value)}
                    className={cn(
                      "flex w-full h-[54.5px] items-center justify-between gap-1.5 rounded-[10px] border-[1.25px] px-[16px] text-[13px] font-normal transition-colors focus:border-brand-500 focus:outline-none bg-white text-[#333333] focus:bg-white",
                      !fechaNCFModificado ? "border-danger-500" : "border-[#F5F5F5]"
                    )}
                  />
                </div>
              </div>

              {/* Indicador Nota de Crédito */}
              <div className="flex flex-col gap-[8px] items-start w-full">
                <div className="flex justify-between items-center w-full select-none">
                  <label className={cn(
                    "text-[12px] font-semibold uppercase font-sans transition-colors",
                    tipoECF === 'E34' ? "text-[#333333]" : "text-[#333333]/50"
                  )}>
                    Indicador Nota de Crédito {tipoECF === 'E34' && '*'}
                  </label>
                  {tipoECF === 'E34' && !indicadorNotaCredito && (
                    <span className="text-[11px] font-semibold text-danger-600 animate-in fade-in-50">Este campo es requerido</span>
                  )}
                </div>
                <div className="relative w-full">
                  <select
                    value={indicadorNotaCredito}
                    disabled={tipoECF !== 'E34'}
                    onChange={(e) => onIndicadorNotaCreditoChange(e.target.value)}
                    className={cn(
                      "h-[54.5px] w-full rounded-[10px] border-[1.25px] text-[13px] px-[16px] appearance-none pr-10 transition-colors focus:outline-none",
                      tipoECF === 'E34'
                        ? cn("bg-white text-[#64748B] cursor-pointer focus:border-brand-500", !indicadorNotaCredito ? "border-danger-500" : "border-[#F5F5F5]")
                        : "bg-[#F8FAFC] text-[#64748B]/40 border-[#F5F5F5] cursor-not-allowed select-none"
                    )}
                  >
                    <option value="">Seleccionar</option>
                    <option value="1">1 - Anulación total</option>
                    <option value="2">2 - Corrección</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#0379D5] pointer-events-none">
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Next button (full-width) */}
        {!isQuickMode && (
          <div className="flex justify-center w-[904px] h-[48px] mt-2">
            <Button
              type="button"
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
