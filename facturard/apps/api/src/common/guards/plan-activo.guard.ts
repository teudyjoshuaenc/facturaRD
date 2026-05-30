import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common'
import { prisma } from '@facturard/database'
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy'

@Injectable()
export class PlanActivoGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>()
    const user = request.user

    if (!user?.tenantId) return false

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { planActivo: true, trialEndsAt: true, estado: true },
    })

    if (!tenant || tenant.estado !== 'ACTIVO') {
      throw new HttpException('Cuenta suspendida o cancelada', HttpStatus.PAYMENT_REQUIRED)
    }

    // Trial: if trialEndsAt is set and has expired, block
    if (tenant.trialEndsAt && tenant.trialEndsAt < new Date()) {
      throw new HttpException(
        'El período de prueba ha terminado. Actualice su plan para continuar emitiendo comprobantes.',
        HttpStatus.PAYMENT_REQUIRED,
      )
    }

    if (!tenant.planActivo) {
      throw new HttpException(
        'Plan inactivo. Contacte soporte o actualice su suscripción.',
        HttpStatus.PAYMENT_REQUIRED,
      )
    }

    return true
  }
}
