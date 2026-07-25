import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma, UserRole } from '@facturard/database'
import type { Tenant } from '@facturard/database'
import type { CreateTenantDto } from './dto/create-tenant.dto'
import type { BrandingDto } from './dto/branding.dto'
import type { UpdateEmpresaDto } from './dto/update-empresa.dto'
import { computeEmisionStatus, type EmisionStatus } from '../../common/emision-status'
import { CloudinaryService } from '../../common/services/cloudinary.service'

// El token de GHL (cifrado) nunca sale en el payload: se reemplaza por un
// booleano `ghlConectado`. `puedeEmitir`/`motivoNoEmite` indican si el tenant está
// listo para ENVIAR a la DGII (certificado vigente + secuencias). `logoPreviewUrl`
// es la derivada f_auto para la UI (calculada desde logoPublicId; null si el logo
// es un enlace externo o no hay logo — en ese caso la UI usa logoUrl directo).
export type SafeTenant = Omit<Tenant, 'ghlAccessToken'> & {
  ghlConectado: boolean
  logoPreviewUrl: string | null
} & EmisionStatus

@Injectable()
export class TenantsService {
  constructor(private readonly cloudinary: CloudinaryService) {}

  private toSafeTenant(t: Tenant, emision: EmisionStatus): SafeTenant {
    const { ghlAccessToken: _ghlAccessToken, ...rest } = t
    return {
      ...rest,
      ghlConectado: Boolean(_ghlAccessToken),
      logoPreviewUrl: t.logoPublicId ? this.cloudinary.previewUrl(t.logoPublicId) : null,
      ...emision,
    }
  }

  /**
   * Calcula el estado de emisión (`puedeEmitir`/`motivoNoEmite`) para un conjunto
   * de tenants en O(1) consultas: certificados activos + presencia de secuencias.
   */
  private async emisionStatusMap(tenantIds: string[]): Promise<Map<string, EmisionStatus>> {
    if (tenantIds.length === 0) return new Map()
    const [certs, secs] = await Promise.all([
      prisma.certificado.findMany({
        where: { tenantId: { in: tenantIds }, activo: true },
        select: { tenantId: true, validoHasta: true },
      }),
      prisma.secuencia.findMany({
        where: { tenantId: { in: tenantIds } },
        select: { tenantId: true },
        distinct: ['tenantId'],
      }),
    ])
    const certByTenant = new Map(certs.map((c) => [c.tenantId, c.validoHasta]))
    const conSecuencias = new Set(secs.map((s) => s.tenantId))
    return new Map(
      tenantIds.map((id) => [
        id,
        computeEmisionStatus(certByTenant.get(id) ?? null, conSecuencias.has(id)),
      ]),
    )
  }

  async create(dto: CreateTenantDto): Promise<SafeTenant> {
    const tenant = await prisma.tenant.create({ data: dto })
    const emision = await this.emisionStatusMap([tenant.id])
    return this.toSafeTenant(tenant, emision.get(tenant.id)!)
  }

  async findAll(callerTenantId: string, callerRole: string): Promise<SafeTenant[]> {
    const tenants =
      callerRole === UserRole.SUPER_ADMIN
        ? await prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } })
        : await prisma.tenant.findUnique({ where: { id: callerTenantId } }).then((t) => (t ? [t] : []))

    const emision = await this.emisionStatusMap(tenants.map((t) => t.id))
    return tenants.map((t) => this.toSafeTenant(t, emision.get(t.id)!))
  }

  async updateBranding(tenantId: string, dto: BrandingDto): Promise<SafeTenant> {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        // Escribir un logoUrl manual (enlace externo) desliga el logo gestionado:
        // se limpia logoPublicId para que la UI no sirva una preview obsoleta.
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl, logoPublicId: null }),
        ...(dto.colorPrimario !== undefined && { colorPrimario: dto.colorPrimario }),
        ...(dto.colorSecundario !== undefined && { colorSecundario: dto.colorSecundario }),
      },
    })
    const emision = await this.emisionStatusMap([tenant.id])
    return this.toSafeTenant(tenant, emision.get(tenant.id)!)
  }

  /**
   * Actualiza los datos de contacto del emisor (dirección/teléfono/correo/logo) que
   * salen en la representación impresa. RNC y razón social NO se tocan: vienen del
   * padrón DGII y deben coincidir con el certificado. Una cadena vacía borra el campo.
   */
  async updateEmpresa(tenantId: string, dto: UpdateEmpresaDto): Promise<SafeTenant> {
    const norm = (v: string): string | null => (v.trim() === '' ? null : v.trim())
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.direccion !== undefined && { direccion: norm(dto.direccion) }),
        ...(dto.telefono !== undefined && { telefono: norm(dto.telefono) }),
        ...(dto.email !== undefined && { email: norm(dto.email) }),
        // Setear/borrar logoUrl manualmente limpia logoPublicId (deja de ser un
        // logo gestionado por Cloudinary; el enlace externo manda).
        ...(dto.logoUrl !== undefined && { logoUrl: norm(dto.logoUrl), logoPublicId: null }),
      },
    })
    const emision = await this.emisionStatusMap([tenant.id])
    return this.toSafeTenant(tenant, emision.get(tenant.id)!)
  }

  /**
   * Sube el archivo del logo a Cloudinary y guarda la derivada f_png en logoUrl
   * (la usa el PDF) + el public_id fijo en logoPublicId. Reemplazar pisa el
   * anterior (public_id fijo con overwrite+invalidate): cero huérfanos. El path
   * se deriva del tenantId autenticado, nunca de input del cliente.
   */
  async updateLogo(tenantId: string, file: Buffer, mimetype: string): Promise<SafeTenant> {
    const { secureUrl, publicId } = await this.cloudinary.subirLogo(tenantId, file, mimetype)
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl: secureUrl, logoPublicId: publicId },
    })
    const emision = await this.emisionStatusMap([tenant.id])
    return this.toSafeTenant(tenant, emision.get(tenant.id)!)
  }

  async findOne(id: string, callerTenantId: string, callerRole: string): Promise<SafeTenant> {
    if (callerRole !== UserRole.SUPER_ADMIN && id !== callerTenantId) {
      throw new NotFoundException('Tenant no encontrado')
    }
    const tenant = await prisma.tenant.findUnique({ where: { id } })
    if (!tenant) throw new NotFoundException(`Tenant ${id} no encontrado`)
    const emision = await this.emisionStatusMap([tenant.id])
    return this.toSafeTenant(tenant, emision.get(tenant.id)!)
  }
}
