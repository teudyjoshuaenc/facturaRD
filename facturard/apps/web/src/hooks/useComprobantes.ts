'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  downloadComprobantePdf,
  type Comprobante,
  type PaginatedResponse,
} from '@/lib/comprobantes'
import { useUI } from '@/lib/context/UIContext'

export type EstadoFilter = 'todos' | 'ACEPTADO' | 'PENDIENTE' | 'RECHAZADO'

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
  const [page, setPage] = useState(1)
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('todos')
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<string>('todos')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [minAmount, setMinAmount] = useState<string>('')
  const [maxAmount, setMaxAmount] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // If any advanced filter is active, fetch more records so they filter correctly on client-side
  const filterActive =
    search.trim().length > 0 ||
    globalSearch.trim().length > 0 ||
    estadoFilter !== 'todos' ||
    tipoFilter !== 'todos' ||
    startDate ||
    endDate ||
    minAmount ||
    maxAmount

  const { data, isLoading } = useQuery({
    queryKey: ['comprobantes-lista', filterActive ? 'filtered' : page],
    queryFn: () =>
      api
        .get<PaginatedResponse<Comprobante>>('/comprobantes', {
          params: {
            page: filterActive ? 1 : page,
            limit: filterActive ? 300 : PAGE_SIZE,
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

    // 1. Estado Filter (En proceso = PENDIENTE, EN_COLA, ENVIANDO)
    if (estadoFilter !== 'todos') {
      if (estadoFilter === 'PENDIENTE') {
        all = all.filter(
          (c) =>
            c.estado === 'PENDIENTE' ||
            c.estado === 'EN_COLA' ||
            c.estado === 'ENVIANDO'
        )
      } else {
        all = all.filter((c) => c.estado === estadoFilter)
      }
    }

    // 2. Text Search
    const activeSearch = (search.trim() ? search : globalSearch).toLowerCase()
    if (activeSearch) {
      all = all.filter(
        (c) =>
          c.eNCF.toLowerCase().includes(activeSearch) ||
          c.razonSocial.toLowerCase().includes(activeSearch) ||
          (c.rnc && c.rnc.toLowerCase().includes(activeSearch)),
      )
    }

    // 3. Tipo ECF
    if (tipoFilter !== 'todos') {
      all = all.filter((c) => c.tipoECF === tipoFilter)
    }

    // 4. Date Range (Parsing safely in local timezone)
    if (startDate) {
      const parts = startDate.split('-').map(Number)
      const yr = parts[0] ?? 0
      const mo = parts[1] ?? 1
      const dy = parts[2] ?? 1
      const start = new Date(yr, mo - 1, dy, 0, 0, 0, 0)
      all = all.filter((c) => new Date(c.createdAt) >= start)
    }
    if (endDate) {
      const parts = endDate.split('-').map(Number)
      const yr = parts[0] ?? 0
      const mo = parts[1] ?? 1
      const dy = parts[2] ?? 1
      const end = new Date(yr, mo - 1, dy, 23, 59, 59, 999)
      all = all.filter((c) => new Date(c.createdAt) <= end)
    }

    // 5. Amount Range
    if (minAmount) {
      const min = Number(minAmount)
      all = all.filter((c) => Number(c.montoTotal) >= min)
    }
    if (maxAmount) {
      const max = Number(maxAmount)
      all = all.filter((c) => Number(c.montoTotal) <= max)
    }

    return all
  }, [data, estadoFilter, search, globalSearch, tipoFilter, startDate, endDate, minAmount, maxAmount])

  const paginatedComprobantes = useMemo(() => {
    if (filterActive) {
      const offset = (page - 1) * PAGE_SIZE
      return filtered.slice(offset, offset + PAGE_SIZE)
    }
    return filtered
  }, [filtered, filterActive, page])

  const customPaginationData = useMemo(() => {
    if (filterActive) {
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
  }, [data, filtered, filterActive, page])

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

  const handleTipoFilterChange = useCallback((t: string) => {
    setTipoFilter(t)
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
    page,
    setPage,
    estadoFilter,
    setEstadoFilter: handleEstadoChange,
    search,
    setSearch: handleSearchChange,
    tipoFilter,
    setTipoFilter: handleTipoFilterChange,
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
