import { Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { PresupuestoService } from './presupuesto.service'
import { UpsertPresupuestoConfigDto } from './dto/upsert-presupuesto-config.dto'
import { ComparacionDto } from './dto/comparacion.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator'

@ApiTags('Presupuesto')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('presupuesto')
export class PresupuestoController {
  constructor(private readonly service: PresupuestoService) {}

  @Get('config')
  @ApiOperation({ summary: 'Config de presupuesto del tenant (o defaults si nunca se configuró)' })
  getConfig(@CurrentTenant() tenantId: string) {
    return this.service.getConfig(tenantId)
  }

  @Put('config')
  @ApiOperation({ summary: 'Upsert completo: perfil + ingresos + costos fijos + parámetros' })
  upsertConfig(@CurrentTenant() tenantId: string, @Body() dto: UpsertPresupuestoConfigDto) {
    return this.service.upsertConfig(tenantId, dto)
  }

  @Get('proyeccion')
  @ApiOperation({ summary: 'Proyección de caja a 12 meses + alertas de quiebre/colchón' })
  proyeccion(@CurrentTenant() tenantId: string) {
    return this.service.proyeccion(tenantId)
  }

  @Get('comparacion')
  @ApiOperation({ summary: 'Real (devengado) vs. presupuestado del mes pedido' })
  comparacion(@CurrentTenant() tenantId: string, @Query() query: ComparacionDto) {
    return this.service.comparacion(tenantId, query.mes)
  }
}
