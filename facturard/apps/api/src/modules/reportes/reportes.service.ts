import { Injectable } from '@nestjs/common'
import { prisma, TipoECF } from '@facturard/database'
import { ComprobantesService } from '../comprobantes/comprobantes.service'
import type { CreateComprobanteDto } from '../comprobantes/dto/create-comprobante.dto'
import {
  DEFAULT_TIPO_BIENES_606,
  DEFAULT_FORMA_PAGO_606,
  DEFAULT_TIPO_INGRESO_607,
  CODIGO_ANULACION_ECF,
  UMBRAL_CONSUMO_607,
} from './reportes.catalogo'

// Tipos de e-CF de VENTA que entran al 607.
const VENTAS: TipoECF[] = ['E31', 'E32', 'E33', 'E34', 'E44', 'E45', 'E46']

const r2 = (n: number): number => Math.round(n * 100) / 100
const sum = (xs: number[]): number => r2(xs.reduce((a, b) => a + b, 0))
const money = (n: number): string => n.toFixed(2)

function inicioDia(date: string): Date { return new Date(`${date}T00:00:00.000-04:00`) }
function finDia(date: string): Date { return new Date(`${date}T23:59:59.999-04:00`) }

/** 'YYYY-MM-DD' → 'YYYYMM' (periodo del encabezado). */
function periodoAAAAMM(desde: string): string {
  return desde.slice(0, 7).replace('-', '')
}

/** Tipo Identificación DGII: 1=RNC (9 díg.), 2=Cédula (11 díg.), '' si no aplica. */
function tipoId(rnc: string | null | undefined): string {
  if (!rnc) return ''
  if (rnc.length === 9) return '1'
  if (rnc.length === 11) return '2'
  return ''
}

/** DD-MM-YYYY → AAAAMMDD; '' si no parsea. */
function ddmmyyyyToYmd(v: string | undefined): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v ?? '')
  return m ? `${m[3]}${m[2]}${m[1]}` : ''
}
function dateToYmd(d: Date | null): string {
  if (!d) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

// ── Filas (JSON) ──────────────────────────────────────────────────────────────
export interface Reporte607Row {
  rncComprador: string | null
  tipoIdentificacion: string
  ncf: string | null
  ncfModificado: string | null
  tipoIngreso: string
  fechaComprobante: string
  montoFacturado: number
  itbisFacturado: number
  tipoPago: number | null
  tipoECF: string
}
export interface Reporte606Row {
  rncProveedor: string | null
  tipoIdentificacion: string
  tipoBienes: string
  ncf: string | null
  fechaComprobante: string
  totalMontoFacturado: number
  itbisFacturado: number
  itbisRetenido: number
  formaPago: string
  tipo: string
}
export interface Reporte608Row {
  ncf: string | null
  fechaComprobante: string
  tipoAnulacion: string
}

export interface ReporteResult<Row> {
  rncEmisor: string
  periodo: { desde: string; hasta: string }
  periodoFiscal: string
  codigoFormato: '606' | '607' | '608'
  rows: Row[]
  totales: Record<string, number>
}

@Injectable()
export class ReportesService {
  constructor(private readonly comprobantes: ComprobantesService) {}

  private async rncEmisor(tenantId: string): Promise<string> {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { rnc: true } })
    return t?.rnc ?? ''
  }

  // ── 607 Ventas ──────────────────────────────────────────────────────────────
  async reporte607(
    tenantId: string,
    desde: string,
    hasta: string,
  ): Promise<ReporteResult<Reporte607Row> & { resumenConsumo: { cantidad: number; montoTotal: number } }> {
    const comps = await prisma.comprobante.findMany({
      where: { tenantId, estado: 'ACEPTADO', tipoECF: { in: VENTAS }, createdAt: { gte: inicioDia(desde), lte: finDia(hasta) } },
      orderBy: { createdAt: 'asc' },
    })

    // Las E32 < RD$250,000 NO van al detalle (resumen agregado en la OFV).
    const esConsumoResumen = (c: (typeof comps)[number]) =>
      c.tipoECF === 'E32' && Number(c.montoTotal) < UMBRAL_CONSUMO_607
    const detalle = comps.filter((c) => !esConsumoResumen(c))
    const consumo = comps.filter(esConsumoResumen)

    const rows: Reporte607Row[] = detalle.map((c) => {
      const datos = (c.datos ?? {}) as unknown as CreateComprobanteDto
      const t = this.comprobantes.calcularTotalesComprobante(datos.items ?? [])
      const montoFacturado = r2(t.montoGravadoI1 + t.montoGravadoI2 + t.montoGravadoI3 + t.montoExento)
      return {
        rncComprador: c.rnc || null,
        tipoIdentificacion: tipoId(c.rnc),
        ncf: c.eNCF,
        ncfModificado: datos.ncfModificado ?? null,
        tipoIngreso: datos.tipoIngresos ? String(Number(datos.tipoIngresos)) : DEFAULT_TIPO_INGRESO_607,
        fechaComprobante: ddmmyyyyToYmd(datos.fechaEmision),
        montoFacturado,
        itbisFacturado: t.totalITBIS,
        tipoPago: datos.tipoPago ?? null,
        tipoECF: c.tipoECF,
      }
    })

    return {
      rncEmisor: await this.rncEmisor(tenantId),
      periodo: { desde, hasta },
      periodoFiscal: periodoAAAAMM(desde),
      codigoFormato: '607',
      rows,
      totales: {
        registros: rows.length,
        montoFacturado: sum(rows.map((r) => r.montoFacturado)),
        itbisFacturado: sum(rows.map((r) => r.itbisFacturado)),
      },
      resumenConsumo: await this.resumenFacturasConsumo(tenantId, desde, hasta, consumo),
    }
  }

  /**
   * Resumen agregado de Facturas de Consumo (E32 < RD$250,000): NO van línea por
   * línea al TXT del 607; se cargan como total en la OFV. Método separado.
   */
  async resumenFacturasConsumo(
    tenantId: string,
    desde: string,
    hasta: string,
    yaCargadas?: { montoTotal: unknown }[],
  ): Promise<{ cantidad: number; montoTotal: number }> {
    const consumo =
      yaCargadas ??
      (await prisma.comprobante.findMany({
        where: {
          tenantId,
          estado: 'ACEPTADO',
          tipoECF: 'E32',
          montoTotal: { lt: UMBRAL_CONSUMO_607 },
          createdAt: { gte: inicioDia(desde), lte: finDia(hasta) },
        },
        select: { montoTotal: true },
      }))
    return { cantidad: consumo.length, montoTotal: sum(consumo.map((c) => Number(c.montoTotal))) }
  }

  toTxt607(result: ReporteResult<Reporte607Row>): string {
    const detalle = result.rows.map((r) => {
      // Formas de venta (17-23): montos CON impuestos; la suma iguala el total.
      // Sin desglose de medio de pago: contado→Efectivo(17), crédito→Crédito(20).
      const totalConImpuestos = r2(r.montoFacturado + r.itbisFacturado)
      const esCredito = r.tipoPago === 2
      const efectivo = esCredito ? '' : money(totalConImpuestos)
      const credito = esCredito ? money(totalConImpuestos) : ''
      return [
        r.rncComprador ?? '', // 1
        r.tipoIdentificacion, // 2
        r.ncf ?? '', // 3
        r.ncfModificado ?? '', // 4
        r.tipoIngreso, // 5
        r.fechaComprobante, // 6
        '', // 7 Fecha de Retención
        money(r.montoFacturado), // 8
        money(r.itbisFacturado), // 9
        '', // 10 ITBIS Retenido por Terceros
        '', // 11 ITBIS Percibido (no habilitado)
        '', // 12 Retención Renta por Terceros
        '', // 13 ISR Percibido (no habilitado)
        '', // 14 ISC
        '', // 15 Otros Impuestos/Tasas
        '', // 16 Propina Legal
        efectivo, // 17 Efectivo
        '', // 18 Cheque/Transf/Depósito
        '', // 19 Tarjeta
        credito, // 20 Venta a Crédito
        '', // 21 Bonos/Certificados
        '', // 22 Permuta
        '', // 23 Otras Formas de Ventas
      ].join('|')
    })
    return this.armar(result, detalle)
  }

  // ── 606 Compras ─────────────────────────────────────────────────────────────
  async reporte606(tenantId: string, desde: string, hasta: string): Promise<ReporteResult<Reporte606Row>> {
    const compras = await prisma.compraRecibida.findMany({
      where: { tenantId, fechaComprobante: { gte: inicioDia(desde), lte: finDia(hasta) } },
      orderBy: { fechaComprobante: 'asc' },
    })

    const rows: Reporte606Row[] = compras.map((c) => ({
      rncProveedor: c.rncProveedor || null,
      tipoIdentificacion: tipoId(c.rncProveedor),
      tipoBienes: DEFAULT_TIPO_BIENES_606, // configurable por compra; default 09
      ncf: c.ncf ?? null,
      fechaComprobante: dateToYmd(c.fechaComprobante),
      totalMontoFacturado: Number(c.subtotal),
      itbisFacturado: Number(c.itbis),
      itbisRetenido: Number(c.itbisRetenido),
      formaPago: DEFAULT_FORMA_PAGO_606, // default efectivo
      tipo: c.tipo,
    }))

    return {
      rncEmisor: await this.rncEmisor(tenantId),
      periodo: { desde, hasta },
      periodoFiscal: periodoAAAAMM(desde),
      codigoFormato: '606',
      rows,
      totales: {
        registros: rows.length,
        totalMontoFacturado: sum(rows.map((r) => r.totalMontoFacturado)),
        itbisFacturado: sum(rows.map((r) => r.itbisFacturado)),
        itbisRetenido: sum(rows.map((r) => r.itbisRetenido)),
      },
    }
  }

  toTxt606(result: ReporteResult<Reporte606Row>): string {
    const detalle = result.rows.map((r) => {
      const retencion = r.itbisRetenido > 0
      return [
        r.rncProveedor ?? '', // 1
        r.tipoIdentificacion, // 2
        r.tipoBienes, // 3
        r.ncf ?? '', // 4
        '', // 5 NCF/Documento Modificado
        r.fechaComprobante, // 6
        retencion ? r.fechaComprobante : '', // 7 Fecha Pago (con retención)
        '', // 8 Monto Facturado en Servicios
        money(r.totalMontoFacturado), // 9 Monto Facturado en Bienes (todo aquí)
        money(r.totalMontoFacturado), // 10 Total Monto Facturado
        money(r.itbisFacturado), // 11 ITBIS Facturado
        retencion ? money(r.itbisRetenido) : '', // 12 ITBIS Retenido
        '', // 13 ITBIS Proporcionalidad
        '', // 14 ITBIS al Costo
        '', // 15 ITBIS por Adelantar
        '', // 16 ITBIS percibido (no habilitado)
        '', // 17 Tipo Retención ISR
        '', // 18 Monto Retención Renta
        '', // 19 ISR Percibido (no habilitado)
        '', // 20 ISC
        '', // 21 Otros Impuestos/Tasas
        '', // 22 Propina Legal
        r.formaPago, // 23 Forma de Pago
      ].join('|')
    })
    return this.armar(result, detalle)
  }

  // ── 608 Anulados ────────────────────────────────────────────────────────────
  // Anulado = comprobante fuente de una nota (E33/E34) con codigoModificacion=1
  // (anulación total). Con e-CF esto es poco común (se gestiona por nota); el
  // caso normal es "en cero".
  async reporte608(tenantId: string, desde: string, hasta: string): Promise<ReporteResult<Reporte608Row>> {
    const notas = await prisma.comprobante.findMany({
      where: { tenantId, tipoECF: { in: ['E33', 'E34'] }, comprobanteReferenciaId: { not: null } },
      select: { comprobanteReferenciaId: true, datos: true },
    })
    const anuladosIds = notas
      .filter((n) => (n.datos as { codigoModificacion?: number } | null)?.codigoModificacion === 1)
      .map((n) => n.comprobanteReferenciaId as string)

    let rows: Reporte608Row[] = []
    if (anuladosIds.length > 0) {
      const comps = await prisma.comprobante.findMany({
        where: { tenantId, id: { in: anuladosIds }, createdAt: { gte: inicioDia(desde), lte: finDia(hasta) } },
        orderBy: { createdAt: 'asc' },
      })
      rows = comps.map((c) => {
        const datos = (c.datos ?? {}) as unknown as CreateComprobanteDto
        return {
          ncf: c.eNCF,
          fechaComprobante: ddmmyyyyToYmd(datos.fechaEmision),
          tipoAnulacion: CODIGO_ANULACION_ECF, // 4 = Corrección de la información
        }
      })
    }

    return {
      rncEmisor: await this.rncEmisor(tenantId),
      periodo: { desde, hasta },
      periodoFiscal: periodoAAAAMM(desde),
      codigoFormato: '608',
      rows,
      totales: { registros: rows.length },
    }
  }

  toTxt608(result: ReporteResult<Reporte608Row>): string {
    const detalle = result.rows.map((r) => [r.ncf ?? '', r.fechaComprobante, r.tipoAnulacion].join('|'))
    return this.armar(result, detalle)
  }

  // Encabezado (RNC|codigo|periodo|cantidad) + líneas de detalle. Modo "en cero":
  // sólo el encabezado con cantidad=0.
  private armar(result: ReporteResult<unknown>, detalle: string[]): string {
    const header = [result.rncEmisor, result.codigoFormato, result.periodoFiscal, String(detalle.length)].join('|')
    return detalle.length > 0 ? `${header}\n${detalle.join('\n')}` : header
  }

  /** Nombre de archivo oficial: DGII_F_{formato}_{RNC}_{AAAAMM}.TXT */
  nombreArchivo(result: ReporteResult<unknown>): string {
    return `DGII_F_${result.codigoFormato}_${result.rncEmisor}_${result.periodoFiscal}.TXT`
  }
}
