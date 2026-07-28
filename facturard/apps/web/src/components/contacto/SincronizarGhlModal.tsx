'use client'

import { useEffect, useState, type JSX } from 'react'
import { Search, ChevronLeft, ChevronRight, Building2, User, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { useGhlBuscar, type GhlCursor, type GhlContactoResumen } from '@/hooks/useGhlBuscar'
import { useGhlSync } from '@/hooks/useGhlSync'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

interface SincronizarGhlModalProps {
  open: boolean
  onClose: () => void
  onImported?: (res: { importados: number; actualizados: number; sinRnc: number }) => void
}

function formatRnc(rnc: string | null): string {
  if (!rnc) return '—'
  const clean = rnc.replace(/\D/g, '')
  if (clean.length === 9) return clean.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')
  return rnc
}

export function SincronizarGhlModal({ open, onClose, onImported }: SincronizarGhlModalProps): JSX.Element {
  const { sincronizar } = useGhlSync()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  // Paginación por cursor (GHL no soporta número de página): guardamos el
  // stack de cursores visitados para poder volver "Atrás".
  const [pageStack, setPageStack] = useState<(GhlCursor | null)[]>([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [mostrarImportados, setMostrarImportados] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Reset completo cada vez que se abre el modal.
  useEffect(() => {
    if (open) {
      setQuery('')
      setDebouncedQuery('')
      setPageStack([null])
      setPageIndex(0)
      setMostrarImportados(false)
      setSelectedIds(new Set())
    }
  }, [open])

  // Debounce de la búsqueda (300ms) — al cambiar, se reinicia la paginación.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    setPageStack([null])
    setPageIndex(0)
  }, [debouncedQuery])

  const cursor = pageStack[pageIndex] ?? null
  const { data, isLoading, isFetching, isError } = useGhlBuscar({ query: debouncedQuery, cursor, enabled: open })

  const contactos = data?.contactos ?? []
  const visibles = mostrarImportados ? contactos : contactos.filter((c) => !c.yaImportado)
  const seleccionables = visibles.filter((c) => !c.yaImportado)
  const allSelected = seleccionables.length > 0 && seleccionables.every((c) => selectedIds.has(c.ghlContactId))

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll(): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) seleccionables.forEach((c) => next.delete(c.ghlContactId))
      else seleccionables.forEach((c) => next.add(c.ghlContactId))
      return next
    })
  }

  function handleSiguiente(): void {
    if (!data?.nextCursor) return
    setPageStack((prev) => [...prev.slice(0, pageIndex + 1), data.nextCursor])
    setPageIndex((i) => i + 1)
  }

  function handleAnterior(): void {
    setPageIndex((i) => Math.max(0, i - 1))
  }

  async function handleImportarSeleccionados(): Promise<void> {
    try {
      const ids = Array.from(selectedIds)
      const res = await sincronizar.mutateAsync(ids)
      toast.success(`Importados: ${res.importados} · Actualizados: ${res.actualizados} · Sin RNC: ${res.sinRnc}`)
      onImported?.(res)
      onClose()
    } catch (err) {
      toast.error('Error al importar contactos', { description: getErrorMessage(err) })
    }
  }

  async function handleImportarTodos(): Promise<void> {
    try {
      const res = await sincronizar.mutateAsync(undefined)
      toast.success(`Importados: ${res.importados} · Actualizados: ${res.actualizados} · Sin RNC: ${res.sinRnc}`)
      onImported?.(res)
      onClose()
    } catch (err) {
      toast.error('No pudimos sincronizar con GoHighLevel', { description: getErrorMessage(err) })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importar contactos de GoHighLevel"
      subtitle="Busca y selecciona los contactos que quieres traer a tu directorio"
      className="max-w-[720px]"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[13px] text-[#64748b] font-sans">
            {selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="md"
              onClick={handleImportarTodos}
              disabled={sincronizar.isPending}
              className="h-10 rounded-[10px] border-[#e2e8f0] text-[#64748b] text-[13px]"
            >
              Importar todos
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleImportarSeleccionados}
              disabled={sincronizar.isPending || selectedIds.size === 0}
              className="h-10 rounded-[10px] bg-[#0379D5] hover:bg-[#0262ad] text-white border-0 text-[13px]"
            >
              Importar seleccionados
            </Button>
          </div>
        </div>
      }
    >
      {/* Buscador */}
      <div className="relative border border-[#e2e8f0] bg-white rounded-[10px] h-[44px] flex items-center px-[12px] gap-[10px] w-full">
        <Search size={16} className="text-[#99a1af] shrink-0" />
        <input
          type="text"
          placeholder="Buscar por nombre, email o teléfono..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 font-['Open_Sans'] font-normal leading-[normal] text-text-primary text-[14px] placeholder-[#99a1af] bg-transparent focus:outline-none"
        />
      </div>
      <p className="text-[11px] text-[#99a1af] font-sans -mt-3">
        La búsqueda de GoHighLevel no indexa el RNC — solo nombre, email y teléfono.
      </p>

      {/* Toggle mostrar ya importados */}
      <label className="flex items-center gap-2 text-[13px] text-[#64748b] font-sans cursor-pointer select-none -mt-1">
        <input
          type="checkbox"
          checked={mostrarImportados}
          onChange={(e) => setMostrarImportados(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
        />
        Mostrar contactos ya importados
      </label>

      {/* Lista */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-10">
            <Spinner size={24} />
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-body-sm text-danger-600">
            No pudimos buscar contactos en GoHighLevel. Intenta de nuevo.
          </div>
        ) : visibles.length === 0 ? (
          <EmptyState
            title=""
            description={
              contactos.length > 0 && !mostrarImportados
                ? 'Todos los contactos de esta página ya están importados.'
                : 'No se encontraron contactos.'
            }
          />
        ) : (
          <div className="max-h-[320px] overflow-y-auto">
            <table className="w-full text-left text-body-sm table-auto border-collapse">
              <thead className="sticky top-0 bg-[#f8fafc] z-10">
                <tr className="border-b border-neutral-200 text-ui-sm font-semibold text-text-secondary h-10 select-none">
                  <th className="pl-4 w-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer"
                      checked={allSelected}
                      disabled={seleccionables.length === 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-3 py-2 font-medium text-[12px] text-[#64748b]">Nombre</th>
                  <th className="px-3 py-2 font-medium text-[12px] text-[#64748b]">Email / Teléfono</th>
                  <th className="px-3 py-2 font-medium text-[12px] text-[#64748b]">RNC</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((c: GhlContactoResumen) => {
                  const isSelected = selectedIds.has(c.ghlContactId)
                  return (
                    <tr
                      key={c.ghlContactId}
                      onClick={() => !c.yaImportado && toggleSelect(c.ghlContactId)}
                      className={cn(
                        'border-b border-neutral-100 last:border-0 h-[56px] transition-colors',
                        c.yaImportado ? 'bg-neutral-50 text-neutral-400' : 'cursor-pointer hover:bg-neutral-50/60',
                        isSelected && !c.yaImportado ? 'bg-[rgba(3,121,213,0.05)]' : '',
                      )}
                    >
                      <td className="pl-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-neutral-300 text-[#0379d5] focus:ring-[#0379d5] cursor-pointer disabled:cursor-not-allowed"
                          checked={isSelected || c.yaImportado}
                          disabled={c.yaImportado}
                          onChange={() => toggleSelect(c.ghlContactId)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-text-secondary shrink-0">
                            {c.email ? <User size={14} /> : <Building2 size={14} />}
                          </div>
                          <span className="font-semibold text-text-primary line-clamp-1">{c.nombre}</span>
                          {c.yaImportado && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200/50 px-2 py-0.5 text-[10px] font-semibold text-green-700 shrink-0">
                              <CheckCircle2 size={10} className="text-green-600" />
                              Importado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        <div className="flex flex-col">
                          <span className="line-clamp-1">{c.email || '—'}</span>
                          {c.telefono && <span className="text-[11px] text-[#99a1af]">{c.telefono}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-semibold text-text-primary">{formatRnc(c.rnc)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2.5 bg-white">
          <span className="text-[11px] text-[#99a1af] font-sans">{isFetching ? 'Cargando…' : `${contactos.length} en esta página`}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={pageIndex === 0}
              onClick={handleAnterior}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-text-secondary hover:bg-neutral-50 disabled:opacity-50 transition-colors focus:outline-none"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={!data?.nextCursor}
              onClick={handleSiguiente}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-text-secondary hover:bg-neutral-50 disabled:opacity-50 transition-colors focus:outline-none"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
