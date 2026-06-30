'use client'

import { useState, useMemo, useCallback } from 'react'

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

// Mock data — replace with API calls when endpoints are ready
const MOCK_PRODUCTOS: Producto[] = [
  { id: 'p1', nombre: 'Salami Induveca 1lb', tipo: 'BIEN', codigo: 'SAL-001', precio: 325.00, indicadorFacturacion: 'I1', precioIncluyeItbis: false },
  { id: 'p2', nombre: 'Queso de Freír Sosúa', tipo: 'BIEN', codigo: 'QUE-001', precio: 280.00, indicadorFacturacion: 'I1', precioIncluyeItbis: false },
  { id: 'p3', nombre: 'Cerveza Presidente 12oz', tipo: 'BIEN', codigo: 'CER-001', precio: 195.00, indicadorFacturacion: 'I1', precioIncluyeItbis: true },
  { id: 'p4', nombre: 'Pan de Agua (unidad)', tipo: 'BIEN', codigo: 'PAN-001', precio: 15.00, indicadorFacturacion: 'I4', precioIncluyeItbis: false },
  { id: 'p5', nombre: 'Servicio de Consultoría TI', tipo: 'SERVICIO', codigo: 'SRV-001', precio: 5000.00, indicadorFacturacion: 'I1', precioIncluyeItbis: false },
  { id: 'p6', nombre: 'Mantenimiento de Equipos', tipo: 'SERVICIO', codigo: 'SRV-002', precio: 2500.00, indicadorFacturacion: 'I1', precioIncluyeItbis: false },
]

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
  const [productos, setProductos] = useState<Producto[]>(MOCK_PRODUCTOS)
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return productos
    const q = searchQuery.toLowerCase()
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q),
    )
  }, [productos, searchQuery])

  const crearProducto = useCallback((data: NuevoProductoData): Producto => {
    const nuevo: Producto = {
      id: `p-${Date.now()}`,
      ...data,
    }
    setProductos((prev) => [nuevo, ...prev])
    return nuevo
  }, [])

  return {
    productos: filtered,
    allProductos: productos,
    searchQuery,
    setSearchQuery,
    crearProducto,
  }
}
