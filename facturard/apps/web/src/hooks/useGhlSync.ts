'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'

// GET /tenants ya NO devuelve el token; expone `ghlConectado` (booleano) y el
// campo ghlRncFieldKey.
interface TenantConGhl {
  id: string
  ghlConectado?: boolean
  ghlRncFieldKey?: string | null
}

export interface SyncResultado {
  importados: number
  actualizados: number
  sinRnc: number
}

export function useGhlSync() {
  const queryClient = useQueryClient()

  const { data: tenant } = useQuery({
    queryKey: ['tenant-info'],
    queryFn: () => api.get<TenantConGhl[]>('/tenants').then((res) => res.data[0]),
  })

  const conectado = Boolean(tenant?.ghlConectado)
  const rncFieldKey = tenant?.ghlRncFieldKey ?? ''

  const guardarConexion = useMutation({
    // El token es opcional: si se omite (y ya hay uno guardado), el backend lo
    // conserva y solo actualiza el campo RNC.
    mutationFn: (vars: { ghlAccessToken?: string; ghlRncFieldKey?: string }) =>
      api.patch('/contactos/configurar-ghl', {
        ...(vars.ghlAccessToken?.trim() ? { ghlAccessToken: vars.ghlAccessToken.trim() } : {}),
        ghlRncFieldKey: vars.ghlRncFieldKey?.trim() || undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-info'] }),
  })

  // Sin ids → sincroniza TODO el location (botón "Importar todos"). Con ids →
  // solo esos contactos (selección hecha en el modal de importación).
  const sincronizar = useMutation({
    mutationFn: (ghlContactIds?: string[]) =>
      api
        .post<SyncResultado>('/contactos/sincronizar-ghl', ghlContactIds?.length ? { ghlContactIds } : {})
        .then((res) => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contactos'] }),
  })

  return {
    conectado,
    rncFieldKey,
    guardarConexion,
    sincronizar,
    getErrorMessage,
  }
}
