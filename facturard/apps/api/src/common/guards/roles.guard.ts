import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserRole } from '@facturard/database'
import { ROLES_KEY } from '../decorators/roles.decorator'
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy'
import type { Request } from 'express'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const request = context.switchToHttp().getRequest<Request & { user: JwtPayload }>()
    return required.includes(request.user.role as UserRole)
  }
}
