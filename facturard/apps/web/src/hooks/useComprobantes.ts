'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, getErrorMessage } from '@/lib/api'
import {
  downloadComprobantePdf,
  estadosDeFiltro,
  type ClaseFiltro,
  type Comprobante,
  type EstadoFiltro,
  type OrigenFiltro,
  type PaginatedResponse,
} from '@/lib/comprobantes'
import { useUI } from '@/lib/context/UIContext'
import { useSearchParams } from 'next/navigation'

/** @deprecated Alias de `EstadoFiltro` (fuente única en lib/comprobantes). */
export type EstadoFilter = EstadoFiltro

const PAGE_SIZE = 10

// -- Dashboard: recent facturas table (limit 10) --

interface UseDashboardOptions {
  limit?: number
}

export function useDashboardComprobantes(options: UseDashboardOptions = {}) {
  const { limit = 10 } = options

  const { data, isLoading } = useQuery({
    queryKey: ['comprobantes-recientes', limit],
    queryFn: () =>
      api
        .get<PaginatedResponse<Comprobante>>('/comprobantes', { params: { limit } })
        .then((res) => res.data),
  })

  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const handleDownload = useCallback(async (comprobante: Comprobante): Promise<void> => {
    setDownloadingId(comprobante.id)
    try {
      await downloadComprobantePdf(api, comprobante.id, comprobante.eNCF)
    } catch {
      toast.error('No se pudo descargar el PDF de este comprobante')
    } finally {
      setDownloadingId(null)
    }
  }, [])

  return {
    comprobantes: data?.data ?? [],
    isLoading,
    downloadingId,
    handleDownload,
  }
}

// -- Dashboard: monthly metrics (all records for the month, max 100) --

interface UseMonthMetricsOptions {
  fechaDesde: string
  fechaHasta: string
}

export function useMonthMetrics({ fechaDesde, fechaHasta }: UseMonthMetricsOptions) {
  const { data, isLoading } = useQuery({
    queryKey: ['comprobantes-metrics', fechaDesde, fechaHasta],
    queryFn: () =>
      api
        .get<PaginatedResponse<Comprobante>>('/comprobantes', {
          params: { fechaDesde, fechaHasta, limit: 100, page: 1 },
        })
        .then((res) => res.data),
    staleTime: 2 * 60 * 1000,
  })

  const metrics = useMemo(() => {
    const all = data?.data ?? []
    const monto = all.reduce((sum, c) => sum + Number(c.montoTotal), 0)
    return {
      totalFacturadas: data?.total ?? 0,
      montoTotal: monto,
      itbisRecaudado: monto * 18 / 118,
    }
  }, [data])

  return { ...metrics, isLoading }
}

// -- Facturas page: paginated list with filters and client-side search --

export function useComprobantes() {
  const { globalSearch } = useUI()
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get('search') || ''
  const [page, setPage] = useState(1)
  const [estadoFilter, setEstadoFilter] = useState<EstadoFiltro>('todos')
  const [claseFilter, setClaseFilter] = useState<ClaseFiltro>('todos')
  const [origenFilter, setOrigenFilter] = useState<OrigenFiltro>('todos')
  const [search, setSearch] = useState(initialSearch)
  const [tipoFilter, setTipoFilter] = useState<string>('todos')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [minAmount, setMinAmount] = useState<string>('')
  const [maxAmount, setMaxAmount] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Combine local search with global search
  const activeSearch = search.trim() || globalSearch.trim()

  // Build server-side query params
  const serverTipo = tipoFilter !== 'todos' ? tipoFilter : undefined
  const serverClase = claseFilter !== 'todos' ? claseFilter : undefined
  const serverOrigen = origenFilter !== 'todos' ? origenFilter : undefined
  const serverSearch = activeSearch || undefined
  const serverFechaDesde = startDate || undefined
  const serverFechaHasta = endDate || undefined
  // El estado (incluido el agrupado "En proceso") lo resuelve el BACKEND: antes
  // se filtraba en cliente sobre un limit:100 y con más comprobantes la lista
  // salía incompleta sin avisar.
  const estadosServer = estadosDeFiltro(estadoFilter)
  const serverEstado = estadosServer.length > 0 ? estadosServer.join(',') : undefined

  // Único filtro que sigue siendo client-side: el rango de monto (el backend no
  // lo soporta). Mientras esté activo, paginamos en cliente sobre 100 registros.
  const hasClientFilter = minAmount !== '' || maxAmount !== ''

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      'comprobantes-lista',
      page,
      serverEstado,
      serverClase,
      serverOrigen,
      serverSearch,
      serverTipo,
      serverFechaDesde,
      serverFechaHasta,
      minAmount,
      maxAmount,
    ],
    queryFn: () =>
      api
        .get<PaginatedResponse<Comprobante>>('/comprobantes', {
          params: {
            page: hasClientFilter ? 1 : page,
            limit: hasClientFilter ? 100 : PAGE_SIZE,
            ...(serverSearch && { search: serverSearch }),
            ...(serverEstado && { estado: serverEstado }),
            ...(serverTipo && { tipoECF: serverTipo }),
            ...(serverClase && { clase: serverClase }),
            ...(serverOrigen && { origen: serverOrigen }),
            ...(serverFechaDesde && { fechaDesde: serverFechaDesde }),
            ...(serverFechaHasta && { fechaHasta: serverFechaHasta }),
          },
        })
        .then((res) => res.data),
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['comprobante-detalle', selectedId],
    queryFn: () =>
      api.get<Comprobante>(`/comprobantes/${selectedId}`).then((res) => res.data),
    enabled: !!selectedId,
  })

  const filtered = useMemo(() => {
    let all = data?.data ?? []

    // Rango de monto — único filtro client-side (sin soporte en el backend).
    if (minAmount) {
      const min = Number(minAmount)
      all = all.filter((c) => Number(c.montoTotal) >= min)
    }
    if (maxAmount) {
      const max = Number(maxAmount)
      all = all.filter((c) => Number(c.montoTotal) <= max)
    }

    return all
  }, [data, minAmount, maxAmount])

  const paginatedComprobantes = useMemo(() => {
    if (hasClientFilter) {
      const offset = (page - 1) * PAGE_SIZE
      return filtered.slice(offset, offset + PAGE_SIZE)
    }
    return filtered
  }, [filtered, hasClientFilter, page])

  const customPaginationData = useMemo(() => {
    if (hasClientFilter) {
      return {
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / PAGE_SIZE) || 1,
        page,
        limit: PAGE_SIZE,
      }
    }
    return data ? {
      total: data.total,
      totalPages: data.totalPages,
      page: data.page,
      limit: data.limit,
    } : null
  }, [data, filtered, hasClientFilter, page])

  const handleDownload = useCallback(async (comprobante: Comprobante): Promise<void> => {
    setDownloadingId(comprobante.id)
    try {
      await downloadComprobantePdf(api, comprobante.id, comprobante.eNCF)
    } catch {
      toast.error('No se pudo descargar el PDF de este comprobante')
    } finally {
      setDownloadingId(null)
    }
  }, [])

  const handleEstadoChange = useCallback((f: EstadoFiltro) => {
    setEstadoFilter(f)
    setPage(1)
  }, [])

  const handleOrigenChange = useCallback((o: OrigenFiltro) => {
    setOrigenFilter(o)
    setPage(1)
  }, [])

  const handleSearchChange = useCallback((s: string) => {
    setSearch(s)
    setPage(1)
  }, [])

  const handleTipoFilterChange = useCallback((t: string) => {
    setTipoFilter(t)
    setPage(1)
  }, [])

  const handleClaseFilterChange = useCallback((c: ClaseFiltro) => {
    setClaseFilter(c)
    setPage(1)
  }, [])

  const handleStartDateChange = useCallback((d: string) => {
    setStartDate(d)
    setPage(1)
  }, [])

  const handleEndDateChange = useCallback((d: string) => {
    setEndDate(d)
    setPage(1)
  }, [])

  const handleMinAmountChange = useCallback((a: string) => {
    setMinAmount(a)
    setPage(1)
  }, [])

  const handleMaxAmountChange = useCallback((a: string) => {
    setMaxAmount(a)
    setPage(1)
  }, [])

  return {
    comprobantes: paginatedComprobantes,
    paginationData: customPaginationData,
    isLoading,
    isFetching,
    refetch,
    page,
    setPage,
    estadoFilter,
    setEstadoFilter: handleEstadoChange,
    search,
    setSearch: handleSearchChange,
    tipoFilter,
    setTipoFilter: handleTipoFilterChange,
    claseFilter,
    setClaseFilter: handleClaseFilterChange,
    origenFilter,
    setOrigenFilter: handleOrigenChange,
    startDate,
    setStartDate: handleStartDateChange,
    endDate,
    setEndDate: handleEndDateChange,
    minAmount,
    setMinAmount: handleMinAmountChange,
    maxAmount,
    setMaxAmount: handleMaxAmountChange,
    selectedId,
    setSelectedId,
    detail,
    detailLoading,
    downloadingId,
    handleDownload,
  }
}

// ─── Envío del comprobante al cliente (vía GoHighLevel) ──────────────────────
// Post-emisión: NO cambia el estado DGII del comprobante. Hoy sólo email;
// WhatsApp exige plantillas aprobadas por Meta y el backend lo rechaza con 400.

export type CanalEnvio = 'EMAIL' | 'WHATSAPP'
export type EstadoEnvio = 'ENVIADO' | 'FALLIDO'

export interface EnvioComprobante {
  id: string
  canal: CanalEnvio
  /** ENVIADO = GoHighLevel aceptó el mensaje, NO que el cliente lo recibió. */
  estado: EstadoEnvio
  destino: string | null
  ghlMessageId: string | null
  ghlConversationId: string | null
  error: string | null
  createdAt: string
}

export interface EnviarComprobantePayload {
  comprobanteId: string
  canal: 'email'
  asunto?: string
  mensaje?: string
}

/** Contacto de GHL bajo el que quedó el hilo del correo. */
export interface AnclaEnvio {
  ghlContactId: string
  razonSocial: string
  origen: 'contactoLocal' | 'contactoGhl' | 'primerComprobante' | 'creado'
  email: string | null
  /** true si ESTE envío creó un contacto nuevo en el CRM del cliente. */
  creado: boolean
}

export interface EnvioResultado {
  canal: CanalEnvio
  estado: EstadoEnvio
  destino: string
  ancla: AnclaEnvio
  ghlMessageId: string | null
  enviadoEn: string
}

/**
 * Avisa cuando el envío creó un contacto en el CRM del cliente. Va en un toast
 * APARTE del de éxito: escribir en GoHighLevel no puede pasar desapercibido
 * entre el "enviado correctamente".
 */
function avisarSiCreoContacto(ancla: AnclaEnvio | undefined): void {
  if (!ancla?.creado) return
  toast.info('Se creó un contacto en Dmaia CRM', {
    description: `${ancla.email ?? 'el destinatario'} no existía como contacto y Dmaia CRM exige uno para enviar. Se creó con la etiqueta "facturard-envio".`,
    duration: 8000,
  })
}

/** Historial de envíos de un comprobante. */
export function useEnviosComprobante(comprobanteId: string | null | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ['comprobante-envios', comprobanteId],
    queryFn: () =>
      api.get<EnvioComprobante[]>(`/comprobantes/${comprobanteId}/envios`).then((res) => res.data),
    enabled: !!comprobanteId,
  })

  return { envios: data ?? [], isLoading }
}

/**
 * Envía el comprobante al cliente. El destinatario lo resuelve el BACKEND a
 * partir del contacto del comprobante — no se manda desde el front, para que
 * una factura no pueda dirigirse al correo de un tercero.
 */
export function useEnviarComprobante() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ comprobanteId, ...body }: EnviarComprobantePayload) =>
      api.post<EnvioResultado>(`/comprobantes/${comprobanteId}/enviar`, body).then((r) => r.data),
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['comprobante-envios', variables.comprobanteId] })
      // El toast usa el destino REAL que devolvió el backend, no lo que se tecleó.
      toast.success('Comprobante enviado', { description: `Enviado a ${data.destino}` })
      avisarSiCreoContacto(data.ancla)
    },
    // Aquí llegan los 400 accionables del backend ("cliente no sincronizado con
    // GoHighLevel", "no tiene correo registrado"). Sin esto el usuario no ve nada.
    onError: (err) => toast.error('No se pudo enviar', { description: getErrorMessage(err) }),
  })
}

/**
 * Máximo de comprobantes por correo. Es el límite de adjuntos de GoHighLevel
 * (5 archivos por request de upload) y el backend lo valida igual: esta
 * constante existe para poder EXPLICARLO en la UI, no para sostenerlo.
 */
export const MAX_COMPROBANTES_POR_CORREO = 5

export interface EnviarLotePayload {
  comprobanteIds: string[]
  destinatarios: string[]
  asunto?: string
  mensaje?: string
}

export interface EnvioLoteResultado {
  loteId: string
  destinatarios: string[]
  ancla: AnclaEnvio
  comprobantes: { id: string; referencia: string }[]
  adjuntos: number
  ghlMessageId: string | null
  enviadoEn: string
}

/**
 * Envío EN LOTE: UN SOLO correo con los PDFs de varios comprobantes adjuntos.
 * No es un correo por comprobante.
 */
export function useEnviarLote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: EnviarLotePayload) =>
      api.post<EnvioLoteResultado>('/comprobantes/enviar-lote', { canal: 'email', ...body }).then((r) => r.data),
    onSuccess: (data, variables) => {
      for (const id of variables.comprobanteIds) {
        void queryClient.invalidateQueries({ queryKey: ['comprobante-envios', id] })
      }
      // Se nombra el destino REAL y dónde quedó el hilo en GHL: el usuario no
      // tiene por qué adivinar en qué conversación aterrizó el correo.
      toast.success(
        `${data.adjuntos} comprobante${data.adjuntos === 1 ? '' : 's'} enviado${data.adjuntos === 1 ? '' : 's'} en un correo`,
        { description: `Para ${data.destinatarios.join(', ')} · hilo en la conversación de ${data.ancla.razonSocial}` },
      )
      avisarSiCreoContacto(data.ancla)
    },
    onError: (err) => toast.error('No se pudo enviar el lote', { description: getErrorMessage(err) }),
  })
}

export interface Cumplimiento {
  certificado: { existe: boolean; vigente: boolean; vencido: boolean; diasRestantes: number | null }
  bloqueaEmision: boolean
  puedeEmitir: boolean
  motivoNoEmite: string
  secuencias: Array<{ tipoECF: string; ultimaSecuencia: number; disponibles: number | null; porAgotarse: boolean; venceEn: string | null }>
  comprobantesConProblema: { count: number; ids: string[] }
  reportesPendientes: { periodo: string; pendientes: string[] }
  indicadorGeneral: 'OK' | 'WARN' | 'CRITICAL'
}

export function useCumplimiento() {
  const { data, isLoading, error } = useQuery<Cumplimiento>({
    queryKey: ['cumplimiento'],
    queryFn: () =>
      api
        .get<Cumplimiento>('/cumplimiento')
        .then((res) => res.data),
  })

  return {
    cumplimiento: data ?? null,
    isLoading,
    error,
  }
}
