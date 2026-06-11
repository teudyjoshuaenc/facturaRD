import { Injectable, ForbiddenException, ConflictException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { prisma } from '@facturard/database'
import type { Tenant } from '@facturard/database'
import { DgiiContribuyentesService } from '../tenants/dgii-contribuyentes.service'
import { SecuenciasService } from '../secuencias/secuencias.service'
import type { GhlOnboardingDto } from './dto/ghl-onboarding.dto'

export interface GhlInitResult {
  token?: string
  tenant?: Pick<Tenant, 'rnc' | 'razonSocial' | 'plan'>
  onboarding?: boolean
  locationId?: string
}

export interface GhlOnboardingResult {
  token: string
  tenant: Pick<Tenant, 'id' | 'rnc' | 'razonSocial' | 'plan'>
}

@Injectable()
export class GhlAuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly dgiiService: DgiiContribuyentesService,
    private readonly secuenciasService: SecuenciasService,
  ) {}

  async init(locationId?: string): Promise<GhlInitResult> {
    if (!locationId) {
      throw new ForbiddenException('Acceso solo disponible desde GoHighLevel')
    }

    const ghlLocation = await prisma.ghlLocation.findUnique({
      where: { locationId },
      include: { tenant: true },
    })

    if (!ghlLocation) {
      return { onboarding: true, locationId }
    }

    const { tenant } = ghlLocation

    return {
      token: this.generateToken(tenant.id),
      tenant: { rnc: tenant.rnc, razonSocial: tenant.razonSocial, plan: tenant.plan },
    }
  }

  async onboarding(dto: GhlOnboardingDto): Promise<GhlOnboardingResult> {
    const [existingLocation, existingRnc, contribuyente] = await Promise.all([
      prisma.ghlLocation.findUnique({ where: { locationId: dto.locationId } }),
      prisma.tenant.findUnique({ where: { rnc: dto.rnc } }),
      this.dgiiService.buscarPorRNC(dto.rnc),
    ])

    if (existingLocation) throw new ConflictException('Esta ubicación de GoHighLevel ya está registrada')
    if (existingRnc) throw new ConflictException('El RNC ya está registrado')

    const tenant = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          rnc: dto.rnc,
          razonSocial: contribuyente.razonSocial,
          nombreComercial: contribuyente.nombreComercial ?? null,
        },
      })

      await tx.ghlLocation.create({
        data: { locationId: dto.locationId, tenantId: newTenant.id },
      })

      return newTenant
    })

    await this.secuenciasService.inicializarTodosLosTipos(tenant.id)

    return {
      token: this.generateToken(tenant.id),
      tenant: { id: tenant.id, rnc: tenant.rnc, razonSocial: tenant.razonSocial, plan: tenant.plan },
    }
  }

  private generateToken(tenantId: string): string {
    return this.jwt.sign({ sub: tenantId, tenantId, role: 'ADMIN' })
  }
}
