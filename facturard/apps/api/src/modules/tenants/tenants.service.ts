import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma, UserRole } from '@facturard/database'
import type { Tenant } from '@facturard/database'
import type { CreateTenantDto } from './dto/create-tenant.dto'

@Injectable()
export class TenantsService {
  async create(dto: CreateTenantDto): Promise<Tenant> {
    return prisma.tenant.create({ data: dto })
  }

  async findAll(callerTenantId: string, callerRole: string): Promise<Tenant[]> {
    if (callerRole === UserRole.SUPER_ADMIN) {
      return prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } })
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: callerTenantId } })
    return tenant ? [tenant] : []
  }

  async findOne(id: string, callerTenantId: string, callerRole: string): Promise<Tenant> {
    if (callerRole !== UserRole.SUPER_ADMIN && id !== callerTenantId) {
      throw new NotFoundException('Tenant no encontrado')
    }
    const tenant = await prisma.tenant.findUnique({ where: { id } })
    if (!tenant) throw new NotFoundException(`Tenant ${id} no encontrado`)
    return tenant
  }
}
