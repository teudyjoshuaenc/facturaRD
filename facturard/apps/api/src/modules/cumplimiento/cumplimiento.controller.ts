import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { CumplimientoService } from './cumplimiento.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator'

@ApiTags('Cumplimiento')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cumplimiento')
export class CumplimientoController {
  constructor(private readonly service: CumplimientoService) {}

  @Get()
  @ApiOperation({ summary: 'Panel de salud fiscal del tenant (certificado, secuencias, rechazos, reportes)' })
  obtener(@CurrentTenant() tenantId: string) {
    return this.service.obtener(tenantId)
  }
}
