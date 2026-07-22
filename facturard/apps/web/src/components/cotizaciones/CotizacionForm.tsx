'use client'

import React, { useState, useMemo, useId, useEffect, useRef } from 'react'
import type { JSX } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  FileText,
  Calendar,
  CreditCard,
  Eye,
  X,
  Check,
  Building2,
  User,
  ChevronRight,
  ChevronDown,
  Save
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Select } from '@/components/ui/select'
import { useContactos } from '@/hooks/useContactos'
import type { Contacto, NuevoContactoData } from '@/hooks/useContactos'
import { useProductos } from '@/hooks/useProductos'
import type { Producto, NuevoProductoData } from '@/hooks/useProductos'
import { NuevoClienteModal } from '@/components/nueva-factura/NuevoClienteModal'
import { NuevoProductoModal } from '@/components/nueva-factura/NuevoProductoModal'
import { formatCurrency, downloadCotizacionPdf } from '@/lib/comprobantes'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const ITBIS_RATES: Record<string, number> = { I1: 0.18, I2: 0.16, I3: 0, I4: 0, E: 0 }

interface ItemRow {
  key: string
  productoId?: string
  nombreItem: string
  descripcion?: string
  cantidad: number
  precioUnitarioItem: number
  indicadorFacturacion: string
}

export function CotizacionForm(): JSX.Element {
  const router = useRouter()
  const baseId = useId()

  const { contactos, crearContacto } = useContactos()
  const { allProductos, crearProducto } = useProductos({ activo: true })

  // Modals state
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [showNuevoProducto, setShowNuevoProducto] = useState(false)

  // Search dropdowns state
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const clientSearchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showClientDropdown) {
      setTimeout(() => {
        clientSearchInputRef.current?.focus()
      }, 50)
    }
  }, [showClientDropdown])

  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  // Document Info
  const [id, setId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [folio, setFolio] = useState('COT-2026-0048')
  const [vendedor] = useState('María Fernández')

  // Form Fields - Client Section
  const [selectedContacto, setSelectedContacto] = useState<Contacto | null>(null)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteRnc, setClienteRnc] = useState('')
  const [clienteCorreo, setClienteCorreo] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clienteDireccion, setClienteDireccion] = useState('')

  // Form Fields - General/Commercial Section
  const [fechaEmision, setFechaEmision] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })
  const [fechaVencimiento, setFechaVencimiento] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 15) // default 15 days
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [moneda, setMoneda] = useState('DOP')
  const [condicionPago, setCondicionPago] = useState('CONTADO')
  const [validezCotizacion, setValidezCotizacion] = useState('15')
  const [terminosCondiciones, setTerminosCondiciones] = useState('')

  // Items State
  const [items, setItems] = useState<ItemRow[]>([])

  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const cloneId = searchParams.get('cloneId')

  // Search filter for clients
  const filteredClientes = useMemo(() => {
    const q = clientSearch.toLowerCase().trim()
    if (!q) return contactos.slice(0, 5)
    return contactos.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.rnc.toLowerCase().includes(q)
    ).slice(0, 5)
  }, [contactos, clientSearch])

  // Search filter for products
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim()
    if (!q) return allProductos.slice(0, 5)
    return allProductos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q)
    )
  }, [allProductos, productSearch])

  // Fetch quotation details for editing or cloning
  useEffect(() => {
    const targetId = editId || cloneId
    if (targetId) {
      setLoading(true)
      api.get(`/cotizaciones/${targetId}`)
        .then((res) => {
          const c = res.data
          if (editId) {
            setId(c.id)
            setFolio(c.folio || 'COT-2026-0048')
          }
          
          setFechaEmision(c.createdAt ? c.createdAt.split('T')[0] : fechaEmision)
          setFechaVencimiento(c.fechaVigencia ? c.fechaVigencia.split('T')[0] : fechaVencimiento)
          setTerminosCondiciones(c.notas || '')
          
          // Items
          const backendItems = c.items || []
          const mappedItems: ItemRow[] = backendItems.map((item: any, idx: number) => ({
            key: `item-${idx}-${Date.now()}`,
            productoId: item.productoId,
            nombreItem: item.nombre || '',
            descripcion: item.descripcion,
            cantidad: Number(item.cantidad || 1),
            precioUnitarioItem: Number(item.precioUnitario || 0),
            indicadorFacturacion: item.tratamientoITBIS === 'EXENTO' ? 'E' : (item.tratamientoITBIS || 'I1')
          }))
          setItems(mappedItems)

          // Load client contact if matching
          if (c.contactoId && contactos.length > 0) {
            const match = contactos.find((con) => con.id === c.contactoId)
            if (match) {
              setSelectedContacto(match)
              setClienteNombre(match.nombre || '')
              setClienteRnc(match.rnc || '')
              setClienteCorreo(match.email || '')
              setClienteTelefono(match.telefono || '')
              setClienteDireccion(match.direccion || '')
            }
          }
        })
        .catch((err) => {
          console.error(err)
          toast.error('Error al cargar la cotización')
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [editId, cloneId, contactos])

  // Calculate Subtotal, ITBIS, and Total
  const { subtotal, itbis, total, descuento } = useMemo(() => {
    let sub = 0
    let tax = 0
    for (const item of items) {
      const base = item.cantidad * item.precioUnitarioItem
      sub += base
      tax += base * (ITBIS_RATES[item.indicadorFacturacion] ?? 0)
    }
    return {
      subtotal: sub,
      itbis: tax,
      total: sub + tax,
      descuento: 0
    }
  }, [items])

  // Select client from search dropdown
  const handleSelectClient = (c: Contacto) => {
    setSelectedContacto(c)
    setClienteNombre(c.nombre || '')
    setClienteRnc(c.rnc || '')
    setClienteCorreo(c.email || '')
    setClienteTelefono(c.telefono || '')
    setClienteDireccion(c.direccion || '')
    setShowClientDropdown(false)
    setClientSearch('')
  }

  // Create new client saved successfully
  const handleSaveNuevoCliente = async (data: NuevoContactoData) => {
    try {
      const nuevo = await crearContacto(data)
      handleSelectClient(nuevo)
      toast.success('Cliente creado y seleccionado')
      setShowNuevoCliente(false)
    } catch (e) {
      toast.error('Error al guardar el cliente')
    }
  }

  // Add item from catalog
  const handleAddProduct = (p: Producto) => {
    const newItem: ItemRow = {
      key: `${baseId}-${Date.now()}`,
      productoId: p.id,
      nombreItem: p.nombre,
      cantidad: 1,
      precioUnitarioItem: p.precio,
      indicadorFacturacion: p.indicadorFacturacion
    }
    setItems([...items, newItem])
    setShowProductDropdown(false)
    setProductSearch('')
  }

  // Create and add new product successfully
  const handleSaveNuevoProducto = async (data: NuevoProductoData) => {
    try {
      const nuevo = await crearProducto(data)
      handleAddProduct(nuevo)
      toast.success('Producto creado y agregado')
      setShowNuevoProducto(false)
    } catch (e) {
      toast.error('Error al guardar el producto')
    }
  }

  // Add empty row manually
  const handleAddManualItem = () => {
    const newItem: ItemRow = {
      key: `${baseId}-${Date.now()}`,
      nombreItem: '',
      cantidad: 1,
      precioUnitarioItem: 0,
      indicadorFacturacion: 'I1'
    }
    setItems([...items, newItem])
  }

  // Update item field inline
  const handleUpdateItem = (key: string, patch: Partial<ItemRow>) => {
    setItems(
      items.map((it) => (it.key === key ? { ...it, ...patch } : it))
    )
  }

  // Remove item row
  const handleRemoveItem = (key: string) => {
    setItems(items.filter((it) => it.key !== key))
  }



  // Submit quote to DB
  const [submitting, setSubmitting] = useState(false)
  // Guardar SIEMPRE deja la cotización como BORRADOR. El envío (marcar ENVIADA) es una
  // acción aparte desde el detalle: el front no envía nada automáticamente al cliente.
  const handleSaveQuote = async () => {
    if (!clienteNombre.trim()) {
      toast.error('El nombre del cliente es obligatorio')
      return
    }

    const payload = {
      contactoId: selectedContacto?.id || undefined,
      fechaVigencia: new Date(fechaVencimiento).toISOString(),
      notas: terminosCondiciones || undefined,
      items: items.map((it) => ({
        productoId: it.productoId || undefined,
        nombre: it.nombreItem,
        descripcion: it.descripcion || undefined,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitarioItem,
        tratamientoITBIS: it.indicadorFacturacion === 'E' || it.indicadorFacturacion === 'I4' ? 'EXENTO' : it.indicadorFacturacion
      }))
    }

    setSubmitting(true)
    try {
      if (id) {
        // Edit existing
        await api.patch(`/cotizaciones/${id}`, payload)
        toast.success('Borrador de cotización actualizado')
      } else {
        // Create new (queda como BORRADOR)
        await api.post('/cotizaciones', payload)
        toast.success('Cotización guardada como borrador')
      }

      router.push('/cotizaciones')
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar la cotización')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center bg-white rounded-xl border border-neutral-200">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] flex flex-col h-[calc(100vh-140px)] min-h-0 overflow-hidden font-sans text-left">
      {/* Header and Back Button Row */}
      <div className="flex items-center gap-4 border-b border-neutral-100 pb-5 shrink-0 select-none">
        <button
          type="button"
          onClick={() => router.push('/cotizaciones')}
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors shrink-0 focus:outline-none"
        >
          <ArrowLeft size={16} className="text-[#64748b]" />
        </button>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-h4 font-bold text-[#101828] text-[22px] leading-tight">Nueva cotización</h2>
          <p className="text-[12px] text-[#64748b] leading-normal">
            {folio} · Se guarda como borrador. Podrás enviarla y descargar su PDF desde el detalle.
          </p>
        </div>
      </div>

      {/* Main 2-column scroll/fixed container */}
      <div className="flex gap-6 mt-6 flex-1 min-h-0 overflow-hidden">
        {/* Left Column (Scrollable Form) */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-12">
          
          {/* Card 1: Datos generales */}
          <Card className="p-6 flex flex-col bg-white border border-[#E2E8F0] shadow-sm rounded-[14px] gap-5 text-left">
            <h3 className="font-bold text-[#101828] text-[16px] border-b border-neutral-100 pb-3">
              Datos generales
            </h3>
            
            {/* Search client popover input and create client button */}
            <div className="flex gap-3 relative select-none">
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setShowClientDropdown(!showClientDropdown)}
                  className="flex w-full items-center justify-between gap-2 rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 text-[14px] text-text-primary cursor-pointer hover:border-brand-500 transition-all min-w-0 h-[44px] select-none shadow-sm"
                >
                  <div className="flex items-center gap-2 min-w-0 font-normal">
                    <User size={16} className="text-[#64748B] flex-shrink-0" />
                    <span className="truncate">{clienteNombre ? `${clienteNombre} (${clienteRnc})` : 'Seleccionar cliente...'}</span>
                  </div>
                  <ChevronDown size={16} className="text-[#64748B] flex-shrink-0" />
                </button>
                {showClientDropdown && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowClientDropdown(false)} />
                    <div className="absolute left-0 mt-1.5 max-h-[400px] w-full overflow-hidden rounded-[14px] border border-neutral-100 bg-white shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] z-40 flex flex-col p-0 animate-in fade-in-50 duration-150">
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
                            className="w-full text-[14px] focus:outline-none border-none p-0 text-[#333333] placeholder:text-[#99A1AF] bg-transparent"
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
                      <div className="overflow-y-auto max-h-[349px] flex flex-col w-full py-1">
                        {filteredClientes.length === 0 ? (
                          <div className="px-4 py-4 text-center text-ui-sm text-text-secondary">
                            No se encontraron clientes
                          </div>
                        ) : (
                          filteredClientes.map((c) => {
                            const isSelected = selectedContacto?.id === c.id
                            const isCompany = c.rnc.length === 9 || c.rnc.startsWith('1')
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleSelectClient(c)}
                                className={cn(
                                  "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors focus:bg-[#F0F5FF] focus:outline-none h-[67px] border-b border-[#F3F4F6] last:border-none flex-shrink-0 cursor-pointer",
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
                                    <span className="text-[14px] font-semibold text-[#333333] leading-5 truncate">
                                      {c.nombre}
                                    </span>
                                    <span className="text-[12px] font-normal text-[#99A1AF] leading-[18px] mt-0.5">
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
              <button
                type="button"
                onClick={() => setShowNuevoCliente(true)}
                className="bg-[#0379d5] hover:bg-[#0262ad] h-[44px] px-4 rounded-[10px] text-white text-[13px] font-semibold flex items-center gap-2 transition-colors shrink-0 shadow-sm cursor-pointer"
              >
                <Plus size={16} />
                <span>Nuevo Cliente</span>
              </button>
            </div>

            {/* Form grid */}
            <div className="flex flex-col gap-4">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                Identificación del documento
              </span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#344054]">Cliente *</label>
                  <input
                    type="text"
                    placeholder="Nombre o razón social"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    className="border border-[#E2E8F0] rounded-[10px] h-[44px] px-3.5 text-[14px] bg-white focus:outline-none focus:border-brand-500 transition-colors w-full"
                  />
                </div>
                {/* RNC */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#344054]">RNC / Cédula</label>
                  <input
                    type="text"
                    placeholder="000-0000000-0"
                    value={clienteRnc}
                    onChange={(e) => setClienteRnc(e.target.value)}
                    className="border border-[#E2E8F0] rounded-[10px] h-[44px] px-3.5 text-[14px] bg-white focus:outline-none focus:border-brand-500 transition-colors w-full"
                  />
                </div>
                {/* Correo */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#344054]">Correo</label>
                  <input
                    type="email"
                    placeholder="cliente@correo.com"
                    value={clienteCorreo}
                    onChange={(e) => setClienteCorreo(e.target.value)}
                    className="border border-[#E2E8F0] rounded-[10px] h-[44px] px-3.5 text-[14px] bg-white focus:outline-none focus:border-brand-500 transition-colors w-full"
                  />
                </div>
                {/* Telefono */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#344054]">Teléfono</label>
                  <input
                    type="text"
                    placeholder="809-000-0000"
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                    className="border border-[#E2E8F0] rounded-[10px] h-[44px] px-3.5 text-[14px] bg-white focus:outline-none focus:border-brand-500 transition-colors w-full"
                  />
                </div>
                {/* Direccion */}
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-[11px] font-semibold text-[#344054]">Dirección</label>
                  <input
                    type="text"
                    placeholder="Calle / sector / ciudad"
                    value={clienteDireccion}
                    onChange={(e) => setClienteDireccion(e.target.value)}
                    className="border border-[#E2E8F0] rounded-[10px] h-[44px] px-3.5 text-[14px] bg-white focus:outline-none focus:border-brand-500 transition-colors w-full"
                  />
                </div>
                {/* Cotizacion Number */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#344054]">Número de cotización</label>
                  <input
                    type="text"
                    disabled
                    value={folio}
                    className="border border-[#E2E8F0] rounded-[10px] h-[44px] px-3.5 text-[14px] bg-neutral-50 text-text-secondary cursor-not-allowed w-full"
                  />
                </div>
                {/* Vendedor */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#344054]">Vendedor</label>
                  <input
                    type="text"
                    disabled
                    value={vendedor}
                    className="border border-[#E2E8F0] rounded-[10px] h-[44px] px-3.5 text-[14px] bg-neutral-50 text-text-secondary cursor-not-allowed w-full"
                  />
                </div>
                {/* Fecha Emision */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#344054]">Fecha de emisión</label>
                  <input
                    type="date"
                    value={fechaEmision}
                    onChange={(e) => setFechaEmision(e.target.value)}
                    className="border border-[#E2E8F0] rounded-[10px] h-[44px] px-3.5 text-[14px] bg-white focus:outline-none focus:border-brand-500 transition-colors w-full"
                  />
                </div>
                {/* Fecha Vencimiento */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#344054]">Fecha de vencimiento</label>
                  <input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    className="border border-[#E2E8F0] rounded-[10px] h-[44px] px-3.5 text-[14px] bg-white focus:outline-none focus:border-brand-500 transition-colors w-full"
                  />
                </div>
                {/* Moneda */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#344054]">Moneda</label>
                  <Select
                    value={moneda}
                    onChange={setMoneda}
                    options={[
                      { value: 'DOP', label: 'DOP - Peso dominicano' },
                      { value: 'USD', label: 'USD - Dólar estadounidense' }
                    ]}
                    triggerClassName="h-[44px] bg-white text-[13px] border border-[#E2E8F0]"
                  />
                </div>
                {/* Condicion Pago */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#344054]">Condición de pago</label>
                  <Select
                    value={condicionPago}
                    onChange={setCondicionPago}
                    options={[
                      { value: 'CONTADO', label: 'Contado' },
                      { value: 'CREDITO', label: 'Crédito' }
                    ]}
                    triggerClassName="h-[44px] bg-white text-[13px] border border-[#E2E8F0]"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2: Productos o servicios */}
          <Card className="p-6 flex flex-col bg-white border border-[#E2E8F0] shadow-sm rounded-[14px] gap-5 text-left">
            <h3 className="font-bold text-[#101828] text-[16px] border-b border-neutral-100 pb-3">
              Productos o servicios
            </h3>

            {/* Search products and new product button */}
            <div className="flex gap-3 relative select-none">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o código..."
                  value={productSearch}
                  onFocus={() => setShowProductDropdown(true)}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-[10px] h-[44px] pl-10 pr-4 text-[14px] focus:outline-none focus:border-brand-500 transition-colors bg-white"
                />

                {showProductDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowProductDropdown(false)} />
                    <div className="absolute left-0 mt-1.5 max-h-[248px] w-full overflow-y-auto rounded-[14px] border border-neutral-100 bg-white shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] py-0 z-20 animate-in fade-in-50 duration-150">
                      {filteredProducts.slice(0, 5).map((p) => {
                        const hasTax = p.indicadorFacturacion === 'I1' || p.indicadorFacturacion === 'I2'
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              handleAddProduct(p)
                            }}
                            className="flex w-full min-h-[58px] h-auto items-center justify-between gap-3 px-4 py-2 text-left border-b border-neutral-50 last:border-none bg-white hover:bg-[#F0F5FF] transition-colors focus:bg-[#F0F5FF] focus:outline-none cursor-pointer"
                          >
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-[15px] font-semibold text-[#333333] leading-5 truncate" title={p.nombre}>{p.nombre}</span>
                              <span className="text-[12px] font-medium text-[#99A1AF] leading-[18px] truncate">{p.codigo}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[16px] font-semibold text-[#333333] leading-6">{formatCurrency(p.precio)}</span>
                              {hasTax && (
                                <div className="flex items-center justify-center w-[40px] h-[20px] bg-[#FFFBEB] rounded-[4px] relative">
                                  <span className="text-[11px] font-semibold text-[#E17100] leading-none">ITBIS</span>
                                </div>
                              )}
                              <Plus size={16} className="text-[#0379D5] stroke-[2.5]" />
                            </div>
                          </button>
                        )
                      })}
                      {filteredProducts.length === 0 && (
                        <div className="px-4 py-4 text-center text-body-sm text-text-secondary bg-white">
                          No se encontraron productos
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowNuevoProducto(true)}
                className="bg-[#0379d5] hover:bg-[#0262ad] h-[44px] px-4 rounded-[10px] text-white text-[13px] font-semibold flex items-center gap-2 transition-colors shrink-0 shadow-sm cursor-pointer"
              >
                <Plus size={16} />
                <span>Nuevo Producto</span>
              </button>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto border border-neutral-200 rounded-xl overflow-hidden mt-2">
              <table className="w-full text-left text-body-sm min-w-[600px]">
                <thead>
                  <tr className="bg-neutral-50/50 text-[12px] font-semibold text-[#475467] border-b border-[#e2e8f0] h-10">
                    <th className="px-4 py-2 font-semibold w-[45%]">Producto</th>
                    <th className="px-4 py-2 font-semibold w-[15%]">Cant.</th>
                    <th className="px-4 py-2 font-semibold w-[18%]">Precio</th>
                    <th className="px-4 py-2 font-semibold w-[12%]">ITBIS</th>
                    <th className="px-4 py-2 font-semibold w-[10%] text-right pr-6">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const rowTotal = item.cantidad * item.precioUnitarioItem * (1 + (ITBIS_RATES[item.indicadorFacturacion] ?? 0))
                    return (
                      <tr key={item.key} className="border-b border-[#f1f5f9] last:border-0 hover:bg-neutral-50/20">
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={item.nombreItem}
                            onChange={(e) => handleUpdateItem(item.key, { nombreItem: e.target.value })}
                            className="w-full bg-transparent font-semibold text-[13px] text-text-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 rounded px-1 py-0.5 border-none"
                            placeholder="Nombre del servicio o bien"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => handleUpdateItem(item.key, { cantidad: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                            className="w-16 bg-transparent text-[13px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 rounded px-1.5 py-0.5 border border-neutral-200 text-center"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[12px] text-text-secondary">RD$</span>
                            <input
                              type="number"
                              value={item.precioUnitarioItem}
                              onChange={(e) => handleUpdateItem(item.key, { precioUnitarioItem: Math.max(0, parseFloat(e.target.value) || 0) })}
                              className="w-24 bg-transparent text-[13px] font-semibold text-text-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 rounded px-1.5 py-0.5 border border-neutral-200"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-text-secondary text-[12px] font-semibold">
                          <select
                            value={item.indicadorFacturacion}
                            onChange={(e) => handleUpdateItem(item.key, { indicadorFacturacion: e.target.value })}
                            className="bg-transparent border border-neutral-200 rounded px-1 py-0.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                          >
                            <option value="I1">18%</option>
                            <option value="I2">16%</option>
                            <option value="I3">0%</option>
                            <option value="I4">Exento</option>
                            <option value="E">Exento</option>
                          </select>
                        </td>
                        <td className="px-4 py-2.5 text-right pr-6">
                          <div className="flex items-center justify-end gap-2.5">
                            <span className="font-bold text-text-primary text-[13px]">
                              {formatCurrency(rowTotal)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.key)}
                              className="text-neutral-400 hover:text-red-600 transition-colors focus:outline-none shrink-0 cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-ui-sm text-text-secondary">
                        No hay productos agregados. Usa el buscador superior para agregar productos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Add manual item link/button */}
            <div className="flex justify-start select-none">
              <button
                type="button"
                onClick={handleAddManualItem}
                className="text-[#0379d5] hover:text-[#0262ad] text-[13px] font-semibold flex items-center gap-1 transition-colors focus:outline-none cursor-pointer"
              >
                <Plus size={14} />
                <span>Agregar ítem personalizado</span>
              </button>
            </div>
          </Card>

          {/* Card 3: Condiciones comerciales */}
          <Card className="p-6 flex flex-col bg-white border border-[#E2E8F0] shadow-sm rounded-[14px] gap-5 text-left">
            <h3 className="font-bold text-[#101828] text-[16px] border-b border-neutral-100 pb-3">
              Condiciones comerciales
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              {/* Validez */}
              <div className="flex flex-col gap-1 w-full md:w-1/2">
                <label className="text-[11px] font-semibold text-[#344054]">Validez de la cotización</label>
                <Select
                  value={validezCotizacion}
                  onChange={setValidezCotizacion}
                  options={[
                    { value: '7', label: '7 días' },
                    { value: '15', label: '15 días' },
                    { value: '30', label: '30 días' },
                    { value: '45', label: '45 días' },
                    { value: '60', label: '60 días' }
                  ]}
                  triggerClassName="h-[44px] bg-white text-[13px] border border-[#E2E8F0]"
                />
              </div>

              {/* Terminos */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-[#344054]">Términos y condiciones</label>
                <textarea
                  rows={3}
                  value={terminosCondiciones}
                  onChange={(e) => setTerminosCondiciones(e.target.value)}
                  placeholder="Condiciones de pago, entrega, garantías..."
                  className="border border-[#E2E8F0] rounded-[10px] p-3 text-[14px] focus:outline-none focus:border-brand-500 transition-colors w-full resize-none bg-white font-sans"
                />
              </div>

            </div>
          </Card>



        </div>

        {/* Right Column (Fixed Resumen) */}
        <div className="w-[310px] [@media(min-width:1201px)]:w-[360px] shrink-0 sticky top-0 h-fit transition-all duration-300">
          <Card className="flex flex-col bg-white border border-[#E2E8F0] rounded-[14px] shadow-sm p-[21px] gap-[16px] relative text-left">
            {/* Header */}
            <div className="flex items-center justify-between w-full select-none">
              <div className="flex items-center gap-[8px]">
                <FileText size={20} className="text-[#333333]" />
                <span className="font-semibold text-[#333333] text-[16px]">
                  Resumen
                </span>
              </div>
            </div>

            {/* Metadata info */}
            <div className="flex flex-col gap-[8px] items-start w-full select-none">
              {/* Date */}
              <div className="flex items-center gap-[8px] text-[#64748B] text-[13px]">
                <Calendar size={16} className="text-[#64748B] flex-shrink-0" />
                <span>Fecha: 18 jun de 2026</span>
              </div>
              {/* Pay Cond */}
              <div className="flex items-center gap-[8px] text-[#64748B] text-[13px]">
                <CreditCard size={16} className="text-[#64748B] flex-shrink-0" />
                <span className="truncate">
                  {condicionPago === 'CREDITO' ? 'Crédito' : 'Contado'}
                </span>
              </div>
            </div>

            <hr className="border-[#E2E8F0] my-0" />

            {/* Client Info */}
            <div className="flex flex-col gap-[4px] items-start w-full text-left font-sans select-none">
              <p className="font-semibold text-[#374B6A] text-[12px] truncate w-full">
                {clienteNombre || 'Consumidor Final'}
              </p>
              <p className="font-normal text-[#7A8FAD] text-[11px] truncate w-full">
                {clienteRnc ? `RNC: ${clienteRnc}` : 'RNC: -'}
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

            {/* Totals Summary */}
            <div className="flex flex-col gap-[8px] w-full text-[13px] text-[#64748B] select-none">
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
            </div>

            <hr className="border-[#E2E8F0] my-0" />

            {/* Total */}
            <div className="flex flex-col gap-[24px] w-full select-none">
              <div className="flex items-center justify-between w-full font-bold text-[#333333] text-[18px]">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-[8px] w-full">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveQuote()}
                  className="w-full h-[44px] rounded-[10px] bg-[#0379D5] text-white text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-[#0262ad] transition-colors shadow-sm focus:outline-none cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <Spinner size={18} className="text-white" />
                  ) : (
                    <>
                      <Save size={15} />
                      <span>{id ? 'Guardar cambios' : 'Guardar cotización'}</span>
                    </>
                  )}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveQuote()}
                    disabled={submitting}
                    className="w-full h-[40px] rounded-[10px] border border-neutral-200 bg-white text-text-primary text-[14px] font-semibold flex items-center justify-center gap-1.5 hover:bg-neutral-50 transition-colors focus:outline-none cursor-pointer disabled:opacity-50"
                  >
                    <Save size={15} className="text-[#64748B]" />
                    <span>Borrador</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/cotizaciones')}
                    className="w-full h-[40px] rounded-[10px] border border-neutral-200 bg-white text-text-primary text-[14px] font-semibold flex items-center justify-center hover:bg-neutral-50 transition-colors focus:outline-none cursor-pointer"
                  >
                    <span>Cancelar</span>
                  </button>
                </div>
              </div>

              {/* Info text */}
              <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 text-[11px] text-[#64748b] leading-normal text-left">
                Se guarda como borrador. Podrás marcarla como enviada y descargar su PDF desde el
                detalle de la cotización.
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <NuevoClienteModal
        open={showNuevoCliente}
        onClose={() => setShowNuevoCliente(false)}
        onSave={handleSaveNuevoCliente}
      />
      <NuevoProductoModal
        open={showNuevoProducto}
        onClose={() => setShowNuevoProducto(false)}
        onSave={handleSaveNuevoProducto}
      />
    </div>
  )
}
