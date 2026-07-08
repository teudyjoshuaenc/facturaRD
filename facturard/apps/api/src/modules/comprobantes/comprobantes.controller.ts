import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Res, Header } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import type { Response } from 'express'
import { ComprobantesService } from './comprobantes.service'
import { CreateComprobanteDto } from './dto/create-comprobante.dto'
import { UpdateComprobanteDto } from './dto/update-comprobante.dto'
import { CrearNotaDto } from './dto/crear-nota.dto'
import { ListComprobantesDto } from './dto/list-comprobantes.dto'
import { ResumenComprobantesDto } from './dto/resumen-comprobantes.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { PlanActivoGuard } from '../../common/guards/plan-activo.guard'
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator'
import { ComprobanteEstado, TipoECF } from '@facturard/database'

@ApiTags('Comprobantes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlanActivoGuard)
@Controller('comprobantes')
export class ComprobantesController {
  constructor(private readonly service: ComprobantesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Crea un comprobante. emitir=true (default) lo encola para la DGII; emitir=false lo guarda como borrador (DRAFT).',
  })
  crear(@CurrentTenant() tenantId: string, @Body() dto: CreateComprobanteDto) {
    return this.service.crear(tenantId, dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita un borrador (DRAFT) y recalcula totales. 409 si ya fue emitido.' })
  actualizar(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateComprobanteDto,
  ) {
    return this.service.actualizarDraft(tenantId, id, dto)
  }

  @Post(':id/emitir')
  @ApiOperation({ summary: 'Emite un borrador: asigna e-NCF, encola y envía a la DGII. 409 si no es DRAFT.' })
  emitir(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.emitir(tenantId, id)
  }

  @Post(':id/nota')
  @ApiOperation({ summary: 'Emite una nota de crédito (E34) o débito (E33) sobre un comprobante ACEPTADO' })
  crearNota(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: CrearNotaDto) {
    return this.service.crearNota(tenantId, id, dto)
  }

  @Get()
  @ApiOperation({ summary: 'Lista comprobantes con filtros y paginación' })
  @ApiQuery({ name: 'estado', enum: ComprobanteEstado, required: false })
  @ApiQuery({ name: 'tipoECF', enum: TipoECF, required: false })
  @ApiQuery({ name: 'fechaDesde', required: false })
  @ApiQuery({ name: 'fechaHasta', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  findAll(@CurrentTenant() tenantId: string, @Query() query: ListComprobantesDto) {
    return this.service.findAll(tenantId, query)
  }

  @Get('resumen')
  @ApiOperation({ summary: 'Resumen agregado de comprobantes (para el dashboard)' })
  @ApiQuery({ name: 'fechaDesde', required: false })
  @ApiQuery({ name: 'fechaHasta', required: false })
  resumen(@CurrentTenant() tenantId: string, @Query() query: ResumenComprobantesDto) {
    return this.service.resumen(tenantId, query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un comprobante con su estado actual' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id)
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'Descarga el PDF del comprobante (solo si fue aceptado)' })
  async downloadPdf(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
  ): Promise<void> {
    // Se regenera al vuelo desde los datos persistidos (no se sirve un PDF viejo
    // de disco): así el QR lleva siempre el consultatimbre correcto y no depende
    // del /tmp efímero de Railway. Ver ComprobantesService.regenerarPdfBuffer.
    const { buffer, filename } = await this.service.regenerarPdfBuffer(tenantId, id)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }
}
