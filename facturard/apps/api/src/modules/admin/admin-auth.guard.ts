import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { prisma, RolAdmin } from '@facturard/database'
import type { AdminUsuario } from '@facturard/database'

/**
 * Tokens del panel (secreto propio `JWT_SECRET:admin`, nunca sirven como token de cliente):
 *  - admin-paso:       tras la contraseña, para configurar o escribir el código 2FA (10 min)
 *  - admin:            sesión del panel (8 h)
 *  - admin-confirmado: código 2FA reciente para datos sensibles (5 min, header x-2fa-admin)
 */
export interface PayloadAdmin {
  sub: string
  type: 'admin-paso' | 'admin' | 'admin-confirmado'
  siguiente?: 'configurar' | 'codigo'
}

export type AdminRequest = Request & { admin?: AdminUsuario }

export const HEADER_CONFIRMACION_ADMIN = 'x-2fa-admin'
const SOLO_ADMIN = 'soloRolAdmin'
/** Restringe el endpoint al rol ADMIN (SOPORTE no). */
export const SoloRolAdmin = () => SetMetadata(SOLO_ADMIN, true)

function bearer(req: Request): string {
  return (req.headers.authorization ?? '').replace(/^bearer\s+/i, '').trim()
}

/** Sesión del panel: token `admin` de un administrador activo. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>()
    let payload: PayloadAdmin
    try {
      payload = this.jwt.verify<PayloadAdmin>(bearer(req))
    } catch {
      throw new UnauthorizedException('Sesión del panel inválida o vencida')
    }
    if (payload.type !== 'admin') throw new UnauthorizedException('Sesión del panel inválida')
    const admin = await prisma.adminUsuario.findUnique({ where: { id: payload.sub } })
    if (!admin?.activo || !admin.totpActivo) throw new UnauthorizedException('Usuario del panel inactivo')
    const soloAdmin = this.reflector.getAllAndOverride<boolean>(SOLO_ADMIN, [context.getHandler(), context.getClass()])
    if (soloAdmin && admin.rol !== RolAdmin.ADMIN) throw new ForbiddenException('Sólo un administrador puede hacer esto')
    req.admin = admin
    return true
  }
}

/** Paso intermedio del login (después de la contraseña). */
@Injectable()
export class AdminPasoGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest & { siguiente?: string | undefined }>()
    try {
      const p = this.jwt.verify<PayloadAdmin>(bearer(req))
      if (p.type !== 'admin-paso') throw new Error('tipo')
      const admin = await prisma.adminUsuario.findUnique({ where: { id: p.sub } })
      if (!admin?.activo) throw new Error('inactivo')
      req.admin = admin
      req.siguiente = p.siguiente
      return true
    } catch {
      throw new UnauthorizedException('Vuelve a escribir tu contraseña')
    }
  }
}
