'use client'

import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'

export interface CotizacionItem {
  id: string
  nombre: string
  descripcion?: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  tratamientoITBIS: string
  indicadorBienoServicio: string
  unidadMedida?: string
  productoId?: string
}

export interface Cotizacion {
  id: string
  folio: string
  estado: 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'CONVERTIDA' | 'VENCIDA'
  tenantId: string
  contactoId?: string
  subtotal: number
  itbis: number
  total: number
  notas?: string
  fechaVigencia?: string
  createdAt: string
  updatedAt: string
  comprobanteId?: string | null
  items: CotizacionItem[]
  // Enriched by the list (from contact join, if any)
  contacto?: {
    id: string
    nombre: string
    rnc: string
    email?: string
    telefono?: string
  }
}

export interface PaginatedCotizaciones {
  data: Cotizacion[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ListCotizacionesQuery {
  page?: number
  limit?: number
  search?: string | undefined
  estado?: string | undefined
  contactoId?: string | undefined
}

export function useCotizaciones() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchCotizaciones = useCallback(async (query: ListCotizacionesQuery = {}) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query.page) params.set('page', String(query.page))
      if (query.limit) params.set('limit', String(query.limit))
      if (query.search?.trim()) params.set('search', query.search.trim())
      if (query.estado && query.estado !== 'todos') params.set('estado', query.estado)
      if (query.contactoId) params.set('contactoId', query.contactoId)

      const res = await api.get<PaginatedCotizaciones>(`/cotizaciones?${params.toString()}`)
      const body = res.data

      setCotizaciones(body.data ?? [])
      setTotal(body.total ?? 0)
      setTotalPages(body.totalPages ?? 1)
      setCurrentPage(body.page ?? 1)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar cotizaciones'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteCotizacion = useCallback(async (id: string): Promise<boolean> => {
    try {
      // The API doesn't have a DELETE endpoint, so we'll mark the state as RECHAZADA
      await api.patch(`/cotizaciones/${id}/estado`, { estado: 'RECHAZADA' })
      return true
    } catch {
      return false
    }
  }, [])

  return {
    cotizaciones,
    loading,
    error,
    total,
    totalPages,
    currentPage,
    fetchCotizaciones,
    deleteCotizacion,
    setCotizaciones
  }
}
