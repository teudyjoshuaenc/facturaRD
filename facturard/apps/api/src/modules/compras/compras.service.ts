import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common'
import { Prisma, prisma } from '@facturard/database'
import type { CompraRecibida } from '@facturard/database'
import {
  buildAprobacionXml,
  enviarAprobacionComercial,
  autenticar,
  firmarDocumento,
  resolveDgiiEnv,
  type EstadoAprobacion,
} from '@facturard/ecf-engine'
import { CertificadosService } from '../certificados/certificados.service'
import type { CreateCompraDto } from './dto/create-compra.dto'
import type { UpdateCompraDto } from './dto/update-compra.dto'
import type { ListComprasDto } from './dto/list-compras.dto'
import type { AprobacionComercialDto } from './dto/aprobacion-comercial.dto'
import type { PaginatedResponse } from '@facturard/shared'

const r2 = (n: number): number => Math.round(n * 100) / 100

function inicioDia(date: string): Date { return new Date(`${date}T00:00:00.000-04:00`) }
function finDia(date: string): Date { return new Date(`${date}T23:59:59.999-04:00`) }

function fechaDGII(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`
}
function fechaHoraDGII(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${fechaDGII(d)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

@Injectable()
export class ComprasService {
  private readonly logger = new Logger(ComprasService.name)

  constructor(private readonly certificados: CertificadosService) {}

  async crear(tenantId: string, dto: CreateCompraDto): Promise<CompraRecibida> {
    let rncProveedor = dto.rncProveedor
    let razonSocialProveedor = dto.razonSocialProveedor

    if (dto.contactoId !== undefined) {
      const contacto = await prisma.contacto.findFirst({ where: { id: dto.contactoId, tenantId } })
      if (!contacto) throw new BadRequestException(`Contacto ${dto.contactoId} no encontrado`)
      rncProveedor = dto.rncProveedor ?? contacto.rnc ?? undefined
      razonSocialProveedor = dto.razonSocialProveedor ?? contacto.razonSocial
    }

    const itbis = dto.itbis ?? 0
    const total = r2(dto.subtotal + itbis)

    return prisma.compraRecibida.create({
      data: {
        tenantId,
        tipo: dto.tipo,
        origen: 'MANUAL',
        subtotal: dto.subtotal,
        itbis,
        itbisRetenido: dto.itbisRetenido ?? 0,
        total,
        ...(dto.contactoId !== undefined && { contactoId: dto.contactoId }),
        ...(rncProveedor !== undefined && { rncProveedor }),
        ...(razonSocialProveedor !== undefined && { razonSocialProveedor }),
        ...(dto.ncf !== undefined && { ncf: dto.ncf }),
        ...(dto.fechaComprobante !== undefined && { fechaComprobante: new Date(dto.fechaComprobante) }),
      },
    })
  }

  async findAll(tenantId: string, query: ListComprasDto): Promise<PaginatedResponse<CompraRecibida>> {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip = (page - 1) * limit

    const rango: Prisma.CompraRecibidaWhereInput =
      query.fechaDesde === undefined && query.fechaHasta === undefined
        ? {}
        : {
            fechaComprobante: {
              ...(query.fechaDesde !== undefined && { gte: inicioDia(query.fechaDesde) }),
              ...(query.fechaHasta !== undefined && { lte: finDia(query.fechaHasta) }),
            },
          }

    const where: Prisma.CompraRecibidaWhereInput = {
      tenantId,
      ...(query.tipo !== undefined && { tipo: query.tipo }),
      ...rango,
      ...(query.search !== undefined && query.search.trim() !== ''
        ? {
            OR: [
              { ncf: { contains: query.search, mode: 'insensitive' } },
              { rncProveedor: { contains: query.search, mode: 'insensitive' } },
              { razonSocialProveedor: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [data, total] = await prisma.$transaction([
      prisma.compraRecibida.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.compraRecibida.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(tenantId: string, id: string): Promise<CompraRecibida> {
    const compra = await prisma.compraRecibida.findFirst({ where: { id, tenantId } })
    if (!compra) throw new NotFoundException(`Compra ${id} no encontrada`)
    return compra
  }

  async actualizar(tenantId: string, id: string, dto: UpdateCompraDto): Promise<CompraRecibida> {
    const actual = await this.findOne(tenantId, id)
    const subtotal = dto.subtotal ?? Number(actual.subtotal)
    const itbis = dto.itbis ?? Number(actual.itbis)

    return prisma.compraRecibida.update({
      where: { id },
      data: {
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.contactoId !== undefined && { contactoId: dto.contactoId }),
        ...(dto.rncProveedor !== undefined && { rncProveedor: dto.rncProveedor }),
        ...(dto.razonSocialProveedor !== undefined && { razonSocialProveedor: dto.razonSocialProveedor }),
        ...(dto.ncf !== undefined && { ncf: dto.ncf }),
        ...(dto.fechaComprobante !== undefined && { fechaComprobante: new Date(dto.fechaComprobante) }),
        ...(dto.subtotal !== undefined && { subtotal: dto.subtotal }),
        ...(dto.itbis !== undefined && { itbis: dto.itbis }),
        ...(dto.itbisRetenido !== undefined && { itbisRetenido: dto.itbisRetenido }),
        ...((dto.subtotal !== undefined || dto.itbis !== undefined) && { total: r2(subtotal + itbis) }),
      },
    })
  }

  async remove(tenantId: string, id: string): Promise<CompraRecibida> {
    await this.findOne(tenantId, id)
    return prisma.compraRecibida.delete({ where: { id } })
  }

  /**
   * Aprobación/rechazo comercial de un e-CF recibido. Reutiliza el motor del
   * ecf-engine (buildAprobacionXml + firma ACECF + autenticar + enviarAprobacionComercial)
   * para notificar a la DGII, y persiste la decisión. No reimplementa la emisión.
   */
  async aprobacionComercial(tenantId: string, id: string, dto: AprobacionComercialDto): Promise<CompraRecibida> {
    const compra = await this.findOne(tenantId, id)
    if (compra.tipo !== 'RECIBIDO_ECF') {
      throw new ConflictException('La aprobación comercial sólo aplica a e-CF recibidos (RECIBIDO_ECF)')
    }
    if (!compra.ncf || !compra.rncProveedor) {
      throw new ConflictException('La compra no tiene NCF o RNC del proveedor para aprobar')
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    const { p12Buffer, passphrase } = await this.certificados.getCertificadoParaFirmar(tenantId)
    const env = resolveDgiiEnv()
    const estado: EstadoAprobacion = dto.decision === 'APROBADO' ? 1 : 2

    const xml = buildAprobacionXml({
      rncEmisor: compra.rncProveedor,
      eNCF: compra.ncf,
      fechaEmision: fechaDGII(compra.fechaComprobante ?? new Date()),
      montoTotal: Number(compra.total),
      rncComprador: tenant.rnc,
      estado,
      fechaHoraAprobacionComercial: fechaHoraDGII(new Date()),
      ...(dto.motivoRechazo !== undefined && { detalleMotivoRechazo: dto.motivoRechazo }),
    })
    const firmado = firmarDocumento({
      p12: p12Buffer,
      passphrase,
      xml,
      signOptions: { referenceXPath: "//*[local-name(.)='ACECF']" },
    })

    const token = await autenticar({ p12Buffer, passphrase, env })
    await enviarAprobacionComercial(firmado, token, { env })
    this.logger.log(`[Compras] Aprobación comercial ${dto.decision} enviada a DGII para eNCF=${compra.ncf}`)

    return prisma.compraRecibida.update({
      where: { id },
      data: { estadoAprobacion: dto.decision },
    })
  }
}
