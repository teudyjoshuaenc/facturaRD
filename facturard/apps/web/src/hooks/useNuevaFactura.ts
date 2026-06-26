'use client'

import { api, getErrorMessage } from '@/lib/api'

export type TipoECF = 'E31' | 'E32' | 'E33' | 'E34' | 'E41' | 'E43' | 'E44' | 'E45' | 'E46' | 'E47'

export interface ItemRow {
  key: string
  nombreItem: string
  cantidad: number
  precioUnitarioItem: number
  indicadorFacturacion: 'I1' | 'I2' | 'I3' | 'I4' | 'E'
  indicadorBienoServicio: 1 | 2
}

export interface ComprobanteFormData {
  tipoECF: TipoECF
  rncComprador: string
  identificadorExtranjero: string
  razonSocialComprador: string
  paisComprador: string
  fechaEmision: string
  condicionPago: 'CONTADO' | 'CREDITO'
  tipoIngresos: '01' | '02' | '03' | '04' | '05' | '06'
  // Información de referencia (E33/E34 obligatorio, resto condicional)
  ncfModificado: string
  fechaNCFModificado: string
  codigoModificacion: '' | '1' | '2' | '3' | '4' | '5'
  items: ItemRow[]
}

function toDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

export function useNuevaFactura() {
  async function createComprobante(data: ComprobanteFormData): Promise<string> {
    try {
      const referencia = data.ncfModificado && data.fechaNCFModificado && data.codigoModificacion
        ? {
            ncfModificado: data.ncfModificado,
            fechaNCFModificado: toDDMMYYYY(data.fechaNCFModificado),
            codigoModificacion: Number(data.codigoModificacion),
          }
        : {}

      const tiposConTipoIngresos: TipoECF[] = ['E31', 'E32', 'E33', 'E34', 'E44', 'E45', 'E46']
      const tiposSinComprador: TipoECF[] = ['E43']

      const res = await api.post<{ eNCF: string }>('/comprobantes', {
        tipoECF: data.tipoECF,
        tipoPago: data.condicionPago === 'CONTADO' ? 1 : 2,
        ...(tiposConTipoIngresos.includes(data.tipoECF) && { tipoIngresos: data.tipoIngresos }),
        fechaEmision: toDDMMYYYY(data.fechaEmision),
        ...(!tiposSinComprador.includes(data.tipoECF) && data.rncComprador && { rncComprador: data.rncComprador }),
        ...(!tiposSinComprador.includes(data.tipoECF) && { razonSocialComprador: data.razonSocialComprador }),
        ...(data.identificadorExtranjero && { identificadorExtranjero: data.identificadorExtranjero }),
        ...(data.paisComprador && { paisComprador: data.paisComprador }),
        ...referencia,
        items: data.items.map((item, i) => ({
          numeroLinea: i + 1,
          indicadorFacturacion: item.indicadorFacturacion,
          nombreItem: item.nombreItem,
          indicadorBienoServicio: item.indicadorBienoServicio,
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
