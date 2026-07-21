'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { toast } from 'sonner'
import type { PaginatedResponse } from '@/lib/comprobantes'

// ─── Tipos (espejo de la respuesta del backend /finanzas) ────────────────────

export type MovimientoTipo = 'INGRESO' | 'EGRESO'
export type MovimientoCategoria =
  | 'NOMINA'
  | 'ALQUILER'
  | 'SERVICIOS'
  | 'PRESTAMO'
  | 'APORTE_CAPITAL'
  | 'IMPUESTOS'
  | 'OTROS'
export type Vista = 'devengado' | 'cobrado'
export type Agrupacion = 'mes' | 'semana'

export const CATEGORIA_LABELS: Record<MovimientoCategoria, string> = {
  NOMINA: 'Nómina',
  ALQUILER: 'Alquiler',
  SERVICIOS: 'Servicios',
  PRESTAMO: 'Préstamo',
  APORTE_CAPITAL: 'Aporte de capital',
  IMPUESTOS: 'Impuestos',
  OTROS: 'Otros',
}

export const CATEGORIA_OPTIONS = (Object.keys(CATEGORIA_LABELS) as MovimientoCategoria[]).map((v) => ({
  value: v,
  label: CATEGORIA_LABELS[v],
}))

export interface MovimientoFinanciero {
  id: string
  tenantId: string
  tipo: MovimientoTipo
  categoria: MovimientoCategoria
  monto: string | number
  moneda: string
  fecha: string
  descripcion: string | null
  metodoPago: string | null
  createdAt: string
  updatedAt: string
}

interface TotalesVista {
  ingresos: number
  egresos: number
  balance: number
  capitalAcumulado: number
}
export interface FinanzasResumen {
  moneda: string
  capitalInicial: number
  devengado: TotalesVista & {
    ingresosFiscal: number
    ingresosNotaVenta: number
    ingresosManual: number
    egresosCompras: number
    egresosManual: number
  }
  cobrado: TotalesVista
}

export interface FlujoPunto {
  periodo: string
  ingresos: number
  egresos: number
  balance: number
}
export interface FlujoResponse {
  agrupacion: Agrupacion
  vista: Vista
  serie: FlujoPunto[]
}

export interface CategoriaRow {
  categoria: MovimientoCategoria
  ingresos: number
  egresos: number
  neto: number
}

export interface CapitalInicial {
  tenantId: string
  monto: string | number
  moneda: string
  fecha: string | null
}

export type TransaccionOrigen =
  | 'FACTURA'
  | 'NOTA_VENTA'
  | 'NOTA_CREDITO'
  | 'COMPRA'
  | 'MOVIMIENTO'
  | 'COBRO'
  | 'PAGO'

export const ORIGEN_LABELS: Record<TransaccionOrigen, string> = {
  FACTURA: 'Factura',
  NOTA_VENTA: 'Nota de venta',
  NOTA_CREDITO: 'Nota de crédito',
  COMPRA: 'Compra',
  MOVIMIENTO: 'Manual',
  COBRO: 'Cobro',
  PAGO: 'Pago',
}

export interface Transaccion {
  id: string
  fecha: string
  monto: number // firmado: + entrada / − salida
  tipo: 'INGRESO' | 'EGRESO'
  origen: TransaccionOrigen
  referencia: string | null
  descripcion: string | null
  categoria: MovimientoCategoria | null
  movimientoId: string | null
}

export interface TransaccionesParams extends Rango {
  tipo?: 'INGRESO' | 'EGRESO'
  origen?: TransaccionOrigen
  vista?: Vista
  page?: number
  limit?: number
}

export interface NuevoMovimiento {
  tipo: MovimientoTipo
  categoria: MovimientoCategoria
  monto: number
  fecha: string
  descripcion?: string
  metodoPago?: string
}

// ─── Rango ───────────────────────────────────────────────────────────────────

interface Rango {
  desde?: string
  hasta?: string
}

// ─── Queries de lectura ──────────────────────────────────────────────────────

export function useFinanzasResumen({ desde, hasta }: Rango) {
  return useQuery({
    queryKey: ['finanzas-resumen', desde, hasta],
    queryFn: () =>
      api.get<FinanzasResumen>('/finanzas/resumen', { params: { desde, hasta } }).then((r) => r.data),
    staleTime: 60 * 1000,
  })
}

export function useFinanzasFlujo({ desde, hasta, agrupacion, vista }: Rango & { agrupacion: Agrupacion; vista: Vista }) {
  return useQuery({
    queryKey: ['finanzas-flujo', desde, hasta, agrupacion, vista],
    queryFn: () =>
      api.get<FlujoResponse>('/finanzas/flujo', { params: { desde, hasta, agrupacion, vista } }).then((r) => r.data),
    staleTime: 60 * 1000,
  })
}

export function useFinanzasCategorias({ desde, hasta }: Rango) {
  return useQuery({
    queryKey: ['finanzas-categorias', desde, hasta],
    queryFn: () =>
      api.get<{ categorias: CategoriaRow[] }>('/finanzas/categorias', { params: { desde, hasta } }).then((r) => r.data),
    staleTime: 60 * 1000,
  })
}

export function useMovimientos({
  desde,
  hasta,
  tipo,
  categoria,
  page = 1,
  limit = 20,
}: Rango & { tipo?: MovimientoTipo; categoria?: MovimientoCategoria; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['finanzas-movimientos', desde, hasta, tipo, categoria, page, limit],
    queryFn: () =>
      api
        .get<PaginatedResponse<MovimientoFinanciero>>('/finanzas/movimientos', {
          params: { desde, hasta, tipo, categoria, page, limit },
        })
        .then((r) => r.data),
    staleTime: 30 * 1000,
  })
}

export function useCapital() {
  return useQuery({
    queryKey: ['finanzas-capital'],
    queryFn: () => api.get<CapitalInicial>('/finanzas/capital').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })
}

export function useTransacciones(params: TransaccionesParams) {
  return useQuery({
    queryKey: [
      'finanzas-transacciones',
      params.desde,
      params.hasta,
      params.tipo,
      params.origen,
      params.vista,
      params.page,
      params.limit,
    ],
    queryFn: () =>
      api.get<PaginatedResponse<Transaccion>>('/finanzas/transacciones', { params }).then((r) => r.data),
    staleTime: 30 * 1000,
  })
}

// Trae TODO el período con los filtros actuales (cap backend 5000) para exportar.
export async function fetchTransaccionesExport(params: TransaccionesParams): Promise<Transaccion[]> {
  const res = await api.get<PaginatedResponse<Transaccion>>('/finanzas/transacciones', {
    params: { ...params, page: 1, limit: 5000 },
  })
  return res.data.data
}

// ─── Mutaciones ──────────────────────────────────────────────────────────────

function useInvalidarFinanzas() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('finanzas') })
}

export function useCrearMovimiento() {
  const invalidar = useInvalidarFinanzas()
  return useMutation({
    mutationFn: (data: NuevoMovimiento) => api.post('/finanzas/movimientos', data).then((r) => r.data),
    onSuccess: () => {
      invalidar()
      toast.success('Movimiento registrado')
    },
    onError: (err) => toast.error('No se pudo registrar', { description: getErrorMessage(err) }),
  })
}

export function useActualizarMovimiento() {
  const invalidar = useInvalidarFinanzas()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NuevoMovimiento> }) =>
      api.patch(`/finanzas/movimientos/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      invalidar()
      toast.success('Movimiento actualizado')
    },
    onError: (err) => toast.error('No se pudo actualizar', { description: getErrorMessage(err) }),
  })
}

export function useEliminarMovimiento() {
  const invalidar = useInvalidarFinanzas()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/finanzas/movimientos/${id}`).then((r) => r.data),
    onSuccess: () => {
      invalidar()
      toast.success('Movimiento eliminado')
    },
    onError: (err) => toast.error('No se pudo eliminar', { description: getErrorMessage(err) }),
  })
}

export function useSetCapital() {
  const invalidar = useInvalidarFinanzas()
  return useMutation({
    mutationFn: (data: { monto: number; fecha: string }) => api.put('/finanzas/capital', data).then((r) => r.data),
    onSuccess: () => {
      invalidar()
      toast.success('Capital inicial actualizado')
    },
    onError: (err) => toast.error('No se pudo guardar', { description: getErrorMessage(err) }),
  })
}
