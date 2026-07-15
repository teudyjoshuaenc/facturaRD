import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { Prisma, prisma } from '@facturard/database'
import type { Cotizacion, CotizacionItem, Tenant } from '@facturard/database'
import { generarRepresentacionImpresa } from '@facturard/ecf-engine'
import type { EcfPdfInput, EcfItem } from '@facturard/ecf-engine'
import { ComprobantesService } from '../comprobantes/comprobantes.service'
import type { CreateComprobanteDto, CreateItemDto } from '../comprobantes/dto/create-comprobante.dto'
import { CotizacionFolioService } from './cotizacion-folio.service'
import type { CreateCotizacionDto, CotizacionItemDto } from './dto/create-cotizacion.dto'
import type { UpdateCotizacionDto } from './dto/update-cotizacion.dto'
import type { ListCotizacionesDto } from './dto/list-cotizaciones.dto'
import type { ConvertirCotizacionDto } from './dto/convertir-cotizacion.dto'
import type { PaginatedResponse } from '@facturard/shared'

// Snapshot normalizado de una línea (números planos), común a creación y conversión.
interface SnapItem {
  productoId?: string
  nombre: string
  descripcion?: string
  cantidad: number
  precioUnitario: number
  tratamientoITBIS: string
  indicadorBienoServicio: string // "1"=Bien, "2"=Servicio
  unidadMedida?: string
}

type CotizacionConItems = Cotizacion & { items: CotizacionItem[] }

const ESTADOS_TERMINALES = new Set(['CONVERTIDA', 'RECHAZADA', 'VENCIDA'])

@Injectable()
export class CotizacionesService {
  constructor(
    private readonly comprobantes: ComprobantesService,
    private readonly folios: CotizacionFolioService,
  ) {}

  async crear(tenantId: string, dto: CreateCotizacionDto): Promise<CotizacionConItems> {
    const snap = await this.resolverItems(tenantId, dto.items)
    const totales = this.comprobantes.calcularTotalesComprobante(this.snapToCreateItems(snap))
    const folio = await this.folios.siguienteFolio(tenantId)

    const cotizacion = await prisma.cotizacion.create({
      data: {
        tenantId,
        folio,
        estado: 'BORRADOR',
        subtotal: this.subtotal(totales),
        itbis: totales.totalITBIS,
        total: totales.montoTotal,
        ...(dto.contactoId !== undefined && { contactoId: dto.contactoId }),
        ...(dto.fechaVigencia !== undefined && { fechaVigencia: new Date(dto.fechaVigencia) }),
        ...(dto.notas !== undefined && { notas: dto.notas }),
        items: { create: snap.map((s) => this.snapToDbItem(s)) },
      },
      include: { items: true },
    })

    return this.conEstadoDerivado(cotizacion)
  }

  async findAll(tenantId: string, query: ListCotizacionesDto): Promise<PaginatedResponse<CotizacionConItems>> {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip = (page - 1) * limit

    const where: Prisma.CotizacionWhereInput = {
      tenantId,
      ...(query.estado !== undefined && { estado: query.estado }),
      ...(query.contactoId !== undefined && { contactoId: query.contactoId }),
      ...(query.search !== undefined && query.search.trim() !== ''
        ? {
            OR: [
              { folio: { contains: query.search, mode: 'insensitive' } },
              { notas: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [data, total] = await prisma.$transaction([
      prisma.cotizacion.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.cotizacion.count({ where }),
    ])

    return { data: data.map((c) => this.conEstadoDerivado(c)), total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(tenantId: string, id: string): Promise<CotizacionConItems> {
    const cotizacion = await prisma.cotizacion.findFirst({ where: { id, tenantId }, include: { items: true } })
    if (!cotizacion) throw new NotFoundException(`Cotización ${id} no encontrada`)
    return this.conEstadoDerivado(cotizacion)
  }

  async actualizar(tenantId: string, id: string, dto: UpdateCotizacionDto): Promise<CotizacionConItems> {
    const actual = await this.findOne(tenantId, id)
    if (actual.estado === 'CONVERTIDA') {
      throw new ConflictException('No se puede editar una cotización ya convertida')
    }

    // Si llegan items, se reemplazan por completo y se recalculan los totales.
    let totalesData: { subtotal: number; itbis: number; total: number } | undefined
    let itemsData: Prisma.CotizacionUpdateInput['items']
    if (dto.items !== undefined) {
      const snap = await this.resolverItems(tenantId, dto.items)
      const totales = this.comprobantes.calcularTotalesComprobante(this.snapToCreateItems(snap))
      totalesData = { subtotal: this.subtotal(totales), itbis: totales.totalITBIS, total: totales.montoTotal }
      itemsData = { deleteMany: {}, create: snap.map((s) => this.snapToDbItem(s)) }
    }

    const cotizacion = await prisma.cotizacion.update({
      where: { id },
      data: {
        ...(dto.contactoId !== undefined && { contactoId: dto.contactoId }),
        ...(dto.fechaVigencia !== undefined && { fechaVigencia: new Date(dto.fechaVigencia) }),
        ...(dto.notas !== undefined && { notas: dto.notas }),
        ...(totalesData !== undefined && totalesData),
        ...(itemsData !== undefined && { items: itemsData }),
      },
      include: { items: true },
    })

    return this.conEstadoDerivado(cotizacion)
  }

  async cambiarEstado(tenantId: string, id: string, nuevoEstado: string): Promise<CotizacionConItems> {
    // Se transiciona sobre el estado REAL almacenado (VENCIDA es sólo derivado).
    const raw = await prisma.cotizacion.findFirst({ where: { id, tenantId } })
    if (!raw) throw new NotFoundException(`Cotización ${id} no encontrada`)
    if (raw.estado === 'CONVERTIDA') {
      throw new ConflictException('Una cotización convertida ya no cambia de estado')
    }

    const permitido: Record<string, string[]> = {
      ENVIADA: ['BORRADOR', 'ENVIADA'],
      APROBADA: ['ENVIADA'],
      RECHAZADA: ['BORRADOR', 'ENVIADA'],
    }
    if (!permitido[nuevoEstado]?.includes(raw.estado)) {
      throw new ConflictException(`Transición inválida: ${raw.estado} → ${nuevoEstado}`)
    }

    const cotizacion = await prisma.cotizacion.update({
      where: { id },
      data: { estado: nuevoEstado },
      include: { items: true },
    })
    return this.conEstadoDerivado(cotizacion)
  }

  /**
   * Convierte la cotización en un comprobante REUTILIZANDO ComprobantesService.crear
   * (mismo camino de totales/secuencia/emisión que POST /comprobantes). No duplica
   * lógica de emisión. Idempotente: una cotización CONVERTIDA devuelve 409.
   */
  async convertir(
    tenantId: string,
    id: string,
    dto: ConvertirCotizacionDto,
  ): Promise<{ cotizacion: Cotizacion; comprobante: Awaited<ReturnType<ComprobantesService['crear']>> }> {
    const cot = await prisma.cotizacion.findFirst({ where: { id, tenantId }, include: { items: true } })
    if (!cot) throw new NotFoundException(`Cotización ${id} no encontrada`)
    if (cot.estado === 'CONVERTIDA') throw new ConflictException('La cotización ya fue convertida')
    if (cot.items.length === 0) throw new BadRequestException('La cotización no tiene líneas')

    const tipoECF = dto.tipoECF ?? (await this.tipoPorDefecto(tenantId, cot.contactoId))

    const createDto: CreateComprobanteDto = {
      tipoECF,
      emitir: dto.emitir ?? false,
      fechaEmision: this.hoyDDMMYYYY(),
      items: this.snapToCreateItems(cot.items.map((it) => this.dbItemToSnap(it))),
      ...(cot.contactoId !== null && { contactoId: cot.contactoId }),
    }

    const comprobante = await this.comprobantes.crear(tenantId, createDto)

    // Enlace bidireccional + flip a CONVERTIDA en una sola transacción.
    const [cotizacion] = await prisma.$transaction([
      prisma.cotizacion.update({ where: { id }, data: { estado: 'CONVERTIDA', comprobanteId: comprobante.id } }),
      prisma.comprobante.update({ where: { id: comprobante.id }, data: { cotizacionId: id } }),
    ])

    const comprobanteFinal = await prisma.comprobante.findUniqueOrThrow({ where: { id: comprobante.id } })
    return { cotizacion, comprobante: comprobanteFinal }
  }

  /**
   * Genera el PDF de la cotización REUTILIZANDO el motor del ecf-engine en modo
   * 'COTIZACION': mismo diseño que la factura fiscal pero sin e-NCF ni QR/timbre,
   * con el folio COT-xxxx y la leyenda de "documento no fiscal". No toca la DGII.
   */
  async regenerarPdfBuffer(tenantId: string, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const cot = await this.findOne(tenantId, id)
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    const contacto = cot.contactoId
      ? await prisma.contacto.findFirst({ where: { id: cot.contactoId, tenantId } })
      : null

    const r2 = (n: number) => Math.round(n * 100) / 100
    let gravado = 0
    let exento = 0
    const items: EcfItem[] = cot.items.map((it) => {
      const cantidad = Number(it.cantidad)
      const precioUnitario = Number(it.precioUnitario)
      const valor = r2(cantidad * precioUnitario)
      const esExento = it.tratamientoITBIS === 'EXENTO'
      if (esExento) exento += valor
      else gravado += valor
      return {
        descripcion: it.nombre,
        cantidad,
        precioUnitario,
        valor,
        itbis: esExento ? 0 : r2(valor * 0.18),
        ...(it.unidadMedida !== null ? { unidadMedida: it.unidadMedida } : {}),
      }
    })

    const pdfInput: EcfPdfInput = {
      modo: 'COTIZACION',
      folio: cot.folio,
      rncEmisor: tenant.rnc,
      nombreEmisor: tenant.razonSocial,
      eNCF: '',
      tipoECF: '',
      fechaEmision: this.fechaDDMMYYYY(cot.createdAt),
      montoTotal: Number(cot.total),
      itbisTotal: Number(cot.itbis),
      montoGravadoTotal: r2(gravado),
      ...(exento > 0 ? { montoExentoTotal: r2(exento) } : {}),
      items,
      ...(contacto?.razonSocial ? { nombreComprador: contacto.razonSocial } : {}),
      ...(contacto?.rnc ? { rncComprador: contacto.rnc } : {}),
      ...this.brandingEmisor(tenant),
    }

    const tmpPath = join(tmpdir(), `cot-${id}-${Date.now()}.pdf`)
    try {
      await generarRepresentacionImpresa(pdfInput, tmpPath)
      const buffer = await readFile(tmpPath)
      return { buffer, filename: `${cot.folio}.pdf` }
    } finally {
      await unlink(tmpPath).catch(() => undefined)
    }
  }

  // Datos de emisor + branding del tenant para la representación impresa.
  private brandingEmisor(tenant: Tenant): Partial<EcfPdfInput> {
    return {
      ...(tenant.nombreComercial !== null ? { nombreComercial: tenant.nombreComercial } : {}),
      ...(tenant.direccion !== null ? { direccionEmisor: tenant.direccion } : {}),
      ...(tenant.telefono !== null ? { telefonoEmisor: tenant.telefono } : {}),
      ...(tenant.email !== null ? { emailEmisor: tenant.email } : {}),
      ...(tenant.logoUrl !== null ? { logoUrl: tenant.logoUrl } : {}),
      ...(tenant.colorPrimario !== null ? { colorPrimario: tenant.colorPrimario } : {}),
      ...(tenant.colorSecundario !== null ? { colorSecundario: tenant.colorSecundario } : {}),
    }
  }

  private fechaDDMMYYYY(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}-${mm}-${d.getFullYear()}`
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async tipoPorDefecto(tenantId: string, contactoId: string | null): Promise<'E31' | 'E32'> {
    if (!contactoId) return 'E32'
    const contacto = await prisma.contacto.findFirst({ where: { id: contactoId, tenantId } })
    if (contacto && contacto.tipo !== 'CONSUMIDOR_FINAL' && contacto.rnc && contacto.rncValidado) return 'E31'
    return 'E32'
  }

  private async resolverItems(tenantId: string, items: CotizacionItemDto[]): Promise<SnapItem[]> {
    return Promise.all(
      items.map(async (item) => {
        if (item.productoId === undefined) {
          // Línea ad-hoc: campos crudos validados en el DTO.
          return {
            nombre: item.nombre as string,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario as number,
            tratamientoITBIS: item.tratamientoITBIS as string,
            indicadorBienoServicio: item.indicadorBienoServicio ?? '2',
            ...(item.descripcion !== undefined && { descripcion: item.descripcion }),
            ...(item.unidadMedida !== undefined && { unidadMedida: item.unidadMedida }),
          }
        }
        const producto = await prisma.producto.findFirst({ where: { id: item.productoId, tenantId } })
        if (!producto) throw new BadRequestException(`Producto ${item.productoId} no encontrado`)
        const descripcion = item.descripcion ?? producto.descripcion ?? undefined
        const unidadMedida = item.unidadMedida ?? producto.unidadMedida ?? undefined
        return {
          productoId: item.productoId,
          nombre: item.nombre ?? producto.nombre,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario ?? Number(producto.precioUnitario),
          tratamientoITBIS: item.tratamientoITBIS ?? producto.tratamientoITBIS,
          indicadorBienoServicio: item.indicadorBienoServicio ?? (producto.tipo === 'BIEN' ? '1' : '2'),
          ...(descripcion !== undefined && { descripcion }),
          ...(unidadMedida !== undefined && { unidadMedida }),
        }
      }),
    )
  }

  private dbItemToSnap(it: CotizacionItem): SnapItem {
    return {
      nombre: it.nombre,
      cantidad: Number(it.cantidad),
      precioUnitario: Number(it.precioUnitario),
      tratamientoITBIS: it.tratamientoITBIS,
      indicadorBienoServicio: it.indicadorBienoServicio,
      ...(it.productoId !== null && { productoId: it.productoId }),
      ...(it.descripcion !== null && { descripcion: it.descripcion }),
      ...(it.unidadMedida !== null && { unidadMedida: it.unidadMedida }),
    }
  }

  private snapToDbItem(s: SnapItem): Prisma.CotizacionItemCreateWithoutCotizacionInput {
    return {
      nombre: s.nombre,
      cantidad: s.cantidad,
      precioUnitario: s.precioUnitario,
      tratamientoITBIS: s.tratamientoITBIS,
      indicadorBienoServicio: s.indicadorBienoServicio,
      ...(s.productoId !== undefined && { productoId: s.productoId }),
      ...(s.descripcion !== undefined && { descripcion: s.descripcion }),
      ...(s.unidadMedida !== undefined && { unidadMedida: s.unidadMedida }),
    }
  }

  // Convierte líneas snapshot a CreateItemDto (misma forma que usa la emisión).
  private snapToCreateItems(items: SnapItem[]): CreateItemDto[] {
    return items.map((s, idx) => {
      const unidad = s.unidadMedida !== undefined && !Number.isNaN(Number(s.unidadMedida)) ? Number(s.unidadMedida) : undefined
      return {
        numeroLinea: idx + 1,
        cantidad: s.cantidad,
        nombreItem: s.nombre,
        precioUnitarioItem: s.precioUnitario,
        indicadorFacturacion: s.tratamientoITBIS === 'EXENTO' ? 'E' : s.tratamientoITBIS,
        indicadorBienoServicio: s.indicadorBienoServicio === '1' ? 1 : 2,
        ...(unidad !== undefined && { unidadMedida: unidad }),
      }
    })
  }

  private subtotal(totales: ReturnType<ComprobantesService['calcularTotalesComprobante']>): number {
    const s = totales.montoGravadoI1 + totales.montoGravadoI2 + totales.montoGravadoI3 + totales.montoExento
    return Math.round(s * 100) / 100
  }

  private hoyDDMMYYYY(): string {
    const d = new Date()
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}-${mm}-${d.getFullYear()}`
  }

  // Deriva VENCIDA en lectura sin mutar el estado almacenado.
  private conEstadoDerivado(c: CotizacionConItems): CotizacionConItems {
    const vencida =
      c.fechaVigencia !== null &&
      c.fechaVigencia.getTime() < Date.now() &&
      !ESTADOS_TERMINALES.has(c.estado) &&
      c.estado !== 'APROBADA'
    return vencida ? { ...c, estado: 'VENCIDA' } : c
  }
}
