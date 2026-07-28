'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import type { JSX } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  Plus,
  Building2,
  User,
  RefreshCw,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Send,
  Edit2,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { useContactosDirectorio } from '@/hooks/useContactosDirectorio'
import { useContactos } from '@/hooks/useContactos'
import { useGhlSync } from '@/hooks/useGhlSync'
import { Select } from '@/components/ui/select'
import { useUI } from '@/lib/context/UIContext'
import { NuevoClienteModal } from '@/components/nueva-factura/NuevoClienteModal'
import { EditarClienteModal } from '@/components/contacto/EditarClienteModal'
import { SincronizarGhlModal } from '@/components/contacto/SincronizarGhlModal'
import { formatDate } from '@/lib/comprobantes'
import { cn } from '@/lib/utils'
import { DetailPanel } from '@/components/contacto/DetailPanel'
import { Modal } from '@/components/ui/modal'
import { toast } from 'sonner'

import {
  EditActionButton,
  RefreshActionButton,
  ImportActionButton,
  ExportActionButton,
  NewActionButton
} from '@/components/ui/table-actions'

const tipoOptions = [
  { value: 'todos', label: 'Tipo' },
  { value: 'CLIENTE', label: 'CLIENTE' },
  { value: 'PROVEEDOR', label: 'PROVEEDOR' },
  { value: 'CONSUMIDOR_FINAL', label: 'CONSUMIDOR_FINAL' },
]

const TIPO_LABEL: Record<string, string> = {
  CLIENTE: 'Cliente',
  PROVEEDOR: 'Proveedor',
  CONSUMIDOR_FINAL: 'Consumidor Final',
}

const origenOptions = [
  { value: 'todos', label: 'Origen' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'GHL', label: 'GHL' },
]

const tipoFiscalOptions = [
  { value: 'todos', label: 'Tipo fiscal' },
  { value: 'RNC', label: 'RNC' },
  { value: 'CEDULA', label: 'Cédula' },
  { value: 'CF', label: 'CF' },
  { value: 'EXTRANJERO', label: 'ID extranjero' },
]

const validacionOptions = [
  { value: 'todos', label: 'Validación DGII' },
  { value: 'VALIDO', label: 'Válido' },
  { value: 'SIN_VALIDAR', label: 'Sin validar' },
]

type TipoFilter = 'todos' | 'CLIENTE' | 'PROVEEDOR' | 'CONSUMIDOR_FINAL'

function formatRnc(rnc: string | null): string {
  if (!rnc) return '—'
  const clean = rnc.replace(/\D/g, '')
  if (clean.length === 9) return clean.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')
  return rnc
}

export default function ContactosPage(): JSX.Element {
  const router = useRouter()
  const { globalSearch } = useUI()
  const { crearContacto, actualizarContacto, eliminarContacto } = useContactos()
  const { conectado } = useGhlSync()

  const startDateRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos')
  const [tipoFiscalFilter, setTipoFiscalFilter] = useState('todos')
  const [validacionFilter, setValidacionFilter] = useState('todos')
  const [origenFilter, setOrigenFilter] = useState('todos')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [soloSinRnc, setSoloSinRnc] = useState(false)
  const [page, setPage] = useState(1)
  const [openModal, setOpenModal] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('new=true')) {
      setOpenModal(true)
      const url = new URL(window.location.href)
      url.searchParams.delete('new')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])
  const [selectedContacto, setSelectedContacto] = useState<any | null>(null)
  const [editingContacto, setEditingContacto] = useState<any | null>(null)
  const [togglingContacto, setTogglingContacto] = useState<any | null>(null)
  const [deletingContacto, setDeletingContacto] = useState<any | null>(null)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    setSelectedIds(new Set())
  }

  const handleBulkExport = () => {
    const selectedList = visibles.filter(c => selectedIds.has(c.id))
    if (selectedList.length === 0) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Por favor permita las ventanas emergentes para exportar a PDF')
      return
    }

    const htmlContent = `
      <html>
        <head>
          <title>Exportación de Contactos</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 40px; color: #333; }
            h1 { font-size: 22px; margin-bottom: 24px; border-bottom: 2px solid #eaeaea; padding-bottom: 12px; color: #111; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border-bottom: 1px solid #eaeaea; padding: 12px 10px; text-align: left; font-size: 13px; }
            th { background-color: #fafafa; font-weight: 600; color: #666; border-top: 1px solid #eaeaea; }
            .footer { margin-top: 40px; font-size: 11px; color: #888; text-align: right; }
          </style>
        </head>
        <body>
          <h1>Reporte de Contactos</h1>
          <table>
            <thead>
              <tr>
                <th>Nombre / Razón social</th>
                <th>Tipo</th>
                <th>Tipo fiscal</th>
                <th>Identificación</th>
                <th>Origen</th>
                <th>Estado</th>
                <th>Última Actividad</th>
              </tr>
            </thead>
            <tbody>
              ${selectedList.map(c => {
                let taxTypeLabel = 'CF'
                if (c.identificadorExtranjero) {
                  taxTypeLabel = 'ID extranjero'
                } else if (c.rnc) {
                  const clean = c.rnc.replace(/\D/g, '')
                  if (clean.length === 9) {
                    taxTypeLabel = 'RNC'
                  } else if (clean.length === 11) {
                    taxTypeLabel = 'Cédula'
                  }
                }
                const cleanRnc = c.rnc ? (c.rnc.length === 9 ? c.rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3') : c.rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')) : c.identificadorExtranjero || '—'
                const statusLabel = c.activo ? 'Activo' : 'Inactivo'
                return "<tr>" +
                  "<td><b>" + (c.razonSocial || '—') + "</b></td>" +
                  "<td>" + (c.tipo || '—') + "</td>" +
                  "<td>" + taxTypeLabel + "</td>" +
                  "<td>" + cleanRnc + "</td>" +
                  "<td>" + (c.origen || '—') + "</td>" +
                  "<td>" + statusLabel + "</td>" +
                  "<td>" + formatDate(c.updatedAt || c.createdAt || new Date().toISOString()) + "</td>" +
                  "</tr>"
              }).join('')}
            </tbody>
          </table>
          <div class="footer">
            Generado automáticamente el ${new Date().toLocaleDateString()}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `
    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  const [avisoNoConectado, setAvisoNoConectado] = useState(false)
  const [ghlModalOpen, setGhlModalOpen] = useState(false)
  const [sinRncCount, setSinRncCount] = useState<number | null>(null)

  const activeSearch = (search.trim() ? search : globalSearch).trim()

  // Contactos inactivos (desactivados o eliminados) nunca se muestran en el
  // directorio: se piden solo activos, sin filtro de estado en la UI.
  const { contactos, total, totalPages, isLoading, isError, isFetching, refetch } = useContactosDirectorio({
    search: activeSearch,
    tipo: tipoFilter === 'todos' ? undefined : tipoFilter,
    activo: true,
    page,
    limit: 10,
  })

  // Local state overrides for toggle active/inactive status quickly
  const [localStatusOverrides, setLocalStatusOverrides] = useState<Record<string, boolean>>({})

  // Apply filters on page loaded contacts
  const visibles = useMemo(() => {
    let list = [...contactos]

    // Apply local status overrides
    list = list.map(c => {
      return {
        ...c,
        activo: localStatusOverrides[c.id] !== undefined ? !!localStatusOverrides[c.id] : c.activo
      }
    })

    // Inactivo (desactivado o eliminado) nunca se muestra, ni antes de que
    // el refetch confirme el cambio en el servidor.
    list = list.filter((c) => c.activo)

    if (soloSinRnc) {
      list = list.filter((c) => !c.rnc)
    }

    if (tipoFiscalFilter !== 'todos') {
      list = list.filter((c) => {
        if (c.identificadorExtranjero) return tipoFiscalFilter === 'EXTRANJERO'
        if (!c.rnc) return tipoFiscalFilter === 'CF'
        const clean = c.rnc.replace(/\D/g, '')
        if (clean.length === 9) return tipoFiscalFilter === 'RNC'
        if (clean.length === 11) return tipoFiscalFilter === 'CEDULA'
        return tipoFiscalFilter === 'CF'
      })
    }

    if (validacionFilter !== 'todos') {
      list = list.filter((c) => {
        const isValid = !!c.rncValidado
        return validacionFilter === 'VALIDO' ? isValid : !isValid
      })
    }

    if (origenFilter !== 'todos') {
      list = list.filter((c) => (c.origen === 'GHL' ? 'GHL' : 'MANUAL') === origenFilter)
    }

    if (startDate) {
      list = list.filter((c) => {
        const dateStr = c.createdAt ? c.createdAt.split('T')[0] || '' : ''
        return dateStr >= startDate
      })
    }
    if (endDate) {
      list = list.filter((c) => {
        const dateStr = c.createdAt ? c.createdAt.split('T')[0] || '' : ''
        return dateStr <= endDate
      })
    }

    return list
  }, [contactos, soloSinRnc, tipoFiscalFilter, validacionFilter, origenFilter, startDate, endDate])

  function handleAbrirSincronizarGhl(): void {
    if (!conectado) {
      setAvisoNoConectado(true)
      return
    }
    setAvisoNoConectado(false)
    setGhlModalOpen(true)
  }

  function resetPage<T>(setter: (v: T) => void): (v: T) => void {
    return (v: T) => {
      setter(v)
      setPage(1)
    }
  }

  // Toggles contact status Active / Inactive
  async function handleToggleStatus(c: any): Promise<void> {
    const rawContact = visibles.find(item => item.id === c.id) || c
    setTogglingContacto(rawContact)
  }

  async function confirmToggleStatus(): Promise<void> {
    if (!togglingContacto) return
    const c = togglingContacto
    const isCurrentlyActive = c.activo !== undefined ? !!c.activo : c.estado === 'ACTIVO'
    const nextStatus = !isCurrentlyActive
    const contactName = c.razonSocial || c.nombre || 'Contacto'

    setLocalStatusOverrides(prev => ({ ...prev, [c.id]: nextStatus }))
    try {
      await actualizarContacto.mutateAsync({ id: c.id, data: { activo: nextStatus } })
      toast.success(`Estado de ${contactName} actualizado`)
    } catch (err) {
      // Revert in case of error
      setLocalStatusOverrides(prev => ({ ...prev, [c.id]: !nextStatus }))
      toast.error('Ocurrió un error al actualizar el estado')
    }
    setTogglingContacto(null)
  }

  async function confirmDeleteContacto(): Promise<void> {
    if (!deletingContacto) return
    const id = deletingContacto.id
    try {
      await eliminarContacto.mutateAsync(id)
      if (selectedContacto && selectedContacto.id === id) {
        setSelectedContacto(null)
      }
    } catch {
      // el toast de error ya lo maneja la mutación
    }
    setDeletingContacto(null)
  }

  async function handleEditSave(id: string, data: any) {
    try {
      const cleanPhone = data.telefono.replace(/\D/g, '')
      const cleanRnc = (data.rnc || '').replace(/\D/g, '')

      await actualizarContacto.mutateAsync({
        id,
        data: {
          tipo: data.tipo,
          rnc: cleanRnc || undefined,
          razonSocial: data.nombre,
          nombreComercial: data.nombreComercial || undefined,
          email: data.email || undefined,
          telefono: cleanPhone || undefined,
          direccion: data.direccion || undefined,
          provincia: data.provincia || undefined,
          municipio: data.municipio || undefined,
          identificadorExtranjero: data.idExtranjero || undefined,
        }
      })
      toast.success('Contacto actualizado correctamente')
      if (selectedContacto && selectedContacto.id === id) {
        setSelectedContacto((prev: any) => ({
          ...prev,
          tipo: data.tipo,
          rnc: cleanRnc || null,
          razonSocial: data.nombre,
          email: data.email || null,
          telefono: cleanPhone || null,
          direccion: data.direccion || null,
          provincia: data.provincia || null,
          municipio: data.municipio || null,
          identificadorExtranjero: data.idExtranjero || null,
        }))
      }
    } catch (err) {
      toast.error('Error al actualizar el contacto')
    }
  }

  const mappedSelectedContacto = useMemo(() => {
    if (!selectedContacto) return null
    // Read local override status if present
    const isActivo = localStatusOverrides[selectedContacto.id] !== undefined
      ? localStatusOverrides[selectedContacto.id]
      : !!selectedContacto.activo

    return {
      id: selectedContacto.id,
      nombre: selectedContacto.razonSocial || 'Sin nombre',
      rnc: selectedContacto.rnc || '',
      email: selectedContacto.email || '',
      telefono: selectedContacto.telefono || '',
      tipo: selectedContacto.tipo === 'CONSUMIDOR_FINAL' ? ('PERSONA' as const) : ('EMPRESA' as const),
      idExtranjero: selectedContacto.identificadorExtranjero || '',
      validacion: selectedContacto.rncValidado ? ('VALIDO' as const) : ('NO_ENCONTRADO' as const),
      totalFacturado: 0,
      fecha: new Date(selectedContacto.updatedAt || selectedContacto.createdAt || Date.now()).toISOString().split('T')[0] ?? '',
      estado: (isActivo ? 'ACTIVO' : 'INACTIVO') as any,
    }
  }, [selectedContacto, localStatusOverrides])

  return (
    <div className="flex flex-col gap-6 text-left w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h4 font-bold text-text-primary">Contactos</h2>
          <p className="text-body-sm text-text-secondary">{total} contactos en tu directorio</p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* EDIT/PENCIL BUTTON - visible only in normal mode */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-left flex items-center justify-center overflow-hidden h-[48px] -my-1 -mx-0.5",
            isSelectionMode ? "w-0 opacity-0 -translate-x-4 scale-0 -mr-2.5" : "w-[44px] opacity-100 translate-x-0 scale-100"
          )}>
            <EditActionButton
              onClick={toggleSelectionMode}
              title="Activar selección"
              className="h-10 w-10 border-neutral-200"
            />
          </div>

          {/* RELOAD/REFRESH BUTTON - always visible */}
          <RefreshActionButton
            onClick={() => refetch()}
            isLoading={isFetching}
            className="h-10 w-10 border-neutral-200"
          />

          {/* GHL IMPORT BUTTON - visible only in normal mode */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-left flex items-center justify-center overflow-hidden h-[48px] -my-1 -mx-0.5",
            isSelectionMode ? "w-0 opacity-0 -translate-x-4 scale-0 -mr-2.5" : "w-[248px] opacity-100 translate-x-0 scale-100"
          )}>
            <ImportActionButton
              onClick={handleAbrirSincronizarGhl}
              isLoading={false}
              label="Sincronizar con GoHighLevel"
              title={conectado ? 'Importar contactos desde GoHighLevel' : 'Conecta GoHighLevel en Configuración'}
              className="h-10 w-[244px] justify-center border-neutral-200"
            />
          </div>

          {/* EXPORT BUTTON - visible only in selection mode */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-right flex items-center justify-center overflow-hidden h-[48px] -my-1 -mx-0.5",
            isSelectionMode ? "w-[118px] opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 translate-x-4 scale-0 -mr-2.5"
          )}>
            <ExportActionButton
              onClick={handleBulkExport}
              disabled={selectedIds.size === 0}
              title="Exportar"
              className="h-10 w-[114px] justify-center border-neutral-200"
            />
          </div>

          {/* CANCELAR BUTTON - visible only in selection mode, styled red */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-right flex items-center justify-center overflow-hidden h-[48px] -my-1 -mx-0.5",
            isSelectionMode ? "w-[114px] opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 translate-x-4 scale-0 -mr-2.5"
          )}>
            <button
              onClick={toggleSelectionMode}
              className="h-10 px-[17px] flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-semibold rounded-[10px] transition-all focus:outline-none shrink-0 w-[110px] font-sans text-[14px] border-none"
            >
              Cancelar
            </button>
          </div>

          {/* NUEVO CONTACTO BUTTON - visible only in normal mode */}
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-left flex items-center justify-center overflow-hidden h-[48px] -my-1 -mx-0.5",
            isSelectionMode ? "w-0 opacity-0 -translate-x-4 scale-0" : "w-[174px] opacity-100 translate-x-0 scale-100"
          )}>
            <NewActionButton
              onClick={() => setOpenModal(true)}
              label="Nuevo contacto"
              className="h-10 w-[170px] justify-center"
            />
          </div>
        </div>
      </div>

      <div className={cn("flex items-start w-full transition-all duration-300 ease-in-out", selectedContacto ? 'gap-[24px]' : 'gap-0')}>
        <div className="flex-1 flex flex-col gap-6 transition-all duration-300 min-w-0">
          {/* Aviso: sin conexión GHL */}
          {avisoNoConectado && !conectado && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-warning-500/40 bg-warning-500/10 px-4 py-3 text-body-sm text-warning-700">
              <span className="flex items-center gap-2">
                <AlertTriangle size={18} className="shrink-0" />
                Primero conecta tu cuenta de Dmaia CRM en Configuración.
              </span>
              <Link href="/configuracion" className="shrink-0 font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2">
                Ir a Configuración
              </Link>
            </div>
          )}

          {/* Aviso: la última importación trajo contactos sin RNC */}
          {sinRncCount !== null && sinRncCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning-500/40 bg-warning-500/10 px-4 py-3 text-body-sm text-text-secondary">
              <span>{sinRncCount} contacto(s) se importaron sin RNC. Complétalo antes de poder facturarles un E31.</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setSoloSinRnc(true); setPage(1) }}
                  className="font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2 focus:outline-none"
                >
                  Ver contactos sin RNC
                </button>
                <button type="button" onClick={() => setSinRncCount(null)} className="focus:outline-none" title="Descartar">
                  <XCircle size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap gap-[12px] items-center bg-white p-[17px] rounded-[14px] border border-[#e4e7ec] shadow-sm w-full font-sans">
            {/* Search Input */}
            <div className="relative border border-[#e2e8f0] bg-white rounded-[10px] h-[44px] flex items-center px-[12px] gap-[10px] flex-1 min-w-[150px]">
              <Search size={16} className="text-[#99a1af]" />
              <input
                type="text"
                placeholder="Buscar por cliente, RNC o e-NCF..."
                value={search}
                onChange={(e) => resetPage(setSearch)(e.target.value)}
                className="flex-1 font-['Open_Sans'] font-normal leading-[normal] text-text-primary text-[14px] placeholder-[#99a1af] bg-transparent focus:outline-none"
              />
            </div>

            {/* Tipo Selector */}
            <Select
              value={tipoFilter}
              onChange={(val) => resetPage(setTipoFilter)(val as any)}
              options={tipoOptions}
              className="w-[165px] shrink-0"
              triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50 px-[13px]"
            />

            {/* Tipo Fiscal Selector */}
            <Select
              value={tipoFiscalFilter}
              onChange={(val) => resetPage(setTipoFiscalFilter)(val)}
              options={tipoFiscalOptions}
              className="w-[140px] shrink-0"
              triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50 px-[13px]"
            />

            {/* Validación DGII Selector */}
            <Select
              value={validacionFilter}
              onChange={(val) => resetPage(setValidacionFilter)(val)}
              options={validacionOptions}
              className="w-[160px] shrink-0"
              triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50 px-[13px]"
            />

            {/* Origen Selector */}
            <Select
              value={origenFilter}
              onChange={(val) => resetPage(setOrigenFilter)(val)}
              options={origenOptions}
              className="w-[100px] shrink-0"
              triggerClassName="h-[44px] bg-white font-semibold text-[13px] hover:bg-neutral-50 px-[13px]"
            />

            {/* Date Range Picker */}
            <div className="relative w-[210px] shrink-0 bg-white border border-[#e2e8f0] rounded-[10px] h-[44px] flex items-center px-[10px]">
              {/* Visual Display */}
              <div className="flex items-center justify-between w-full text-[12px] font-sans font-normal text-[#99a1af] select-none pointer-events-none whitespace-nowrap">
                <div className="flex items-center gap-[6px]">
                  <Calendar size={14} className="text-[#99a1af] flex-shrink-0" />
                  <span className={startDate ? "text-[#333333]" : "text-[#99a1af]"}>
                    {startDate ? formatDate(startDate) : 'dd/mm/aaaa'}
                  </span>
                </div>
                <span className="text-[#99a1af] font-normal text-[16px]">–</span>
                <span className={endDate ? "text-[#333333]" : "text-[#99a1af]"}>
                  {endDate ? formatDate(endDate) : 'dd/mm/aaaa'}
                </span>
              </div>

              {/* Invisible inputs on top */}
              <div className="absolute inset-0 flex">
                <div
                  onClick={() => {
                    try {
                      startDateRef.current?.showPicker()
                    } catch (e) {
                      startDateRef.current?.focus()
                    }
                  }}
                  className="w-1/2 h-full cursor-pointer"
                />
                <div
                  onClick={() => {
                    try {
                      endDateRef.current?.showPicker()
                    } catch (e) {
                      endDateRef.current?.focus()
                    }
                  }}
                  className="w-1/2 h-full cursor-pointer"
                />
                <input
                  ref={startDateRef}
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setPage(1)
                  }}
                  className="absolute -z-10 opacity-0 invisible w-0 h-0"
                />
                <input
                  ref={endDateRef}
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setPage(1)
                  }}
                  className="absolute -z-10 opacity-0 invisible w-0 h-0"
                />
              </div>
            </div>

            {soloSinRnc && (
              <Badge variant="warning" className="h-10">
                Solo sin RNC
                <button type="button" onClick={() => setSoloSinRnc(false)} className="ml-1 focus:outline-none" title="Quitar filtro">
                  <XCircle size={14} />
                </button>
              </Badge>
            )}
          </div>

          {/* Tabla */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center p-16">
                <Spinner size={28} />
              </div>
            ) : isError ? (
              <div className="p-12 text-center text-body-sm text-danger-600">
                No pudimos cargar los contactos. Intenta refrescar.
              </div>
            ) : visibles.length === 0 ? (
              <EmptyState
                title=""
                description={
                  activeSearch || tipoFilter !== 'todos' || tipoFiscalFilter !== 'todos' || validacionFilter !== 'todos' || origenFilter !== 'todos' || startDate || endDate || soloSinRnc
                    ? 'No hay contactos que coincidan con los filtros.'
                    : 'Aún no tienes contactos. Crea uno o sincroniza desde Dmaia CRM'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body-sm table-auto border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-[#f8fafc] text-ui-sm font-semibold text-text-secondary h-10 select-none">
                      <th className={cn("p-0 text-center align-middle transition-all duration-300 ease-in-out border-b border-neutral-200 bg-[#f8fafc]", isSelectionMode ? "w-10" : "w-0")}>
                        <div className={cn(
                          "transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-center h-10 pl-4 origin-left",
                          isSelectionMode ? "w-10 opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 -translate-x-4 scale-0"
                        )}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
                            checked={visibles.length > 0 && visibles.every(c => selectedIds.has(c.id))}
                            onChange={() => {
                              const allSelected = visibles.every(c => selectedIds.has(c.id))
                              if (allSelected) {
                                setSelectedIds(prev => {
                                  const next = new Set(prev)
                                  visibles.forEach(c => next.delete(c.id))
                                  return next
                                })
                              } else {
                                setSelectedIds(prev => {
                                  const next = new Set(prev)
                                  visibles.forEach(c => next.add(c.id))
                                  return next
                                })
                              }
                            }}
                          />
                        </div>
                      </th>
                      <th className="px-4 py-3 font-medium text-[12px] text-[#64748b] w-[240px] min-w-[240px]">Nombre / Razón social</th>
                      <th className="px-4 py-3 font-medium text-[12px] text-[#64748b] w-[80px]">Tipo</th>
                      <th className="px-4 py-3 font-medium text-[12px] text-[#64748b] w-[95px]">Tipo fiscal</th>
                      <th className="px-4 py-3 font-medium text-[12px] text-[#64748b] w-[110px]">Identificacion</th>
                      <th className="px-4 py-3 font-medium text-[12px] text-[#64748b] w-[110px]">Validación</th>
                      <th className="px-4 py-3 font-medium text-[12px] text-[#64748b] w-[95px]">e-CF sugerido</th>
                      <th className="px-4 py-3 font-medium text-[12px] text-[#64748b] w-[110px]">Ultima actividad</th>
                      <th className="px-4 py-3 font-medium text-[12px] text-[#64748b] text-center w-[100px]">Estado</th>
                      <th className="px-4 py-3 font-medium text-[12px] text-[#64748b] text-right pr-6 w-[110px]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((c) => {
                      // Determine tax type label and styling
                      let taxTypeLabel = 'CF'
                      let taxTypeClass = 'bg-[#fdf2f8] text-[#9d174d] border-[#fbcfe8]'
                      if (c.identificadorExtranjero) {
                        taxTypeLabel = 'ID extranjero'
                        taxTypeClass = 'bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]'
                      } else if (c.rnc) {
                        const cleanRnc = c.rnc.replace(/\D/g, '')
                        if (cleanRnc.length === 9) {
                          taxTypeLabel = 'RNC'
                          taxTypeClass = 'bg-[#eff6ff] text-[#1e40af] border-[#bfdbfe]'
                        } else if (cleanRnc.length === 11) {
                          taxTypeLabel = 'Cédula'
                          taxTypeClass = 'bg-neutral-50 text-neutral-800 border-neutral-200'
                        }
                      }

                      // Determine type label and styling
                      let typeLabel = 'Cliente'
                      let typeClass = 'bg-neutral-50 text-neutral-800 border-neutral-200'
                      if (c.tipo === 'PROVEEDOR') {
                        typeLabel = 'Proveedor'
                        typeClass = 'bg-[#fdf2f8] text-[#9d174d] border-[#fbcfe8]'
                      } else if (c.tipo === 'CONSUMIDOR_FINAL') {
                        typeLabel = 'Ocasional'
                        typeClass = 'bg-[#f5f3ff] text-[#5b21b6] border-[#ddd6fe]'
                      }

                      // Determine suggested e-CF
                      let suggestedEcf = 'E31'
                      if (c.tipo === 'PROVEEDOR') {
                        suggestedEcf = taxTypeLabel === 'RNC' ? 'E41' : 'E42'
                      } else {
                        if (taxTypeLabel === 'CF' || taxTypeLabel === 'Cédula') {
                          suggestedEcf = 'E32'
                        } else if (taxTypeLabel === 'ID extranjero') {
                          suggestedEcf = 'E47'
                        }
                      }

                      // Format activity date
                      const activityDate = c.updatedAt || c.createdAt || new Date().toISOString()
                      const formattedActivity = formatDate(activityDate)

                      const isSelected = selectedIds.has(c.id)

                      return (
                        <tr
                          key={c.id}
                          onClick={() => {
                            if (isSelectionMode) {
                              setSelectedIds(prev => {
                                const next = new Set(prev)
                                if (next.has(c.id)) {
                                  next.delete(c.id)
                                } else {
                                  next.add(c.id)
                                }
                                return next
                              })
                            } else {
                              setSelectedContacto(c)
                            }
                          }}
                          className={cn(
                            "border-b border-neutral-200 last:border-0 hover:bg-neutral-50/30 transition-colors h-[72px] cursor-pointer",
                            isSelected ? "bg-[rgba(3,121,213,0.05)] hover:bg-[rgba(3,121,213,0.08)]" : "bg-white"
                          )}
                        >
                          <td className={cn("p-0 text-center align-middle transition-all duration-300 ease-in-out border-b border-neutral-200", isSelectionMode ? "w-10" : "w-0")} onClick={(e) => e.stopPropagation()}>
                            <div className={cn(
                              "transition-all duration-300 ease-in-out overflow-hidden flex items-center justify-center h-[72px] pl-4 origin-left",
                              isSelectionMode ? "w-10 opacity-100 translate-x-0 scale-100" : "w-0 opacity-0 -translate-x-4 scale-0"
                            )}>
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedIds(prev => {
                                    const next = new Set(prev)
                                    if (next.has(c.id)) {
                                      next.delete(c.id)
                                    } else {
                                      next.add(c.id)
                                    }
                                    return next
                                  })
                                }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 w-[240px] min-w-[240px]">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-text-secondary flex-shrink-0">
                                  {c.tipo === 'CONSUMIDOR_FINAL' ? <User size={16} /> : <Building2 size={16} />}
                                </div>
                                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-[#0f973d] ring-2 ring-white" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-semibold text-text-primary line-clamp-1">{c.razonSocial}</span>
                                <span className="text-[11px] text-text-secondary line-clamp-1">{c.tipo === 'CONSUMIDOR_FINAL' ? 'Cliente' : 'Empresa'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 w-[80px] font-semibold">
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-[6px] text-[12px] font-medium border", typeClass)}>
                              {typeLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 w-[95px]">
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-[6px] text-[12px] font-medium border", taxTypeClass)}>
                              {taxTypeLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 w-[110px] font-semibold text-text-primary">
                            {formatRnc(c.rnc)}
                          </td>
                          <td className="px-4 py-3 w-[110px]">
                            {c.rncValidado ? (
                              <div className="flex items-center gap-1.5 text-green-700 font-semibold text-[13px]">
                                <CheckCircle2 size={14} className="text-green-600" />
                                <span>Válido</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-[13px]">
                                <AlertTriangle size={14} className="text-amber-500" />
                                <span>No encontrado</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 w-[95px]">
                            <span className="inline-block bg-[rgba(100,116,139,0.1)] text-[#64748b] text-[12px] font-semibold px-2.5 py-1 rounded-[10px]">
                              {suggestedEcf}
                            </span>
                          </td>
                          <td className="px-4 py-3 w-[110px] text-text-secondary">
                            {formattedActivity}
                          </td>
                          <td className="px-4 py-3 text-center w-[100px]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleStatus(c)
                              }}
                              className="focus:outline-none"
                            >
                              {c.activo ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200/50 px-2.5 py-0.5 text-ui-xs font-semibold text-green-700 hover:bg-green-100 transition-colors">
                                  <CheckCircle2 size={11} className="text-green-600" />
                                  Activo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-50 border border-neutral-200/50 px-2.5 py-0.5 text-ui-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors">
                                  <XCircle size={11} className="text-neutral-500" />
                                  Inactivo
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-right pr-6 w-[110px]">
                            <div className="flex items-center justify-end gap-3.5">
                              <button
                                type="button"
                                title="Crear factura"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (!c.rnc && !c.identificadorExtranjero) {
                                    toast.error("Error: El RNC/Cédula es requerido para crear factura. Por favor actualice los datos del contacto.")
                                    return
                                  }
                                  router.push(`/nueva-factura?clienteId=${c.id}`)
                                }}
                                className="text-text-secondary hover:text-brand-500 transition-colors focus:outline-none"
                              >
                                <Send size={15} />
                              </button>
                              <button
                                type="button"
                                title="Editar"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingContacto(c)
                                }}
                                className="text-text-secondary hover:text-brand-500 transition-colors focus:outline-none"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                type="button"
                                title="Eliminar"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeletingContacto(c)
                                }}
                                className="text-text-secondary hover:text-danger-600 transition-colors focus:outline-none"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginación (server-side) — mismo estilo que /facturas */}
            {!isLoading && !isError && visibles.length > 0 && (
              <div className="border-[#f1f5f9] border-t flex h-[57px] items-center justify-between px-[20px] bg-white select-none">
                <p className="text-[13px] font-sans font-normal text-[#64748b]">{total} resultados</p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex h-8 w-8 items-center justify-center text-[#64748b] hover:bg-neutral-50 disabled:opacity-50 transition-colors focus:outline-none rounded-[4px]"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#0379d5] text-[13px] font-normal text-white font-sans">
                    {page}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="flex h-8 w-8 items-center justify-center text-[#64748b] hover:bg-neutral-50 disabled:opacity-50 transition-colors focus:outline-none rounded-[4px]"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className={cn(
            "transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0",
            selectedContacto ? 'w-[400px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
          )}
        >
          {selectedContacto && (
            <DetailPanel
              contacto={mappedSelectedContacto}
              onClose={() => setSelectedContacto(null)}
              onEmitirFactura={(c) => router.push(`/nueva-factura?clienteId=${c.id}`)}
              onCrearCotizacion={(c) => router.push(`/cotizaciones?clienteId=${c.id}`)}
              onRegistrarCompra={(c) => alert(`Registrar compra para ${c.nombre} (Próximamente)`)}
              onEditar={(c) => {
                const orig = visibles.find(v => v.id === c.id)
                setEditingContacto(orig || selectedContacto)
              }}
              onToggleStatus={handleToggleStatus}
            />
          )}
        </div>
      </div>

      <NuevoClienteModal open={openModal} onClose={() => setOpenModal(false)} onSave={crearContacto} />
      <EditarClienteModal
        open={!!editingContacto}
        contacto={editingContacto}
        onClose={() => setEditingContacto(null)}
        onSave={handleEditSave}
      />
      <SincronizarGhlModal
        open={ghlModalOpen}
        onClose={() => setGhlModalOpen(false)}
        onImported={(res) => setSinRncCount(res.sinRnc)}
      />

      <Modal
        open={togglingContacto !== null}
        onClose={() => setTogglingContacto(null)}
        title={(togglingContacto?.activo !== undefined ? togglingContacto.activo : togglingContacto?.estado === 'ACTIVO') ? 'Desactivar contacto' : 'Activar contacto'}
        subtitle=""
        icon={<AlertTriangle size={20} className="text-[#f79009]" />}
        className="max-w-[448px]"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setTogglingContacto(null)}
              className="h-10 rounded-[10px] border-[#e2e8f0] text-[#64748b] text-[13px]"
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={confirmToggleStatus}
              className="h-10 rounded-[10px] bg-[#0379D5] hover:bg-[#0262ad] text-white border-0 text-[13px]"
            >
              Confirmar
            </Button>
          </div>
        }
      >
        <div className="py-2 text-left">
          <p className="text-[14px] text-[#64748b] leading-[22px] font-sans">
            ¿Estás seguro de que deseas{' '}
            <span className="font-bold text-[#333]">
              {(togglingContacto?.activo !== undefined ? togglingContacto.activo : togglingContacto?.estado === 'ACTIVO') ? 'desactivar' : 'activar'}
            </span>{' '}
            el contacto{' '}
            <span className="font-bold text-[#333]">{togglingContacto?.razonSocial || togglingContacto?.nombre}</span>
            {togglingContacto?.rnc ? (
              <>
                {' '}
                (RNC/Cédula: <span className="font-bold text-[#333]">{formatRnc(togglingContacto.rnc)}</span>)
              </>
            ) : togglingContacto?.identificadorExtranjero ? (
              <>
                {' '}
                (ID Extranjero: <span className="font-bold text-[#333]">{togglingContacto.identificadorExtranjero}</span>)
              </>
            ) : togglingContacto?.idExtranjero ? (
              <>
                {' '}
                (ID Extranjero: <span className="font-bold text-[#333]">{togglingContacto.idExtranjero}</span>)
              </>
            ) : ''}
            ?
          </p>
        </div>
      </Modal>

      <Modal
        open={deletingContacto !== null}
        onClose={() => setDeletingContacto(null)}
        title="Eliminar contacto"
        subtitle=""
        icon={<Trash2 size={20} className="text-danger-600" />}
        className="max-w-[448px]"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setDeletingContacto(null)}
              className="h-10 rounded-[10px] border-[#e2e8f0] text-[#64748b] text-[13px]"
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={confirmDeleteContacto}
              className="h-10 rounded-[10px] bg-danger-600 hover:bg-danger-700 text-white border-0 text-[13px]"
            >
              Eliminar
            </Button>
          </div>
        }
      >
        <div className="py-2 text-left">
          <p className="text-[14px] text-[#64748b] leading-[22px] font-sans">
            ¿Estás seguro de que deseas eliminar el contacto{' '}
            <span className="font-bold text-[#333]">{deletingContacto?.razonSocial}</span>
            {deletingContacto?.rnc ? (
              <>
                {' '}
                (RNC/Cédula: <span className="font-bold text-[#333]">{formatRnc(deletingContacto.rnc)}</span>)
              </>
            ) : ''}
            ? Quedará marcado como inactivo y no volverá a aparecer en tu directorio activo.
          </p>
        </div>
      </Modal>
    </div>
  )
}
