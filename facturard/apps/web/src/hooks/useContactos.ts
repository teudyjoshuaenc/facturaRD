'use client'

import { useState, useMemo, useCallback } from 'react'

export interface Contacto {
  id: string
  nombre: string
  rnc: string
  email: string
  telefono: string
  tipo: 'EMPRESA' | 'PERSONA'
}

// Mock data — replace with API calls when endpoints are ready
const MOCK_CONTACTOS: Contacto[] = [
  { id: 'c1', nombre: 'Distribuidora López SRL', rnc: '130567891', email: 'info@distlopez.com.do', telefono: '809-555-0101', tipo: 'EMPRESA' },
  { id: 'c2', nombre: 'Comercial Díaz & Asociados', rnc: '101234567', email: 'ventas@cdiaz.com.do', telefono: '809-555-0202', tipo: 'EMPRESA' },
  { id: 'c3', nombre: 'Importadora Caribe', rnc: '131793916', email: 'compras@importcaribe.do', telefono: '809-555-0303', tipo: 'EMPRESA' },
  { id: 'c4', nombre: 'Constructora Del Este', rnc: '130874523', email: 'admin@consteste.do', telefono: '809-555-0404', tipo: 'EMPRESA' },
  { id: 'c5', nombre: 'Farmacia Central EIRL', rnc: '101234567', email: 'central@farmacias.do', telefono: '809-555-0505', tipo: 'EMPRESA' },
  { id: 'c6', nombre: 'Restaurante El Corusco', rnc: '401012345', email: 'reservas@elcorusco.do', telefono: '809-555-0606', tipo: 'EMPRESA' },
]

export interface NuevoContactoData {
  nombre: string
  rnc: string
  email: string
  telefono: string
  tipo: 'EMPRESA' | 'PERSONA'
}

export function useContactos() {
  const [contactos, setContactos] = useState<Contacto[]>(MOCK_CONTACTOS)
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return contactos
    const q = searchQuery.toLowerCase()
    return contactos.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.rnc.includes(q),
    )
  }, [contactos, searchQuery])

  const frecuentes = useMemo(() => contactos.slice(0, 4), [contactos])

  const crearContacto = useCallback((data: NuevoContactoData): Contacto => {
    const nuevo: Contacto = {
      id: `c-${Date.now()}`,
      ...data,
    }
    setContactos((prev) => [nuevo, ...prev])
    return nuevo
  }, [])

  return {
    contactos: filtered,
    frecuentes,
    searchQuery,
    setSearchQuery,
    crearContacto,
  }
}
