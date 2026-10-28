import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'

/** Sesión de registro: sólo permite completar el propio registro (permisos básicos). */
export interface RegistroJwtPayload {
  sub: string // id de la CuentaRegistro
  type: 'registro'
}

export type RegistroRequest = Request & { cuentaId?: string }

@Injectable()
export class RegistroJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RegistroRequest>()
    const raw = req.headers.authorization ?? ''
    const token = raw.replace(/^bearer\s+/i, '').trim()
    if (!token) throw new UnauthorizedException('Falta la sesión de registro')
    try {
      const payload = this.jwt.verify<RegistroJwtPayload>(token)
      if (payload.type !== 'registro') throw new Error('tipo')
      req.cuentaId = payload.sub
      return true
    } catch {
      throw new UnauthorizedException('Sesión de registro inválida o vencida')
    }
  }
}
