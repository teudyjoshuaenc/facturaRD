'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface GhlContactoResumen {
  ghlContactId: string
  nombre: string
  email: string | null
  telefono: string | null
  rnc: string | null
  yaImportado: boolean
}

export interface BuscarGhlResultado {
  contactos: GhlContactoResumen[]
  nextCursor: { id: string; date: string } | null
}

export interface GhlCursor {
  id: string
  date: string
}

interface Params {
  query: string
  cursor: GhlCursor | null
  limit?: number
  enabled: boolean
}

// Búsqueda EN VIVO sobre GHL (no contra nuestra DB) para el modal de
// importación selectiva. Paginación por cursor (GHL no soporta número de
// página) — el modal mantiene el stack de cursores visitados para "Anterior".
export function useGhlBuscar({ query, cursor, limit = 20, enabled }: Params) {
  return useQuery({
    queryKey: ['ghl-buscar', query, cursor?.id ?? null, cursor?.date ?? null, limit],
    queryFn: () =>
      api
        .get<BuscarGhlResultado>('/contactos/ghl/buscar', {
          params: {
            query: query.trim() || undefined,
            cursorId: cursor?.id,
            cursorDate: cursor?.date,
            limit,
          },
        })
        .then((res) => res.data),
    enabled,
    placeholderData: keepPreviousData,
  })
}
