import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { Prisma, prisma } from '@facturard/database'
import type { Comprobante } from '@facturard/database'
import type { CreateComprobanteDto, CreateItemDto } from './dto/create-comprobante.dto'
import type { ListComprobantesDto } from './dto/list-comprobantes.dto'
import type { ResumenComprobantesDto } from './dto/resumen-comprobantes.dto'
import type { PaginatedResponse, ResumenComprobantes } from '@facturard/shared'
import { SecuenciasService } from '../secuencias/secuencias.service'

// fechaDesde/fechaHasta son fechas calendario en hora de RD (UTC-4 fijo, sin DST).
// Se anclan explícitamente a ese offset — usar setHours() dependería de la zona
// horaria del proceso (en Railway corre en UTC, no UTC-4), excluyendo facturas
// del mismo día creadas por la noche en RD.
function inicioDia(date: string): Date {
  return new Date(`${date}T00:00:00.000-04:00`)
}

function finDia(date: string): Date {
  return new Date(`${date}T23:59:59.999-04:00`)
}

function rangoFechas(fechaDesde?: string, fechaHasta?: string): Prisma.ComprobanteWhereInput {
  if (fechaDesde === undefined && fechaHasta === undefined) return {}
  return {
    createdAt: {
      ...(fechaDesde !== undefined && { gte: inicioDia(fechaDesde) }),
      ...(fechaHasta !== undefined && { lte: finDia(fechaHasta) }),
    },
  }
}

export interface EcfJobData {
  comprobanteId: string
  tenantId: string
}

function calcularTotales(items: CreateItemDto[]): {
  montoGravadoI1: number
  montoGravadoI2: number
  montoGravadoI3: number
  montoExento: number
  totalITBIS: number
  montoTotal: number
} {
  const r2 = (n: number) => Math.round(n * 100) / 100

  let gI1 = 0, gI2 = 0, gI3 = 0, exento = 0, itbis = 0

  for (const item of items) {
    const bruto = r2(item.cantidad * item.precioUnitarioItem)
    const desc = r2(bruto * ((item.descuentoPorcentaje ?? 0) / 100))
    const monto = r2(bruto - desc)

    switch (item.indicadorFacturacion) {
      case 'I1': gI1 += monto; itbis += r2(monto * 0.18); break
      case 'I2': gI2 += monto; itbis += r2(monto * 0.16); break
      case 'I3': gI3 += monto; break
      default:   exento += monto; break  // I4, E
    }
  }

  const montoGravadoTotal = r2(gI1 + gI2 + gI3)
  const totalITBIS = r2(itbis)
  const montoTotal = r2(montoGravadoTotal + exento + totalITBIS)

  return { montoGravadoI1: r2(gI1), montoGravadoI2: r2(gI2), montoGravadoI3: r2(gI3), montoExento: r2(exento), totalITBIS, montoTotal }
}

@Injectable()
export class ComprobantesService {
  constructor(
    @InjectQueue('ecf-emission') private readonly ecfQueue: Queue<EcfJobData>,
    private readonly secuenciasService: SecuenciasService,
  ) {}

  async crear(tenantId: string, dto: CreateComprobanteDto): Promise<Comprobante> {
    // 1. Verificar que el tenant tiene certificado activo
    const cert = await prisma.certificado.findFirst({ where: { tenantId, activo: true } })
    if (!cert) throw new ConflictException('El tenant no tiene certificado activo. Sube un P12 antes de emitir.')

    // 2. Obtener siguiente eNCF de la secuencia (atómico)
    const eNCF = await this.secuenciasService.siguienteENCF(tenantId, dto.tipoECF)

    // 3. Calcular totales
    const totales = calcularTotales(dto.items)

    // 4. Crear en DB con estado PENDIENTE + datos originales para el worker
    const dtoConEncf = { ...dto, eNCF }
    const comprobante = await prisma.comprobante.create({
      data: {
        tenantId,
        eNCF,
        tipoECF: dto.tipoECF,
        estado: 'PENDIENTE',
        montoTotal: totales.montoTotal,
        rnc: dto.rncComprador ?? '',
        razonSocial: dto.razonSocialComprador ?? '',
        datos: JSON.parse(JSON.stringify(dtoConEncf)) as object,
      },
    })

    // 5. Encolar job
    await this.ecfQueue.add('emit', { comprobanteId: comprobante.id, tenantId })

    return comprobante
  }

  async findAll(tenantId: string, query: ListComprobantesDto): Promise<PaginatedResponse<Comprobante>> {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip = (page - 1) * limit

    const where: Prisma.ComprobanteWhereInput = {
      tenantId,
      ...(query.estado !== undefined && { estado: query.estado }),
      ...(query.tipoECF !== undefined && { tipoECF: query.tipoECF }),
      ...rangoFechas(query.fechaDesde, query.fechaHasta),
      ...(query.search !== undefined && query.search.trim() !== ''
        ? {
            OR: [
              { eNCF: { contains: query.search, mode: 'insensitive' } },
              { razonSocial: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [data, total] = await prisma.$transaction([
      prisma.comprobante.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.comprobante.count({ where }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(tenantId: string, id: string): Promise<Comprobante> {
    const comprobante = await prisma.comprobante.findFirst({ where: { id, tenantId } })
    if (!comprobante) throw new NotFoundException(`Comprobante ${id} no encontrado`)
    return comprobante
  }

  async resumen(tenantId: string, query: ResumenComprobantesDto): Promise<ResumenComprobantes> {
    const where: Prisma.ComprobanteWhereInput = {
      tenantId,
      ...rangoFechas(query.fechaDesde, query.fechaHasta),
    }

    const [totalFacturas, montoAgg, pendientes, aceptadas, rechazadas] = await prisma.$transaction([
      prisma.comprobante.count({ where }),
      prisma.comprobante.aggregate({ where, _sum: { montoTotal: true } }),
      prisma.comprobante.count({ where: { ...where, estado: { in: ['PENDIENTE', 'EN_COLA', 'ENVIANDO'] } } }),
      prisma.comprobante.count({ where: { ...where, estado: { in: ['ACEPTADO', 'ACEPTADO_CONDICIONAL'] } } }),
      prisma.comprobante.count({ where: { ...where, estado: { in: ['RECHAZADO', 'ERROR'] } } }),
    ])

    const r2 = (n: number) => Math.round(n * 100) / 100
    const montoTotal = r2(Number(montoAgg._sum.montoTotal ?? 0))

    return {
      totalFacturas,
      montoTotal,
      itbisTotal: r2((montoTotal * 18) / 118),
      pendientes,
      rechazadas,
      aceptadas,
    }
  }
}
