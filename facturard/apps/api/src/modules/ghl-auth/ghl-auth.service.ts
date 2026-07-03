import { Injectable, ForbiddenException, ConflictException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { prisma } from '@facturard/database'
import type { Tenant } from '@facturard/database'
import { DgiiContribuyentesService } from '../tenants/dgii-contribuyentes.service'
import { SecuenciasService } from '../secuencias/secuencias.service'
import { CertificadosService } from '../certificados/certificados.service'
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
    private readonly certificadosService: CertificadosService,
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

  /**
   * Registra un nuevo tenant a partir del iframe de GHL, recibiendo TODO junto
   * (RNC + P12 + passphrase). En UNA transacción atómica: crea Tenant, vincula
   * GhlLocation, genera secuencias base y guarda el certificado cifrado.
   * Si cualquier paso falla, rollback total — sin tenant ni certificado huérfanos.
   */
  async onboarding(dto: GhlOnboardingDto, file: Buffer, passphrase: string): Promise<GhlOnboardingResult> {
    // 1. Validaciones que NO escriben en DB (fallan sin dejar basura).
    const [existingLocation, existingRnc, contribuyente] = await Promise.all([
      prisma.ghlLocation.findUnique({ where: { locationId: dto.locationId } }),
      prisma.tenant.findUnique({ where: { rnc: dto.rnc } }),
      this.dgiiService.buscarPorRNC(dto.rnc),
    ])

    if (existingLocation) throw new ConflictException('Esta ubicación de GoHighLevel ya está registrada')
    if (existingRnc) throw new ConflictException('El RNC ya está registrado')

    // 2. Validar + cifrar el P12 ANTES de la transacción. Si la passphrase es
    //    incorrecta o el archivo no es un P12 válido/vigente → 400 y no se crea nada.
    const certData = this.certificadosService.buildCertificadoData(file, passphrase)

    // 3. Transacción atómica: tenant + location + secuencias + certificado.
    const tenant = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          rnc: dto.rnc,
          razonSocial: contribuyente.razonSocial,
          nombreComercial: contribuyente.nombreComercial ?? null,
        },
      })

      await tx.ghlLocation.create({ data: { locationId: dto.locationId, tenantId: newTenant.id } })
      await this.secuenciasService.inicializarTodosLosTiposTx(tx, newTenant.id)
      await tx.certificado.create({ data: { tenantId: newTenant.id, ...certData } })

      return newTenant
    })

    return {
      token: this.generateToken(tenant.id),
      tenant: { id: tenant.id, rnc: tenant.rnc, razonSocial: tenant.razonSocial, plan: tenant.plan },
    }
  }

  private generateToken(tenantId: string): string {
    return this.jwt.sign({ sub: tenantId, tenantId, role: 'ADMIN' })
  }
}
