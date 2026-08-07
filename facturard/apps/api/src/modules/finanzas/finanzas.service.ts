import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { Prisma, prisma, ComprobanteEstado } from '@facturard/database'
import type { MovimientoFinanciero, Pago, CapitalInicial, CajaDiaria } from '@facturard/database'
import type { PaginatedResponse } from '@facturard/shared'
import type { CreateMovimientoDto } from './dto/create-movimiento.dto'
import type { UpdateMovimientoDto } from './dto/update-movimiento.dto'
import type { ListMovimientosDto } from './dto/list-movimientos.dto'
import type { CreatePagoDto } from './dto/create-pago.dto'
import type { ListPagosDto } from './dto/list-pagos.dto'
import type { SetCapitalDto } from './dto/set-capital.dto'
import type { RangoDto } from './dto/rango.dto'
import type { FlujoDto } from './dto/flujo.dto'
import type { SaldoDto } from './dto/saldo.dto'
import type { ListTransaccionesDto } from './dto/list-transacciones.dto'
import type { AperturaCajaDto } from './dto/apertura-caja.dto'
import type { CierreCajaDto } from './dto/cierre-caja.dto'
import type { ListCajaDto } from './dto/list-caja.dto'

export type TransaccionOrigen =
  | 'FACTURA'
  | 'NOTA_VENTA'
  | 'NOTA_CREDITO'
  | 'COMPRA'
  | 'MOVIMIENTO'
  | 'COBRO'
  | 'PAGO'

// Una fila del feed unificado. `monto` va FIRMADO: positivo = entrada, negativo =
// salida. `tipo` se deriva del signo. `movimientoId` sólo se llena para
// movimientos manuales (los únicos editables/eliminables desde el feed).
export interface Transaccion {
  id: string
  fecha: string
  monto: number
  tipo: 'INGRESO' | 'EGRESO'
  origen: TransaccionOrigen
  referencia: string | null
  descripcion: string | null
  categoria: string | null
  movimientoId: string | null
}

// Estados de un e-CF que cuentan como INGRESO DEVENGADO: aceptados por la DGII
// y los que van en camino. Un RECHAZADO/ERROR/DRAFT NO es una venta válida y
// nunca suma. (Decisión de negocio confirmada.)
const ESTADOS_INGRESO_DEVENGADO: ComprobanteEstado[] = [
  'ACEPTADO',
  'ACEPTADO_CONDICIONAL',
  'PENDIENTE',
  'EN_COLA',
  'ENVIANDO',
]

const r2 = (n: number): number => Math.round(n * 100) / 100
const pad = (n: number): string => String(n).padStart(2, '0')

// Convención horaria RD (UTC-4, sin horario de verano) igual que el resto del repo.
function inicioDia(date: string): Date { return new Date(`${date.slice(0, 10)}T00:00:00.000-04:00`) }
function finDia(date: string): Date { return new Date(`${date.slice(0, 10)}T23:59:59.999-04:00`) }

// "Hoy" en zona RD (UTC-4), como YYYY-MM-DD.
function hoyRD(): string {
  const d = new Date(Date.now() - 4 * 3600 * 1000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

// CajaDiaria.fecha es @db.Date (sin hora): se ancla siempre a medianoche UTC
// para que el mismo YYYY-MM-DD produzca el mismo valor en apertura y cierre.
function fechaSoloDia(s: string): Date {
  return new Date(`${s.slice(0, 10)}T00:00:00.000Z`)
}

// Fecha de entrada: si viene sólo la fecha (YYYY-MM-DD) la anclamos a mediodía RD
// para que caiga siempre dentro de su día bajo el filtro de rango (evita que el
// día-frontera se pierda por el corrimiento de zona horaria). ISO completo → tal cual.
function parseFecha(s: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00.000-04:00`) : new Date(s)
}

// Rango sobre un campo de fecha arbitrario. Devuelve {} si no hay límites.
function rango(field: string, desde?: string, hasta?: string): Record<string, unknown> {
  if (desde === undefined && hasta === undefined) return {}
  return {
    [field]: {
      ...(desde !== undefined && { gte: inicioDia(desde) }),
      ...(hasta !== undefined && { lte: finDia(hasta) }),
    },
  }
}

function periodoMes(d: Date): string {
  const s = new Date(d.getTime() - 4 * 3600 * 1000)
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}`
}

// Semana ISO-8601 (lunes) en zona RD.
function periodoSemana(d: Date): string {
  const s = new Date(d.getTime() - 4 * 3600 * 1000)
  const target = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()))
  const dayNr = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
    )
  return `${target.getUTCFullYear()}-W${pad(week)}`
}

interface TotalesVista {
  ingresos: number
  egresos: number
  balance: number
}
interface TotalesDevengado extends TotalesVista {
  ingresosFiscal: number
  ingresosNotaVenta: number
  ingresosManual: number
  egresosCompras: number
  egresosManual: number
}

export interface CajaEstadoResponse {
  fecha: string
  estado: 'NO_ABIERTA' | 'ABIERTA' | 'CERRADA'
  montoApertura: number | null
  montoActual: number | null
  montoEsperado: number | null
  montoContado: number | null
  diferencia: number | null
  notasApertura: string | null
  notasCierre: string | null
  abiertaEn: string | null
  cerradaEn: string | null
}

@Injectable()
export class FinanzasService {
  // ─── Movimientos manuales (CRUD) ─────────────────────────────────────────

  async crearMovimiento(tenantId: string, dto: CreateMovimientoDto): Promise<MovimientoFinanciero> {
    return prisma.movimientoFinanciero.create({
      data: {
        tenantId,
        tipo: dto.tipo,
        categoria: dto.categoria,
        monto: dto.monto,
        moneda: dto.moneda ?? 'DOP',
        fecha: parseFecha(dto.fecha),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.metodoPago !== undefined && { metodoPago: dto.metodoPago }),
      },
    })
  }

  async listMovimientos(tenantId: string, query: ListMovimientosDto): Promise<PaginatedResponse<MovimientoFinanciero>> {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip = (page - 1) * limit

    const where: Prisma.MovimientoFinancieroWhereInput = {
      tenantId,
      ...(query.tipo !== undefined && { tipo: query.tipo }),
      ...(query.categoria !== undefined && { categoria: query.categoria }),
      ...(rango('fecha', query.desde, query.hasta) as Prisma.MovimientoFinancieroWhereInput),
    }

    const [data, total] = await prisma.$transaction([
      prisma.movimientoFinanciero.findMany({ where, orderBy: { fecha: 'desc' }, skip, take: limit }),
      prisma.movimientoFinanciero.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findMovimiento(tenantId: string, id: string): Promise<MovimientoFinanciero> {
    const mov = await prisma.movimientoFinanciero.findFirst({ where: { id, tenantId } })
    if (!mov) throw new NotFoundException(`Movimiento ${id} no encontrado`)
    return mov
  }

  async actualizarMovimiento(tenantId: string, id: string, dto: UpdateMovimientoDto): Promise<MovimientoFinanciero> {
    await this.findMovimiento(tenantId, id)
    return prisma.movimientoFinanciero.update({
      where: { id },
      data: {
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.categoria !== undefined && { categoria: dto.categoria }),
        ...(dto.monto !== undefined && { monto: dto.monto }),
        ...(dto.moneda !== undefined && { moneda: dto.moneda }),
        ...(dto.fecha !== undefined && { fecha: parseFecha(dto.fecha) }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.metodoPago !== undefined && { metodoPago: dto.metodoPago }),
      },
    })
  }

  async eliminarMovimiento(tenantId: string, id: string): Promise<MovimientoFinanciero> {
    await this.findMovimiento(tenantId, id)
    return prisma.movimientoFinanciero.delete({ where: { id } })
  }

  // ─── Pagos / cobros ──────────────────────────────────────────────────────

  /**
   * Registra un cobro (sobre factura) o pago (sobre compra). CRÍTICO: sólo
   * inserta una fila en `pagos` — NO toca el estado DGII ni ningún campo del
   * comprobante/compra. Valida propiedad (tenant), coherencia tipo↔documento y
   * rechaza el sobrepago (no se puede abonar más que el saldo pendiente).
   */
  async crearPago(tenantId: string, dto: CreatePagoDto): Promise<Pago> {
    if (dto.tipo === 'COBRO') {
      if (!dto.comprobanteId) throw new BadRequestException('Un COBRO requiere comprobanteId')
      if (dto.compraId) throw new BadRequestException('Un COBRO no lleva compraId')
    } else {
      if (!dto.compraId) throw new BadRequestException('Un PAGO requiere compraId')
      if (dto.comprobanteId) throw new BadRequestException('Un PAGO no lleva comprobanteId')
    }

    const { montoDoc, pagado } = await this.saldoDoc(tenantId, dto.tipo, dto.comprobanteId, dto.compraId)
    if (r2(pagado + dto.monto) > montoDoc) {
      throw new BadRequestException(
        `El abono excede el saldo pendiente (${r2(montoDoc - pagado)}). No se permite sobrepago.`,
      )
    }

    return prisma.pago.create({
      data: {
        tenantId,
        tipo: dto.tipo,
        monto: dto.monto,
        moneda: dto.moneda ?? 'DOP',
        fecha: parseFecha(dto.fecha),
        ...(dto.comprobanteId !== undefined && { comprobanteId: dto.comprobanteId }),
        ...(dto.compraId !== undefined && { compraId: dto.compraId }),
        ...(dto.metodoPago !== undefined && { metodoPago: dto.metodoPago }),
      },
    })
  }

  async listPagos(tenantId: string, query: ListPagosDto): Promise<Pago[]> {
    const where: Prisma.PagoWhereInput = {
      tenantId,
      ...(query.tipo !== undefined && { tipo: query.tipo }),
      ...(query.comprobanteId !== undefined && { comprobanteId: query.comprobanteId }),
      ...(query.compraId !== undefined && { compraId: query.compraId }),
      ...(rango('fecha', query.desde, query.hasta) as Prisma.PagoWhereInput),
    }
    return prisma.pago.findMany({ where, orderBy: { fecha: 'desc' } })
  }

  async eliminarPago(tenantId: string, id: string): Promise<Pago> {
    const pago = await prisma.pago.findFirst({ where: { id, tenantId } })
    if (!pago) throw new NotFoundException(`Pago ${id} no encontrado`)
    return prisma.pago.delete({ where: { id } })
  }

  /**
   * Saldo pendiente de un documento = monto del documento − suma de sus abonos.
   * Resuelve el monto/tenant del comprobante (COBRO) o la compra (PAGO) y valida
   * propiedad. Un borrador (DRAFT) no es cobrable.
   */
  private async saldoDoc(
    tenantId: string,
    tipo: 'COBRO' | 'PAGO',
    comprobanteId?: string,
    compraId?: string,
  ): Promise<{ montoDoc: number; pagado: number }> {
    if (tipo === 'COBRO') {
      if (!comprobanteId) throw new BadRequestException('Un COBRO requiere comprobanteId')
      const c = await prisma.comprobante.findFirst({ where: { id: comprobanteId, tenantId, eliminado: false } })
      if (!c) throw new NotFoundException(`Comprobante ${comprobanteId} no encontrado`)
      if (c.estado === 'DRAFT') throw new BadRequestException('No se puede cobrar un borrador (DRAFT)')
      const agg = await prisma.pago.aggregate({
        where: { tenantId, tipo: 'COBRO', comprobanteId },
        _sum: { monto: true },
      })
      return { montoDoc: r2(Number(c.montoTotal)), pagado: r2(Number(agg._sum?.monto ?? 0)) }
    }

    if (!compraId) throw new BadRequestException('Un PAGO requiere compraId')
    const compra = await prisma.compraRecibida.findFirst({ where: { id: compraId, tenantId } })
    if (!compra) throw new NotFoundException(`Compra ${compraId} no encontrada`)
    const agg = await prisma.pago.aggregate({
      where: { tenantId, tipo: 'PAGO', compraId },
      _sum: { monto: true },
    })
    return { montoDoc: r2(Number(compra.total)), pagado: r2(Number(agg._sum?.monto ?? 0)) }
  }

  async saldo(
    tenantId: string,
    query: SaldoDto,
  ): Promise<{ tipo: 'COBRO' | 'PAGO'; montoTotal: number; pagado: number; saldoPendiente: number }> {
    const tieneComprobante = query.comprobanteId !== undefined
    const tieneCompra = query.compraId !== undefined
    if (tieneComprobante === tieneCompra) {
      throw new BadRequestException('Indica exactamente uno: comprobanteId o compraId')
    }
    const tipo: 'COBRO' | 'PAGO' = tieneComprobante ? 'COBRO' : 'PAGO'
    const { montoDoc, pagado } = await this.saldoDoc(tenantId, tipo, query.comprobanteId, query.compraId)
    return { tipo, montoTotal: montoDoc, pagado, saldoPendiente: r2(montoDoc - pagado) }
  }

  // ─── Capital inicial ─────────────────────────────────────────────────────

  async getCapital(tenantId: string): Promise<CapitalInicial | { tenantId: string; monto: number; moneda: string; fecha: null }> {
    const cap = await prisma.capitalInicial.findUnique({ where: { tenantId } })
    return cap ?? { tenantId, monto: 0, moneda: 'DOP', fecha: null }
  }

  async setCapital(tenantId: string, dto: SetCapitalDto): Promise<CapitalInicial> {
    return prisma.capitalInicial.upsert({
      where: { tenantId },
      create: { tenantId, monto: dto.monto, moneda: dto.moneda ?? 'DOP', fecha: parseFecha(dto.fecha) },
      update: { monto: dto.monto, moneda: dto.moneda ?? 'DOP', fecha: parseFecha(dto.fecha) },
    })
  }

  // ─── Agregación unificada (lectura sobre las 4 fuentes) ──────────────────

  /**
   * Totales devengado y cobrado en un rango. Fuente unificada por CONSULTA (no
   * duplica datos). Ingreso fiscal NETO: facturas positivas − notas de crédito
   * (E34). Notas de venta internas (no fiscales) suman aparte pero distinguibles.
   */
  private async totales(tenantId: string, desde?: string, hasta?: string): Promise<{
    devengado: TotalesDevengado
    cobrado: TotalesVista
  }> {
    const rComp = rango('createdAt', desde, hasta) as Prisma.ComprobanteWhereInput
    const rCompra = rango('fechaComprobante', desde, hasta) as Prisma.CompraRecibidaWhereInput
    const rMov = rango('fecha', desde, hasta) as Prisma.MovimientoFinancieroWhereInput
    const rPago = rango('fecha', desde, hasta) as Prisma.PagoWhereInput

    const fiscalBase: Prisma.ComprobanteWhereInput = {
      tenantId,
      esFiscal: true,
      eliminado: false,
      estado: { in: ESTADOS_INGRESO_DEVENGADO },
      ...rComp,
    }

    const [
      posAgg, // facturas fiscales positivas (todo menos E34)
      ncAgg, // notas de crédito E34 (restan)
      notaVentaAgg, // notas de venta internas (no fiscales)
      comprasAgg,
      movIngAgg,
      movEgrAgg,
      cobroAgg,
      pagoAgg,
    ] = await prisma.$transaction([
      prisma.comprobante.aggregate({ where: { ...fiscalBase, tipoECF: { not: 'E34' } }, _sum: { montoTotal: true } }),
      prisma.comprobante.aggregate({ where: { ...fiscalBase, tipoECF: 'E34' }, _sum: { montoTotal: true } }),
      prisma.comprobante.aggregate({
        where: { tenantId, esFiscal: false, eliminado: false, estado: 'INTERNO', ...rComp },
        _sum: { montoTotal: true },
      }),
      prisma.compraRecibida.aggregate({ where: { tenantId, ...rCompra }, _sum: { total: true } }),
      prisma.movimientoFinanciero.aggregate({ where: { tenantId, tipo: 'INGRESO', ...rMov }, _sum: { monto: true } }),
      prisma.movimientoFinanciero.aggregate({ where: { tenantId, tipo: 'EGRESO', ...rMov }, _sum: { monto: true } }),
      prisma.pago.aggregate({ where: { tenantId, tipo: 'COBRO', ...rPago }, _sum: { monto: true } }),
      prisma.pago.aggregate({ where: { tenantId, tipo: 'PAGO', ...rPago }, _sum: { monto: true } }),
    ])

    const num = (v: Prisma.Decimal | null | undefined): number => r2(Number(v ?? 0))

    const ingresosFiscal = r2(num(posAgg._sum.montoTotal) - num(ncAgg._sum.montoTotal))
    const ingresosNotaVenta = num(notaVentaAgg._sum.montoTotal)
    const ingresosManual = num(movIngAgg._sum.monto)
    const egresosCompras = num(comprasAgg._sum.total)
    const egresosManual = num(movEgrAgg._sum.monto)

    const ingDev = r2(ingresosFiscal + ingresosNotaVenta + ingresosManual)
    const egrDev = r2(egresosCompras + egresosManual)

    const cobroIngresos = r2(num(cobroAgg._sum.monto) + ingresosManual)
    const cobroEgresos = r2(num(pagoAgg._sum.monto) + egresosManual)

    return {
      devengado: {
        ingresos: ingDev,
        ingresosFiscal,
        ingresosNotaVenta,
        ingresosManual,
        egresos: egrDev,
        egresosCompras,
        egresosManual,
        balance: r2(ingDev - egrDev),
      },
      cobrado: {
        ingresos: cobroIngresos,
        egresos: cobroEgresos,
        balance: r2(cobroIngresos - cobroEgresos),
      },
    }
  }

  async resumen(tenantId: string, query: RangoDto): Promise<unknown> {
    // Totales del rango pedido.
    const rangoTot = await this.totales(tenantId, query.desde, query.hasta)
    // Capital acumulado = capital inicial + flujo neto ACUMULADO hasta `hasta`
    // (ignora `desde`: el acumulado arranca desde el principio del negocio).
    const acum = await this.totales(tenantId, undefined, query.hasta)
    const capRow = await prisma.capitalInicial.findUnique({ where: { tenantId } })
    const capitalInicial = capRow ? r2(Number(capRow.monto)) : 0

    return {
      moneda: 'DOP',
      capitalInicial,
      devengado: {
        ...rangoTot.devengado,
        capitalAcumulado: r2(capitalInicial + acum.devengado.balance),
      },
      cobrado: {
        ...rangoTot.cobrado,
        capitalAcumulado: r2(capitalInicial + acum.cobrado.balance),
      },
    }
  }

  // ─── Serie temporal para el gráfico ──────────────────────────────────────

  async flujo(tenantId: string, query: FlujoDto): Promise<unknown> {
    const agrupacion = query.agrupacion ?? 'mes'
    const vista = query.vista ?? 'devengado'
    const periodo = agrupacion === 'semana' ? periodoSemana : periodoMes
    const buckets = new Map<string, { ingresos: number; egresos: number }>()
    const add = (fecha: Date, campo: 'ingresos' | 'egresos', monto: number): void => {
      const k = periodo(fecha)
      const b = buckets.get(k) ?? { ingresos: 0, egresos: 0 }
      b[campo] = r2(b[campo] + monto)
      buckets.set(k, b)
    }

    const rMov = rango('fecha', query.desde, query.hasta) as Prisma.MovimientoFinancieroWhereInput
    const movs = await prisma.movimientoFinanciero.findMany({
      where: { tenantId, ...rMov },
      select: { fecha: true, tipo: true, monto: true },
    })
    for (const m of movs) add(m.fecha, m.tipo === 'INGRESO' ? 'ingresos' : 'egresos', r2(Number(m.monto)))

    if (vista === 'devengado') {
      const rComp = rango('createdAt', query.desde, query.hasta) as Prisma.ComprobanteWhereInput
      const comps = await prisma.comprobante.findMany({
        where: {
          tenantId,
          eliminado: false,
          OR: [
            { esFiscal: true, estado: { in: ESTADOS_INGRESO_DEVENGADO } },
            { esFiscal: false, estado: 'INTERNO' },
          ],
          ...rComp,
        },
        select: { createdAt: true, montoTotal: true, tipoECF: true },
      })
      // Nota de crédito E34 resta; el resto suma.
      for (const c of comps) {
        const monto = r2(Number(c.montoTotal)) * (c.tipoECF === 'E34' ? -1 : 1)
        add(c.createdAt, 'ingresos', monto)
      }
      const rCompra = rango('fechaComprobante', query.desde, query.hasta) as Prisma.CompraRecibidaWhereInput
      const compras = await prisma.compraRecibida.findMany({
        where: { tenantId, ...rCompra },
        select: { fechaComprobante: true, createdAt: true, total: true },
      })
      for (const c of compras) add(c.fechaComprobante ?? c.createdAt, 'egresos', r2(Number(c.total)))
    } else {
      const rPago = rango('fecha', query.desde, query.hasta) as Prisma.PagoWhereInput
      const pagos = await prisma.pago.findMany({
        where: { tenantId, ...rPago },
        select: { fecha: true, tipo: true, monto: true },
      })
      for (const p of pagos) add(p.fecha, p.tipo === 'COBRO' ? 'ingresos' : 'egresos', r2(Number(p.monto)))
    }

    const serie = [...buckets.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([periodoKey, v]) => ({
        periodo: periodoKey,
        ingresos: v.ingresos,
        egresos: v.egresos,
        balance: r2(v.ingresos - v.egresos),
      }))

    return { agrupacion, vista, serie }
  }

  // ─── Desglose por categoría (movimientos manuales) ───────────────────────

  async categorias(tenantId: string, query: RangoDto): Promise<unknown> {
    const rMov = rango('fecha', query.desde, query.hasta) as Prisma.MovimientoFinancieroWhereInput
    const grupos = await prisma.movimientoFinanciero.groupBy({
      by: ['categoria', 'tipo'],
      where: { tenantId, ...rMov },
      _sum: { monto: true },
    })

    const mapa = new Map<string, { categoria: string; ingresos: number; egresos: number }>()
    for (const g of grupos) {
      const row = mapa.get(g.categoria) ?? { categoria: g.categoria, ingresos: 0, egresos: 0 }
      const monto = r2(Number(g._sum.monto ?? 0))
      if (g.tipo === 'INGRESO') row.ingresos = r2(row.ingresos + monto)
      else row.egresos = r2(row.egresos + monto)
      mapa.set(g.categoria, row)
    }

    const categorias = [...mapa.values()]
      .map((c) => ({ ...c, neto: r2(c.ingresos - c.egresos) }))
      .sort((a, b) => (a.categoria < b.categoria ? -1 : 1))

    return { categorias }
  }

  // ─── Feed unificado de transacciones (lo que entra y sale) ───────────────

  /**
   * Lista unificada de entradas/salidas del período, combinando las 4 fuentes.
   * Devengado: facturas (ingreso), notas de crédito E34 (resta), notas de venta,
   * compras (egreso) y movimientos manuales. Cobrado: cobros/pagos + manuales.
   * `monto` firmado (+entrada / −salida); ordenado por fecha desc. Paginado, con
   * filtros por tipo y origen. Sólo LEE lo fiscal (no lo toca).
   */
  async transacciones(tenantId: string, query: ListTransaccionesDto): Promise<PaginatedResponse<Transaccion>> {
    const vista = query.vista ?? 'devengado'
    const CAP = 5000
    const items: Transaccion[] = []

    // Movimientos manuales — cuentan en ambas vistas.
    const rMov = rango('fecha', query.desde, query.hasta) as Prisma.MovimientoFinancieroWhereInput
    const movs = await prisma.movimientoFinanciero.findMany({ where: { tenantId, ...rMov }, take: CAP })
    for (const m of movs) {
      const signo = m.tipo === 'INGRESO' ? 1 : -1
      items.push({
        id: `mov:${m.id}`,
        fecha: m.fecha.toISOString(),
        monto: r2(signo * Number(m.monto)),
        tipo: m.tipo,
        origen: 'MOVIMIENTO',
        referencia: null,
        descripcion: m.descripcion,
        categoria: m.categoria,
        movimientoId: m.id,
      })
    }

    if (vista === 'devengado') {
      const rComp = rango('createdAt', query.desde, query.hasta) as Prisma.ComprobanteWhereInput
      const comps = await prisma.comprobante.findMany({
        where: {
          tenantId,
          eliminado: false,
          OR: [
            { esFiscal: true, estado: { in: ESTADOS_INGRESO_DEVENGADO } },
            { esFiscal: false, estado: 'INTERNO' },
          ],
          ...rComp,
        },
        take: CAP,
      })
      for (const c of comps) {
        const esNotaCredito = c.tipoECF === 'E34'
        const origen: TransaccionOrigen = !c.esFiscal ? 'NOTA_VENTA' : esNotaCredito ? 'NOTA_CREDITO' : 'FACTURA'
        const monto = r2((esNotaCredito ? -1 : 1) * Number(c.montoTotal))
        items.push({
          id: `fac:${c.id}`,
          fecha: c.createdAt.toISOString(),
          monto,
          tipo: monto >= 0 ? 'INGRESO' : 'EGRESO',
          origen,
          referencia: c.eNCF ?? c.folioInterno,
          descripcion: c.razonSocial,
          categoria: null,
          movimientoId: null,
        })
      }

      const rCompra = rango('fechaComprobante', query.desde, query.hasta) as Prisma.CompraRecibidaWhereInput
      const compras = await prisma.compraRecibida.findMany({ where: { tenantId, ...rCompra }, take: CAP })
      for (const c of compras) {
        items.push({
          id: `com:${c.id}`,
          fecha: (c.fechaComprobante ?? c.createdAt).toISOString(),
          monto: r2(-Number(c.total)),
          tipo: 'EGRESO',
          origen: 'COMPRA',
          referencia: c.ncf ?? c.rncProveedor,
          descripcion: c.razonSocialProveedor,
          categoria: null,
          movimientoId: null,
        })
      }
    } else {
      const rPago = rango('fecha', query.desde, query.hasta) as Prisma.PagoWhereInput
      const pagos = await prisma.pago.findMany({
        where: { tenantId, ...rPago },
        take: CAP,
        include: { comprobante: true, compra: true },
      })
      for (const p of pagos) {
        const signo = p.tipo === 'COBRO' ? 1 : -1
        items.push({
          id: `pag:${p.id}`,
          fecha: p.fecha.toISOString(),
          monto: r2(signo * Number(p.monto)),
          tipo: p.tipo === 'COBRO' ? 'INGRESO' : 'EGRESO',
          origen: p.tipo,
          referencia: p.comprobante?.eNCF ?? p.comprobante?.folioInterno ?? p.compra?.ncf ?? null,
          descripcion: p.comprobante?.razonSocial ?? p.compra?.razonSocialProveedor ?? null,
          categoria: null,
          movimientoId: null,
        })
      }
    }

    let filtered = items
    if (query.tipo) filtered = filtered.filter((t) => t.tipo === query.tipo)
    if (query.origen) filtered = filtered.filter((t) => t.origen === query.origen)
    filtered.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))

    const total = filtered.length
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 15, CAP)
    const data = filtered.slice((page - 1) * limit, (page - 1) * limit + limit)
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  // ─── Caja diaria (apertura/cierre de efectivo) ───────────────────────────

  private toCajaResponse(fecha: string, caja: CajaDiaria | null, montoActual: number | null): CajaEstadoResponse {
    if (!caja) {
      return {
        fecha,
        estado: 'NO_ABIERTA',
        montoApertura: null,
        montoActual: null,
        montoEsperado: null,
        montoContado: null,
        diferencia: null,
        notasApertura: null,
        notasCierre: null,
        abiertaEn: null,
        cerradaEn: null,
      }
    }
    return {
      fecha,
      estado: caja.estado,
      montoApertura: r2(Number(caja.montoApertura)),
      montoActual,
      montoEsperado: caja.montoEsperado !== null ? r2(Number(caja.montoEsperado)) : null,
      montoContado: caja.montoContado !== null ? r2(Number(caja.montoContado)) : null,
      diferencia: caja.diferencia !== null ? r2(Number(caja.diferencia)) : null,
      notasApertura: caja.notasApertura,
      notasCierre: caja.notasCierre,
      abiertaEn: caja.abiertaEn.toISOString(),
      cerradaEn: caja.cerradaEn?.toISOString() ?? null,
    }
  }

  /**
   * Estado de la caja de un día: NO_ABIERTA / ABIERTA (con `montoActual` en
   * vivo = apertura + neto cobrado hasta ahora) / CERRADA (con lo calculado
   * al cierre). Sólo LEE — no crea nada.
   */
  async getCaja(tenantId: string, fecha?: string): Promise<CajaEstadoResponse> {
    const f = fecha ?? hoyRD()
    const caja = await prisma.cajaDiaria.findUnique({ where: { tenantId_fecha: { tenantId, fecha: fechaSoloDia(f) } } })
    if (!caja) return this.toCajaResponse(f, null, null)

    if (caja.estado === 'CERRADA') {
      return this.toCajaResponse(f, caja, r2(Number(caja.montoContado)))
    }
    const { cobrado } = await this.totales(tenantId, f, f)
    const montoActual = r2(Number(caja.montoApertura) + cobrado.balance)
    return this.toCajaResponse(f, caja, montoActual)
  }

  /** Abre la caja del día con el efectivo inicial. Una sola apertura por tenant+fecha. */
  async abrirCaja(tenantId: string, dto: AperturaCajaDto): Promise<CajaDiaria> {
    const fecha = dto.fecha ?? hoyRD()
    const existente = await prisma.cajaDiaria.findUnique({
      where: { tenantId_fecha: { tenantId, fecha: fechaSoloDia(fecha) } },
    })
    if (existente) throw new ConflictException(`La caja del ${fecha} ya fue abierta`)

    return prisma.cajaDiaria.create({
      data: {
        tenantId,
        fecha: fechaSoloDia(fecha),
        montoApertura: dto.monto,
        ...(dto.notas !== undefined && { notasApertura: dto.notas }),
      },
    })
  }

  /**
   * Cierra la caja del día: calcula el esperado (apertura + neto cobrado del
   * día) y la diferencia contra lo contado. Exige una apertura previa sin
   * cerrar para esa fecha.
   */
  async cerrarCaja(tenantId: string, dto: CierreCajaDto): Promise<CajaDiaria> {
    const fecha = dto.fecha ?? hoyRD()
    const caja = await prisma.cajaDiaria.findUnique({
      where: { tenantId_fecha: { tenantId, fecha: fechaSoloDia(fecha) } },
    })
    if (!caja) throw new NotFoundException(`No hay caja abierta el ${fecha}; ábrela primero`)
    if (caja.estado === 'CERRADA') throw new ConflictException(`La caja del ${fecha} ya está cerrada`)

    const { cobrado } = await this.totales(tenantId, fecha, fecha)
    const montoEsperado = r2(Number(caja.montoApertura) + cobrado.balance)
    const diferencia = r2(dto.montoContado - montoEsperado)

    return prisma.cajaDiaria.update({
      where: { id: caja.id },
      data: {
        estado: 'CERRADA',
        montoEsperado,
        montoContado: dto.montoContado,
        diferencia,
        cerradaEn: new Date(),
        ...(dto.notas !== undefined && { notasCierre: dto.notas }),
      },
    })
  }

  async listCajas(tenantId: string, query: ListCajaDto): Promise<PaginatedResponse<CajaDiaria>> {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip = (page - 1) * limit

    const where: Prisma.CajaDiariaWhereInput = {
      tenantId,
      ...(query.desde !== undefined && { fecha: { gte: fechaSoloDia(query.desde) } }),
      ...(query.hasta !== undefined && {
        fecha: { ...(query.desde !== undefined ? { gte: fechaSoloDia(query.desde) } : {}), lte: fechaSoloDia(query.hasta) },
      }),
    }

    const [data, total] = await prisma.$transaction([
      prisma.cajaDiaria.findMany({ where, orderBy: { fecha: 'desc' }, skip, take: limit }),
      prisma.cajaDiaria.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }
}
