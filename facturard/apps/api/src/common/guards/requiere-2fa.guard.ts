import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { prisma } from '@facturard/database'
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy'

/** Minutos que dura la confirmación con código 2FA para las secciones Empresa y Configuración. */
export const MINUTOS_CONFIRMACION_2FA = 10
export const HEADER_CONFIRMACION_2FA = 'x-2fa'

interface PayloadConfirmacion {
  tenantId: string
  type: 'confirmacion-2fa'
}

/** Firma y verifica el token corto que se obtiene al confirmar con el código 2FA. */
export function firmadorConfirmacion(config: ConfigService): JwtService {
  return new JwtService({
    secret: `${config.getOrThrow<string>('jwt.secret')}:confirmacion-2fa`,
    signOptions: { expiresIn: `${MINUTOS_CONFIRMACION_2FA}m` },
  })
}

/**
 * Operaciones sensibles (datos de la empresa, certificado, integraciones): si la
 * empresa tiene 2FA activo exigen un código confirmado hace menos de 10 minutos
 * (header `x-2fa`). Empresas antiguas sin 2FA pasan: la app les pide activarlo al
 * entrar y, desde ese momento, quedan protegidas. Debe ir DESPUÉS de JwtAuthGuard.
 */
@Injectable()
export class Requiere2FAGuard implements CanActivate {
  private readonly jwt: JwtService

  constructor(config: ConfigService) {
    this.jwt = firmadorConfirmacion(config)
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>()
    const tenantId = req.user?.tenantId
    if (!tenantId) throw new ForbiddenException('Sesión sin empresa')

    const cuenta = await prisma.cuentaRegistro.findUnique({ where: { tenantId }, select: { totpActivo: true } })
    if (!cuenta?.totpActivo) return true

    const token = String(req.headers[HEADER_CONFIRMACION_2FA] ?? '')
    try {
      const p = this.jwt.verify<PayloadConfirmacion>(token)
      if (p.type === 'confirmacion-2fa' && p.tenantId === tenantId) return true
    } catch {
      // cae al 403 de abajo
    }
    throw new ForbiddenException({
      statusCode: 403,
      codigo: 'REQUIERE_2FA',
      message: 'Confirma con tu código de Google Authenticator para continuar',
    })
  }
}
