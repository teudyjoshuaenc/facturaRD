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
  /** Detalle libre de la línea → DescripcionItem del e-CF (máx 1000). */
  descripcion?: string
  unidadMedida?: number
  descuento?: number
  itbisRetenido?: number
  isrRetenido?: number
}

export interface ComprobanteFormData {
  tipoECF: TipoECF
  /**
   * Contacto elegido. Se manda SIEMPRE que exista (también en borradores): el
   * RNC no alcanza como identidad —un consumidor final o un contacto sin RNC
   * viaja con rnc:'' y al reabrir el borrador no había forma de reencontrarlo,
   * así que el cliente aparecía vacío y había que elegirlo de nuevo.
   */
  contactoId?: string
  rncComprador: string
  identificadorExtranjero: string
  razonSocialComprador: string
  paisComprador: string
  fechaEmision: string
  condicionPago: 'CONTADO' | 'CREDITO' | 'GRATUITO'
  tipoIngresos: '01' | '02' | '03' | '04' | '05' | '06'
  fechaVencimiento?: string
  terminoPago?: string
  // Información de referencia (E33/E34 obligatorio, resto condicional)
  ncfModificado: string
  fechaNCFModificado: string
  codigoModificacion: '' | '1' | '2' | '3' | '4' | '5'
  indicadorNotaCredito?: 1 | 2
  items: ItemRow[]
  emitirConComprobante?: boolean
  // false = "Nota de venta" interna (no fiscal). Ausente/true = e-CF fiscal.
  esFiscal?: boolean
}

function toDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

export function useNuevaFactura() {
  async function createComprobante(
    data: ComprobanteFormData,
  ): Promise<{ id: string; eNCF: string; montoTotal: number; razonSocial?: string; createdAt?: string }> {
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

      let backendTipoPago = 1
      if (data.condicionPago === 'CREDITO') backendTipoPago = 2
      else if (data.condicionPago === 'GRATUITO') backendTipoPago = 3

      const res = await api.post<{ id: string; eNCF: string; montoTotal: number; razonSocial?: string; createdAt?: string }>('/comprobantes', {
        tipoECF: data.tipoECF,
        tipoPago: backendTipoPago,
        ...(data.esFiscal !== undefined && { esFiscal: data.esFiscal }),
        ...(data.emitirConComprobante !== undefined && { emitir: data.emitirConComprobante }),
        ...(tiposConTipoIngresos.includes(data.tipoECF) && data.tipoIngresos && { tipoIngresos: data.tipoIngresos }),
        ...(data.terminoPago && { terminoPago: data.terminoPago }),
        fechaEmision: toDDMMYYYY(data.fechaEmision),
        ...(data.fechaVencimiento && { fechaVencimiento: toDDMMYYYY(data.fechaVencimiento) }),
        ...(!tiposSinComprador.includes(data.tipoECF) && data.contactoId && { contactoId: data.contactoId }),
        ...(!tiposSinComprador.includes(data.tipoECF) && data.rncComprador && { rncComprador: data.rncComprador }),
        ...(!tiposSinComprador.includes(data.tipoECF) && { razonSocialComprador: data.razonSocialComprador }),
        ...(data.identificadorExtranjero && { identificadorExtranjero: data.identificadorExtranjero }),
        ...(data.paisComprador && { paisComprador: data.paisComprador }),
        ...(data.indicadorNotaCredito && { indicadorNotaCredito: Number(data.indicadorNotaCredito) }),
        ...referencia,
        items: data.items.map((item, i) => ({
          numeroLinea: i + 1,
          indicadorFacturacion: item.indicadorFacturacion,
          nombreItem: item.nombreItem,
          indicadorBienoServicio: item.indicadorBienoServicio,
          cantidad: item.cantidad,
          precioUnitarioItem: item.precioUnitarioItem,
          ...(item.descripcion?.trim() && { descripcion: item.descripcion.trim() }),
          ...(item.unidadMedida && { unidadMedida: item.unidadMedida }),
          ...(item.descuento && { descuento: item.descuento }),
          ...(item.itbisRetenido && { itbisRetenido: item.itbisRetenido }),
          ...(item.isrRetenido && { isrRetenido: item.isrRetenido }),
        })),
      })
      return res.data
    } catch (err) {
      throw new Error(getErrorMessage(err))
    }
  }

  async function updateComprobante(id: string, data: ComprobanteFormData): Promise<{ id: string; eNCF: string; montoTotal: number }> {
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

      let backendTipoPago = 1
      if (data.condicionPago === 'CREDITO') backendTipoPago = 2
      else if (data.condicionPago === 'GRATUITO') backendTipoPago = 3

      // El PATCH edita el documento; NO lleva `emitir` (el UpdateDTO lo omite y la
      // emisión real se hace aparte vía POST /:id/emitir).
      const res = await api.patch<{ id: string; eNCF: string; montoTotal: number }>(`/comprobantes/${id}`, {
        tipoECF: data.tipoECF,
        tipoPago: backendTipoPago,
        ...(tiposConTipoIngresos.includes(data.tipoECF) && data.tipoIngresos && { tipoIngresos: data.tipoIngresos }),
        ...(data.terminoPago && { terminoPago: data.terminoPago }),
        fechaEmision: toDDMMYYYY(data.fechaEmision),
        ...(data.fechaVencimiento && { fechaVencimiento: toDDMMYYYY(data.fechaVencimiento) }),
        ...(!tiposSinComprador.includes(data.tipoECF) && data.contactoId && { contactoId: data.contactoId }),
        ...(!tiposSinComprador.includes(data.tipoECF) && data.rncComprador && { rncComprador: data.rncComprador }),
        ...(!tiposSinComprador.includes(data.tipoECF) && { razonSocialComprador: data.razonSocialComprador }),
        ...(data.identificadorExtranjero && { identificadorExtranjero: data.identificadorExtranjero }),
        ...(data.paisComprador && { paisComprador: data.paisComprador }),
        ...(data.indicadorNotaCredito && { indicadorNotaCredito: Number(data.indicadorNotaCredito) }),
        ...referencia,
        items: data.items.map((item, i) => ({
          numeroLinea: i + 1,
          indicadorFacturacion: item.indicadorFacturacion,
          nombreItem: item.nombreItem,
          indicadorBienoServicio: item.indicadorBienoServicio,
          cantidad: item.cantidad,
          precioUnitarioItem: item.precioUnitarioItem,
          ...(item.descripcion?.trim() && { descripcion: item.descripcion.trim() }),
          ...(item.unidadMedida && { unidadMedida: item.unidadMedida }),
          ...(item.descuento && { descuento: item.descuento }),
          ...(item.itbisRetenido && { itbisRetenido: item.itbisRetenido }),
          ...(item.isrRetenido && { isrRetenido: item.isrRetenido }),
        })),
      })
      return res.data
    } catch (err) {
      throw new Error(getErrorMessage(err))
    }
  }

  return { createComprobante, updateComprobante }
}
