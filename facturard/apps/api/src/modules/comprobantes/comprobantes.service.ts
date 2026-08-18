import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readFile, unlink } from 'node:fs/promises'
import { Prisma, prisma } from '@facturard/database'
import type { Comprobante } from '@facturard/database'
import { generarRepresentacionImpresa, resolveDgiiEnv } from '@facturard/ecf-engine'
import type { EcfPdfInput } from '@facturard/ecf-engine'
import { buildEcfPdfInput } from './pdf-input.builder'
import type { CreateComprobanteDto, CreateItemDto } from './dto/create-comprobante.dto'
import type { UpdateComprobanteDto } from './dto/update-comprobante.dto'
import type { CrearNotaDto } from './dto/crear-nota.dto'
import type { ListComprobantesDto } from './dto/list-comprobantes.dto'
import type { ResumenComprobantesDto } from './dto/resumen-comprobantes.dto'
import type { VentasPorProvinciaDto } from './dto/ventas-por-provincia.dto'
import type { PaginatedResponse, ResumenComprobantes, VentasPorProvincia } from '@facturard/shared'
import { SecuenciasService } from '../secuencias/secuencias.service'
import { DocumentoFolioService } from './documento-folio.service'

/**
 * Comprobante + el correo del comprador resuelto desde el Contacto local.
 * `contactoEmail` NO es una columna: se resuelve al leer (ver `conContactoEmail`).
 */
export type ComprobanteConContacto = Comprobante & { contactoEmail: string | null }

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

// Norma General 10-18 + Formato e-CF v1.0: en E32 de consumo, la identificación
// del comprador (RNC/Cédula) es obligatoria cuando el monto total >= RD$250,000.
export const UMBRAL_IDENTIFICACION_E32 = 250_000

// `NombreItem` es `AlfNum80Type` (maxLength 80) en los XSD de la DGII para
// E31/E32/E33/E34. Un nombre más largo genera un XML que NO valida contra el
// XSD y la emisión falla en el worker — DESPUÉS de haber quemado el e-NCF.
// Se valida ANTES de consumir la secuencia para no quemar un comprobante por un
// nombre demasiado largo (el catálogo de productos no limita el largo del
// nombre, así que el snapshot también puede exceder 80).
export const MAX_NOMBRE_ITEM = 80

/** Lanza 400 si un E32 >= umbral no trae identificación del comprador. */
function validarIdentificacionE32(dto: CreateComprobanteDto, montoTotal: number): void {
  if (dto.tipoECF !== 'E32' || montoTotal < UMBRAL_IDENTIFICACION_E32) return
  const tieneId =
      (dto.rncComprador !== undefined && dto.rncComprador.trim() !== '') ||
      (dto.identificadorExtranjero !== undefined && dto.identificadorExtranjero.trim() !== '')
  if (!tieneId) {
    throw new BadRequestException(
        `Falta identificación del comprador (RNC/Cédula) para una Factura de Consumo (E32) con monto total >= RD$${UMBRAL_IDENTIFICACION_E32.toLocaleString('en-US')}.`,
    )
  }
}

function hoyDDMMYYYY(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

// La fecha de vencimiento de secuencia se guarda a mediodía UTC (ver
// secuencias.controller). getUTC* evita que el día se corra por zona horaria.
function fechaVencToDDMMYYYY(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`
}

// Tipos de e-CF cuya norma EXIGE <FechaVencimientoSecuencia> (CLAUDE.md §14).
// E32 y E34 NO la llevan → deben emitir sin exigirla.
const TIPOS_REQUIEREN_FECHAVENC = new Set(['E31', 'E33', 'E41', 'E43', 'E44', 'E45', 'E46', 'E47'])

function parseDDMMYYYYtoUTC(s: string): number | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s)
  return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null
}

/** Días calendario entre dos fechas DD-MM-YYYY (hasta - desde). */
function diasCalendarioEntre(desde: string, hasta: string): number {
  const a = parseDDMMYYYYtoUTC(desde)
  const b = parseDDMMYYYYtoUTC(hasta)
  if (a === null || b === null) return 0
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
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

  let gI1 = 0, gI2 = 0, gI3 = 0, exento = 0, itbis = 0, retITBIS = 0, retISR = 0

  for (const item of items) {
    const bruto = r2(item.cantidad * (item.precioUnitarioItem ?? 0))
    // Descuento por porcentaje (cotizaciones) y/o monto absoluto (form estándar);
    // ausentes → 0, sin efecto. La base gravada nunca baja de 0.
    const descPct = r2(bruto * ((item.descuentoPorcentaje ?? 0) / 100))
    const descAbs = item.descuento ?? 0
    const monto = r2(Math.max(0, bruto - descPct - descAbs))

    switch (item.indicadorFacturacion) {
      case 'I1': gI1 += monto; itbis += r2(monto * 0.18); break
      case 'I2': gI2 += monto; itbis += r2(monto * 0.16); break
      case 'I3': gI3 += monto; break
      default:   exento += monto; break  // I4, E
    }

    // Retenciones de la línea (E41/E47); ausentes → 0, no alteran el total.
    retITBIS += item.itbisRetenido ?? 0
    retISR += item.isrRetenido ?? 0
  }

  const montoGravadoTotal = r2(gI1 + gI2 + gI3)
  const totalITBIS = r2(itbis)
  const montoTotal = r2(Math.max(0, montoGravadoTotal + exento + totalITBIS - retITBIS - retISR))

  return { montoGravadoI1: r2(gI1), montoGravadoI2: r2(gI2), montoGravadoI3: r2(gI3), montoExento: r2(exento), totalITBIS, montoTotal }
}

@Injectable()
export class ComprobantesService {
  constructor(
      @InjectQueue('ecf-emission') private readonly ecfQueue: Queue<EcfJobData>,
      private readonly secuenciasService: SecuenciasService,
      private readonly documentoFolioService: DocumentoFolioService,
  ) {}

  /**
   * Totales de un conjunto de líneas, con la MISMA lógica que la emisión.
   * Se expone para que Cotizaciones no duplique el cálculo de ITBIS/total.
   */
  calcularTotalesComprobante(items: CreateItemDto[]): ReturnType<typeof calcularTotales> {
    return calcularTotales(items)
  }

  /**
   * Resuelve la FechaVencimientoSecuencia (DD-MM-YYYY) que irá en el e-CF:
   *  1) payloadFecha  — override manual explícito del emisor, si viene.
   *  2) secuenciaFecha — la fecha del rango autorizado por la DGII para ese tipo.
   *  3) si el tipo la EXIGE y no hay ninguna → error claro (NUNCA un default silencioso).
   * Tipos que por norma no la llevan (E32, E34) devuelven undefined sin error.
   */
  private resolverFechaVencimiento(
      tipoECF: string,
      payloadFecha: string | undefined,
      secuenciaFecha: Date | null,
  ): string | undefined {
    if (payloadFecha) return payloadFecha
    if (secuenciaFecha) return fechaVencToDDMMYYYY(secuenciaFecha)
    if (TIPOS_REQUIEREN_FECHAVENC.has(tipoECF)) {
      throw new BadRequestException(
          `Falta la fecha de vencimiento de la secuencia para el tipo ${tipoECF}; configúrala en Empresa/Secuencias.`,
      )
    }
    return undefined
  }

  /**
   * Barrera de emisión: un tenant solo puede ENVIAR a la DGII si tiene un
   * certificado digital activo y vigente. Sin él, lanza 409 con un mensaje claro
   * y accionable. NO afecta borradores (DRAFT) ni cotizaciones — esos flujos no
   * llaman a este método. Es la protección de servidor: no basta con ocultar el
   * botón en el front.
   */
  private async assertPuedeEmitir(tenantId: string): Promise<void> {
    const cert = await prisma.certificado.findFirst({ where: { tenantId, activo: true } })
    if (!cert) {
      throw new ConflictException(
          'No puedes emitir a la DGII sin un certificado digital activo. ' +
          'Configúralo en Configuración → Certificación fiscal (o guarda el comprobante como borrador).',
      )
    }
    if (cert.validoHasta.getTime() < Date.now()) {
      throw new ConflictException(
          `Tu certificado digital venció el ${cert.validoHasta.toLocaleDateString('es-DO')}. ` +
          'Sube uno vigente en Configuración → Certificación fiscal para volver a emitir.',
      )
    }
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
          esFiscal: dto.esFiscal ?? true,
          tipoECF: dto.tipoECF ?? 'E32',
          estado: 'DRAFT',
          montoTotal: totales.montoTotal,
          rnc: dto.rncComprador ?? '',
          razonSocial: dto.razonSocialComprador ?? '',
          ...(dto.contactoId !== undefined && { contactoId: dto.contactoId }),
          datos: JSON.parse(JSON.stringify(dto)) as object,
        },
      })
    }

    // esFiscal=false → "Nota de venta" interna: documento NO fiscal. NO consume
    // e-NCF, NO firma, NO encola, NO toca la DGII y queda fuera de 606/607/608.
    // Numeración interna propia (NV-000001). No exige certificado ni campos
    // fiscales. Esta rama corre ANTES que cualquier lógica de emisión.
    if (dto.esFiscal === false) {
      const folioInterno = await this.documentoFolioService.siguienteFolio(tenantId)
      return prisma.comprobante.create({
        data: {
          tenantId,
          eNCF: null,
          esFiscal: false,
          folioInterno,
          // tipoECF es informativo en una nota (no va a la DGII). Si no vino, se
          // default-ea a E32 solo para satisfacer la columna NOT NULL del schema.
          tipoECF: dto.tipoECF ?? 'E32',
          estado: 'INTERNO',
          montoTotal: totales.montoTotal,
          rnc: dto.rncComprador ?? '',
          razonSocial: dto.razonSocialComprador ?? '',
          ...(dto.contactoId !== undefined && { contactoId: dto.contactoId }),
          datos: JSON.parse(JSON.stringify(dto)) as object,
        },
      })
    }

    // emitir=true (default) → comportamiento de producción, sin cambios.
    // Validación DGII: E32 >= RD$250,000 requiere identificación del comprador.
    validarIdentificacionE32(dto, totales.montoTotal)

    // 1. Verificar que el tenant tiene certificado activo (barrera de emisión).
    await this.assertPuedeEmitir(tenantId)

    // 2. Resolver FechaVencimientoSecuencia ANTES de consumir la secuencia
    //    (si falta y el tipo la exige, se lanza error sin gastar un e-NCF).
    const secuenciaFecha = await this.secuenciasService.getFechaVencimiento(tenantId, dto.tipoECF)
    const fechaVencimiento = this.resolverFechaVencimiento(dto.tipoECF, dto.fechaVencimiento, secuenciaFecha)

    // 3. Obtener siguiente eNCF de la secuencia (atómico)
    const { eNCF } = await this.secuenciasService.siguienteENCF(tenantId, dto.tipoECF)

    // 4. Crear en DB con estado PENDIENTE + datos originales para el worker
    const dtoConEncf = { ...dto, eNCF, ...(fechaVencimiento !== undefined && { fechaVencimiento }) }
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
  /**
   * `NombreItem` es AlfNum80Type en los XSD de la DGII: un nombre >80 genera un
   * XML que NO valida y la emisión falla en el worker DESPUÉS de quemar el e-NCF.
   * Se rechaza aquí (antes de consumir la secuencia) y NO se trunca — el nombre
   * es contenido fiscal, no se altera en silencio.
   *
   * Se llama en los DOS caminos que pueden consumir un e-NCF: al crear+emitir
   * (`resolverDto`) y al emitir un borrador ya guardado (`emitir`), porque un
   * draft pudo guardarse sin esta validación.
   */
  private assertNombresItemValidos(items: readonly CreateItemDto[]): void {
    for (const it of items) {
      const nombre = (it.nombreItem ?? '').trim()
      if (nombre.length > MAX_NOMBRE_ITEM) {
        throw new BadRequestException(
            `El nombre del artículo en la línea ${it.numeroLinea} tiene ${nombre.length} caracteres y la DGII ` +
            `permite máximo ${MAX_NOMBRE_ITEM}. Acórtalo ${nombre.length - MAX_NOMBRE_ITEM} caracteres ` +
            `(artículo: "${nombre.slice(0, 40)}…").`,
        )
      }
    }
  }

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
    this.assertNombresItemValidos(items)

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
    const descripcionItem = item.descripcion ?? producto.descripcion ?? undefined

    return {
      numeroLinea: item.numeroLinea,
      cantidad: item.cantidad,
      productoId: item.productoId,
      nombreItem: item.nombreItem ?? producto.nombre,
      precioUnitarioItem: item.precioUnitarioItem ?? Number(producto.precioUnitario),
      indicadorFacturacion: item.indicadorFacturacion ?? mapTratamientoITBIS(producto.tratamientoITBIS),
      indicadorBienoServicio: item.indicadorBienoServicio ?? (producto.tipo === 'SERVICIO' ? 2 : 1),
      // La descripción de la línea: la del item manda; si no vino, cae al texto
      // del catálogo (snapshot, igual que nombre/precio).
      ...(descripcionItem !== undefined && { descripcion: descripcionItem }),
      ...(item.descuentoPorcentaje !== undefined && { descuentoPorcentaje: item.descuentoPorcentaje }),
      ...(item.descuento !== undefined && { descuento: item.descuento }),
      ...(item.itbisRetenido !== undefined && { itbisRetenido: item.itbisRetenido }),
      ...(item.isrRetenido !== undefined && { isrRetenido: item.isrRetenido }),
      ...(unidadMedida !== undefined && { unidadMedida }),
    }
  }

  /**
   * Edita un comprobante EDITABLE. Recalcula totales si se envían nuevos `items`.
   * Son editables:
   *  - un borrador fiscal (DRAFT), y
   *  - una Nota de venta interna (esFiscal=false, estado INTERNO) — no tiene
   *    consecuencia fiscal, así que se puede corregir después de creada.
   * Un e-CF fiscal ya EMITIDO es inmutable → 409. La edición nunca cambia la
   * naturaleza (esFiscal) ni el folio/e-NCF del documento.
   */
  async actualizarDraft(
      tenantId: string,
      id: string,
      dto: UpdateComprobanteDto,
  ): Promise<Comprobante> {
    const comprobante = await this.findOne(tenantId, id)
    const esNotaVenta = !comprobante.esFiscal && comprobante.estado === 'INTERNO'
    const esBorrador = comprobante.estado === 'DRAFT'
    if (!esBorrador && !esNotaVenta) {
      throw new ConflictException(
          'Sólo se pueden editar borradores (DRAFT) o notas de venta internas. Un e-CF emitido es inmutable.',
      )
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
   * Soft-delete de una Nota de venta interna (esFiscal=false). Un e-CF fiscal
   * NUNCA se elimina (inmutable) → 409. El registro se marca `eliminado=true` y
   * deja de aparecer en listados/detalle/PDF, pero se conserva en la DB.
   */
  async eliminar(tenantId: string, id: string): Promise<{ id: string; eliminado: true }> {
    const comprobante = await this.findOne(tenantId, id)
    // Un e-CF fiscal YA EMITIDO consumió un e-NCF y es parte del historial fiscal:
    // inmutable, no se elimina. Pero un BORRADOR (DRAFT) no consumió e-NCF ni tocó
    // la DGII, y una nota de venta interna es no fiscal → ambos se pueden descartar
    // (soft-delete). La barrera es "ya emitido", no "es fiscal".
    if (comprobante.esFiscal && comprobante.estado !== 'DRAFT') {
      throw new ConflictException(
          'No se puede eliminar un comprobante fiscal ya emitido. Sólo los borradores y las notas de venta internas son eliminables.',
      )
    }
    await prisma.comprobante.update({ where: { id }, data: { eliminado: true } })
    return { id, eliminado: true }
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

    // Si es una Nota de venta interna (esFiscal=false), transiciona a INTERNO y asigna el folio NV-
    if (comprobante.esFiscal === false) {
      const folioInterno = await this.documentoFolioService.siguienteFolio(tenantId)
      return prisma.comprobante.update({
        where: { id },
        data: {
          folioInterno,
          estado: 'INTERNO',
        },
      })
    }

    await this.assertPuedeEmitir(tenantId)

    const datos = (comprobante.datos ?? {}) as unknown as CreateComprobanteDto
    // Validación DGII: E32 >= RD$250,000 requiere identificación del comprador.
    validarIdentificacionE32(datos, Number(comprobante.montoTotal))
    // Un borrador guardado antes de esta validación (o por otro camino) podría
    // traer un NombreItem >80: se atrapa aquí, antes de quemar el e-NCF.
    this.assertNombresItemValidos(datos.items ?? [])

    // Resolver FechaVencimientoSecuencia antes de consumir la secuencia.
    const secuenciaFecha = await this.secuenciasService.getFechaVencimiento(tenantId, comprobante.tipoECF)
    const fechaVencimiento = this.resolverFechaVencimiento(comprobante.tipoECF, datos.fechaVencimiento, secuenciaFecha)

    const { eNCF } = await this.secuenciasService.siguienteENCF(tenantId, comprobante.tipoECF)
    const dtoConEncf = { ...datos, eNCF, ...(fechaVencimiento !== undefined && { fechaVencimiento }) }

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
  async crearNota(
      tenantId: string,
      sourceId: string,
      dto: CrearNotaDto,
  ): Promise<Comprobante & { avisoITBIS?: string }> {
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

    const fechaNota = hoyDDMMYYYY()

    // IndicadorNotaCredito (SOLO E34): regla de 30 días calculada por el servidor.
    // La fecha manda — se ignora cualquier valor enviado por el caller.
    let indicadorNotaCredito: 0 | 1 | undefined
    let avisoITBIS: string | undefined
    if (dto.tipo === 'E34') {
      const dias = diasCalendarioEntre(datosFuente.fechaEmision, fechaNota)
      indicadorNotaCredito = dias > 30 ? 1 : 0
      if (indicadorNotaCredito === 1) {
        avisoITBIS =
            'La nota de crédito se emite a más de 30 días calendario del comprobante afectado: ' +
            'NO rebaja ITBIS (Ley 11-92 Art. 338 párrafo; Reglamento 293-11 Art. 8).'
      }
    }

    const notaDto: CreateComprobanteDto = {
      tipoECF: dto.tipo,
      emitir: dto.emitir ?? true,
      fechaEmision: fechaNota,
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
      // NO se hereda fechaVencimiento del fuente: la nota (E33) usa su PROPIA
      // secuencia, con su propia fecha de vencimiento autorizada por la DGII.
      // crear() la resuelve desde la secuencia de E33 (E34 no la lleva).
      ...(source.contactoId !== null && { contactoId: source.contactoId }),
      ...(dto.razonModificacion !== undefined && { razonModificacion: dto.razonModificacion }),
      // E33 no lleva el campo (indicadorNotaCredito queda undefined).
      ...(indicadorNotaCredito !== undefined && { indicadorNotaCredito }),
    }

    const nota = await this.crear(tenantId, notaDto)

    // Enlace a la factura referenciada.
    const actualizado = await prisma.comprobante.update({
      where: { id: nota.id },
      data: { comprobanteReferenciaId: source.id },
    })

    return avisoITBIS ? { ...actualizado, avisoITBIS } : actualizado
  }

  async findAll(tenantId: string, query: ListComprobantesDto): Promise<PaginatedResponse<ComprobanteConContacto>> {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip = (page - 1) * limit

    // Clase de documento (filtro de la lista). DRAFT manda sobre esFiscal, igual
    // que en el front (`claseDocumento`): una nota de venta también puede estar
    // en borrador (esFiscal=false + DRAFT, todavía sin folio NV-) y debe caer en
    // "borrador", no en "nota". Las tres clases son mutuamente excluyentes.
    //  fiscal   → e-CF fiscal ya emitido / en curso (no borrador)
    //  borrador → cualquier DRAFT (fiscal o de nota de venta)
    //  nota     → Nota de venta ya creada (esFiscal=false y no borrador)
    const claseWhere: Prisma.ComprobanteWhereInput =
        query.clase === 'nota' ? { esFiscal: false, estado: { not: 'DRAFT' } }
      : query.clase === 'borrador' ? { estado: 'DRAFT' }
      : query.clase === 'fiscal' ? { esFiscal: true, estado: { not: 'DRAFT' } }
      : {}

    // Estado(s) DGII. Llega como lista para poder pedir el agrupado "En proceso"
    // (PENDIENTE|EN_COLA|ENVIANDO) en UNA consulta paginada por el servidor.
    // Va en AND con la clase: si ambos se combinan, ninguno pisa al otro.
    const estadoWhere: Prisma.ComprobanteWhereInput =
      query.estado !== undefined && query.estado.length > 0 ? { estado: { in: query.estado } } : {}

    // Procedencia: convertido desde una cotización. Es un eje aparte del estado.
    const origenWhere: Prisma.ComprobanteWhereInput =
      query.origen === 'cotizacion' ? { cotizacionId: { not: null } } : {}

    const where: Prisma.ComprobanteWhereInput = {
      tenantId,
      eliminado: false, // las notas de venta soft-deleted no se listan
      AND: [claseWhere, estadoWhere, origenWhere],
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

    return {
      data: await this.conContactoEmail(tenantId, data),
      total, page, limit, totalPages: Math.ceil(total / limit),
    }
  }

  async findOne(tenantId: string, id: string): Promise<Comprobante> {
    const comprobante = await prisma.comprobante.findFirst({ where: { id, tenantId, eliminado: false } })
    if (!comprobante) throw new NotFoundException(`Comprobante ${id} no encontrado`)
    return comprobante
  }

  /** Detalle para la UI: el comprobante + el correo del comprador ya resuelto. */
  async findOneDetalle(tenantId: string, id: string): Promise<ComprobanteConContacto> {
    const comprobante = await this.findOne(tenantId, id)
    return (await this.conContactoEmail(tenantId, [comprobante]))[0]!
  }

  /**
   * Adjunta `contactoEmail`: el correo del comprador según el Contacto local.
   *
   * El comprobante NO guarda correo (el snapshot fiscal es rnc/razón social/
   * dirección), así que la única fuente es el Contacto. La UI lo necesita para
   * mostrar a dónde va a salir el envío; sin esto el modal creía que el cliente
   * no tenía correo aunque el backend sí lo resolvía.
   *
   * Misma regla que el envío (`contactoId` primero, RNC después) y UNA sola
   * consulta para toda la página.
   */
  private async conContactoEmail<T extends Comprobante>(tenantId: string, comprobantes: T[]): Promise<(T & { contactoEmail: string | null })[]> {
    const ids = comprobantes.map((c) => c.contactoId).filter((v): v is string => !!v)
    const rncs = comprobantes.filter((c) => !c.contactoId).map((c) => c.rnc).filter((v): v is string => !!v)

    const contactos =
      ids.length === 0 && rncs.length === 0
        ? []
        : await prisma.contacto.findMany({
            where: {
              tenantId,
              OR: [
                ...(ids.length > 0 ? [{ id: { in: ids } }] : []),
                ...(rncs.length > 0 ? [{ rnc: { in: rncs }, activo: true }] : []),
              ],
            },
            select: { id: true, rnc: true, email: true },
            orderBy: { createdAt: 'asc' },
          })

    const porId = new Map(contactos.map((c) => [c.id, c.email]))
    const porRnc = new Map<string, string | null>()
    for (const c of contactos) {
      if (c.rnc && !porRnc.has(c.rnc)) porRnc.set(c.rnc, c.email) // el más antiguo gana, como en el envío
    }

    return comprobantes.map((c) => ({
      ...c,
      contactoEmail: (c.contactoId ? porId.get(c.contactoId) : c.rnc ? porRnc.get(c.rnc) : null) ?? null,
    }))
  }

  /**
   * Regenera el PDF del comprobante AL VUELO desde los datos persistidos
   * (`datos` + `xmlFirmado`), en vez de servir el archivo guardado en disco.
   * Motivos: (a) el /tmp de Railway es efímero (se borra en cada redeploy), y
   * (b) así el QR/consultatimbre lleva siempre el set correcto (e-NCF en MAYÚS,
   * fechafirma y codigoseguridad), sin depender de PDFs viejos ya horneados ni
   * reemitir el e-CF. No consume secuencia ni contacta a la DGII.
   */
  async regenerarPdfBuffer(tenantId: string, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const comprobante = await this.findOne(tenantId, id)

    // Los comprobantes con error/rechazo no tienen PDF descargable (no llegaron a
    // representar nada válido). El resto sí: aceptados salen como e-CF fiscal con QR;
    // borradores/pendientes salen como VISTA PREVIA (modo BORRADOR, sin QR/timbre).
    if (comprobante.estado === 'RECHAZADO' || comprobante.estado === 'ERROR') {
      throw new NotFoundException('No hay PDF disponible: el comprobante fue rechazado o falló su envío')
    }
    if (!comprobante.datos) {
      throw new NotFoundException('El comprobante no tiene datos suficientes para generar el PDF')
    }

    // Una Nota de venta interna (esFiscal=false) es un documento NO fiscal: sale
    // en modo INTERNO (sin QR/timbre, título "NOTA DE VENTA", folio NV-xxxx).
    const esNotaVenta = !comprobante.esFiscal
    const aceptadoFiscal = comprobante.estado === 'ACEPTADO' || comprobante.estado === 'ACEPTADO_CONDICIONAL'

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    const datos = comprobante.datos as unknown as CreateComprobanteDto
    const base = buildEcfPdfInput(
        datos,
        tenant,
        comprobante.eNCF ?? '',
        resolveDgiiEnv(),
        aceptadoFiscal ? (comprobante.xmlFirmado ?? undefined) : undefined,
    )
    // Sólo el aceptado fiscal se representa como e-CF (con QR/timbre). La nota de
    // venta interna → modo INTERNO. Cualquier otro estado fiscal emitible
    // (DRAFT/PENDIENTE/EN_COLA/ENVIANDO) es una vista previa (BORRADOR).
    const pdfInput: EcfPdfInput =
        esNotaVenta ? { ...base, modo: 'INTERNO', folio: comprobante.folioInterno ?? '' }
      : aceptadoFiscal ? base
      : { ...base, modo: 'BORRADOR' }

    const tmpPath = join(tmpdir(), `ecf-${id}-${Date.now()}.pdf`)
    try {
      await generarRepresentacionImpresa(pdfInput, tmpPath)
      const buffer = await readFile(tmpPath)
      const filename = esNotaVenta
        ? `${comprobante.folioInterno ?? `nota-venta-${id.slice(0, 8)}`}.pdf`
        : comprobante.eNCF
          ? `${comprobante.eNCF}${aceptadoFiscal ? '' : '-borrador'}.pdf`
          : `borrador-${id.slice(0, 8)}.pdf`
      return { buffer, filename }
    } finally {
      await unlink(tmpPath).catch(() => undefined)
    }
  }

  async resumen(tenantId: string, query: ResumenComprobantesDto): Promise<ResumenComprobantes> {
    // El dashboard mide facturación FISCAL: las notas de venta internas
    // (esFiscal=false) y los eliminados no cuentan en estas métricas.
    const where: Prisma.ComprobanteWhereInput = {
      tenantId,
      esFiscal: true,
      eliminado: false,
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

  /**
   * Ventas por provincia del comprador — no fiscal, solo lectura para el mapa
   * del dashboard. 2 queries fijas (facturas del rango + contactos del
   * tenant), se unen por RNC en memoria: nada de N+1 ni JOIN pesado.
   * `clase`: fiscal (default, e-CF aceptados) | nota (notas de venta interna
   * ya finalizadas, sin DGII) | todas. "Todas" además cuenta las notas que se
   * quedaron en Borrador (bug conocido del form: manda emitir:false junto con
   * esFiscal:false) — el usuario las creó, cuentan como venta aunque el
   * estado quedara mal seteado. Fiscales sigue exigiendo ACEPTADO.
   */
  async ventasPorProvincia(tenantId: string, query: VentasPorProvinciaDto): Promise<VentasPorProvincia> {
    const claseWhere: Prisma.ComprobanteWhereInput =
        query.clase === 'nota' ? { esFiscal: false, estado: { not: 'DRAFT' } }
      : query.clase === 'todas' ? {
          OR: [
            { esFiscal: true, estado: { in: ['ACEPTADO', 'ACEPTADO_CONDICIONAL'] } },
            { esFiscal: false },
          ],
        }
      : { esFiscal: true, estado: { in: ['ACEPTADO', 'ACEPTADO_CONDICIONAL'] } }

    const where: Prisma.ComprobanteWhereInput = {
      tenantId,
      eliminado: false,
      ...claseWhere,
      ...rangoFechas(query.fechaDesde, query.fechaHasta),
    }

    const [facturas, contactos] = await Promise.all([
      prisma.comprobante.findMany({ where, select: { rnc: true, montoTotal: true } }),
      prisma.contacto.findMany({
        where: { tenantId, provincia: { not: null } },
        select: { rnc: true, provincia: true },
      }),
    ])

    const provinciaPorRnc = new Map(
      contactos.filter((c) => c.rnc !== null).map((c) => [c.rnc as string, c.provincia as string]),
    )

    const r2 = (n: number) => Math.round(n * 100) / 100
    const acumPorProvincia = new Map<string, { facturas: number; monto: number }>()
    let sinAsignarFacturas = 0
    let sinAsignarMonto = 0

    for (const f of facturas) {
      const monto = Number(f.montoTotal)
      const provincia = provinciaPorRnc.get(f.rnc)
      if (!provincia) {
        sinAsignarFacturas += 1
        sinAsignarMonto += monto
        continue
      }
      const actual = acumPorProvincia.get(provincia) ?? { facturas: 0, monto: 0 }
      acumPorProvincia.set(provincia, { facturas: actual.facturas + 1, monto: actual.monto + monto })
    }

    return {
      provincias: Array.from(acumPorProvincia.entries()).map(([provincia, v]) => ({
        provincia,
        facturas: v.facturas,
        monto: r2(v.monto),
      })),
      sinAsignar: { facturas: sinAsignarFacturas, monto: r2(sinAsignarMonto) },
    }
  }
}
