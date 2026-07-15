import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Res, Header } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import type { Response } from 'express'
import { CotizacionesService } from './cotizaciones.service'
import { CreateCotizacionDto } from './dto/create-cotizacion.dto'
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto'
import { ListCotizacionesDto } from './dto/list-cotizaciones.dto'
import { CambiarEstadoDto } from './dto/cambiar-estado.dto'
import { ConvertirCotizacionDto } from './dto/convertir-cotizacion.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { PlanActivoGuard } from '../../common/guards/plan-activo.guard'
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator'

@ApiTags('Cotizaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly service: CotizacionesService) {}

  @Post()
  @ApiOperation({ summary: 'Crea una cotización (folio interno atómico, estado BORRADOR)' })
  crear(@CurrentTenant() tenantId: string, @Body() dto: CreateCotizacionDto) {
    return this.service.crear(tenantId, dto)
  }

  @Get()
  @ApiOperation({ summary: 'Lista cotizaciones con filtros y paginación' })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'contactoId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  findAll(@CurrentTenant() tenantId: string, @Query() query: ListCotizacionesDto) {
    return this.service.findAll(tenantId, query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una cotización con sus líneas' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id)
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({
    summary: 'Descarga el PDF de la cotización (mismo diseño fiscal, marcado como documento NO fiscal).',
  })
  async downloadPdf(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.service.regenerarPdfBuffer(tenantId, id)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita una cotización (recalcula totales). 409 si ya fue convertida.' })
  actualizar(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateCotizacionDto) {
    return this.service.actualizar(tenantId, id, dto)
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Cambia el estado (BORRADOR→ENVIADA→APROBADA/RECHAZADA)' })
  cambiarEstado(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: CambiarEstadoDto) {
    return this.service.cambiarEstado(tenantId, id, dto.estado)
  }

  @Post(':id/convertir')
  @UseGuards(PlanActivoGuard)
  @ApiOperation({ summary: 'Convierte la cotización en comprobante (DRAFT por defecto; emitir=true emite ya)' })
  convertir(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: ConvertirCotizacionDto) {
    return this.service.convertir(tenantId, id, dto)
  }
}
