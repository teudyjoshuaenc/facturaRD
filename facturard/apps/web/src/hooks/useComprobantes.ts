'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  downloadComprobantePdf,
  type Comprobante,
  type PaginatedResponse,
} from '@/lib/comprobantes'

export type EstadoFilter = 'todos' | 'ACEPTADO' | 'PENDIENTE' | 'RECHAZADO'

const PAGE_SIZE = 10

// -- Dashboard: recent facturas table (limit 5) --

interface UseDashboardOptions {
  limit?: number
}

export function useDashboardComprobantes(options: UseDashboardOptions = {}) {
  const { limit = 5 } = options

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
  const [page, setPage] = useState(1)
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('todos')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // When searching: fetch up to 100 records across pages so the filter is meaningful
  const searchActive = search.trim().length > 0

  const { data, isLoading } = useQuery({
    queryKey: ['comprobantes-lista', page, estadoFilter, searchActive],
    queryFn: () =>
      api
        .get<PaginatedResponse<Comprobante>>('/comprobantes', {
          params: {
            page: searchActive ? 1 : page,
            limit: searchActive ? 100 : PAGE_SIZE,
            ...(estadoFilter !== 'todos' && { estado: estadoFilter }),
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
    const all = data?.data ?? []
    if (!search.trim()) return all
    const term = search.toLowerCase()
    return all.filter(
      (c) =>
        c.eNCF.toLowerCase().includes(term) ||
        c.razonSocial.toLowerCase().includes(term) ||
        (c.rnc && c.rnc.includes(term)),
    )
  }, [data, search])

  const handleDownload = useCallback(async (comprobante: Comprobante): Promise<void> => {
    setDownloadingId(comprobante.id)
    try {
      await downloadComprobantePdf(api, comprobante.id, comprobante.eNCF)
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

  return {
    comprobantes: filtered,
    paginationData: searchActive ? null : data,
    isLoading,
    page,
    setPage,
    estadoFilter,
    setEstadoFilter: handleEstadoChange,
    search,
    setSearch: handleSearchChange,
    selectedId,
    setSelectedId,
    detail,
    detailLoading,
    downloadingId,
    handleDownload,
  }
}
