import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import * as crypto from 'crypto'
import { prisma } from '@facturard/database'
import type { Request } from 'express'

@Injectable()
export class ApiKeyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const rawKey = request.headers['x-api-key']

    if (typeof rawKey !== 'string') throw new UnauthorizedException('API key requerida')

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const apiKey = await prisma.apiKey.findUnique({ where: { keyHash, activo: true } })

    if (!apiKey) throw new UnauthorizedException('API key inválida')

    await prisma.apiKey.update({ where: { id: apiKey.id }, data: { ultimoUso: new Date() } })

    // Attach tenantId to request for downstream use
    ;(request as Request & { tenantId: string }).tenantId = apiKey.tenantId
    return true
  }
}
