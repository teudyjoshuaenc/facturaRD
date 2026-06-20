'use client'

import { api, getErrorMessage } from '@/lib/api'

export interface ItemRow {
  key: string
  nombreItem: string
  cantidad: number
  precioUnitarioItem: number
}

export interface ComprobanteFormData {
  tipoECF: 'E31' | 'E32'
  rncComprador: string
  razonSocialComprador: string
  fechaEmision: string
  condicionPago: 'CONTADO' | 'CREDITO'
  items: ItemRow[]
}

function toDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

export function useNuevaFactura() {
  async function createComprobante(data: ComprobanteFormData): Promise<string> {
    try {
      const res = await api.post<{ eNCF: string }>('/comprobantes', {
        tipoECF: data.tipoECF,
        tipoPago: data.condicionPago === 'CONTADO' ? 1 : 2,
        tipoIngresos: '01',
        fechaEmision: toDDMMYYYY(data.fechaEmision),
        rncComprador: data.rncComprador || undefined,
        razonSocialComprador: data.razonSocialComprador,
        items: data.items.map((item, i) => ({
          numeroLinea: i + 1,
          indicadorFacturacion: 'I1',
          nombreItem: item.nombreItem,
          indicadorBienoServicio: 2,
          cantidad: item.cantidad,
          precioUnitarioItem: item.precioUnitarioItem,
        })),
      })
      return res.data.eNCF
    } catch (err) {
      throw new Error(getErrorMessage(err))
    }
  }

  return { createComprobante }
}
