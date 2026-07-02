import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { ComprasService } from './compras.service'
import { CreateCompraDto } from './dto/create-compra.dto'
import { UpdateCompraDto } from './dto/update-compra.dto'
import { ListComprasDto } from './dto/list-compras.dto'
import { AprobacionComercialDto } from './dto/aprobacion-comercial.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator'

@ApiTags('Compras')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('compras')
export class ComprasController {
  constructor(private readonly service: ComprasService) {}

  @Post()
  @ApiOperation({ summary: 'Registra una compra manual (E41 / gasto menor / sin comprobante)' })
  crear(@CurrentTenant() tenantId: string, @Body() dto: CreateCompraDto) {
    return this.service.crear(tenantId, dto)
  }

  @Get()
  @ApiOperation({ summary: 'Lista compras con filtros y paginación (feed 606)' })
  @ApiQuery({ name: 'tipo', enum: ['E41', 'GASTO_MENOR', 'SIN_COMPROBANTE', 'RECIBIDO_ECF'], required: false })
  @ApiQuery({ name: 'fechaDesde', required: false })
  @ApiQuery({ name: 'fechaHasta', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  findAll(@CurrentTenant() tenantId: string, @Query() query: ListComprasDto) {
    return this.service.findAll(tenantId, query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una compra' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza una compra' })
  actualizar(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateCompraDto) {
    return this.service.actualizar(tenantId, id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina una compra' })
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.remove(tenantId, id)
  }

  @Post(':id/aprobacion-comercial')
  @ApiOperation({ summary: 'Aprueba/rechaza un e-CF recibido y notifica a la DGII' })
  aprobacionComercial(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AprobacionComercialDto,
  ) {
    return this.service.aprobacionComercial(tenantId, id, dto)
  }
}
