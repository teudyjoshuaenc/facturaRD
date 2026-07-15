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
  activo?: boolean
  unidadMedida?: number
  descuento?: number
  itbisRetenido?: number
  isrRetenido?: number
  aplicarPropinaLegal?: boolean
  activo: boolean
  descripcion?: string
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
  descripcion?: string
}

export interface UseProductosParams {
  activo?: boolean
}

// options.activo controla el filtro de 3 estados del backend:
//   undefined → todos (activos e inactivos) — usado por la GESTIÓN del catálogo.
//   true → sólo activos — usado por el SELECTOR de emisión (no se factura con bajas).
//   false → sólo inactivos.
export function useProductos(options?: { activo?: boolean }) {
  export function useProductos(params?: UseProductosParams) {
    const queryClient = useQueryClient()
    const [searchQuery, setSearchQuery] = useState('')
    const activo = params?.activo

    const { data: productos = [], isLoading } = useQuery({
      queryKey: ['productos', searchQuery, options?.activo],
      const { data: productos = [], isLoading, refetch, isFetching } = useQuery({
        queryKey: ['productos', searchQuery, activo],
        queryFn: async () => {
          const res = await api.get('/productos', {
            params: {
              search: searchQuery.trim() || undefined,
              activo: options?.activo,
              activo: activo,
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
              activo: p.activo !== false,
              activo: p.activo !== false,
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
            activo: result.activo !== false,
            activo: result.activo !== false,
          }
          if (result.unidadMedida) {
            p.unidadMedida = Number(result.unidadMedida)
          }
          return p
        },
        [crearProductoMutation],
      )

  const actualizarProductoMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<NuevoProductoData> & { activo?: boolean } }) => {
          const body = {
            ...(data.tipo !== undefined && { tipo: data.tipo }),
            ...(data.nombre !== undefined && { nombre: data.nombre }),
            ...(data.precio !== undefined && { precioUnitario: data.precio }),
            ...(data.indicadorFacturacion !== undefined && {
              tratamientoITBIS: data.indicadorFacturacion === 'E' || data.indicadorFacturacion === 'I4' ? 'EXENTO' : data.indicadorFacturacion,
            }),
            ...(data.unidadMedida !== undefined && { unidadMedida: data.unidadMedida ? String(data.unidadMedida) : null }),
            ...(data.codigo !== undefined && { codigo: data.codigo || null }),
            ...(data.activo !== undefined && { activo: data.activo }),
          }
          const res = await api.patch(`/productos/${id}`, body)
          return res.data
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['productos'] })
          toast.success('Producto actualizado correctamente')
        },
        onError: (err: any) => {
          const msg = getErrorMessage(err)
          toast.error('Error al actualizar el producto', { description: msg })
        },
      })

  const actualizarProducto = useCallback(
        async (id: string, data: Partial<NuevoProductoData> & { activo?: boolean }): Promise<Producto> => {
          const result = await actualizarProductoMutation.mutateAsync({ id, data })
          const p: Producto = {
            id: result.id,
            nombre: result.nombre,
            tipo: result.tipo as 'BIEN' | 'SERVICIO',
            codigo: result.codigo || '',
            precio: Number(result.precioUnitario),
            indicadorFacturacion: result.tratamientoITBIS === 'EXENTO' ? 'E' : (result.tratamientoITBIS || 'I1'),
            precioIncluyeItbis: false,
            activo: result.activo !== false,
          }
          if (result.unidadMedida) {
            p.unidadMedida = Number(result.unidadMedida)
          }
          return p
        },
        [actualizarProductoMutation],
      )

  const eliminarProductoMutation = useMutation({
        mutationFn: async (id: string) => {
          const res = await api.delete(`/productos/${id}`)
          return res.data
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['productos'] })
          toast.success('Producto eliminado correctamente')
        },
        onError: (err: any) => {
          const msg = getErrorMessage(err)
          toast.error('Error al eliminar el producto', { description: msg })
        },
      })

  const eliminarProducto = useCallback(
        async (id: string): Promise<void> => {
          await eliminarProductoMutation.mutateAsync(id)
        },
        [eliminarProductoMutation],
      )

  return {
        productos,
        allProductos: productos,
        searchQuery,
        setSearchQuery,
        crearProducto,
        actualizarProducto,
        eliminarProducto,
        isLoading,
        isFetching,
        refetch,
      }
    }

