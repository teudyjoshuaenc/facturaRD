'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import {
  downloadComprobantePdf,
  type Comprobante,
  type PaginatedResponse,
} from '@/lib/comprobantes'
import { useUI } from '@/lib/context/UIContext'
import { useSearchParams } from 'next/navigation'

export type EstadoFilter = 'todos' | 'ACEPTADO' | 'PENDIENTE' | 'RECHAZADO' | 'DRAFT' | 'COTIZACION_CONVERTIDA'

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
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('todos')
  const [claseFilter, setClaseFilter] = useState<'todos' | 'fiscal' | 'borrador' | 'nota'>('todos')
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
  const serverSearch = activeSearch || undefined
  const serverFechaDesde = startDate || undefined
  const serverFechaHasta = endDate || undefined

  // Determine if any client-side-only filter is active (amount range, estado grouping)
  const hasClientFilter = minAmount !== '' || maxAmount !== '' || estadoFilter !== 'todos'

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      'comprobantes-lista',
      page,
      estadoFilter,
      claseFilter,
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
            ...(serverTipo && { tipoECF: serverTipo }),
            ...(serverClase && { clase: serverClase }),
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

    // 1. Estado Filter (En proceso = PENDIENTE, EN_COLA, ENVIANDO) — client-side grouping
    if (estadoFilter !== 'todos') {
      if (estadoFilter === 'PENDIENTE') {
        all = all.filter(
          (c) =>
            c.estado === 'PENDIENTE' ||
            c.estado === 'EN_COLA' ||
            c.estado === 'ENVIANDO'
        )
      } else if (estadoFilter === 'COTIZACION_CONVERTIDA') {
        all = all.filter((c) => !!c.cotizacionId)
      } else {
        all = all.filter((c) => c.estado === estadoFilter)
      }
    }

    // 2. Amount Range — client-side only
    if (minAmount) {
      const min = Number(minAmount)
      all = all.filter((c) => Number(c.montoTotal) >= min)
    }
    if (maxAmount) {
      const max = Number(maxAmount)
      all = all.filter((c) => Number(c.montoTotal) <= max)
    }

    return all
  }, [data, estadoFilter, minAmount, maxAmount])

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

  const handleEstadoChange = useCallback((f: EstadoFilter) => {
    setEstadoFilter(f)
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

  const handleClaseFilterChange = useCallback((c: 'todos' | 'fiscal' | 'borrador' | 'nota') => {
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
