'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ─── Tipos (espejo de la respuesta del backend /presupuesto) ────────────────

export interface IngresoLinea {
  nombre: string
  montoMensual: number
  crecimientoPct: number
}

export interface CostoFijoLinea {
  nombre: string
  categoria?: string
  montoMensual: number
}

export interface PresupuestoConfig {
  sector: string | null
  moneda: string
  mesFiscalInicio: number
  colchonMeses: number
  metaMargenPct: number
  varPct: number
  cxcInicial: number
  cxpInicial: number
  ingresos: IngresoLinea[]
  costosFijos: CostoFijoLinea[]
  // false = el tenant nunca guardó nada — dispara el wizard de onboarding.
  configurado: boolean
}

export interface FilaProyeccion {
  indice: number
  mes: string
  entra: number
  fijo: number
  variable: number
  neto: number
  saldo: number
}

export interface ProyeccionResult {
  filas: FilaProyeccion[]
  resumen: {
    totalEntradas: number
    totalSalidas: number
    totalNeto: number
    margenPct: number
    puntoEquilibrio: number
    saldoFinal: number
    colchonMonto: number
  }
  alertas: {
    quiebre: { indice: number; mes: string; saldo: number } | null
    riesgoColchon: { indice: number; mes: string; saldo: number } | null
  }
}

export interface ComparacionResult {
  real: { ingresos: number; egresos: number }
  presupuestado: { ingresos: number; egresos: number }
}

export function usePresupuestoConfig() {
  return useQuery({
    queryKey: ['presupuesto-config'],
    queryFn: () => api.get<PresupuestoConfig>('/presupuesto/config').then((r) => r.data),
  })
}

export function useGuardarPresupuestoConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<PresupuestoConfig, 'configurado'>) =>
      api.put<PresupuestoConfig>('/presupuesto/config', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presupuesto-config'] })
      queryClient.invalidateQueries({ queryKey: ['presupuesto-proyeccion'] })
      queryClient.invalidateQueries({ queryKey: ['presupuesto-comparacion'] })
    },
  })
}

export function useProyeccion(enabled = true) {
  return useQuery({
    queryKey: ['presupuesto-proyeccion'],
    queryFn: () => api.get<ProyeccionResult>('/presupuesto/proyeccion').then((r) => r.data),
    enabled,
  })
}

export function useComparacion(mes: string, enabled = true) {
  return useQuery({
    queryKey: ['presupuesto-comparacion', mes],
    queryFn: () => api.get<ComparacionResult>('/presupuesto/comparacion', { params: { mes } }).then((r) => r.data),
    enabled,
  })
}
