import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Res, Header } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import type { Response } from 'express'
import { ComprobantesService } from './comprobantes.service'
import { EnvioComprobanteService } from './envio-comprobante.service'
import { EnviarComprobanteDto } from './dto/enviar-comprobante.dto'
import { EnviarLoteDto } from './dto/enviar-lote.dto'
import { CreateComprobanteDto } from './dto/create-comprobante.dto'
import { UpdateComprobanteDto } from './dto/update-comprobante.dto'
import { CrearNotaDto } from './dto/crear-nota.dto'
import { ListComprobantesDto } from './dto/list-comprobantes.dto'
import { ResumenComprobantesDto } from './dto/resumen-comprobantes.dto'
import { VentasPorProvinciaDto } from './dto/ventas-por-provincia.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { PlanActivoGuard } from '../../common/guards/plan-activo.guard'
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator'
import { ComprobanteEstado, TipoECF } from '@facturard/database'

@ApiTags('Comprobantes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlanActivoGuard)
@Controller('comprobantes')
export class ComprobantesController {
  constructor(
    private readonly service: ComprobantesService,
    private readonly envios: EnvioComprobanteService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Crea un comprobante. emitir=true (default) lo encola para la DGII; emitir=false lo guarda como borrador (DRAFT).',
  })
  crear(@CurrentTenant() tenantId: string, @Body() dto: CreateComprobanteDto) {
    return this.service.crear(tenantId, dto)
  }

  // Ruta literal declarada ANTES de las rutas con :id para que ningún patrón
  // paramétrico pueda capturarla.
  @Post('enviar-lote')
  @ApiOperation({
    summary:
      'Envía UN SOLO correo con los PDFs de varios comprobantes adjuntos (máximo 5, límite de GoHighLevel). ' +
      'No es un correo por comprobante. Post-emisión: NO cambia el estado DGII de ninguno. ' +
      'Todo-o-nada: si un PDF no se puede generar, no se envía nada.',
  })
  enviarLote(@CurrentTenant() tenantId: string, @Body() dto: EnviarLoteDto) {
    return this.envios.enviarLote(tenantId, dto)
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

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina (soft delete) una nota de venta interna. 409 si es un comprobante fiscal.' })
  eliminar(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.eliminar(tenantId, id)
  }

  @Post(':id/nota')
  @ApiOperation({ summary: 'Emite una nota de crédito (E34) o débito (E33) sobre un comprobante ACEPTADO' })
  crearNota(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: CrearNotaDto) {
    return this.service.crearNota(tenantId, id, dto)
  }

  @Get()
  @ApiOperation({ summary: 'Lista comprobantes con filtros y paginación' })
  @ApiQuery({
    name: 'estado',
    enum: ComprobanteEstado,
    required: false,
    description: 'Uno o varios estados separados por coma (ej. PENDIENTE,EN_COLA,ENVIANDO)',
  })
  @ApiQuery({ name: 'clase', enum: ['fiscal', 'borrador', 'nota'], required: false })
  @ApiQuery({ name: 'origen', enum: ['cotizacion'], required: false })
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

  @Get('ventas-por-provincia')
  @ApiOperation({ summary: 'Ventas agregadas por provincia del comprador (para el mapa del dashboard)' })
  @ApiQuery({ name: 'fechaDesde', required: false })
  @ApiQuery({ name: 'fechaHasta', required: false })
  @ApiQuery({ name: 'clase', enum: ['fiscal', 'nota', 'todas'], required: false })
  ventasPorProvincia(@CurrentTenant() tenantId: string, @Query() query: VentasPorProvinciaDto) {
    return this.service.ventasPorProvincia(tenantId, query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un comprobante con su estado actual y el correo del comprador' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOneDetalle(tenantId, id)
  }

  @Post(':id/enviar')
  @ApiOperation({
    summary:
      'Envía el comprobante al cliente por GoHighLevel (PDF adjunto). Post-emisión: NO cambia el estado DGII. ' +
      'Hoy sólo canal="email"; whatsapp/ambos responden 400.',
  })
  enviar(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: EnviarComprobanteDto,
  ) {
    return this.envios.enviar(tenantId, id, dto)
  }

  @Get(':id/envios')
  @ApiOperation({ summary: 'Historial de envíos del comprobante (canal, estado, destino, messageId de GHL).' })
  historialEnvios(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.envios.historial(tenantId, id)
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({
    summary:
      'Descarga el PDF del comprobante. Aceptado → e-CF fiscal con QR; borrador/pendiente → vista previa sin timbre. Rechazado/error → 404.',
  })
  async downloadPdf(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
  ): Promise<void> {
    // Se regenera al vuelo desde los datos persistidos (no se sirve un PDF viejo
    // de disco): así el QR lleva siempre el consultatimbre correcto y no depende
    // del /tmp efímero del contenedor. Ver ComprobantesService.regenerarPdfBuffer.
    const { buffer, filename } = await this.service.regenerarPdfBuffer(tenantId, id)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }
}
