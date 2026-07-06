'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PaginatedResponse } from '@/lib/comprobantes'

// Forma REAL del contacto que devuelve GET /contactos (Prisma). Sin mapear a
// EMPRESA/PERSONA (eso es solo para el wizard de nueva-factura).
export interface ContactoDir {
  id: string
  razonSocial: string
  nombreComercial: string | null
  rnc: string | null
  tipo: 'CLIENTE' | 'PROVEEDOR' | 'CONSUMIDOR_FINAL'
  email: string | null
  telefono: string | null
  origen: 'MANUAL' | 'GHL'
  rncValidado: boolean
  activo: boolean
}

export interface ContactosDirParams {
  search?: string | undefined
  tipo?: string | undefined
  origen?: string | undefined
  page?: number | undefined
  limit?: number | undefined
}

export function useContactosDirectorio(params: ContactosDirParams) {
  const queryClient = useQueryClient()
  const { search, tipo, origen, page = 1, limit = 10 } = params

  const { data, isLoading, isError } = useQuery({
    // La key empieza con 'contactos' → la invalida la sync GHL y crearContacto.
    queryKey: ['contactos', 'directorio', { search, tipo, origen, page, limit }],
    queryFn: () =>
      api
        .get<PaginatedResponse<ContactoDir>>('/contactos', {
          params: {
            search: search?.trim() || undefined,
            tipo: tipo || undefined,
            origen: origen || undefined,
            page,
            limit,
          },
        })
        .then((res) => res.data),
  })

  return {
    contactos: data?.data ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 1,
    isLoading,
    isError,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['contactos'] }),
  }
}
