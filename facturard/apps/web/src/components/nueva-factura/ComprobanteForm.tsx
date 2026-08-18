import { useCallback, useEffect, useId, useState, useMemo, useRef } from 'react'
import type { JSX } from 'react'
import Link from 'next/link'
import { Calendar, FileText, User, ChevronDown, ChevronRight, RefreshCw, Banknote, CreditCard, ArrowLeftRight, Clock, Search, X, Check, Building2, Eye, Save, Send, FilePlus, AlertTriangle, ShieldCheck, ArrowLeft } from 'lucide-react'
import { StepWizard } from './StepWizard'
import { StepCliente } from './StepCliente'
import { StepDetalle } from './StepDetalle'
import { StepResumen } from './StepResumen'
import { api, getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrency } from '@/lib/comprobantes'
import type { ComprobanteFormData, ItemRow, TipoECF } from '@/hooks/useNuevaFactura'
import type { Contacto } from '@/hooks/useContactos'
import { useContactos } from '@/hooks/useContactos'
import { useRncValidation } from '@/hooks/useRncValidation'
import { useUI } from '@/lib/context/UIContext'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmReemitirModal } from '@/components/facturas/ConfirmReemitirModal'
import { ConfirmLeaveDraftModal } from '@/components/ui/confirm-leave-draft-modal'
import { useEmissionStatus } from '@/hooks/useEmissionStatus'

const WIZARD_STEPS = [
  { number: 1, label: 'Cliente' },
  { number: 2, label: 'Detalle' },
  { number: 3, label: 'Confirmar' },
]

const ITBIS_RATES: Record<string, number> = { I1: 0.18, I2: 0.16, I3: 0, I4: 0, E: 0 }

// Mensaje cuando el tenant no tiene certificado digital activo: no puede emitir a
// la DGII, pero sí guardar borradores. Enlaza a la Certificación fiscal.
const CERT_BLOCK_MSG =
  'Para enviar facturas a la DGII necesitas un certificado digital. Configúralo en ' +
  'Configuración → Certificación fiscal, o contáctanos para ayudarte a certificarte.'

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
  const [year, month, day] = parts
  if (!year || !month || !day) return isoDate
  return `${day}-${month}-${year}`
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
  const router = useRouter()
  const { facturacionMode } = useUI()
  const { contactos, crearContacto } = useContactos()
  const emisionRef = useRef<HTMLInputElement>(null)

  const searchParams = useSearchParams()
  const clienteIdParam = searchParams.get('clienteId')
  const draftId = searchParams.get('id')
  const cloneId = searchParams.get('cloneId')

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1)

  // Form state
  const [tipoECF, setTipoECF] = useState<TipoECF>('E31')
  const [selectedCliente, setSelectedCliente] = useState<Contacto | null>(null)

  // Draft and Re-emission State
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [originalEstado, setOriginalEstado] = useState<string | null>(null)
  const [showConfirmReemitir, setShowConfirmReemitir] = useState(false)
  const [draftData, setDraftData] = useState<any>(null)

  // Auto select client from query param
  useEffect(() => {
    if (clienteIdParam && contactos.length > 0 && !selectedCliente) {
      const match = contactos.find((c) => c.id === clienteIdParam)
      if (match) {
        setSelectedCliente(match)
      }
    }
  }, [clienteIdParam, contactos, selectedCliente])
  const [tipoPago, setTipoPago] = useState<'CONTADO' | 'CREDITO' | 'GRATUITO'>('CONTADO')
  const [tipoIngreso, setTipoIngreso] = useState<string>('')
  const [terminoPago, setTerminoPago] = useState<string>('')
  const [fechaEmision, setFechaEmision] = useState(todayISO())
  const [fechaLimite, setFechaLimite] = useState<string>('')
  const [items, setItems] = useState<ItemRow[]>([])
  const [notas, setNotas] = useState('')
  const [emitirConComprobante, setEmitirConComprobante] = useState(true)
  // Clase de documento: true = e-CF fiscal (flujo DGII); false = Nota de venta
  // interna (no fiscal, sin e-NCF/firma/DGII, sin exigir campos fiscales ni cert).
  const [esFiscal, setEsFiscal] = useState(true)
  const [identificadorExtranjero, setIdentificadorExtranjero] = useState('')
  const [paisComprador, setPaisComprador] = useState('')

  // Prefill foreigner fields when selected client changes
  useEffect(() => {
    if (selectedCliente) {
      setIdentificadorExtranjero(selectedCliente.idExtranjero || '')
    } else {
      setIdentificadorExtranjero('')
      setPaisComprador('')
    }
  }, [selectedCliente])

  // Helper to convert DD-MM-YYYY back to YYYY-MM-DD for date inputs
  function parseDDMMYYYY(dateStr?: string): string {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length !== 3) return dateStr
    const [day, month, year] = parts
    return `${year}-${month}-${day}`
  }

  // Load draft/rejected/error invoice data if editing or cloning
  useEffect(() => {
    const targetId = draftId || cloneId
    if (targetId) {
      setLoadingDraft(true)
      api.get(`/comprobantes/${targetId}`)
        .then((res) => {
          const c = res.data
          // Editables: borrador fiscal (DRAFT/RECHAZADO/ERROR) o Nota de venta
          // interna (INTERNO). Un e-CF emitido/aceptado no se edita aquí.
          if (draftId && c.estado !== 'DRAFT' && c.estado !== 'RECHAZADO' && c.estado !== 'ERROR' && c.estado !== 'INTERNO') {
            toast.error('Este comprobante ya fue emitido y aceptado o está en proceso.')
            router.push('/facturas')
            return
          }

          if (draftId) {
            setOriginalEstado(c.estado)
          }
          // Al clonar (cloneId) siempre se crea una factura FISCAL nueva; al editar
          // (draftId) se respeta la clase del documento cargado.
          setEsFiscal(cloneId ? true : c.esFiscal !== false)
          setTipoECF(c.tipoECF)

          // Map backend payment condition to local tipoPago
          // 1: CONTADO, 2: CREDITO, 3: GRATUITO
          const cond = c.datos?.condicionPago || (c.tipoPago === 2 ? 'CREDITO' : c.tipoPago === 3 ? 'GRATUITO' : 'CONTADO')
          setTipoPago(cond)
          setTipoIngreso(c.datos?.tipoIngresos || '')
          setFechaEmision(cloneId ? todayISO() : parseDDMMYYYY(c.datos?.fechaEmision || c.fechaEmision))
          setFechaLimite(parseDDMMYYYY(c.datos?.fechaVencimiento || c.fechaVencimiento))
          setTerminoPago(c.datos?.terminoPago || '')
          setNotas(c.datos?.notas || '')

          // Reference info
          setNcfModificado(c.datos?.ncfModificado || '')
          setFechaNCFModificado(parseDDMMYYYY(c.datos?.fechaNCFModificado || ''))
          setCodigoModificacion(c.datos?.codigoModificacion ? String(c.datos.codigoModificacion) : '')
          setIndicadorNotaCredito(c.datos?.indicadorNotaCredito ? String(c.datos.indicadorNotaCredito) : '')

          // Items mapping
          const backendItems = c.datos?.items || c.items || []
          const mappedItems: ItemRow[] = backendItems.map((item: any, idx: number) => ({
            key: `item-${idx}-${Date.now()}`,
            nombreItem: item.nombreItem || '',
            cantidad: Number(item.cantidad || 0),
            precioUnitarioItem: Number(item.precioUnitarioItem || 0),
            indicadorFacturacion: item.indicadorFacturacion || 'I1',
            indicadorBienoServicio: Number(item.indicadorBienoServicio || 1) as 1 | 2,
            ...(item.descripcion ? { descripcion: String(item.descripcion) } : {}),
            descuento: Number(item.descuento || 0),
            itbisRetenido: Number(item.itbisRetenido || 0),
            isrRetenido: Number(item.isrRetenido || 0),
            unidadMedida: item.unidadMedida ? Number(item.unidadMedida) : undefined,
          }))
          setItems(mappedItems)

          // Save draft data for client matching
          setDraftData(c)

          // Retomar el borrador donde se quedó, no siempre desde el paso 1.
          // Se calcula sobre los datos crudos de la respuesta (no sobre el estado
          // de React, que todavía no se actualizó en este mismo tick).
          if (draftId && facturacionMode === 'estandar') {
            const hasClienteInfo =
              c.esFiscal === false ||
              Boolean(c.datos?.rncComprador || c.rnc || c.datos?.razonSocialComprador || c.razonSocialComprador)
            const hasValidItems =
              mappedItems.length > 0 &&
              mappedItems.every((i) => i.nombreItem.trim().length > 0 && i.cantidad > 0 && i.precioUnitarioItem > 0)
            if (hasValidItems) {
              setCurrentStep(3)
            } else if (hasClienteInfo) {
              setCurrentStep(2)
            }
          }
        })
        .catch((err) => {
          console.error('Error loading draft details:', err)
          toast.error('Error al cargar los datos del comprobante')
        })
        .finally(() => {
          setLoadingDraft(false)
        })
    }
  }, [draftId, cloneId, router])

  // Match and select the client once contacts are loaded
  useEffect(() => {
    if (draftData && contactos.length > 0) {
      const rncComp = draftData.datos?.rncComprador || draftData.rnc
      const clientMatch = contactos.find((contact) => contact.rnc === rncComp || contact.id === draftData.contactoId)
      if (clientMatch) {
        setSelectedCliente(clientMatch)
      }
    }
  }, [draftData, contactos])

  // Reference Info state (E33/E34)
  const [ncfModificado, setNcfModificado] = useState('')
  const [fechaNCFModificado, setFechaNCFModificado] = useState('')
  const [codigoModificacion, setCodigoModificacion] = useState('')
  const [indicadorNotaCredito, setIndicadorNotaCredito] = useState('')

  // Popover states for quick mode
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const clientSearchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showClientDropdown) {
      setTimeout(() => {
        clientSearchInputRef.current?.focus()
      }, 50)
    }
  }, [showClientDropdown])

  const tipoECFOptions = useMemo(() => {
    return Object.entries(TIPO_ECF_LABELS).map(([key, label]) => {
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
      return { value: key, label: displayLabel }
    })
  }, [])

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [blockingReason, setBlockingReason] = useState<string | null>(null)
  const [isPlanExpired, setIsPlanExpired] = useState(false)
  const [hasCertIssue, setHasCertIssue] = useState(false)

  useEffect(() => {
    async function checkBlockingStatus() {
      try {
        const certRes = await api.get('/certificados/active')
        const cert = certRes.data
        if (!cert || !cert.activo) {
          setHasCertIssue(true)
          setBlockingReason(CERT_BLOCK_MSG)
        } else {
          const days = Math.ceil(
            (new Date(cert.validoHasta).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
          )
          if (days <= 0) {
            setHasCertIssue(true)
            setBlockingReason(CERT_BLOCK_MSG)
          }
        }
      } catch (err: any) {
        if (err.response?.status === 402) {
          setIsPlanExpired(true)
          const msg = getErrorMessage(err, 'El período de prueba o su plan ha vencido.')
          setBlockingReason(msg)
        } else if (err.response?.status === 404) {
          setHasCertIssue(true)
          setBlockingReason(CERT_BLOCK_MSG)
        } else {
          console.error('Error checking active certificate:', err)
        }
      }
    }
    checkBlockingStatus()
  }, [])

  // Default inteligente de la CLASE: si el tenant NO puede emitir (sin certificado
  // o vencido), preselecciona "Nota de venta" — lo único que puede usar. Se aplica
  // una sola vez y solo al CREAR (no al editar/clonar, donde la clase la fija el doc).
  const autoClaseApplied = useRef(false)
  useEffect(() => {
    if (autoClaseApplied.current) return
    if (draftId || cloneId) return
    if (hasCertIssue) {
      setEsFiscal(false)
      autoClaseApplied.current = true
    }
  }, [hasCertIssue, draftId, cloneId])



  const filteredClientes = useMemo(() => {
    const q = clientSearch.toLowerCase().trim()
    if (!q) return contactos
    return contactos.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.rnc.toLowerCase().includes(q)
    )
  }, [contactos, clientSearch])

  // Sin match local y lo escrito es un RNC completo (9 dígitos) → se busca en
  // la DGII para no obligar a abrir "+ Nuevo Cliente" a mano. Al usarlo se
  // crea el Contacto igual que el modal (la factura SIEMPRE referencia un
  // Contacto real). Cédula (11 dígitos) no tiene padrón público en la DGII.
  const clientSearchDigits = clientSearch.replace(/\D/g, '')
  const dropdownRncLookupHabilitado = filteredClientes.length === 0 && clientSearchDigits.length === 9
  const { status: dropdownRncStatus, razonSocial: dropdownRncRazonSocial } = useRncValidation(
    dropdownRncLookupHabilitado ? clientSearchDigits : '',
  )

  async function handleUsarResultadoDgii(): Promise<void> {
    try {
      const nuevo = await crearContacto({
        nombre: dropdownRncRazonSocial,
        rnc: clientSearchDigits,
        email: '',
        telefono: '',
        tipo: 'CLIENTE',
      })
      setSelectedCliente(nuevo)
      setShowClientDropdown(false)
      setClientSearch('')
    } catch (e) {
      console.error(e)
    }
  }

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

  async function executeSubmit(emitConCF: boolean): Promise<void> {
    setSubmitting(true)
    setError('')
    const isForeignerType = tipoECF === 'E46' || tipoECF === 'E47'
    const filteredItems = items.filter(
      (item) => item.nombreItem.trim() !== '' || item.precioUnitarioItem > 0
    )
    try {
      await onSubmit({
        tipoECF,
        rncComprador: selectedCliente?.rnc ?? '',
        identificadorExtranjero: isForeignerType ? identificadorExtranjero : (selectedCliente?.idExtranjero ?? ''),
        razonSocialComprador: selectedCliente?.nombre ?? '',
        paisComprador: isForeignerType ? paisComprador : '',
        fechaEmision,
        condicionPago: tipoPago,
        tipoIngresos: tipoIngreso as ComprobanteFormData['tipoIngresos'],
        ...(tipoPago === 'CREDITO' && fechaLimite ? { fechaVencimiento: fechaLimite } : {}),
        ...(terminoPago ? { terminoPago } : {}),
        ncfModificado,
        fechaNCFModificado,
        codigoModificacion: codigoModificacion as any,
        ...(indicadorNotaCredito && { indicadorNotaCredito: Number(indicadorNotaCredito) as 1 | 2 }),
        items: filteredItems,
        emitirConComprobante: emitConCF,
        esFiscal,
      })
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      onError?.(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(emitConCF: boolean): Promise<void> {
    if (emitConCF && draftId && originalEstado && originalEstado !== 'DRAFT') {
      setShowConfirmReemitir(true)
      return
    }
    await executeSubmit(emitConCF)
  }

  // ─── Volver: guardar como borrador antes de salir ──────────────────────────
  // "Hay algo que valga la pena guardar" = al menos una línea empezada o un
  // cliente elegido. Sin eso, volver es solo navegar (no se crean borradores
  // vacíos). Con contenido, se pregunta antes de salir (guardar / descartar).
  const hayContenido =
    selectedCliente !== null ||
    items.some((i) => i.nombreItem.trim() !== '' || i.precioUnitarioItem > 0)

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  // El botón "Volver"/"Cancelar" ya preguntan; el botón ATRÁS del navegador no
  // pasaba por ahí (popstate no lo intercepta nadie) y salía directo sin avisar.
  // Con contenido sin guardar, se agrega un estado de historial "de repuesto":
  // al presionar atrás, en vez de salir, se re-empuja ese estado (la URL no
  // cambia) y se abre el mismo modal de siempre.
  useEffect(() => {
    if (!hayContenido) return
    window.history.pushState(null, '', window.location.href)
    function onPopState(): void {
      window.history.pushState(null, '', window.location.href)
      setShowLeaveConfirm(true)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [hayContenido])

  function handleBack(): void {
    if (submitting) return
    if (hayContenido) {
      setShowLeaveConfirm(true)
    } else {
      router.push('/facturas')
    }
  }

  async function guardarYSalir(): Promise<void> {
    setShowLeaveConfirm(false)
    // handleSubmit(false) guarda como borrador y, si sale bien, ya navega a
    // /facturas (lo hace el onSubmit de la página). Si falla, muestra el error y
    // se queda en el formulario — igual que el botón "Guardar borrador".
    await handleSubmit(false)
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

  const isE32UnderLimit = tipoECF === 'E32' && total < 250000
  const isE32OverLimit = tipoECF === 'E32' && total >= 250000

  const isRncRequired = tipoECF === 'E31' || tipoECF === 'E41' || tipoECF === 'E45' || isE32OverLimit
  const isRncValid = !isRncRequired || (selectedCliente !== null && selectedCliente.rnc.trim() !== '')

  const isForeignerType = tipoECF === 'E46' || tipoECF === 'E47'
  const isIdentificadorExtranjeroValid = !isForeignerType || identificadorExtranjero.trim() !== ''

  const isPaisCompradorRequired = tipoECF === 'E47'
  const isPaisCompradorValid = !isPaisCompradorRequired || paisComprador.trim() !== ''

  // Una Nota de venta interna (esFiscal=false) no exige campos fiscales: basta
  // con líneas válidas (cliente y campos fiscales son opcionales).
  const isClienteStepValid = !esFiscal
    ? true
    : (!emitirConComprobante || tipoECF === 'E43' || isE32UnderLimit || (selectedCliente !== null && isRncValid && isIdentificadorExtranjeroValid && isPaisCompradorValid)) &&
      (!emitirConComprobante || isTipoIngresoValid) &&
      isFechaLimiteValid &&
      isReferenciaValid
  const isDetalleStepValid = items.length > 0 && items.every(
    (i) => i.nombreItem.trim().length > 0 && i.cantidad > 0 && i.precioUnitarioItem > 0,
  )

  const isEmitEnabled = isClienteStepValid && isDetalleStepValid

  // Reglas de validez (isClienteStepValid/isDetalleStepValid) se recalculan en
  // vivo, pero currentStep es estado propio — sin esto, alternar "Nota de
  // venta" (no exige cliente) ↔ "Factura fiscal" (sí) mientras ya estás en el
  // paso 2/3 te deja PARADO ahí con campos vacíos: nunca se re-valida el paso
  // en el que estás al cambiar las reglas. Se regresa al último paso que sigue
  // siendo válido apenas eso pasa.
  useEffect(() => {
    if (currentStep > 1 && !isClienteStepValid) setCurrentStep(1)
    else if (currentStep > 2 && !isDetalleStepValid) setCurrentStep(2)
  }, [isClienteStepValid, isDetalleStepValid, currentStep])

  // ─── Wizard: navegación desde el botón principal de la derecha ─────────────
  // Cuando NO estás en el paso final, ese botón actúa como "Siguiente" (misma
  // acción que el "siguiente" de abajo, que se mantiene) en vez de quedarse
  // bloqueado. Las validaciones son las MISMAS que gatean el botón de abajo:
  // paso 1 → datos del cliente, paso 2 → líneas del detalle.
  // 'estandar' es exactamente la condición con la que se renderiza el wizard de
  // 3 pasos; en modo 'rapido' no hay pasos y el botón no
  // debe navegar.
  const isWizardMode = facturacionMode === 'estandar'
  const isOnLastStep = currentStep >= 3
  const showStepNav = isWizardMode && !isOnLastStep
  const isCurrentStepValid =
    currentStep === 1 ? isClienteStepValid
    : currentStep === 2 ? isDetalleStepValid
    : true

  if (loadingDraft) {
    return (
      <div className="flex h-64 items-center justify-center bg-white rounded-xl border border-neutral-200">
        <Spinner size={32} />
      </div>
    )
  }

  const claseLocked = Boolean(draftId) // al editar no se cambia la clase del documento

  return (
    <div className="mx-auto w-full max-w-[1400px] flex flex-col pb-6">
      {/* Volver: si hay contenido, ofrece guardar como borrador antes de salir. */}
      <div className={cn(
        "mx-auto mb-3 w-full text-left",
        facturacionMode === 'estandar' ? "lg:w-full lg:max-w-[1336px] lg:px-[16px] xl:px-0" : ""
      )}>
        <button
          type="button"
          onClick={handleBack}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 h-9 -ml-1 px-2 rounded-[8px] text-[13px] font-medium text-[#64748B] hover:text-[#334155] hover:bg-neutral-100 transition-colors focus:outline-none disabled:opacity-50 cursor-pointer select-none"
        >
          <ArrowLeft size={16} />
          <span>Volver a Facturas</span>
        </button>
      </div>

      {/* Selector de clase de documento (Fase 2) */}
      <div className={cn(
        "mx-auto mb-4 w-full text-left",
        facturacionMode === 'estandar' ? "lg:w-full lg:max-w-[1336px] lg:px-[16px] xl:px-0" : ""
      )}>
        <div className="inline-flex rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] p-1 gap-1 select-none">
          {([
            { val: true, label: 'Factura fiscal (e-CF)' },
            { val: false, label: 'Nota de venta (sin comprobante)' },
          ] as const).map((opt) => {
            const active = esFiscal === opt.val
            return (
              <button
                key={String(opt.val)}
                type="button"
                disabled={claseLocked && !active}
                onClick={() => !claseLocked && setEsFiscal(opt.val)}
                className={cn(
                  "h-9 px-4 rounded-[9px] text-[13px] font-semibold transition-colors",
                  active ? "bg-[#0379D5] text-white shadow-sm" : "text-[#64748B] hover:text-[#334155]",
                  claseLocked && !active ? "opacity-40 cursor-not-allowed" : ""
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        {!esFiscal && (
          <p className="mt-2 text-[12px] text-[#64748B] leading-snug">
            Documento interno con numeración propia (NV-000001). No se envía a la DGII, no consume e-NCF ni exige certificado ni campos fiscales.
          </p>
        )}
      </div>

      {/* Main 2-column layout */}
      <div className={cn(
        "w-full",
        facturacionMode === 'estandar'
          ? "flex flex-col lg:flex-row gap-[24px] lg:w-full lg:max-w-[1336px] lg:px-[16px] xl:px-0 lg:h-auto mx-auto overflow-visible"
          : "grid grid-cols-1 gap-6 lg:grid-cols-3 h-full overflow-hidden"
      )}>
        {/* Left Column */}
        {facturacionMode === 'estandar' ? (
          <Card className="w-full lg:flex-1 lg:max-w-[952px] lg:min-w-0 p-6 flex flex-col bg-white border border-[#E2E8F0] shadow-sm rounded-[14px] overflow-visible">
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
                  identificadorExtranjero={identificadorExtranjero}
                  onIdentificadorExtranjeroChange={setIdentificadorExtranjero}
                  paisComprador={paisComprador}
                  onPaisCompradorChange={setPaisComprador}
                  total={total}
                  onNext={() => goToStep(2)}
                  esFiscal={esFiscal}
                />
              )}

              {currentStep === 2 && (
                <StepDetalle
                  items={items}
                  onItemsChange={handleItemsChange}
                  notas={notas}
                  onNotasChange={setNotas}
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
                  esFiscal={esFiscal}
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
              onBack={() => { }}
              isQuickMode={true}
              tipoECF={tipoECF}
            />
          </Card>
        )}

        {/* Right Column */}
        <div className={cn(
          "flex flex-col overflow-hidden",
          facturacionMode === 'estandar' ? "w-full lg:w-[360px] max-[1200px]:lg:w-[310px] shrink-0" : "h-full lg:col-span-1"
        )}>
          {/* Rápido Mode Selectors (Client, Type, Date) above the card */}
          {facturacionMode === 'rapido' && (
            <div className="flex flex-col gap-2 mb-4 w-full">
              <div className="grid grid-cols-3 gap-2 w-full">
                {/* Client Selector */}
                <div className="relative flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowClientDropdown(!showClientDropdown)
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
                              ref={clientSearchInputRef}
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
                            clientSearchDigits.length === 11 ? (
                              <div className="px-4 py-4 text-center text-ui-sm text-text-secondary">
                                No se encontraron clientes.
                                <br />
                                La cédula no tiene registro público en la DGII — usa &quot;+ Nuevo Cliente&quot; para escribir el nombre a mano.
                              </div>
                            ) : dropdownRncLookupHabilitado && dropdownRncStatus === 'loading' ? (
                              <div className="flex items-center justify-center gap-2 px-4 py-4 text-ui-sm text-text-secondary">
                                <Spinner size={16} /> Buscando RNC en la DGII...
                              </div>
                            ) : dropdownRncLookupHabilitado && dropdownRncStatus === 'valid' ? (
                              <button
                                type="button"
                                onClick={() => void handleUsarResultadoDgii()}
                                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F0F5FF]/50 focus:bg-[#F0F5FF] focus:outline-none"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 bg-[#F3F4F6] text-[#6A7282]">
                                    <Building2 size={16} />
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[16px] font-semibold text-[#333333] leading-6 truncate">
                                      {dropdownRncRazonSocial}
                                    </span>
                                    <span className="text-[13px] font-normal text-[#99A1AF] leading-[20px] mt-0.5">
                                      Encontrado en la DGII · RNC: {clientSearchDigits.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[13px] font-semibold text-[#0379D5] shrink-0">Usar</span>
                              </button>
                            ) : (
                              <div className="px-4 py-4 text-center text-ui-sm text-text-secondary">
                                No se encontraron clientes
                                {dropdownRncLookupHabilitado && dropdownRncStatus === 'invalid' && (
                                  <>
                                    <br />
                                    RNC no registrado en la DGII.
                                  </>
                                )}
                              </div>
                            )
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
                  <Select
                    value={tipoECF}
                    onChange={(val) => setTipoECF(val as TipoECF)}
                    options={tipoECFOptions}
                    placeholder="Tipo NCF"
                    triggerClassName="h-10 border-neutral-200 bg-white px-2.5 text-[11px] font-bold text-text-primary hover:border-brand-500"
                    dropdownClassName="w-[320px]"
                  />
                </div>

                {/* Date Selector */}
                <div
                  onClick={() => {
                    try {
                      emisionRef.current?.showPicker()
                    } catch (e) {
                      emisionRef.current?.focus()
                    }
                  }}
                  className="relative flex-1 min-w-0 select-none cursor-pointer"
                >
                  <div className="flex w-full items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px] font-bold text-text-primary hover:border-brand-500 transition-colors justify-between min-w-0 h-10 shadow-sm animate-in fade-in-50 duration-150">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Calendar size={14} className="text-text-secondary flex-shrink-0" />
                      <span className="truncate">{formatDateSpanish(fechaEmision)}</span>
                    </div>
                  </div>
                  <input
                    ref={emisionRef}
                    type="date"
                    value={fechaEmision}
                    onChange={(e) => setFechaEmision(e.target.value)}
                    className="absolute -z-10 opacity-0 invisible w-0 h-0"
                  />
                </div>
              </div>

              {isForeignerType && selectedCliente && (
                <div className="grid grid-cols-2 gap-2 w-full animate-in fade-in-50 duration-150 text-left">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#64748B] uppercase">ID Extranjero *</label>
                    <input
                      type="text"
                      placeholder="Identificador Extranjero"
                      value={identificadorExtranjero}
                      onChange={(e) => setIdentificadorExtranjero(e.target.value)}
                      className={cn(
                        "h-10 rounded-lg border bg-white px-2.5 py-2 text-[11px] font-bold focus:outline-none focus:border-brand-500 shadow-sm",
                        !identificadorExtranjero ? "border-danger-500" : "border-neutral-200"
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#64748B] uppercase">País del Comprador {isPaisCompradorRequired ? '*' : '(Opcional)'}</label>
                    <input
                      type="text"
                      placeholder="País del Comprador"
                      value={paisComprador}
                      onChange={(e) => setPaisComprador(e.target.value)}
                      className={cn(
                        "h-10 rounded-lg border bg-white px-2.5 py-2 text-[11px] font-bold focus:outline-none focus:border-brand-500 shadow-sm",
                        isPaisCompradorRequired && !paisComprador ? "border-danger-500" : "border-neutral-200"
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resumen Card */}
          <Card className={cn(
            "flex flex-col bg-white border border-[#E2E8F0] rounded-[14px] transition-all duration-300 gap-[16px] items-stretch p-[21px] relative",
            facturacionMode === 'estandar'
              ? "w-full flex-1 shadow-sm"
              : "flex-1 shadow-sm overflow-y-auto h-full"
          )}>
            {/* Header */}
            <div className="flex items-center justify-between w-full select-none">
              <div className="flex items-center gap-[8px]">
                <FileText size={20} className="text-[#333333]" />
                <span className="font-['Open_Sans'] font-semibold leading-[24px] text-[#333333] text-[16px]">
                  {esFiscal ? 'Resumen e-CF' : 'Resumen'}
                </span>
              </div>
            </div>

            {/* Metadata (Invoice Info) */}
            <div className="flex flex-col gap-[8px] items-start w-full select-none">
              {/* Date */}
              <div className="flex items-center gap-[8px] text-[#64748B] text-[13px] font-sans">
                <Calendar size={16} className="text-[#64748B] flex-shrink-0" />
                <span className="leading-[19.5px]">{formatDateSpanish(fechaEmision)}</span>
              </div>

              {/* Payment Condition */}
              <div className="flex items-center gap-[8px] text-[#64748B] text-[13px] font-sans">
                <CreditCard size={16} className="text-[#64748B] flex-shrink-0" />
                <span className="leading-[19.5px] truncate">
                  {tipoPago === 'CREDITO' ? 'Crédito' : tipoPago === 'GRATUITO' ? 'Gratuito' : 'Contado'}
                  {tipoPago === 'CREDITO' && terminoPago ? ` - ${terminoPago}` : ''}
                </span>
              </div>

              {/* Tipo de documento */}
              <div className="flex items-center gap-[8px] text-[#64748B] text-[13px] font-sans w-full min-w-0">
                <FileText size={16} className="text-[#64748B] flex-shrink-0" />
                <span className="leading-[19.5px] truncate" title={esFiscal ? TIPO_ECF_LABELS[tipoECF] : 'Nota de venta'}>
                  {esFiscal ? TIPO_ECF_LABELS[tipoECF] : 'Nota de venta (documento interno)'}
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
                  ? `RNC: ${selectedCliente.rnc.length === 9
                    ? selectedCliente.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
                    : selectedCliente.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')
                  }`
                  : 'RNC: -'}
              </p>
            </div>

            <hr className="border-[#E2E8F0] my-0" />

            {/* Items Summary (List of added products) */}
            {items.length > 0 && (
              <>
                <div className="flex flex-col gap-[10px] w-full text-[12px] text-[#475569] max-h-[160px] overflow-y-auto pr-1">
                  {items.map((item, index) => {
                    const itemSubtotal = item.cantidad * item.precioUnitarioItem
                    return (
                      <div key={item.key || index} className="flex items-start justify-between w-full gap-2 select-none">
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-semibold text-[#334155] truncate text-[13px]" title={item.nombreItem || 'Ítem personalizado'}>
                            {item.nombreItem || 'Ítem personalizado'}
                          </span>
                          <span className="text-[11px] text-[#64748B] mt-0.5">
                            Cant: {item.cantidad} × {formatCurrency(item.precioUnitarioItem)}
                          </span>
                        </div>
                        <span className="font-bold text-[#334155] shrink-0 text-right text-[13px] self-start mt-0.5">
                          {formatCurrency(itemSubtotal)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <hr className="border-[#E2E8F0] my-0" />
              </>
            )}

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
                {/* Nota de venta interna: un solo botón, sin certificado ni campos fiscales */}
                {!esFiscal && (() => {
                  // Fuera del paso final este botón avanza el wizard; en el
                  // paso final vuelve a ser el de crear la nota de venta.
                  const disabled = showStepNav
                    ? !isCurrentStepValid
                    : submitting || isPlanExpired || !isDetalleStepValid
                  return (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => (showStepNav ? goToStep(currentStep + 1) : handleSubmit(false))}
                      className={cn(
                        "w-full h-[44px] rounded-[10px] bg-brand-500 text-white text-[16px] font-semibold leading-[24px] font-sans flex items-center justify-center gap-2 transition-all duration-200 select-none shadow-sm",
                        disabled
                          ? "opacity-20 cursor-not-allowed"
                          : "hover:bg-brand-600 hover:scale-[1.03] hover:shadow-md active:scale-[0.98] cursor-pointer"
                      )}
                    >
                      {submitting ? (
                        <Spinner size={18} className="text-white" />
                      ) : showStepNav ? (
                        <>
                          <span>Siguiente</span>
                          <ChevronRight size={16} className="text-white" />
                        </>
                      ) : (
                        <>
                          <FilePlus size={15} className="text-white" />
                          <span>{draftId ? 'Guardar cambios' : 'Crear nota de venta'}</span>
                        </>
                      )}
                    </button>
                  )
                })()}

                {esFiscal && isE32OverLimit && (!selectedCliente || !selectedCliente.rnc.trim()) && (
                  <p className="text-[11px] font-semibold text-danger-600 text-left leading-normal animate-in fade-in-50 mb-1 font-sans">
                    Para facturas de consumo (E32) de RD$250,000 o más, es obligatorio identificar al comprador con su RNC o cédula.
                  </p>
                )}
                {esFiscal && blockingReason && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-700 font-semibold leading-normal text-left font-sans flex items-start gap-2 select-none mb-1">
                    <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-bold text-[13px]">
                        {hasCertIssue ? 'Necesitas un certificado digital' : 'Emisión Bloqueada'}
                      </p>
                      <p className="font-normal mt-0.5 text-[11px] leading-snug">{blockingReason}</p>
                      {hasCertIssue && (
                        <Link
                          href="/configuracion#certificacion-fiscal"
                          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[#0379D5] px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#0379D5]/90"
                        >
                          <ShieldCheck size={13} />
                          Ir a Certificación fiscal
                        </Link>
                      )}
                    </div>
                  </div>
                )}
                {/* Emitir e-CF Button (solo fiscal) */}
                {esFiscal && (
                  <button
                    type="button"
                    disabled={(facturacionMode !== 'rapido' && currentStep < 3) || !isEmitEnabled || submitting || !!blockingReason}
                    onClick={() => handleSubmit(true)}
                    className={cn(
                      "w-full h-[44px] rounded-[10px] bg-[#0379D5] text-white text-[16px] font-semibold leading-[24px] font-sans flex items-center justify-center gap-2 transition-all duration-200 select-none shadow-sm",
                      ((facturacionMode !== 'rapido' && currentStep < 3) || !isEmitEnabled || submitting || !!blockingReason)
                        ? "opacity-20 cursor-not-allowed"
                        : "hover:bg-[#0379D5]/90 hover:scale-[1.03] hover:shadow-md active:scale-[0.98] cursor-pointer"
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
                )}

                {/* Acciones secundarias, apiladas por jerarquía descendente:
                    Emitir (primaria, rellena) › Guardar borrador (con borde) ›
                    Cancelar (fantasma, sin borde). Antes iban en 2 columnas con
                    el MISMO estilo, así que "guardar" y "cancelar" —que son cosas
                    muy distintas— pesaban visualmente igual. */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    disabled={submitting || isPlanExpired}
                    className="w-full h-[40px] rounded-[10px] border border-neutral-200 bg-white text-text-primary text-[14px] font-semibold flex items-center justify-center gap-1.5 hover:bg-neutral-50 transition-colors focus:outline-none cursor-pointer disabled:opacity-50"
                  >
                    <Save size={15} className="text-[#64748B]" />
                    <span>Guardar borrador</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={submitting}
                    className="w-full h-[36px] rounded-[10px] text-text-secondary text-[13px] font-medium flex items-center justify-center hover:bg-neutral-100 hover:text-text-primary transition-colors focus:outline-none cursor-pointer disabled:opacity-50"
                  >
                    <span>Cancelar</span>
                  </button>
                </div>


              </div>

              {/* Borrador & Limpiar buttons in quick mode */}
              {facturacionMode === 'rapido' && (
                <div className={cn("grid gap-2 mt-1", esFiscal ? "grid-cols-2" : "grid-cols-1")}>
                  {esFiscal && (
                    <Button
                      variant="secondary"
                      size="md"
                      type="button"
                      onClick={() => handleSubmit(false)}
                      disabled={submitting || isPlanExpired}
                      className="flex items-center justify-center gap-1.5 h-10 border border-neutral-200 text-text-primary hover:bg-neutral-50 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileText size={15} className="text-text-secondary" />
                      Guardar borrador
                    </Button>
                  )}
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
                {esFiscal ? 'e-NCF • Comprobante Fiscal Electrónico' : 'NV • Documento interno (no fiscal)'}
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

      {/* Confirm re-emission modal */}
      <ConfirmReemitirModal
        open={showConfirmReemitir}
        onClose={() => setShowConfirmReemitir(false)}
        onConfirm={() => {
          setShowConfirmReemitir(false)
          executeSubmit(true)
        }}
      />

      {/* Salir con cambios sin guardar → guardar borrador / descartar / seguir */}
      <ConfirmLeaveDraftModal
        open={showLeaveConfirm}
        documento={esFiscal ? 'factura' : 'nota de venta'}
        saving={submitting}
        onSeguir={() => setShowLeaveConfirm(false)}
        onDescartar={() => {
          setShowLeaveConfirm(false)
          router.push('/facturas')
        }}
        onGuardar={() => void guardarYSalir()}
      />
    </div>
  )
}
