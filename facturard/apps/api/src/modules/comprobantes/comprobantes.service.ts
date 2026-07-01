import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { Prisma, prisma } from '@facturard/database'
import type { Comprobante } from '@facturard/database'
import type { CreateComprobanteDto, CreateItemDto } from './dto/create-comprobante.dto'
import type { UpdateComprobanteDto } from './dto/update-comprobante.dto'
import type { CrearNotaDto } from './dto/crear-nota.dto'
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

// tratamientoITBIS del catálogo (I1|I2|I3|EXENTO) → indicadorFacturacion del e-CF.
function mapTratamientoITBIS(t: string): string {
  return t === 'EXENTO' ? 'E' : t
}

function hoyDDMMYYYY(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
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
    const bruto = r2(item.cantidad * (item.precioUnitarioItem ?? 0))
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

  /**
   * Totales de un conjunto de líneas, con la MISMA lógica que la emisión.
   * Se expone para que Cotizaciones no duplique el cálculo de ITBIS/total.
   */
  calcularTotalesComprobante(items: CreateItemDto[]): ReturnType<typeof calcularTotales> {
    return calcularTotales(items)
  }

  async crear(tenantId: string, dtoOriginal: CreateComprobanteDto): Promise<Comprobante> {
    // Resuelve snapshots de producto (items) y del comprador (contacto) ANTES de
    // calcular totales y persistir, para que el documento sea inmutable.
    const dto = await this.resolverDto(tenantId, dtoOriginal)
    const totales = calcularTotales(dto.items)

    // emitir=false → borrador: no consume secuencia, no encola, no toca la DGII.
    if (dto.emitir === false) {
      return prisma.comprobante.create({
        data: {
          tenantId,
          eNCF: null,
          tipoECF: dto.tipoECF,
          estado: 'DRAFT',
          montoTotal: totales.montoTotal,
          rnc: dto.rncComprador ?? '',
          razonSocial: dto.razonSocialComprador ?? '',
          ...(dto.contactoId !== undefined && { contactoId: dto.contactoId }),
          datos: JSON.parse(JSON.stringify(dto)) as object,
        },
      })
    }

    // emitir=true (default) → comportamiento de producción, sin cambios.
    // 1. Verificar que el tenant tiene certificado activo
    const cert = await prisma.certificado.findFirst({ where: { tenantId, activo: true } })
    if (!cert) throw new ConflictException('El tenant no tiene certificado activo. Sube un P12 antes de emitir.')

    // 2. Obtener siguiente eNCF de la secuencia (atómico)
    const eNCF = await this.secuenciasService.siguienteENCF(tenantId, dto.tipoECF)

    // 3. Crear en DB con estado PENDIENTE + datos originales para el worker
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
        ...(dto.contactoId !== undefined && { contactoId: dto.contactoId }),
        datos: JSON.parse(JSON.stringify(dtoConEncf)) as object,
      },
    })

    // 4. Encolar job
    await this.ecfQueue.add('emit', { comprobanteId: comprobante.id, tenantId })

    return comprobante
  }

  /**
   * Resuelve las referencias de un DTO de comprobante:
   *  - Cada item con `productoId` copia nombre/precio/tratamientoITBIS/unidad del
   *    catálogo (override explícito del cliente prevalece). Snapshot inmutable.
   *  - `contactoId` copia identidad del comprador. CONSUMIDOR_FINAL o sin contacto
   *    conserva el flujo sin comprador (E32).
   */
  private async resolverDto(tenantId: string, dto: CreateComprobanteDto): Promise<CreateComprobanteDto> {
    const items = await Promise.all(dto.items.map((item) => this.resolverItem(tenantId, item)))
    for (const it of items) {
      if (
        it.nombreItem === undefined ||
        it.indicadorFacturacion === undefined ||
        it.indicadorBienoServicio === undefined ||
        it.precioUnitarioItem === undefined
      ) {
        throw new BadRequestException(
          'Cada línea requiere nombre, indicadorFacturacion, indicadorBienoServicio y precio (o un productoId válido)',
        )
      }
    }

    let resolved: CreateComprobanteDto = { ...dto, items }

    if (dto.contactoId !== undefined) {
      const contacto = await prisma.contacto.findFirst({ where: { id: dto.contactoId, tenantId } })
      if (!contacto) throw new BadRequestException(`Contacto ${dto.contactoId} no encontrado`)
      if (contacto.tipo !== 'CONSUMIDOR_FINAL') {
        const rncComprador = dto.rncComprador ?? contacto.rnc ?? undefined
        const direccionComprador = dto.direccionComprador ?? contacto.direccion ?? undefined
        const identificadorExtranjero = dto.identificadorExtranjero ?? contacto.identificadorExtranjero ?? undefined
        const paisComprador = dto.paisComprador ?? contacto.paisExtranjero ?? undefined
        resolved = {
          ...resolved,
          razonSocialComprador: dto.razonSocialComprador ?? contacto.razonSocial,
          ...(rncComprador !== undefined && { rncComprador }),
          ...(direccionComprador !== undefined && { direccionComprador }),
          ...(identificadorExtranjero !== undefined && { identificadorExtranjero }),
          ...(paisComprador !== undefined && { paisComprador }),
        }
      }
    }

    return resolved
  }

  private async resolverItem(tenantId: string, item: CreateItemDto): Promise<CreateItemDto> {
    if (item.productoId === undefined) return item

    const producto = await prisma.producto.findFirst({ where: { id: item.productoId, tenantId } })
    if (!producto) throw new BadRequestException(`Producto ${item.productoId} no encontrado`)

    const unidadProducto =
      producto.unidadMedida != null && producto.unidadMedida !== '' && !Number.isNaN(Number(producto.unidadMedida))
        ? Number(producto.unidadMedida)
        : undefined
    const unidadMedida = item.unidadMedida ?? unidadProducto

    return {
      numeroLinea: item.numeroLinea,
      cantidad: item.cantidad,
      productoId: item.productoId,
      nombreItem: item.nombreItem ?? producto.nombre,
      precioUnitarioItem: item.precioUnitarioItem ?? Number(producto.precioUnitario),
      indicadorFacturacion: item.indicadorFacturacion ?? mapTratamientoITBIS(producto.tratamientoITBIS),
      indicadorBienoServicio: item.indicadorBienoServicio ?? (producto.tipo === 'SERVICIO' ? 2 : 1),
      ...(item.descuentoPorcentaje !== undefined && { descuentoPorcentaje: item.descuentoPorcentaje }),
      ...(unidadMedida !== undefined && { unidadMedida }),
    }
  }

  /**
   * Edita un comprobante en estado DRAFT (borrador). Recalcula totales si se
   * envían nuevos `items`. Rechaza (409) cualquier comprobante que ya no sea
   * borrador — un e-CF emitido es inmutable.
   */
  async actualizarDraft(
    tenantId: string,
    id: string,
    dto: UpdateComprobanteDto,
  ): Promise<Comprobante> {
    const comprobante = await this.findOne(tenantId, id)
    if (comprobante.estado !== 'DRAFT') {
      throw new ConflictException('Sólo se pueden editar comprobantes en estado DRAFT')
    }

    const datosActuales = (comprobante.datos ?? {}) as unknown as CreateComprobanteDto
    const merged = { ...datosActuales, ...dto } as CreateComprobanteDto
    const datos = await this.resolverDto(tenantId, merged)
    const totales = calcularTotales(datos.items)

    return prisma.comprobante.update({
      where: { id },
      data: {
        montoTotal: totales.montoTotal,
        rnc: datos.rncComprador ?? '',
        razonSocial: datos.razonSocialComprador ?? '',
        ...(dto.tipoECF !== undefined && { tipoECF: dto.tipoECF }),
        ...(datos.contactoId !== undefined && { contactoId: datos.contactoId }),
        datos: JSON.parse(JSON.stringify(datos)) as object,
      },
    })
  }

  /**
   * Transiciona un DRAFT al pipeline de emisión real: asigna e-NCF de la
   * secuencia (atómico), lo persiste en `datos` y encola el job de BullMQ.
   * Reutiliza EXACTAMENTE el mismo camino que `crear(emitir=true)`.
   * Idempotente: si el comprobante ya no es DRAFT devuelve 409.
   */
  async emitir(tenantId: string, id: string): Promise<Comprobante> {
    const comprobante = await this.findOne(tenantId, id)
    if (comprobante.estado !== 'DRAFT') {
      throw new ConflictException('El comprobante ya fue emitido o no es un borrador')
    }

    const cert = await prisma.certificado.findFirst({ where: { tenantId, activo: true } })
    if (!cert) throw new ConflictException('El tenant no tiene certificado activo. Sube un P12 antes de emitir.')

    const datos = (comprobante.datos ?? {}) as unknown as CreateComprobanteDto
    const eNCF = await this.secuenciasService.siguienteENCF(tenantId, comprobante.tipoECF)
    const dtoConEncf = { ...datos, eNCF }

    const actualizado = await prisma.comprobante.update({
      where: { id },
      data: {
        eNCF,
        estado: 'PENDIENTE',
        datos: JSON.parse(JSON.stringify(dtoConEncf)) as object,
      },
    })

    await this.ecfQueue.add('emit', { comprobanteId: id, tenantId })

    return actualizado
  }

  /**
   * Emite una nota de crédito (E34) o débito (E33) sobre un comprobante ACEPTADO.
   * Reutiliza los generadores E33/E34 del ecf-engine (vía crear → pipeline) y hereda
   * del fuente: comprador (contacto + snapshot) y referencia fiscal (ncfModificado,
   * fechaNCFModificado, comprobanteReferenciaId). No reimplementa la emisión.
   */
  async crearNota(tenantId: string, sourceId: string, dto: CrearNotaDto): Promise<Comprobante> {
    const source = await this.findOne(tenantId, sourceId) // 404 tenant-scoped
    if (source.estado !== 'ACEPTADO') {
      throw new ConflictException('El comprobante fuente debe estar ACEPTADO para emitir una nota')
    }
    const datosFuente = (source.datos ?? {}) as unknown as CreateComprobanteDto
    if (!source.eNCF || !datosFuente.fechaEmision) {
      throw new ConflictException('El comprobante fuente no tiene e-NCF o fecha de emisión')
    }

    const items = dto.items ?? datosFuente.items
    if (!items || items.length === 0) throw new BadRequestException('La nota no tiene líneas')

    const notaDto: CreateComprobanteDto = {
      tipoECF: dto.tipo,
      emitir: dto.emitir ?? true,
      fechaEmision: hoyDDMMYYYY(),
      items,
      // Referencia fiscal heredada del comprobante fuente
      ncfModificado: source.eNCF,
      fechaNCFModificado: datosFuente.fechaEmision,
      codigoModificacion: dto.codigoModificacion,
      // Comprador heredado (snapshot del fuente)
      ...(datosFuente.rncComprador !== undefined && { rncComprador: datosFuente.rncComprador }),
      ...(datosFuente.razonSocialComprador !== undefined && { razonSocialComprador: datosFuente.razonSocialComprador }),
      ...(datosFuente.direccionComprador !== undefined && { direccionComprador: datosFuente.direccionComprador }),
      ...(datosFuente.identificadorExtranjero !== undefined && { identificadorExtranjero: datosFuente.identificadorExtranjero }),
      ...(datosFuente.paisComprador !== undefined && { paisComprador: datosFuente.paisComprador }),
      ...(datosFuente.fechaVencimiento !== undefined && { fechaVencimiento: datosFuente.fechaVencimiento }),
      ...(source.contactoId !== null && { contactoId: source.contactoId }),
      ...(dto.razonModificacion !== undefined && { razonModificacion: dto.razonModificacion }),
      ...(dto.indicadorNotaCredito !== undefined && { indicadorNotaCredito: dto.indicadorNotaCredito }),
    }

    const nota = await this.crear(tenantId, notaDto)

    // Enlace a la factura referenciada.
    return prisma.comprobante.update({
      where: { id: nota.id },
      data: { comprobanteReferenciaId: source.id },
    })
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
