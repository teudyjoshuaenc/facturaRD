import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { randomBytes, createHash, type BinaryLike } from 'crypto'
import { prisma, UserRole } from '@facturard/database'
import type { Tenant, User } from '@facturard/database'
import type { LoginDto } from './dto/login.dto'
import type { RegisterDto } from './dto/register.dto'
import { DgiiContribuyentesService } from '../tenants/dgii-contribuyentes.service'
import { SecuenciasService } from '../secuencias/secuencias.service'
import { EmailService } from '../email/email.service'

interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface RegisterResult extends AuthTokens {
  tenant: Pick<Tenant, 'id' | 'rnc' | 'razonSocial' | 'plan'>
  user: Pick<User, 'id' | 'email' | 'nombre' | 'role'>
}

/**
 * SHA-256 del refresh token para almacenamiento en DB.
 * Se usa SHA-256 en lugar de bcrypt porque:
 *  - Los refresh tokens son aleatoriamente únicos (JWT con firma HMAC) → no hay riesgo de fuerza bruta
 *  - bcrypt trunca a 72 bytes, causando falsas coincidencias entre tokens del mismo usuario
 */
function hashRefreshToken(token: BinaryLike): string {
  return createHash('sha256').update(token).digest('hex')
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly dgiiService: DgiiContribuyentesService,
    private readonly secuenciasService: SecuenciasService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    // 1. Validar RNC contra padrón DGII — obtiene razón social oficial
    const contribuyente = await this.dgiiService.buscarPorRNC(dto.rnc)

    // 2. Validar unicidad antes de abrir la transacción
    const [existingRnc, existingEmail] = await Promise.all([
      prisma.tenant.findUnique({ where: { rnc: dto.rnc } }),
      prisma.user.findFirst({ where: { email: dto.email } }),
    ])
    if (existingRnc) throw new ConflictException('El RNC ya está registrado')
    if (existingEmail) throw new ConflictException('El email ya está en uso')

    const passwordHash = await bcrypt.hash(dto.password, 12)

    const { tenant, user } = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          rnc: dto.rnc,
          razonSocial: contribuyente.razonSocial,              // de DGII
          nombreComercial: contribuyente.nombreComercial ?? null,
          plan: dto.plan ?? 'BASICO',
        },
      })

      const newUser = await tx.user.create({
        data: {
          tenantId: newTenant.id,
          email: dto.email,
          passwordHash,
          nombre: dto.nombre,
          role: UserRole.ADMIN,
        },
      })

      return { tenant: newTenant, user: newUser }
    })

    // Inicializar secuencias para todos los tipos de e-CF
    await this.secuenciasService.inicializarTodosLosTipos(tenant.id)

    const tokens = await this.generateTokens(user.id, tenant.id, user.role)

    // Guardar hash SHA-256 del refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: hashRefreshToken(tokens.refreshToken) },
    })

    return {
      ...tokens,
      tenant: { id: tenant.id, rnc: tenant.rnc, razonSocial: tenant.razonSocial, plan: tenant.plan },
      user: { id: user.id, email: user.email, nombre: user.nombre, role: user.role },
    }
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await prisma.user.findFirst({ where: { email: dto.email, activo: true } })

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas')
    }

    const tokens = await this.generateTokens(user.id, user.tenantId, user.role)

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: hashRefreshToken(tokens.refreshToken) },
    })

    return tokens
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwt.verify<{ sub: string; tenantId: string; role: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      })

      // 1. Calcular hash SHA-256 del token entrante
      const incomingHash = hashRefreshToken(refreshToken)

      // 2. Optimistic lock: UPDATE solo si el hash en DB coincide con el del token.
      //    Si otro request concurrente ya lo rotó → count = 0 → 401.
      //    Usamos updateMany porque soporta filtrado por cualquier campo.
      const { count } = await prisma.user.updateMany({
        where: { id: payload.sub, refreshTokenHash: incomingHash },
        data: { refreshTokenHash: null },
      })
      if (count === 0) throw new UnauthorizedException('Sesión inválida o refresh token ya usado')

      // 3. Emitir nuevos tokens y guardar nuevo hash
      const tokens = await this.generateTokens(payload.sub, payload.tenantId, payload.role)
      await prisma.user.update({
        where: { id: payload.sub },
        data: { refreshTokenHash: hashRefreshToken(tokens.refreshToken) },
      })

      return tokens
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err
      throw new UnauthorizedException('Refresh token inválido')
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findFirst({ where: { email, activo: true } })
    // Respuesta silenciosa — nunca revelar si el email existe (seguridad)
    if (!user) return

    // Token aleatorio de 32 bytes → hex (64 chars). Guardamos el hash SHA-256.
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken: tokenHash, resetPasswordExpires: expires },
    })

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000')
    const link = `${appUrl}/reset-password?token=${rawToken}`

    await this.emailService.sendResetPassword(user.email, user.nombre, link)
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: { gt: new Date() },
      },
    })

    if (!user) throw new BadRequestException('Token inválido o expirado')

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        resetPasswordToken: null,
        resetPasswordExpires: null,
        refreshTokenHash: null, // invalida todas las sesiones activas
      },
    })
  }

  private async generateTokens(userId: string, tenantId: string, role: string): Promise<AuthTokens> {
    const basePayload = { sub: userId, tenantId, role }
    // jti (JWT ID) garantiza unicidad incluso si dos tokens se generan en el mismo segundo.
    // Crítico para que SHA-256(RT_old) ≠ SHA-256(RT_new) siempre.
    const accessToken = this.jwt.sign({ ...basePayload, jti: randomBytes(8).toString('hex') })
    const refreshToken = this.jwt.sign(
      { ...basePayload, jti: randomBytes(16).toString('hex') },
      {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.config.getOrThrow<string>('jwt.refreshExpiresIn'),
      },
    )
    return { accessToken, refreshToken }
  }
}
