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
    }

    const [data, total] = await prisma.$transaction([
      prisma.contacto.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.contacto.count({ where }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
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
