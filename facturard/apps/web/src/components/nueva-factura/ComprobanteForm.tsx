import { useCallback, useEffect, useId, useState, useMemo } from 'react'
import type { JSX } from 'react'
import { Calendar, FileText, User, ChevronDown, RefreshCw, Banknote, CreditCard, ArrowLeftRight, Clock, Search, X, Check, Building2, Eye, Save, Send, FilePlus } from 'lucide-react'
import { StepWizard } from './StepWizard'
import { StepCliente } from './StepCliente'
import { StepDetalle } from './StepDetalle'
import { StepResumen } from './StepResumen'
import { getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrency } from '@/lib/comprobantes'
import type { ComprobanteFormData, ItemRow, TipoECF } from '@/hooks/useNuevaFactura'
import type { Contacto } from '@/hooks/useContactos'
import { useContactos } from '@/hooks/useContactos'
import { useUI } from '@/lib/context/UIContext'
import { cn } from '@/lib/utils'

const WIZARD_STEPS = [
  { number: 1, label: 'Cliente' },
  { number: 2, label: 'Detalle' },
  { number: 3, label: 'Confirmar' },
]

const ITBIS_RATES: Record<string, number> = { I1: 0.18, I2: 0.16, I3: 0, I4: 0, E: 0 }

const TIPO_ECF_LABELS: Record<TipoECF, string> = {
  E31: 'B01 - Factura de Crédito Fiscal Electrónica (E31)',
  E32: 'B02 - Factura de Consumo Electrónica (E32)',
  E33: 'B03 - Nota de Débito Electrónica (E33)',
  E34: 'B04 - Nota de Crédito Electrónica (E34)',
  E41: 'B11 - Comprobante de Compras Electrónico (E41)',
  E43: 'B13 - Gastos Menores Electrónico (E43)',
  E44: 'B14 - Regímenes Especiales Electrónico (E44)',
  E45: 'B15 - Gubernamental Electrónico (E45)',
  E46: 'B16 - Exportaciones Electrónico (E46)',
  E47: 'B17 - Pagos al Exterior Electrónico (E47)',
}

const TIPO_PAGO_OPTIONS = [
  { value: 'CONTADO' as const, label: 'Contado', icon: Banknote },
  { value: 'CREDITO' as const, label: 'Crédito', icon: Clock },
  { value: 'GRATUITO' as const, label: 'Gratuito', icon: CreditCard },
]

function formatDateSpanish(isoDate: string): string {
  if (!isoDate) return ''
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  const partYear = parts[0]
  const partMonth = parts[1]
  const partDay = parts[2]
  if (!partYear || !partMonth || !partDay) return isoDate
  const day = parseInt(partDay, 10)
  const monthIndex = parseInt(partMonth, 10) - 1
  const year = partYear
  const spanishMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const month = spanishMonths[monthIndex] ?? ''
  return `${day} ${month} de ${year}`
}

function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

interface Props {
  onSubmit: (data: ComprobanteFormData) => Promise<any>
  onError?: (message: string) => void
}

export function ComprobanteForm({ onSubmit, onError }: Props): JSX.Element {
  const baseId = useId()
  const { facturacionMode } = useUI()
  const { contactos } = useContactos()

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1)

  // Form state
  const [tipoECF, setTipoECF] = useState<TipoECF>('E31')
  const [selectedCliente, setSelectedCliente] = useState<Contacto | null>(null)
  const [tipoPago, setTipoPago] = useState<'CONTADO' | 'CREDITO' | 'GRATUITO'>('CONTADO')
  const [tipoIngreso, setTipoIngreso] = useState<string>('')
  const [terminoPago, setTerminoPago] = useState<string>('')
  const [fechaEmision, setFechaEmision] = useState(todayISO())
  const [fechaLimite, setFechaLimite] = useState<string>('')
  const [items, setItems] = useState<ItemRow[]>([])
  const [notas, setNotas] = useState('')
  const [emitirConComprobante, setEmitirConComprobante] = useState(true)
  
  // Reference Info state (E33/E34)
  const [ncfModificado, setNcfModificado] = useState('')
  const [fechaNCFModificado, setFechaNCFModificado] = useState('')
  const [codigoModificacion, setCodigoModificacion] = useState('')
  const [indicadorNotaCredito, setIndicadorNotaCredito] = useState('')

  // Popover states for quick mode
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [showNcfDropdown, setShowNcfDropdown] = useState(false)
  const [clientSearch, setClientSearch] = useState('')

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const filteredClientes = useMemo(() => {
    const q = clientSearch.toLowerCase().trim()
    if (!q) return contactos
    return contactos.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.rnc.toLowerCase().includes(q)
    )
  }, [contactos, clientSearch])

  // Reset client when tipo changes to E43 (Gastos Menores — no client needed)
  useEffect(() => {
    if (tipoECF === 'E43') {
      setSelectedCliente(null)
    }
  }, [tipoECF])

  const handleItemsChange = useCallback((newItems: ItemRow[]) => setItems(newItems), [])

  function goToStep(step: number): void {
    if (step >= 1 && step <= 3) setCurrentStep(step)
  }

  // Calculate totals
  const { subtotal, itbis, total, descuento, itbisRetenido, isrRetenido } = useMemo(() => {
    let sub = 0
    let tax = 0
    let retItbis = 0
    let retIsr = 0
    let descTotal = 0
    for (const item of items) {
      const base = item.cantidad * item.precioUnitarioItem
      const desc = item.descuento ?? 0
      descTotal += desc
      const baseNet = Math.max(0, base - desc)
      sub += baseNet
      tax += baseNet * (ITBIS_RATES[item.indicadorFacturacion] ?? 0)
      retItbis += item.itbisRetenido ?? 0
      retIsr += item.isrRetenido ?? 0
    }
    return {
      subtotal: sub,
      itbis: tax,
      total: Math.max(0, sub + tax - retItbis - retIsr),
      descuento: descTotal,
      itbisRetenido: retItbis,
      isrRetenido: retIsr,
    }
  }, [items])

  async function handleSubmit(emitConCF: boolean): Promise<void> {
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        tipoECF,
        rncComprador: selectedCliente?.rnc ?? '',
        identificadorExtranjero: selectedCliente?.idExtranjero ?? '',
        razonSocialComprador: selectedCliente?.nombre ?? '',
        paisComprador: '',
        fechaEmision,
        condicionPago: tipoPago,
        tipoIngresos: tipoIngreso as ComprobanteFormData['tipoIngresos'],
        ...(tipoPago === 'CREDITO' && fechaLimite ? { fechaVencimiento: fechaLimite } : {}),
        ...(terminoPago ? { terminoPago } : {}),
        ncfModificado,
        fechaNCFModificado,
        codigoModificacion: codigoModificacion as any,
        ...(indicadorNotaCredito && { indicadorNotaCredito: Number(indicadorNotaCredito) as 1 | 2 }),
        items,
        emitirConComprobante: emitConCF,
      })
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      onError?.(msg)
    } finally {
      setSubmitting(false)
    }
  }

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

  const isClienteStepValid =
    (!emitirConComprobante || tipoECF === 'E43' || selectedCliente !== null) &&
    (!emitirConComprobante || isTipoIngresoValid) &&
    isFechaLimiteValid &&
    isReferenciaValid
  const isDetalleStepValid = items.length > 0 && items.every(
    (i) => i.nombreItem.trim().length > 0 && i.cantidad > 0 && i.precioUnitarioItem > 0,
  )

  const isEmitEnabled = isClienteStepValid && isDetalleStepValid

  return (
    <div className="mx-auto w-full max-w-[1400px] flex flex-col pb-6">
      {/* Main 2-column layout */}
      <div className={cn(
        "w-full",
        facturacionMode === 'estandar'
          ? "flex flex-col lg:flex-row gap-[24px] lg:w-[1336px] lg:min-h-[948px] lg:h-auto mx-auto overflow-visible"
          : "grid grid-cols-1 gap-6 lg:grid-cols-3 h-full overflow-hidden"
      )}>
        {/* Left Column */}
        {facturacionMode === 'estandar' ? (
          <Card className={cn(
            "w-full lg:w-[952px] p-6 flex flex-col bg-white border border-[#E2E8F0] shadow-sm rounded-[14px]",
            currentStep === 2 ? "lg:h-[810px] overflow-y-auto" : "lg:h-auto lg:self-start overflow-visible"
          )}>
            {/* Stepper Wizard centered at top of the panel */}
            <div className="flex justify-center border-[#F5F5F5] pb-5 pt-0">
              <StepWizard
                steps={WIZARD_STEPS}
                currentStep={currentStep}
                onStepClick={(step) => {
                  if (step < currentStep) goToStep(step)
                }}
              />
            </div>

            {/* Active Step Content */}
            <div className="transition-all duration-300 ease-in-out">
              {currentStep === 1 && (
                <StepCliente
                  selectedCliente={selectedCliente}
                  onSelectCliente={setSelectedCliente}
                  tipoECF={tipoECF}
                  onTipoECFChange={setTipoECF}
                  tipoPago={tipoPago}
                  onTipoPagoChange={setTipoPago}
                  tipoIngreso={tipoIngreso}
                  onTipoIngresoChange={setTipoIngreso}
                  terminoPago={terminoPago}
                  onTerminoPagoChange={setTerminoPago}
                  fechaEmision={fechaEmision}
                  onFechaEmisionChange={setFechaEmision}
                  fechaLimite={fechaLimite}
                  onFechaLimiteChange={setFechaLimite}
                  ncfModificado={ncfModificado}
                  onNcfModificadoChange={setNcfModificado}
                  fechaNCFModificado={fechaNCFModificado}
                  onFechaNCFModificadoChange={setFechaNCFModificado}
                  codigoModificacion={codigoModificacion}
                  onCodigoModificacionChange={setCodigoModificacion}
                  indicadorNotaCredito={indicadorNotaCredito}
                  onIndicadorNotaCreditoChange={setIndicadorNotaCredito}
                  onNext={() => goToStep(2)}
                />
              )}

              {currentStep === 2 && (
                <StepDetalle
                  items={items}
                  onItemsChange={handleItemsChange}
                  notas={notas}
                  onNotasChange={setNotas}
                  onNext={() => goToStep(3)}
                  onBack={() => goToStep(1)}
                  tipoECF={tipoECF}
                />
              )}

              {currentStep === 3 && (
                <StepResumen
                  cliente={selectedCliente}
                  tipoECF={tipoECF}
                  condicionPago={tipoPago}
                  fechaEmision={fechaEmision}
                  items={items}
                  notas={notas}
                  fechaLimite={fechaLimite}
                  terminoPago={terminoPago}
                  onBack={() => goToStep(2)}
                />
              )}
            </div>
          </Card>
        ) : (
          /* Rápido Mode Left Card: JUST product selection and table */
          <Card className="lg:col-span-2 p-6 flex flex-col gap-6 bg-white border border-neutral-200 shadow-sm rounded-2xl h-full overflow-y-auto">
            <StepDetalle
              items={items}
              onItemsChange={handleItemsChange}
              notas={notas}
              onNotasChange={setNotas}
              onNext={() => { }}
              onBack={() => { }}
              isQuickMode={true}
              tipoECF={tipoECF}
            />
          </Card>
        )}

        {/* Right Column */}
        <div className={cn(
          "h-full flex flex-col overflow-hidden",
          facturacionMode === 'estandar' ? "w-full lg:w-[360px]" : "lg:col-span-1"
        )}>
          {/* Rápido Mode Selectors (Client, Type, Date) above the card */}
          {facturacionMode === 'rapido' && (
            <div className="grid grid-cols-3 gap-2 mb-4 w-full">
              {/* Client Selector */}
              <div className="relative flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowClientDropdown(!showClientDropdown)
                    setShowNcfDropdown(false)
                  }}
                  className="flex w-full items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px] font-bold text-text-primary cursor-pointer hover:border-brand-500 transition-colors justify-between min-w-0 h-10 select-none shadow-sm animate-in fade-in-50 duration-150"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User size={14} className="text-text-secondary flex-shrink-0" />
                    <span className="truncate">{selectedCliente ? selectedCliente.nombre : 'Cliente'}</span>
                  </div>
                  <ChevronDown size={12} className="text-text-secondary flex-shrink-0" />
                </button>
                {showClientDropdown && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowClientDropdown(false)} />
                    <div className="absolute left-0 mt-1.5 max-h-[456px] w-[580px] overflow-hidden rounded-[14px] border border-neutral-100 bg-white shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] z-40 flex flex-col p-0 animate-in fade-in-50 duration-150">
                      {/* Search box sticky at the top */}
                      <div className="px-4 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white z-10 h-[51px] flex-shrink-0">
                        <div className="flex items-center gap-3 flex-1">
                          <Search size={18} className="text-[#99A1AF] flex-shrink-0" />
                          <input
                            type="text"
                            placeholder="Buscar cliente por nombre o RNC..."
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            className="w-full text-[16px] focus:outline-none border-none p-0 text-[#333333] placeholder:text-[#99A1AF] bg-transparent"
                          />
                        </div>
                        {clientSearch && (
                          <button
                            type="button"
                            onClick={() => setClientSearch('')}
                            className="w-[26px] h-[26px] flex items-center justify-center rounded-[8px] bg-neutral-50 hover:bg-neutral-100 text-[#99A1AF]"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Client rows */}
                      <div className="overflow-y-auto max-h-[404px] flex flex-col w-full py-1">
                        {filteredClientes.length === 0 ? (
                          <div className="px-4 py-4 text-center text-ui-sm text-text-secondary">
                            No se encontraron clientes
                          </div>
                        ) : (
                          filteredClientes.map((c) => {
                            const isSelected = selectedCliente?.id === c.id
                            const isCompany = c.rnc.length === 9 || c.rnc.startsWith('1')
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCliente(c)
                                  setShowClientDropdown(false)
                                  setClientSearch('')
                                }}
                                className={cn(
                                  "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors focus:bg-[#F0F5FF] focus:outline-none h-[67px] border-b border-[#F3F4F6] last:border-none flex-shrink-0",
                                  isSelected ? "bg-[#F0F5FF]" : "bg-white hover:bg-[#F0F5FF]/50"
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                                    isSelected ? "bg-[#EFF4FF] text-[#0379D5]" : "bg-[#F3F4F6] text-[#6A7282]"
                                  )}>
                                    {isCompany ? <Building2 size={16} /> : <User size={16} />}
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
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* NCF Selector */}
              <div className="relative flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowNcfDropdown(!showNcfDropdown)
                    setShowClientDropdown(false)
                  }}
                  className="flex w-full items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px] font-bold text-text-primary cursor-pointer hover:border-brand-500 transition-colors justify-between min-w-0 h-10 select-none shadow-sm animate-in fade-in-50 duration-150"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText size={14} className="text-text-secondary flex-shrink-0" />
                    <span className="truncate">
                      {tipoECF ? TIPO_ECF_LABELS[tipoECF].split(' - ')[0] : 'Tipo NCF'}
                    </span>
                  </div>
                  <ChevronDown size={12} className="text-text-secondary flex-shrink-0" />
                </button>
                {showNcfDropdown && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowNcfDropdown(false)} />
                    <div className="absolute left-0 mt-1.5 max-h-[220px] w-[320px] overflow-y-auto rounded-[14px] border border-[#F3F4F6] bg-white shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] z-40 py-0 animate-in fade-in-50 duration-150">
                      {Object.entries(TIPO_ECF_LABELS).map(([key, label]) => {
                        const isSelected = tipoECF === key
                        const displayLabel = label
                          .replace('Factura de Crédito Fiscal Electrónica', 'Crédito Fiscal Electrónica')
                          .replace('Factura de Consumo Electrónica', 'Consumidor Final Electrónica')
                          .replace('Nota de Débito Electrónica', 'Nota de Débito Electrónica')
                          .replace('Nota de Crédito Electrónica', 'Nota de Crédito Electrónica')
                          .replace('Comprobante de Compras Electrónico', 'Compras Electrónico')
                          .replace('Gastos Menores Electrónico', 'Gastos Menores Electrónico')
                          .replace('Regímenes Especiales Electrónico', 'Régimen Especial Electrónico')
                          .replace('Gubernamental Electrónico', 'Gubernamental Electrónico')
                          .replace('Exportaciones Electrónico', 'Exportaciones Electrónico')
                          .replace('Pagos al Exterior Electrónico', 'Pagos al Exterior Electrónico')
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setTipoECF(key as TipoECF)
                              setShowNcfDropdown(false)
                            }}
                            className={cn(
                              "flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors focus:bg-[#F0F5FF] focus:outline-none h-[44px]",
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

              {/* Date Selector */}
              <div className="relative flex-1 min-w-0 select-none">
                <div className="flex w-full items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px] font-bold text-text-primary hover:border-brand-500 transition-colors justify-between min-w-0 h-10 shadow-sm animate-in fade-in-50 duration-150">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Calendar size={14} className="text-text-secondary flex-shrink-0" />
                    <span className="truncate">{formatDateSpanish(fechaEmision)}</span>
                  </div>
                </div>
                <input
                  type="date"
                  value={fechaEmision}
                  onChange={(e) => setFechaEmision(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
              </div>
            </div>
          )}

          {/* Resumen Card */}
          <Card className={cn(
            "flex flex-col bg-white border border-[#E2E8F0] rounded-[14px] transition-all duration-300 gap-[16px] items-stretch p-[21px] relative",
            facturacionMode === 'estandar'
              ? "w-[360px] shadow-sm h-auto lg:self-start"
              : "flex-1 shadow-sm overflow-y-auto h-full"
          )}>
            {/* Header */}
            <div className="flex items-center justify-between w-full select-none">
              <div className="flex items-center gap-[8px]">
                <FileText size={20} className="text-[#333333]" />
                <span className="font-['Open_Sans'] font-semibold leading-[24px] text-[#333333] text-[16px]">
                  Resumen e-CF
                </span>
              </div>
              <div className="flex items-center gap-[12px]">
                <button
                  type="button"
                  title="Vista Previa"
                  className="text-[#0379D5] hover:text-[#0379D5]/80 transition-colors"
                >
                  <Eye size={18} />
                </button>
                <button
                  type="button"
                  title="Guardar Borrador"
                  className="text-[#0379D5] hover:text-[#0379D5]/80 transition-colors"
                >
                  <Save size={17} />
                </button>
              </div>
            </div>

            {/* Metadata (Invoice Info) */}
            <div className="flex flex-col gap-[8px] items-start w-full select-none">
              {/* Date */}
              <div className="flex items-center gap-[8px] text-[#64748B] text-[13px] font-sans">
                <Calendar size={16} className="text-[#64748B] flex-shrink-0" />
                <span className="leading-[19.5px]">{fechaEmision}</span>
              </div>
              
              {/* Payment Condition */}
              <div className="flex items-center gap-[8px] text-[#64748B] text-[13px] font-sans">
                <CreditCard size={16} className="text-[#64748B] flex-shrink-0" />
                <span className="leading-[19.5px] truncate">
                  {tipoPago === 'CREDITO' ? 'Crédito' : tipoPago === 'GRATUITO' ? 'Gratuito' : 'Contado'}
                  {tipoPago === 'CREDITO' && terminoPago ? ` - ${terminoPago}` : ''}
                </span>
              </div>

              {/* e-CF Document Type */}
              <div className="flex items-center gap-[8px] text-[#64748B] text-[13px] font-sans w-full min-w-0">
                <FileText size={16} className="text-[#64748B] flex-shrink-0" />
                <span className="leading-[19.5px] truncate" title={TIPO_ECF_LABELS[tipoECF]}>
                  {TIPO_ECF_LABELS[tipoECF]}
                </span>
              </div>
            </div>

            <hr className="border-[#E2E8F0] my-0" />

            {/* Customer Section */}
            <div className="flex flex-col gap-[4px] items-start w-full text-left font-sans select-none">
              <p className="font-semibold leading-[18px] text-[#374B6A] text-[12px] truncate w-full">
                {selectedCliente ? selectedCliente.nombre : 'Consumidor Final'}
              </p>
              <p className="font-normal leading-[16.5px] text-[#7A8FAD] text-[11px] truncate w-full">
                {selectedCliente && selectedCliente.rnc
                  ? `RNC: ${
                      selectedCliente.rnc.length === 9
                        ? selectedCliente.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
                        : selectedCliente.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')
                    }`
                  : 'RNC: -'}
              </p>
            </div>

            <hr className="border-[#E2E8F0] my-0" />

            {/* Totals Summary breakdown */}
            <div className="flex flex-col gap-[8px] w-full text-[13px] text-[#64748B] font-sans select-none">
              <div className="flex items-center justify-between w-full">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between w-full">
                <span>Descuento</span>
                <span>{formatCurrency(descuento)}</span>
              </div>
              <div className="flex items-center justify-between w-full">
                <span>ITBIS (18%)</span>
                <span>{formatCurrency(itbis)}</span>
              </div>
              <div className="flex items-center justify-between w-full">
                <span>ITBIS Retenido (18%)</span>
                <span>{formatCurrency(itbisRetenido)}</span>
              </div>
              <div className="flex items-center justify-between w-full">
                <span>ISR Retenido</span>
                <span>{formatCurrency(isrRetenido)}</span>
              </div>
              {!['E41', 'E44', 'E46', 'E47'].includes(tipoECF) && (
                <div className="flex items-center justify-between w-full">
                  <span>Propina Legal</span>
                  <span>{formatCurrency(0)}</span>
                </div>
              )}
            </div>

            <hr className="border-[#E2E8F0] my-0" />

            {/* Total and Emit Button */}
            <div className="flex flex-col gap-[24px] w-full select-none">
              <div className="flex items-center justify-between w-full font-bold text-[#333333] text-[18px] font-sans">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>

              {/* Payment Method section inside Resumen card in quick mode */}
              {facturacionMode === 'rapido' && (
                <div className="flex flex-col gap-3 border-t border-border-subtle text-left pt-3">
                  <h3 className="text-ui-xs font-semibold text-text-secondary uppercase">Tipo de Pago</h3>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TIPO_PAGO_OPTIONS.map((opt) => {
                      const isSelected = tipoPago === opt.value
                      const Icon = opt.icon
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setTipoPago(opt.value)}
                          className={cn(
                            'flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 transition-all duration-200 min-w-[60px] flex-1 hover:scale-[1.02] active:scale-[0.98]',
                            isSelected
                              ? 'border-brand-500 bg-brand-500 text-white shadow-md shadow-brand-500/25'
                              : 'border-neutral-200 bg-white text-text-secondary hover:border-brand-300'
                          )}
                        >
                          <Icon size={16} className={isSelected ? 'text-white' : 'text-text-secondary'} />
                          <span className={cn(
                            'text-[9px] font-semibold whitespace-nowrap',
                            isSelected ? 'text-white' : 'text-text-secondary'
                          )}>{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-[8px] w-full">
                {/* Emitir e-CF Button */}
                <button
                  type="button"
                  disabled={(facturacionMode !== 'rapido' && currentStep < 3) || !isEmitEnabled || submitting}
                  onClick={() => handleSubmit(true)}
                  className={cn(
                    "w-full h-[44px] rounded-[10px] bg-[#0379D5] text-white text-[16px] font-semibold leading-[24px] font-sans flex items-center justify-center gap-2 transition-all duration-200 select-none shadow-sm",
                    ((facturacionMode !== 'rapido' && currentStep < 3) || !isEmitEnabled || submitting)
                      ? "opacity-20 cursor-not-allowed"
                      : "hover:bg-[#0379D5]/90 cursor-pointer"
                  )}
                >
                  {submitting ? (
                    <Spinner size={18} className="text-white" />
                  ) : (
                    <>
                      <Send size={15} className="text-white" />
                      <span>Emitir e-CF</span>
                    </>
                  )}
                </button>
              </div>
              
              {/* Borrador & Limpiar buttons in quick mode */}
              {facturacionMode === 'rapido' && (
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Button
                    variant="secondary"
                    size="md"
                    type="button"
                    onClick={() => alert('Borrador guardado exitosamente.')}
                    className="flex items-center justify-center gap-1.5 h-10 border border-neutral-200 text-text-primary hover:bg-neutral-50 font-semibold"
                  >
                    <FileText size={15} className="text-text-secondary" />
                    Borrador
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setItems([])
                      setSelectedCliente(null)
                      setTipoPago('CONTADO')
                      setTipoIngreso('')
                      setTerminoPago('')
                      setFechaLimite('')
                      setNotas('')
                    }}
                    className="flex items-center justify-center gap-1.5 h-10 border border-neutral-200 text-text-primary hover:bg-neutral-50 font-semibold"
                  >
                    <RefreshCw size={15} className="text-text-secondary" />
                    Limpiar
                  </Button>
                </div>
              )}
            </div>

            {/* Footer e-CF label */}
            <div className="flex justify-center items-center px-[38px] w-full select-none font-sans mt-1">
              <span className="text-[#64748B] text-[12px] text-center leading-[16.5px] whitespace-nowrap">
                e-NCF • Comprobante Fiscal Electrónico
              </span>
            </div>
          </Card>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-auto max-w-lg rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-body-sm text-danger-700 mt-4">
          {error}
        </div>
      )}
    </div>
  )
}
