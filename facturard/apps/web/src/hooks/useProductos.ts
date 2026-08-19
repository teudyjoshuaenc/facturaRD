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
  /** Monto exacto tecleado si se capturó con ITBIS incluido. Sólo para re-mostrar. */
  precioCaptura?: number | null
  activo?: boolean
  unidadMedida?: number
  descuento?: number
  itbisRetenido?: number
  isrRetenido?: number
  aplicarPropinaLegal?: boolean
  descripcion?: string
  /** true → guardado sin terminar: no se puede facturar hasta publicarlo. */
  borrador?: boolean
}

export interface NuevoProductoData {
  nombre: string
  tipo: 'BIEN' | 'SERVICIO'
  codigo: string
  precio: number
  indicadorFacturacion: 'I1' | 'I2' | 'I3' | 'I4' | 'E'
  precioIncluyeItbis: boolean
  precioCaptura?: number | null
  unidadMedida?: number
  descuento?: number
  itbisRetenido?: number
  isrRetenido?: number
  aplicarPropinaLegal?: boolean
  descripcion?: string
  borrador?: boolean
}

export interface UseProductosParams {
  activo?: boolean
  /** Omitir → sólo publicados (selector de emisión). 'todos' → gestión del catálogo. */
  clase?: 'publicado' | 'borrador' | 'todos'
}

// options.activo controla el filtro de 3 estados del backend:
//   undefined → todos (activos e inactivos) — usado por la GESTIÓN del catálogo.
//   true → sólo activos — usado por el SELECTOR de emisión (no se factura con bajas).
//   false → sólo inactivos.
export function useProductos(options?: UseProductosParams) {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')

  const { data: productos = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['productos', searchQuery, options?.activo, options?.clase],
    queryFn: async () => {
      const res = await api.get('/productos', {
        params: {
          search: searchQuery.trim() || undefined,
          activo: options?.activo,
          clase: options?.clase,
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
          precioIncluyeItbis: p.precioIncluyeItbis === true,
          precioCaptura: p.precioCaptura != null ? Number(p.precioCaptura) : null,
          activo: p.activo !== false,
          borrador: p.borrador === true,
          ...(p.descripcion ? { descripcion: p.descripcion as string } : {}),
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
      const esBorrador = data.borrador === true
      const body = {
        tipo: data.tipo,
        nombre: data.nombre,
        // Un borrador puede guardarse sin precio; el backend no lo exige.
        ...(esBorrador && !(data.precio > 0) ? {} : { precioUnitario: data.precio }),
        ...(esBorrador ? { borrador: true } : {}),
        // Modo de captura: el precio que va arriba YA es la base sin ITBIS.
        precioIncluyeItbis: data.precioIncluyeItbis === true,
        ...(data.precioCaptura != null ? { precioCaptura: data.precioCaptura } : {}),
        tratamientoITBIS: data.indicadorFacturacion === 'E' || data.indicadorFacturacion === 'I4' ? 'EXENTO' : data.indicadorFacturacion,
        unidadMedida: data.unidadMedida ? String(data.unidadMedida) : undefined,
        codigo: data.codigo || undefined,
        descripcion: data.descripcion || undefined,
      }
      const res = await api.post('/productos', body)
      return res.data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      toast.success(vars.borrador === true ? 'Borrador guardado' : 'Producto creado correctamente')
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
        precioIncluyeItbis: result.precioIncluyeItbis === true,
        precioCaptura: result.precioCaptura != null ? Number(result.precioCaptura) : null,
        activo: result.activo !== false,
        borrador: result.borrador === true,
        ...(result.descripcion ? { descripcion: result.descripcion as string } : {}),
      }
      if (result.unidadMedida) {
        p.unidadMedida = Number(result.unidadMedida)
      }
      return p
    },
    [crearProductoMutation],
  )

  const actualizarProductoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NuevoProductoData> & { activo?: boolean; borrador?: boolean } }) => {
      const body = {
        ...(data.tipo !== undefined && { tipo: data.tipo }),
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.precio !== undefined && { precioUnitario: data.precio }),
        ...(data.indicadorFacturacion !== undefined && {
          tratamientoITBIS: data.indicadorFacturacion === 'E' || data.indicadorFacturacion === 'I4' ? 'EXENTO' : data.indicadorFacturacion,
        }),
        ...(data.unidadMedida !== undefined && { unidadMedida: data.unidadMedida ? String(data.unidadMedida) : null }),
        ...(data.codigo !== undefined && { codigo: data.codigo || null }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
        ...(data.activo !== undefined && { activo: data.activo }),
        ...(data.borrador !== undefined && { borrador: data.borrador }),
        ...(data.precioIncluyeItbis !== undefined && { precioIncluyeItbis: data.precioIncluyeItbis }),
        ...(data.precioCaptura !== undefined && { precioCaptura: data.precioCaptura }),
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
    async (id: string, data: Partial<NuevoProductoData> & { activo?: boolean; borrador?: boolean }): Promise<Producto> => {
      const result = await actualizarProductoMutation.mutateAsync({ id, data })
      const p: Producto = {
        id: result.id,
        nombre: result.nombre,
        tipo: result.tipo as 'BIEN' | 'SERVICIO',
        codigo: result.codigo || '',
        precio: Number(result.precioUnitario),
        indicadorFacturacion: result.tratamientoITBIS === 'EXENTO' ? 'E' : (result.tratamientoITBIS || 'I1'),
        precioIncluyeItbis: result.precioIncluyeItbis === true,
        precioCaptura: result.precioCaptura != null ? Number(result.precioCaptura) : null,
        activo: result.activo !== false,
        borrador: result.borrador === true,
        ...(result.descripcion ? { descripcion: result.descripcion as string } : {}),
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
