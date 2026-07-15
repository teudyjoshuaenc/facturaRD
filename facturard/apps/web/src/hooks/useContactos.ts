'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { toast } from 'sonner'

export interface Contacto {
  id: string
  nombre: string
  rnc: string
  email: string
  telefono: string
  tipo: 'EMPRESA' | 'PERSONA'
  idExtranjero?: string
  direccion?: string
  provincia?: string
  municipio?: string
  comentarios?: string
  validacion?: 'VALIDO' | 'NO_ENCONTRADO'
  totalFacturado?: number
  fecha?: string
  estado?: 'ACTIVO' | 'INACTIVO' | 'OCASIONAL'
}

export interface NuevoContactoData {
  nombre: string
  rnc: string
  email: string
  telefono: string
  tipo: 'CLIENTE' | 'PROVEEDOR' | 'CONSUMIDOR_FINAL'
  idExtranjero?: string
  direccion?: string
  provincia?: string
  municipio?: string
  comentarios?: string
}

export function useContactos() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')

  // Este hook alimenta el SELECTOR de emisión (nueva-factura): pide sólo activos
  // para no permitir facturar con contactos dados de baja. La GESTIÓN del
  // directorio usa useContactosDirectorio (sin filtro → ve todos).
  const { data: contactos = [], isLoading } = useQuery({
    queryKey: ['contactos', 'emision', searchQuery],
    queryFn: async () => {
      const res = await api.get('/contactos', {
        params: {
          search: searchQuery.trim() || undefined,
          activo: true,
          limit: 100,
        },
      })
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data || [])
      return raw.map((c: any) => ({
        id: c.id,
        nombre: c.razonSocial || c.nombreComercial || 'Sin nombre',
        rnc: c.rnc || '',
        email: c.email || '',
        telefono: c.telefono || '',
        tipo: c.tipo === 'CONSUMIDOR_FINAL' ? 'PERSONA' : 'EMPRESA',
        idExtranjero: c.identificadorExtranjero || '',
        direccion: c.direccion || '',
        provincia: '',
        municipio: '',
        comentarios: '',
        validacion: c.rncValidado ? 'VALIDO' : 'NO_ENCONTRADO',
        totalFacturado: 0,
        fecha: new Date(c.updatedAt || c.createdAt || Date.now()).toISOString().split('T')[0] ?? '',
        estado: c.activo ? 'ACTIVO' : 'INACTIVO',
      })) as Contacto[]
    },
  })

  const frecuentes = useMemo(() => contactos.slice(0, 4), [contactos])

  const crearContactoMutation = useMutation({
    mutationFn: async (data: NuevoContactoData) => {
      const cleanRnc = data.rnc.replace(/\D/g, '')

      const body = {
        tipo: data.tipo,
        rnc: cleanRnc || undefined,
        razonSocial: data.nombre,
        email: data.email || undefined,
        telefono: data.telefono.replace(/\D/g, '') || undefined,
        direccion: data.direccion || undefined,
        identificadorExtranjero: data.idExtranjero || undefined,
      }

      const res = await api.post('/contactos', body)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactos'] })
      toast.success('Contacto creado correctamente')
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err)
      toast.error('Error al crear el contacto', { description: msg })
    },
  })

  const crearContacto = useCallback(
    async (data: NuevoContactoData): Promise<Contacto> => {
      const result = await crearContactoMutation.mutateAsync(data)
      return {
        id: result.id,
        nombre: result.razonSocial || result.nombreComercial || '',
        rnc: result.rnc || '',
        email: result.email || '',
        telefono: result.telefono || '',
        tipo: result.tipo === 'CONSUMIDOR_FINAL' ? 'PERSONA' : 'EMPRESA',
        idExtranjero: result.identificadorExtranjero || '',
        direccion: result.direccion || '',
        provincia: '',
        municipio: '',
        comentarios: '',
        validacion: result.rncValidado ? 'VALIDO' : 'NO_ENCONTRADO',
        totalFacturado: 0,
        fecha: new Date(result.updatedAt || result.createdAt || Date.now()).toISOString().split('T')[0] ?? '',
        estado: result.activo ? 'ACTIVO' : 'INACTIVO',
      }
    },
    [crearContactoMutation],
  )

  const actualizarContactoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.patch(`/contactos/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactos'] })
    },
  })

  return {
    contactos,
    frecuentes,
    searchQuery,
    setSearchQuery,
    crearContacto,
    actualizarContacto: actualizarContactoMutation,
    isLoading,
  }
}
