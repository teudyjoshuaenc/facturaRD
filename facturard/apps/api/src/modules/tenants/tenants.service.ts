import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma, UserRole } from '@facturard/database'
import type { Tenant } from '@facturard/database'
import type { CreateTenantDto } from './dto/create-tenant.dto'
import type { BrandingDto } from './dto/branding.dto'

// El token de GHL (cifrado) nunca sale en el payload: se reemplaza por un
// booleano `ghlConectado`.
export type SafeTenant = Omit<Tenant, 'ghlAccessToken'> & { ghlConectado: boolean }

function toSafeTenant(t: Tenant): SafeTenant {
  const { ghlAccessToken: _ghlAccessToken, ...rest } = t
  return { ...rest, ghlConectado: Boolean(_ghlAccessToken) }
}

@Injectable()
export class TenantsService {
  async create(dto: CreateTenantDto): Promise<SafeTenant> {
    const tenant = await prisma.tenant.create({ data: dto })
    return toSafeTenant(tenant)
  }

  async findAll(callerTenantId: string, callerRole: string): Promise<SafeTenant[]> {
    if (callerRole === UserRole.SUPER_ADMIN) {
      const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } })
      return tenants.map(toSafeTenant)
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: callerTenantId } })
    return tenant ? [toSafeTenant(tenant)] : []
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
    return toSafeTenant(tenant)
  }

  async findOne(id: string, callerTenantId: string, callerRole: string): Promise<SafeTenant> {
    if (callerRole !== UserRole.SUPER_ADMIN && id !== callerTenantId) {
      throw new NotFoundException('Tenant no encontrado')
    }
    const tenant = await prisma.tenant.findUnique({ where: { id } })
    if (!tenant) throw new NotFoundException(`Tenant ${id} no encontrado`)
    return toSafeTenant(tenant)
  }
}
