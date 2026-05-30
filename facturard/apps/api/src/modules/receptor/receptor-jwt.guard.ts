import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'

export interface ReceptorJwtPayload {
  sub: string          // RNC del emisor autenticado
  type: 'receptor-session'
  iss: string
  iat: number
  exp: number
}

@Injectable()
export class ReceptorJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { receptorPayload?: ReceptorJwtPayload }>()
    const authHeader = req.headers['authorization'] as string | undefined

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Se requiere un token de sesión receptor. ' +
        'Obténgalo en POST /fe/autenticacion/api/validacioncertificado',
      )
    }

    const token = authHeader.slice(7)
    try {
      const payload = this.jwtService.verify<ReceptorJwtPayload>(token, {
        issuer: 'facturard-receptor-ecf',
      })

      if (payload.type !== 'receptor-session') {
        throw new UnauthorizedException('Token no válido para este endpoint')
      }

      req.receptorPayload = payload
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Token inválido'
      throw new UnauthorizedException(`Token de receptor inválido: ${msg}`)
    }
  }
}
