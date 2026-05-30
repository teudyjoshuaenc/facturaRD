import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { prisma } from '@facturard/database'
import type { Request } from 'express'
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy'

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>()
    const { method, url, ip, user } = request

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next.handle()
    if (!user?.tenantId) return next.handle()

    return next.handle().pipe(
      tap(() => {
        void prisma.auditLog.create({
          data: {
            tenantId: user.tenantId,
            userId: user.sub,
            accion: `${method} ${url}`,
            entidad: url.split('/')[3] ?? 'unknown',
            ip: ip ?? null,
          },
        })
      }),
    )
  }
}
