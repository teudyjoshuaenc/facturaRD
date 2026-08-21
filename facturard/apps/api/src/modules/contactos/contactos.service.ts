import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { Prisma, prisma } from '@facturard/database'
import type { Contacto } from '@facturard/database'
import { DgiiContribuyentesService } from '../tenants/dgii-contribuyentes.service'
import type { CreateContactoDto } from './dto/create-contacto.dto'
import type { UpdateContactoDto } from './dto/update-contacto.dto'
import type { ListContactosDto } from './dto/list-contactos.dto'
import type { PaginatedResponse } from '@facturard/shared'

// La respuesta de crear/actualizar puede llevar un warning (p.ej. la DGII no
// respondió) sin bloquear la operación.
export type ContactoConAviso = Contacto & { warning?: string }

// Contacto del selector de emisión enriquecido con la fecha del último
// comprobante que se le hizo. Sólo lectura: no toca nada fiscal.
export type ContactoReciente = Contacto & { ultimaFacturaAt: Date }

// Tope de contactos "recientes" que devuelve el endpoint. La UI pinta 5.
const MAX_RECIENTES = 10

@Injectable()
export class ContactosService {
  constructor(private readonly dgii: DgiiContribuyentesService) {}

  async crear(tenantId: string, dto: CreateContactoDto): Promise<ContactoConAviso> {
    const { razonSocial, rncValidado, nombreComercial, warning } = await this.resolverRnc(dto)

    if (!razonSocial || razonSocial.trim() === '') {
      throw new BadRequestException('razonSocial es requerido (no se pudo autocompletar desde el RNC)')
    }

    const data = {
      tenantId,
      tipo: dto.tipo,
      razonSocial,
      rncValidado,
      ...(dto.rnc !== undefined && { rnc: dto.rnc }),
      ...(nombreComercial !== undefined && { nombreComercial }),
      ...(dto.identificadorExtranjero !== undefined && { identificadorExtranjero: dto.identificadorExtranjero }),
      ...(dto.paisExtranjero !== undefined && { paisExtranjero: dto.paisExtranjero }),
      ...(dto.direccion !== undefined && { direccion: dto.direccion }),
      ...(dto.provincia !== undefined && { provincia: dto.provincia }),
      ...(dto.municipio !== undefined && { municipio: dto.municipio }),
      ...(dto.telefono !== undefined && { telefono: dto.telefono }),
      ...(dto.email !== undefined && { email: dto.email }),
    }

    // Upsert por (tenantId, rnc): si el RNC ya existe en el tenant, se actualiza
    // en vez de duplicar. Sin RNC (p.ej. CONSUMIDOR_FINAL) siempre crea.
    let contacto: Contacto
    if (dto.rnc) {
      const existing = await prisma.contacto.findFirst({ where: { tenantId, rnc: dto.rnc } })
      contacto = existing
        ? await prisma.contacto.update({ where: { id: existing.id }, data })
        : await prisma.contacto.create({ data })
    } else {
      contacto = await prisma.contacto.create({ data })
    }

    return warning ? { ...contacto, warning } : contacto
  }

  async findAll(tenantId: string, query: ListContactosDto): Promise<PaginatedResponse<Contacto>> {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip = (page - 1) * limit

    const where: Prisma.ContactoWhereInput = {
      tenantId,
      // Filtro de 3 estados: sin parámetro → todos (activos e inactivos);
      // activo=true → sólo activos; activo=false → sólo inactivos (soft-deleted).
      ...(query.activo !== undefined && { activo: query.activo }),
      ...(query.tipo !== undefined && { tipo: query.tipo }),
      ...(query.origen !== undefined && { origen: query.origen }),
      ...(query.search !== undefined && query.search.trim() !== ''
        ? {
            OR: [
              { razonSocial: { contains: query.search, mode: 'insensitive' } },
              { rnc: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...((query.desde !== undefined || query.hasta !== undefined) && {
        createdAt: {
          ...(query.desde !== undefined && { gte: new Date(`${query.desde}T00:00:00.000Z`) }),
          ...(query.hasta !== undefined && { lte: new Date(`${query.hasta}T23:59:59.999Z`) }),
        },
      }),
    }

    const [data, total] = await prisma.$transaction([
      prisma.contacto.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.contacto.count({ where }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  /**
   * Clientes a los que MÁS RECIENTEMENTE se les facturó (no los recién creados,
   * que es lo que da findAll con orderBy createdAt). Alimenta la sección
   * "Recientes" del selector de emisión.
   *
   * Cuenta CUALQUIER comprobante no eliminado — fiscal, borrador o nota de venta:
   * para el selector lo que importa es a quién le estuviste facturando, no si el
   * documento llegó a la DGII.
   *
   * Dos fuentes porque el histórico no es homogéneo:
   *  (a) comprobantes con contactoId → identidad exacta;
   *  (b) comprobantes VIEJOS sin contactoId (antes del fix de draft-cliente) →
   *      se reconstruye por RNC del comprador. Un RNC vacío no hace match: si no
   *      cualquier consumidor final sin RNC arrastraría a otro contacto.
   * Si un contacto aparece por ambas vías gana la fecha más reciente.
   *
   * Sólo devuelve contactos ACTIVOS: el selector no factura a dados de baja.
   */
  async recientes(tenantId: string, limit?: number): Promise<ContactoReciente[]> {
    const take = Math.min(Math.max(limit ?? 5, 1), MAX_RECIENTES)
    // Se pide de más en cada fuente porque al resolver se cae lo inactivo, lo
    // borrado y lo duplicado entre ambas vías.
    const holgura = take * 4

    const [porContacto, porRnc] = await prisma.$transaction([
      prisma.comprobante.groupBy({
        by: ['contactoId'],
        where: { tenantId, eliminado: false, contactoId: { not: null } },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: 'desc' } },
        take: holgura,
      }),
      prisma.comprobante.groupBy({
        by: ['rnc'],
        where: { tenantId, eliminado: false, contactoId: null, rnc: { not: '' } },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: 'desc' } },
        take: holgura,
      }),
    ])

    const ids = porContacto.map((g) => g.contactoId).filter((id): id is string => id !== null)
    const rncs = porRnc.map((g) => g.rnc)
    if (ids.length === 0 && rncs.length === 0) return []

    const contactos = await prisma.contacto.findMany({
      where: {
        tenantId,
        activo: true,
        OR: [
          ...(ids.length > 0 ? [{ id: { in: ids } }] : []),
          ...(rncs.length > 0 ? [{ rnc: { in: rncs } }] : []),
        ],
      },
    })

    const porId = new Map(contactos.map((c) => [c.id, c]))
    // Varios contactos pueden compartir RNC; se elige el más antiguo, la misma
    // regla que usa el envío para resolver el contacto de un comprobante.
    const primeroPorRnc = new Map<string, Contacto>()
    for (const c of [...contactos].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
      if (c.rnc && !primeroPorRnc.has(c.rnc)) primeroPorRnc.set(c.rnc, c)
    }

    const fechas = new Map<string, { contacto: Contacto; ultimaFacturaAt: Date }>()
    const registrar = (contacto: Contacto | undefined, fecha: Date | null | undefined): void => {
      if (!contacto || !fecha) return
      const previo = fechas.get(contacto.id)
      if (!previo || fecha > previo.ultimaFacturaAt) fechas.set(contacto.id, { contacto, ultimaFacturaAt: fecha })
    }

    for (const g of porContacto) registrar(g.contactoId ? porId.get(g.contactoId) : undefined, g._max?.createdAt)
    for (const g of porRnc) registrar(primeroPorRnc.get(g.rnc), g._max?.createdAt)

    return [...fechas.values()]
      .sort((a, b) => b.ultimaFacturaAt.getTime() - a.ultimaFacturaAt.getTime())
      .slice(0, take)
      .map(({ contacto, ultimaFacturaAt }) => ({ ...contacto, ultimaFacturaAt }))
  }

  async findOne(tenantId: string, id: string): Promise<Contacto> {
    const contacto = await prisma.contacto.findFirst({ where: { id, tenantId } })
    if (!contacto) throw new NotFoundException(`Contacto ${id} no encontrado`)
    return contacto
  }

  async actualizar(tenantId: string, id: string, dto: UpdateContactoDto): Promise<ContactoConAviso> {
    const actual = await this.findOne(tenantId, id)

    // Revalida contra la DGII sólo si cambió el RNC (o el tipo dejó de ser
    // consumidor final con un RNC ya presente).
    const rncNuevo = dto.rnc ?? actual.rnc ?? undefined
    const tipoNuevo = dto.tipo ?? actual.tipo
    let warning: string | undefined
    let rncValidado = actual.rncValidado
    let razonSocial = dto.razonSocial ?? actual.razonSocial
    let nombreComercial = dto.nombreComercial

    if (dto.rnc !== undefined && dto.rnc !== actual.rnc) {
      const resolved = await this.resolverRnc({
        tipo: tipoNuevo,
        ...(rncNuevo !== undefined && { rnc: rncNuevo }),
        ...(dto.razonSocial !== undefined && { razonSocial: dto.razonSocial }),
        ...(dto.nombreComercial !== undefined && { nombreComercial: dto.nombreComercial }),
      })
      rncValidado = resolved.rncValidado
      razonSocial = dto.razonSocial ?? resolved.razonSocial ?? actual.razonSocial
      nombreComercial = dto.nombreComercial ?? resolved.nombreComercial
      warning = resolved.warning
    }

    const contacto = await prisma.contacto.update({
      where: { id },
      data: {
        rncValidado,
        razonSocial,
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.rnc !== undefined && { rnc: dto.rnc }),
        ...(nombreComercial !== undefined && { nombreComercial }),
        ...(dto.identificadorExtranjero !== undefined && { identificadorExtranjero: dto.identificadorExtranjero }),
        ...(dto.paisExtranjero !== undefined && { paisExtranjero: dto.paisExtranjero }),
        ...(dto.direccion !== undefined && { direccion: dto.direccion }),
        ...(dto.provincia !== undefined && { provincia: dto.provincia }),
        ...(dto.municipio !== undefined && { municipio: dto.municipio }),
        ...(dto.telefono !== undefined && { telefono: dto.telefono }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
    })

    return warning ? { ...contacto, warning } : contacto
  }

  async remove(tenantId: string, id: string): Promise<Contacto> {
    await this.findOne(tenantId, id)
    return prisma.contacto.update({ where: { id }, data: { activo: false } })
  }

  /**
   * Valida el RNC contra la DGII cuando corresponde. Nunca lanza: si la DGII no
   * responde o el RNC no existe, devuelve rncValidado=false + warning para que el
   * llamador persista igual sin bloquear.
   */
  private async resolverRnc(dto: {
    tipo: string
    rnc?: string
    razonSocial?: string
    nombreComercial?: string
  }): Promise<{
    razonSocial: string | undefined
    nombreComercial: string | undefined
    rncValidado: boolean
    warning: string | undefined
  }> {
    if (!dto.rnc || dto.tipo === 'CONSUMIDOR_FINAL') {
      return { razonSocial: dto.razonSocial, nombreComercial: dto.nombreComercial, rncValidado: false, warning: undefined }
    }

    try {
      const c = await this.dgii.buscarPorRNC(dto.rnc)
      return {
        // Autocompleta desde la DGII cuando el cliente no envió razón social.
        razonSocial: dto.razonSocial ?? c.razonSocial,
        nombreComercial: dto.nombreComercial ?? c.nombreComercial,
        rncValidado: true,
        warning: undefined,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        razonSocial: dto.razonSocial,
        nombreComercial: dto.nombreComercial,
        rncValidado: false,
        warning: `No se pudo validar el RNC contra la DGII: ${msg}`,
      }
    }
  }
}
