import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy'

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request & { user: JwtPayload; tenantId?: string }>()
    return request.user?.tenantId ?? (request.tenantId as string)
  },
)
