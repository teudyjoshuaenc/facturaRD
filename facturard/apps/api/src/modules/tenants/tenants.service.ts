import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma, UserRole } from '@facturard/database'
import type { Tenant } from '@facturard/database'
import type { CreateTenantDto } from './dto/create-tenant.dto'
import type { BrandingDto } from './dto/branding.dto'
import { computeEmisionStatus, type EmisionStatus } from '../../common/emision-status'

// El token de GHL (cifrado) nunca sale en el payload: se reemplaza por un
// booleano `ghlConectado`. `puedeEmitir`/`motivoNoEmite` indican si el tenant está
// listo para ENVIAR a la DGII (certificado vigente + secuencias).
export type SafeTenant = Omit<Tenant, 'ghlAccessToken'> & { ghlConectado: boolean } & EmisionStatus

function toSafeTenant(t: Tenant, emision: EmisionStatus): SafeTenant {
  const { ghlAccessToken: _ghlAccessToken, ...rest } = t
  return { ...rest, ghlConectado: Boolean(_ghlAccessToken), ...emision }
}

@Injectable()
export class TenantsService {
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
    return toSafeTenant(tenant, emision.get(tenant.id)!)
  }

  async findAll(callerTenantId: string, callerRole: string): Promise<SafeTenant[]> {
    const tenants =
      callerRole === UserRole.SUPER_ADMIN
        ? await prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } })
        : await prisma.tenant.findUnique({ where: { id: callerTenantId } }).then((t) => (t ? [t] : []))

    const emision = await this.emisionStatusMap(tenants.map((t) => t.id))
    return tenants.map((t) => toSafeTenant(t, emision.get(t.id)!))
  }

  async updateBranding(tenantId: string, dto: BrandingDto): Promise<SafeTenant> {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.colorPrimario !== undefined && { colorPrimario: dto.colorPrimario }),
        ...(dto.colorSecundario !== undefined && { colorSecundario: dto.colorSecundario }),
      },
    })
    const emision = await this.emisionStatusMap([tenant.id])
    return toSafeTenant(tenant, emision.get(tenant.id)!)
  }

  async findOne(id: string, callerTenantId: string, callerRole: string): Promise<SafeTenant> {
    if (callerRole !== UserRole.SUPER_ADMIN && id !== callerTenantId) {
      throw new NotFoundException('Tenant no encontrado')
    }
    const tenant = await prisma.tenant.findUnique({ where: { id } })
    if (!tenant) throw new NotFoundException(`Tenant ${id} no encontrado`)
    const emision = await this.emisionStatusMap([tenant.id])
    return toSafeTenant(tenant, emision.get(tenant.id)!)
  }
}
