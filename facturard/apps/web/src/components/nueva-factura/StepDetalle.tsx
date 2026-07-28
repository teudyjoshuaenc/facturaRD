import { useState, useMemo, useId, useEffect } from 'react'
import type { JSX } from 'react'
import { Plus, Trash2, Pencil, ChevronRight, ChevronLeft, Package, Search, Wrench } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NuevoProductoModal } from './NuevoProductoModal'
import { EditarProductoModal } from '@/components/producto/EditarProductoModal'
import { useProductos } from '@/hooks/useProductos'
import type { Producto, NuevoProductoData } from '@/hooks/useProductos'
import { formatCurrency } from '@/lib/comprobantes'
import type { ItemRow, TipoECF } from '@/hooks/useNuevaFactura'
import { cn } from '@/lib/utils'

const ITBIS_RATES: Record<string, number> = { I1: 0.18, I2: 0.16, I3: 0, I4: 0, E: 0 }
const ITBIS_LABELS: Record<string, string> = { I1: '18%', I2: '16%', I3: '0%', I4: 'Exento', E: 'Exento' }

const UNIDADES_MEDIDA_MAP: Record<number, string> = {
  1: 'Barril', 2: 'Bolsa', 3: 'Bote', 4: 'Bultos', 5: 'Botella', 6: 'Caja/Cajón',
  7: 'Cajetilla', 8: 'Centímetro', 9: 'Cilindro', 10: 'Conjunto', 11: 'Contenedor',
  12: 'Día', 13: 'Docena', 14: 'Fardo', 15: 'Galones', 16: 'Grado', 17: 'Gramo',
  18: 'Granel', 19: 'Hora', 20: 'Huacal', 21: 'Kilogramo', 22: 'Kilovatio Hora',
  23: 'Libra', 24: 'Litro', 25: 'Lote', 26: 'Metro', 27: 'Metro Cuadrado',
  28: 'Metro Cúbico', 29: 'Millones de Unidades Térmicas', 30: 'Minuto',
  31: 'Paquete', 32: 'Par', 33: 'Pie', 34: 'Pieza', 35: 'Rollo', 36: 'Sobre',
  37: 'Segundo', 38: 'Tanque', 39: 'Tonelada', 40: 'Tubo', 41: 'Yarda',
  42: 'Yarda cuadrada', 43: 'Unidad', 44: 'Elemento', 45: 'Millar', 46: 'Saco',
  47: 'Lata', 48: 'Display', 49: 'Bidón', 50: 'Ración', 51: 'Quintal',
  52: 'Toneladas de registro bruto', 53: 'Pie Cuadrado', 54: 'Pasajero',
  55: 'Pulgadas', 56: 'Parqueo Barcos En Muelle', 57: 'Bandeja', 58: 'Servicio'
}

interface StepDetalleProps {
  items: ItemRow[]
  onItemsChange: (items: ItemRow[]) => void
  notas: string
  onNotasChange: (notas: string) => void
  onNext: () => void
  onBack: () => void
  isQuickMode?: boolean
  tipoECF?: TipoECF | undefined
}

export function StepDetalle({
  items,
  onItemsChange,
  notas,
  onNotasChange,
  onNext,
  onBack,
  isQuickMode,
  tipoECF,
}: StepDetalleProps): JSX.Element {
  const baseId = useId()
  // Selector de emisión: sólo productos activos (no se factura con productos dados de baja).
  const { allProductos, crearProducto } = useProductos({ activo: true })
  const [showNuevoProducto, setShowNuevoProducto] = useState(false)
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [productFocused, setProductFocused] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        document.getElementById('producto-search-input')?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Lista para el dropdown: sin texto muestra todos los productos activos permitidos
  // por el tipo e-CF; con texto filtra por nombre/código. El tope se aplica al render.
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim()
    const isExemptOnly = tipoECF && ['E41', 'E43', 'E44', 'E47'].includes(tipoECF)
    return allProductos.filter((p) => {
      if (isExemptOnly && p.indicadorFacturacion !== 'E' && p.indicadorFacturacion !== 'I4') {
        return false
      }
      if (!q) return true
      return (
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q)
      )
    })
  }, [allProductos, productSearch, tipoECF])

  function addFromProduct(p: Producto): void {
    const newItem: ItemRow = {
      key: `${baseId}-${Date.now()}`,
      nombreItem: p.nombre,
      cantidad: 1,
      precioUnitarioItem: p.precio,
      indicadorFacturacion: p.indicadorFacturacion,
      indicadorBienoServicio: p.tipo === 'BIEN' ? 1 : 2,
      ...(p.unidadMedida && { unidadMedida: p.unidadMedida }),
      ...(p.descuento && { descuento: p.descuento }),
      ...(p.itbisRetenido && { itbisRetenido: p.itbisRetenido }),
      ...(p.isrRetenido && { isrRetenido: p.isrRetenido }),
    }
    onItemsChange([...items, newItem])
  }

  function updateItem(key: string, patch: any): void {
    onItemsChange(
      items.map((item) => {
        if (item.key === key) {
          const res = { ...item, ...patch }
          if (patch.descuento === undefined) {
            delete res.descuento
          }
          if (patch.itbisRetenido === undefined) {
            delete res.itbisRetenido
          }
          if (patch.isrRetenido === undefined) {
            delete res.isrRetenido
          }
          return res
        }
        return item
      })
    )
  }

  function removeItem(key: string): void {
    onItemsChange(items.filter((item) => item.key !== key))
  }

  // Mismo modal de edición de /producto: se le da forma de Producto al item de la
  // factura (no hay llamada a la API, es sólo el estado local del formulario).
  const editingItem = items.find((item) => item.key === editingItemKey) ?? null
  const editingAsProducto = editingItem
    ? {
        id: editingItem.key,
        nombre: editingItem.nombreItem,
        tipo: (editingItem.indicadorBienoServicio === 1 ? 'BIEN' : 'SERVICIO') as 'BIEN' | 'SERVICIO',
        codigo: '',
        precio: editingItem.precioUnitarioItem,
        indicadorFacturacion: editingItem.indicadorFacturacion,
        precioFinal: editingItem.precioUnitarioItem,
        estado: 'ACTIVO',
      }
    : null

  function handleEditItem(key: string, data: any): void {
    updateItem(key, {
      nombreItem: data.nombre,
      indicadorBienoServicio: data.tipo === 'BIEN' ? 1 : 2,
      precioUnitarioItem: data.precio,
      indicadorFacturacion: data.indicadorFacturacion,
      ...(data.unidadMedida !== undefined && { unidadMedida: data.unidadMedida }),
    })
  }

  async function handleNuevoProducto(data: NuevoProductoData): Promise<void> {
    try {
      const nuevo = await crearProducto(data)
      addFromProduct(nuevo)
    } catch (e) {
      console.error(e)
    }
  }

  const hasValidItems = items.length > 0 && items.every(
    (i) => i.nombreItem.trim().length > 0 && i.cantidad > 0 && i.precioUnitarioItem > 0,
  )

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Products catalog & search */}
        <div className="flex flex-col gap-4">
          {!isQuickMode && <h3 className="text-[18px] font-semibold text-[#333333] leading-[27px] font-sans text-left">Detalle de Factura</h3>}

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary z-50" />
              <input
                id="producto-search-input"
                type="text"
                placeholder={isQuickMode ? "Buscar o agregar producto... (ej: arroz, café, cerveza)" : "Buscar por nombre o NNC..."}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onFocus={() => setProductFocused(true)}
                className={cn(
                  "relative z-50 h-10 w-full rounded-lg border border-neutral-300 bg-white pl-10 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20",
                  isQuickMode ? "pr-12" : "pr-4"
                )}
              />
              {isQuickMode && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded border border-neutral-300 bg-neutral-100 text-[10px] font-bold text-text-secondary select-none">
                  /
                </div>
              )}

              {/* Backdrop para cerrar al hacer click fuera */}
              {productFocused && (
                <div className="fixed inset-0 z-40" onClick={() => setProductFocused(false)} />
              )}

              {/* Dropdown: se abre al enfocar; tope de productos activos, filtra al teclear */}
              {productFocused && (
                <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-[248px] w-full overflow-y-auto rounded-[14px] border border-neutral-100 bg-white shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] py-0 animate-in fade-in-50 duration-150">
                  {filteredProducts.slice(0, 15).map((p) => {
                    const hasTax = p.indicadorFacturacion === 'I1' || p.indicadorFacturacion === 'I2'
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          addFromProduct(p)
                          setProductSearch('')
                          setProductFocused(false)
                        }}
                        className="flex w-full min-h-[58px] h-auto items-center justify-between gap-3 px-4 py-2 text-left border-b border-neutral-50 last:border-none bg-white hover:bg-[#F0F5FF] transition-colors focus:bg-[#F0F5FF] focus:outline-none"
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
                    <div className="px-4 py-4 text-center text-body-sm text-text-secondary">
                      {productSearch.trim().length > 0 ? 'No se encontraron productos' : 'No tienes productos activos todavía'}
                    </div>
                  )}
                </div>
              )}
            </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowNuevoProducto(true)}
            className="h-10 px-4 whitespace-nowrap flex items-center justify-center gap-1.5"
          >
            <Plus size={16} />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Items table */}
      <div className="flex flex-col gap-4 pt-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center bg-white rounded-xl border border-neutral-200">
            <Package size={24} className="text-text-secondary" />
            <p className="text-body-sm text-text-secondary">
              Agrega productos desde el buscador o crea uno nuevo
            </p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[360px] bg-white rounded-xl border border-neutral-200/60 shadow-sm animate-in fade-in-50 duration-200">
            <table className="w-full text-left text-body-sm border-collapse">
              <thead className="sticky top-0 bg-neutral-50 z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                <tr className="text-[11px] uppercase tracking-wider text-text-secondary bg-neutral-50 border-b border-neutral-100 select-none">
                  <th className="py-3 px-4 font-semibold text-text-secondary min-w-[240px] max-w-[320px]">Producto</th>
                  <th className="py-3 px-4 font-semibold text-text-secondary">Unidad de Medida</th>
                  <th className="py-3 px-4 font-semibold text-text-secondary text-center">Bien o Servicio</th>
                  <th className={cn("py-3 px-4 font-semibold text-text-secondary", isQuickMode ? "w-28 text-center" : "w-24")}>Cant.</th>
                  <th className="py-3 px-4 font-semibold text-text-secondary text-right w-28">Precio</th>
                  <th className="py-3 px-4 font-semibold text-text-secondary text-center w-20">ITBIS</th>
                  {!isQuickMode && tipoECF !== 'E43' && tipoECF !== 'E47' && <th className="py-3 px-4 font-semibold text-text-secondary text-center w-24">Descuento</th>}
                  {!isQuickMode && <th className="py-3 px-4 font-semibold text-text-secondary text-right w-24">ITBIS Ret.</th>}
                  {!isQuickMode && <th className="py-3 px-4 font-semibold text-text-secondary text-right w-24">ISR Ret.</th>}
                  <th className="py-3 px-4 font-semibold text-text-secondary text-right w-32">Total</th>
                  <th className="py-3 px-4 w-20" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const monto = item.cantidad * item.precioUnitarioItem
                  const itbisPercent = ITBIS_LABELS[item.indicadorFacturacion] ?? '0%'
                  const desc = item.descuento ?? 0
                  const baseNet = Math.max(0, monto - desc)
                  const itemItbis = baseNet * (ITBIS_RATES[item.indicadorFacturacion] ?? 0)
                  const retItbis = item.itbisRetenido ?? 0
                  const retIsr = item.isrRetenido ?? 0
                  const totalRow = Math.max(0, baseNet + itemItbis - retItbis - retIsr)

                  return (
                    <tr key={item.key} className="border-t border-neutral-100 hover:bg-neutral-50/40">
                      <td className="py-3.5 px-4 font-semibold text-text-primary max-w-[280px]">
                        <span className="block truncate" title={item.nombreItem}>{item.nombreItem}</span>
                      </td>
                      <td className="py-3.5 px-4 text-text-secondary font-medium">
                        {UNIDADES_MEDIDA_MAP[item.unidadMedida ?? 43] ?? 'Unidad'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {item.indicadorBienoServicio === 1 ? (
                          <Package size={16} className="text-[#64748B] mx-auto" />
                        ) : (
                          <Wrench size={16} className="text-[#64748B] mx-auto" />
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {isQuickMode ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateItem(item.key, { cantidad: Math.max(1, item.cantidad - 1) })}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 hover:bg-neutral-200 text-text-primary font-bold transition-colors select-none"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-body-sm font-semibold text-text-primary">
                              {item.cantidad}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateItem(item.key, { cantidad: item.cantidad + 1 })}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 hover:bg-neutral-200 text-text-primary font-bold transition-colors select-none"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={1}
                            step="any"
                            className="w-16 rounded-lg border border-neutral-300 px-2 py-1.5 text-body-sm text-center font-medium focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
                            value={item.cantidad}
                            onChange={(e) => updateItem(item.key, { cantidad: Number(e.target.value) })}
                          />
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-text-secondary">
                        {formatCurrency(item.precioUnitarioItem)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-medium text-text-secondary">
                        {itbisPercent}
                      </td>
                      {!isQuickMode && tipoECF !== 'E43' && tipoECF !== 'E47' && (
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            placeholder="0.00"
                            className="w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-body-sm text-center font-medium focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
                            value={item.descuento !== undefined ? item.descuento : ''}
                            onChange={(e) => updateItem(item.key, { descuento: e.target.value ? Number(e.target.value) : undefined })}
                          />
                        </td>
                      )}
                      {!isQuickMode && (
                        <td className="py-3.5 px-4 text-right font-semibold text-text-secondary">
                          {tipoECF === 'E41' ? (
                            <input
                              type="number"
                              min={0}
                              step="any"
                              placeholder="0.00"
                              className="ml-auto w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-body-sm text-center font-medium focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
                              value={item.itbisRetenido !== undefined ? item.itbisRetenido : ''}
                              onChange={(e) => updateItem(item.key, { itbisRetenido: e.target.value ? Number(e.target.value) : undefined })}
                            />
                          ) : (
                            formatCurrency(item.itbisRetenido ?? 0)
                          )}
                        </td>
                      )}
                      {!isQuickMode && (
                        <td className="py-3.5 px-4 text-right font-semibold text-text-secondary">
                          {tipoECF === 'E47' ? (
                            <input
                              type="number"
                              min={0}
                              step="any"
                              placeholder="0.00"
                              className="ml-auto w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-body-sm text-center font-medium focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
                              value={item.isrRetenido !== undefined ? item.isrRetenido : ''}
                              onChange={(e) => updateItem(item.key, { isrRetenido: e.target.value ? Number(e.target.value) : undefined })}
                            />
                          ) : (
                            formatCurrency(item.isrRetenido ?? 0)
                          )}
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-right font-semibold text-text-primary">
                        {formatCurrency(totalRow)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => setEditingItemKey(item.key)}
                            className="text-text-secondary hover:text-brand-500 transition-colors"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.key)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <Trash2 size={18} />
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
      </div>

      {/* Notes */}
      {!isQuickMode && (
        <div className="flex flex-col gap-2">
          <label htmlFor="factura-notas" className="text-ui-sm font-semibold text-text-secondary uppercase tracking-wider">
            Notas
          </label>
          <textarea
            id="factura-notas"
            rows={3}
            value={notas}
            onChange={(e) => onNotasChange(e.target.value)}
            placeholder="Escribe notas o comentarios adicionales de la factura..."
            className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-body-sm text-text-primary focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-inner"
          />
        </div>
      )}

      {/* Navigation */}
      {!isQuickMode && (
        <div className="flex items-center gap-[24px] w-full max-w-[904px] h-[48px] select-none">
          <Button
            variant="secondary"
            size="lg"
            onClick={onBack}
            className="w-[114px] h-[48px] rounded-[14px] border border-[#F5F5F5] text-black font-normal text-[16px] font-sans hover:bg-neutral-50"
          >
            Atrás
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={!hasValidItems}
            onClick={onNext}
            className="flex-1 h-[48px] rounded-[14px] bg-[#0379D5] hover:bg-[#0379D5]/90 text-[16px] font-normal text-white font-sans flex items-center justify-center gap-2"
          >
            <span>siguiente</span>
            <ChevronRight size={16} className="text-white" />
          </Button>
        </div>
      )}
    </div >

      <NuevoProductoModal
        open={showNuevoProducto}
        onClose={() => setShowNuevoProducto(false)}
        onSave={handleNuevoProducto}
        tipoECF={tipoECF}
      />

      <EditarProductoModal
        open={editingItemKey !== null}
        producto={editingAsProducto}
        onClose={() => setEditingItemKey(null)}
        onSave={handleEditItem}
      />
    </>
  )
}
