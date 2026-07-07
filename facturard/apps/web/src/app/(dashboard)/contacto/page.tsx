'use client'

import { useMemo, useState } from 'react'
import type { JSX } from 'react'
import Link from 'next/link'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { useContactosDirectorio } from '@/hooks/useContactosDirectorio'
import { useContactos } from '@/hooks/useContactos'
import { useGhlSync, type SyncResultado } from '@/hooks/useGhlSync'
import { useUI } from '@/lib/context/UIContext'
import { NuevoClienteModal } from '@/components/nueva-factura/NuevoClienteModal'

type TipoFilter = 'todos' | 'CLIENTE' | 'PROVEEDOR' | 'CONSUMIDOR_FINAL'
type OrigenFilter = 'todos' | 'MANUAL' | 'GHL'

const TIPO_LABEL: Record<string, string> = {
  CLIENTE: 'Cliente',
  PROVEEDOR: 'Proveedor',
  CONSUMIDOR_FINAL: 'Consumidor final',
}

function formatRnc(rnc: string | null): string {
  if (!rnc) return '—'
  if (rnc.length === 9) return rnc.replace(/(\d{3})(\d{5})(\d{1})/, '$1-$2-$3')
  if (rnc.length === 11) return rnc.replace(/(\d{3})(\d{7})(\d{1})/, '$1-$2-$3')
  return rnc
}

export default function ContactosPage(): JSX.Element {
  const { globalSearch } = useUI()
  const { crearContacto } = useContactos()
  const { conectado, sincronizar, getErrorMessage } = useGhlSync()

  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos')
  const [origenFilter, setOrigenFilter] = useState<OrigenFilter>('todos')
  const [soloSinRnc, setSoloSinRnc] = useState(false)
  const [page, setPage] = useState(1)
  const [openModal, setOpenModal] = useState(false)
  const [selectedContacto, setSelectedContacto] = useState<any | null>(null)

  const [syncResult, setSyncResult] = useState<SyncResultado | null>(null)
  const [syncError, setSyncError] = useState('')
  const [avisoNoConectado, setAvisoNoConectado] = useState(false)

  const activeSearch = (search.trim() ? search : globalSearch).trim()

  const { contactos, total, totalPages, isLoading, isError, refetch } = useContactosDirectorio({
    search: activeSearch,
    tipo: tipoFilter === 'todos' ? undefined : tipoFilter,
    origen: origenFilter === 'todos' ? undefined : origenFilter,
    page,
    limit: 10,
  })

  // "Sin RNC" se filtra sobre la página cargada (el backend no tiene ese filtro).
  const visibles = useMemo(
    () => (soloSinRnc ? contactos.filter((c) => !c.rnc) : contactos),
    [contactos, soloSinRnc],
  )

  async function handleSincronizarGhl(): Promise<void> {
    if (!conectado) {
      setAvisoNoConectado(true)
      return
    }
    setSyncError('')
    setSyncResult(null)
    try {
      const res = await sincronizar.mutateAsync()
      setSyncResult(res)
      setPage(1)
    } catch (err) {
      setSyncError(getErrorMessage(err, 'No pudimos sincronizar con GoHighLevel.'))
    }
  }

  function resetPage<T>(setter: (v: T) => void): (v: T) => void {
    return (v: T) => {
      setter(v)
      setPage(1)
    }
  }

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h4 font-bold text-text-primary">Contactos</h2>
          <p className="text-body-sm text-text-secondary">{total} contactos en tu directorio</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="md"
            onClick={() => refetch()}
            className="h-10 w-10 p-0 flex items-center justify-center border border-neutral-200 hover:bg-neutral-50"
            title="Refrescar"
          >
            <RotateCw size={16} className="text-text-secondary" />
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={handleSincronizarGhl}
            disabled={sincronizar.isPending}
            className="h-10 border border-neutral-200 hover:bg-neutral-50 px-4"
            title={conectado ? 'Importar contactos desde GoHighLevel' : 'Conecta GoHighLevel en Configuración'}
          >
            {sincronizar.isPending ? <Spinner size={16} className="mr-1.5" /> : <RefreshCw size={16} className="mr-1.5" />}
            Sincronizar con GoHighLevel
          </Button>
          <Button variant="primary" size="md" onClick={() => setOpenModal(true)} className="h-10 px-4 font-semibold">
            <Plus size={16} className="mr-1.5" />
            Nuevo contacto
          </Button>
        </div>
      </div>

      {/* Aviso: sin conexión GHL */}
      {avisoNoConectado && !conectado && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-warning-500/40 bg-warning-500/10 px-4 py-3 text-body-sm text-warning-700">
          <span className="flex items-center gap-2">
            <AlertTriangle size={18} className="shrink-0" />
            Primero conecta tu cuenta de GoHighLevel en Configuración.
          </span>
          <Link href="/configuracion" className="shrink-0 font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2">
            Ir a Configuración
          </Link>
        </div>
      )}

      {/* Error de sincronización */}
      {syncError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-body-sm text-danger-700">
          <span className="flex items-center gap-2">
            <XCircle size={18} className="shrink-0" />
            {syncError} Revisa el token en Configuración.
          </span>
          <Link href="/configuracion" className="shrink-0 font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2">
            Ir a Configuración
          </Link>
        </div>
      )}

      {/* Resultado de sincronización */}
      {syncResult && (
        <div className="flex flex-col gap-2 rounded-xl border border-success-500/40 bg-success-500/10 px-4 py-3">
          <div className="flex items-center gap-2 text-body-sm font-semibold text-success-700">
            <CheckCircle2 size={18} className="shrink-0" />
            Importados: {syncResult.importados} · Actualizados: {syncResult.actualizados} · Sin RNC: {syncResult.sinRnc}
          </div>
          {syncResult.sinRnc > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-text-secondary">
              <span>{syncResult.sinRnc} contacto(s) se importaron sin RNC. Complétalo antes de poder facturarles un E31.</span>
              <button
                type="button"
                onClick={() => { setOrigenFilter('GHL'); setSoloSinRnc(true); setPage(1) }}
                className="font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2 focus:outline-none"
              >
                Ver contactos sin RNC
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filtros (server-side: search, tipo, origen) */}
      <div className="flex flex-wrap items-center gap-3.5 bg-white p-3.5 rounded-xl border border-neutral-200 shadow-sm w-full">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={16} />
          <input
            type="text"
            placeholder="Buscar por razón social, RNC o email..."
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
            className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
          />
        </div>

        <select
          value={tipoFilter}
          onChange={(e) => resetPage(setTipoFilter)(e.target.value as TipoFilter)}
          className="h-10 rounded-lg border border-neutral-200 bg-white pl-3.5 pr-9 text-body-sm font-medium text-text-primary focus:outline-none focus:border-brand-500 cursor-pointer hover:bg-neutral-50 transition-colors"
        >
          <option value="todos">Todos los tipos</option>
          <option value="CLIENTE">Cliente</option>
          <option value="PROVEEDOR">Proveedor</option>
          <option value="CONSUMIDOR_FINAL">Consumidor final</option>
        </select>

        <select
          value={origenFilter}
          onChange={(e) => { resetPage(setOrigenFilter)(e.target.value as OrigenFilter); setSoloSinRnc(false) }}
          className="h-10 rounded-lg border border-neutral-200 bg-white pl-3.5 pr-9 text-body-sm font-medium text-text-primary focus:outline-none focus:border-brand-500 cursor-pointer hover:bg-neutral-50 transition-colors"
        >
          <option value="todos">Todos los orígenes</option>
          <option value="MANUAL">Manual</option>
          <option value="GHL">GoHighLevel</option>
        </select>

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
              activeSearch || tipoFilter !== 'todos' || origenFilter !== 'todos' || soloSinRnc
                ? 'No hay contactos que coincidan con los filtros.'
                : 'Aún no tienes contactos. Crea uno o sincroniza desde GoHighLevel.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50 text-ui-sm font-semibold text-text-secondary">
                  <th className="px-4 py-3">Nombre / Razón social</th>
                  <th className="px-4 py-3">RNC / Cédula</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Validación</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((c) => (
                  <tr key={c.id} className="border-b border-neutral-200 last:border-0 hover:bg-neutral-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-text-secondary flex-shrink-0">
                          {c.tipo === 'CONSUMIDOR_FINAL' ? <User size={16} /> : <Building2 size={16} />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-text-primary line-clamp-1">{c.razonSocial}</span>
                          {c.nombreComercial && (
                            <span className="text-[11px] text-text-secondary line-clamp-1">{c.nombreComercial}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-primary">{formatRnc(c.rnc)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.tipo === 'CLIENTE' ? 'info' : 'neutral'}>{TIPO_LABEL[c.tipo] ?? c.tipo}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.origen === 'GHL' ? 'info' : 'neutral'}>
                        {c.origen === 'GHL' ? 'GoHighLevel' : 'Manual'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-text-secondary">{c.telefono || '—'}</td>
                    <td className="px-4 py-3">
                      {c.rncValidado ? (
                        <Badge variant="success"><CheckCircle2 size={12} /> Válido</Badge>
                      ) : (
                        <Badge variant="warning"><AlertTriangle size={12} /> Sin validar</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación (server-side) */}
        {!isLoading && !isError && visibles.length > 0 && (
          <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3.5 bg-white">
            <p className="text-ui-sm text-text-secondary">{total} resultados</p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-text-secondary hover:bg-neutral-50 disabled:opacity-50 transition-colors focus:outline-none"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-brand-500 px-2 text-ui-sm font-bold text-white">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-text-secondary hover:bg-neutral-50 disabled:opacity-50 transition-colors focus:outline-none"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <NuevoClienteModal open={openModal} onClose={() => setOpenModal(false)} onSave={crearContacto} />
    </div>
  )
}
