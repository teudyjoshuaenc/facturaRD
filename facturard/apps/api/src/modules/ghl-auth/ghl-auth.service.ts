import { Injectable, ForbiddenException, ConflictException, BadRequestException, NotFoundException, Logger } from '@nestjs/common'
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
  private readonly logger = new Logger(GhlAuthService.name)

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
   * Registra un nuevo tenant a partir del iframe de GHL. El certificado es
   * OPCIONAL: si vienen `file` + `passphrase` se crea el tenant CON certificado y
   * queda listo para emitir; si no vienen, se crea el tenant SIN certificado
   * (operativo para cotizar y guardar borradores, pero sin poder emitir a la DGII
   * hasta que se certifique). En AMBOS casos la creación es una transacción
   * atómica: si algo falla, rollback total — sin tenant ni certificado huérfanos.
   */
  async onboarding(
    dto: GhlOnboardingDto,
    file: Buffer | undefined,
    passphrase: string | undefined,
  ): Promise<GhlOnboardingResult> {
    // 1. Validaciones que NO escriben en DB (fallan sin dejar basura).
    const [existingLocation, existingRnc] = await Promise.all([
      prisma.ghlLocation.findUnique({ where: { locationId: dto.locationId } }),
      prisma.tenant.findUnique({ where: { rnc: dto.rnc } }),
    ])

    if (existingLocation) throw new ConflictException('Esta ubicación de GoHighLevel ya está registrada')
    if (existingRnc) throw new ConflictException('El RNC/Cédula ya está registrado')

    // 2. Resolver identidad contra la DGII (RNC o Cédula). Para cédula tolera que
    //    la persona física no esté en el padrón, cayendo al nombre manual.
    const { razonSocial, nombreComercial } = await this.resolverIdentidad(dto)

    // 3. Si viene certificado, validarlo + cifrarlo ANTES de la transacción.
    //    Passphrase incorrecta o P12 inválido → 400 y no se crea nada.
    const certData =
      file !== undefined && passphrase !== undefined && passphrase !== ''
        ? this.certificadosService.buildCertificadoData(file, passphrase)
        : undefined

    // 4. Transacción atómica: tenant + location + secuencias (+ certificado si vino).
    const tenant = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          rnc: dto.rnc,
          razonSocial,
          nombreComercial: nombreComercial ?? null,
        },
      })

      await tx.ghlLocation.create({ data: { locationId: dto.locationId, tenantId: newTenant.id } })
      await this.secuenciasService.inicializarTodosLosTiposTx(tx, newTenant.id)
      if (certData !== undefined) {
        await tx.certificado.create({ data: { tenantId: newTenant.id, ...certData } })
      }

      return newTenant
    })

    return {
      token: this.generateToken(tenant.id),
      tenant: { id: tenant.id, rnc: tenant.rnc, razonSocial: tenant.razonSocial, plan: tenant.plan },
    }
  }

  /**
   * Resuelve razón social / nombre comercial de la identificación (RNC o Cédula)
   * contra el padrón de la DGII. La DGII es autoritativa cuando responde.
   *
   * Para CÉDULA (persona física), muchas no figuran en el padrón de contribuyentes;
   * si la DGII no la encuentra o no está disponible y el usuario envió un nombre
   * manual (`razonSocial`), se acepta sin validar (con aviso en el log). Un RNC
   * de empresa SIEMPRE debe validar contra la DGII (sin respaldo manual).
   */
  private async resolverIdentidad(
    dto: GhlOnboardingDto,
  ): Promise<{ razonSocial: string; nombreComercial?: string }> {
    const esCedula = dto.tipoIdentificacion === 'CEDULA'
    try {
      const contribuyente = await this.dgiiService.buscarPorRNC(dto.rnc)
      return {
        razonSocial: contribuyente.razonSocial,
        ...(contribuyente.nombreComercial !== undefined && { nombreComercial: contribuyente.nombreComercial }),
      }
    } catch (err) {
      const noEncontrado = err instanceof NotFoundException
      const dgiiCaida = !(err instanceof NotFoundException)
      // Respaldo manual permitido solo para cédula (persona física fuera del padrón).
      if (esCedula && dto.razonSocial !== undefined && dto.razonSocial.trim() !== '') {
        this.logger.warn(
          `Cédula ${dto.rnc} no validada contra la DGII (${noEncontrado ? 'no encontrada' : 'servicio no disponible'}); ` +
            'se usa el nombre proporcionado por el usuario.',
        )
        return { razonSocial: dto.razonSocial.trim() }
      }
      if (esCedula && noEncontrado) {
        throw new BadRequestException(
          'No encontramos esa cédula en la DGII. Escribe tu nombre para continuar.',
        )
      }
      // RNC no encontrado (404) o DGII no disponible (503) → se propaga tal cual.
      if (dgiiCaida) this.logger.warn(`No se pudo validar ${dto.rnc} contra la DGII`)
      throw err
    }
  }

  private generateToken(tenantId: string): string {
    return this.jwt.sign({ sub: tenantId, tenantId, role: 'ADMIN' })
  }
}
