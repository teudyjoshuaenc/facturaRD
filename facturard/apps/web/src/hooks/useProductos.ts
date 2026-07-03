'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { toast } from 'sonner'

export interface Producto {
  id: string
  nombre: string
  tipo: 'BIEN' | 'SERVICIO'
  codigo: string
  precio: number
  indicadorFacturacion: 'I1' | 'I2' | 'I3' | 'I4' | 'E'
  precioIncluyeItbis: boolean
  unidadMedida?: number
  descuento?: number
  itbisRetenido?: number
  isrRetenido?: number
  aplicarPropinaLegal?: boolean
}

export interface NuevoProductoData {
  nombre: string
  tipo: 'BIEN' | 'SERVICIO'
  codigo: string
  precio: number
  indicadorFacturacion: 'I1' | 'I2' | 'I3' | 'I4' | 'E'
  precioIncluyeItbis: boolean
  unidadMedida?: number
  descuento?: number
  itbisRetenido?: number
  isrRetenido?: number
  aplicarPropinaLegal?: boolean
}

export function useProductos() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')

  const { data: productos = [], isLoading } = useQuery({
    queryKey: ['productos', searchQuery],
    queryFn: async () => {
      const res = await api.get('/productos', {
        params: {
          search: searchQuery.trim() || undefined,
          limit: 100,
        },
      })
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data || [])
      return raw.map((p: any) => {
        const item: Producto = {
          id: p.id,
          nombre: p.nombre,
          tipo: p.tipo as 'BIEN' | 'SERVICIO',
          codigo: p.codigo || '',
          precio: Number(p.precioUnitario),
          indicadorFacturacion: p.tratamientoITBIS === 'EXENTO' ? 'E' : (p.tratamientoITBIS || 'I1'),
          precioIncluyeItbis: false,
        }
        if (p.unidadMedida) {
          item.unidadMedida = Number(p.unidadMedida)
        }
        return item
      }) as Producto[]
    },
  })

  const crearProductoMutation = useMutation({
    mutationFn: async (data: NuevoProductoData) => {
      const body = {
        tipo: data.tipo,
        nombre: data.nombre,
        precioUnitario: data.precio,
        tratamientoITBIS: data.indicadorFacturacion === 'E' || data.indicadorFacturacion === 'I4' ? 'EXENTO' : data.indicadorFacturacion,
        unidadMedida: data.unidadMedida ? String(data.unidadMedida) : undefined,
        codigo: data.codigo || undefined,
      }
      const res = await api.post('/productos', body)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      toast.success('Producto creado correctamente')
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err)
      toast.error('Error al crear el producto', { description: msg })
    },
  })

  const crearProducto = useCallback(
    async (data: NuevoProductoData): Promise<Producto> => {
      const result = await crearProductoMutation.mutateAsync(data)
      const p: Producto = {
        id: result.id,
        nombre: result.nombre,
        tipo: result.tipo as 'BIEN' | 'SERVICIO',
        codigo: result.codigo || '',
        precio: Number(result.precioUnitario),
        indicadorFacturacion: result.tratamientoITBIS === 'EXENTO' ? 'E' : (result.tratamientoITBIS || 'I1'),
        precioIncluyeItbis: false,
      }
      if (result.unidadMedida) {
        p.unidadMedida = Number(result.unidadMedida)
      }
      return p
    },
    [crearProductoMutation],
  )

  return {
    productos,
    allProductos: productos,
    searchQuery,
    setSearchQuery,
    crearProducto,
    isLoading,
  }
}
