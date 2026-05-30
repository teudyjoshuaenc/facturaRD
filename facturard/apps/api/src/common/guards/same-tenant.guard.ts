import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { UserRole } from '@facturard/database'
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy'
import type { Request } from 'express'

@Injectable()
export class SameTenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user: JwtPayload; params: Record<string, string> }>()
    const user = request.user
    const { id } = request.params

    if (user.role === UserRole.SUPER_ADMIN) return true
    if (id !== user.tenantId) {
      throw new ForbiddenException('No tienes acceso a este tenant')
    }
    return true
  }
}
