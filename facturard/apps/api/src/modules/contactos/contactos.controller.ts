import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { ContactosService } from './contactos.service'
import { GhlContactosService } from './ghl-contactos.service'
import { CreateContactoDto } from './dto/create-contacto.dto'
import { UpdateContactoDto } from './dto/update-contacto.dto'
import { ListContactosDto } from './dto/list-contactos.dto'
import { ConfigurarGhlDto } from './dto/configurar-ghl.dto'
import { SincronizarGhlDto } from './dto/sincronizar-ghl.dto'
import { BuscarGhlDto } from './dto/buscar-ghl.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator'

@ApiTags('Contactos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contactos')
export class ContactosController {
  constructor(
    private readonly service: ContactosService,
    private readonly ghl: GhlContactosService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crea un contacto (valida RNC contra DGII si aplica). Upsert por RNC.' })
  crear(@CurrentTenant() tenantId: string, @Body() dto: CreateContactoDto) {
    return this.service.crear(tenantId, dto)
  }

  @Post('sincronizar-ghl')
  @ApiOperation({ summary: 'Importa/actualiza contactos desde GoHighLevel. Sin body → todo el location; con ghlContactIds → solo esos.' })
  sincronizarGhl(@CurrentTenant() tenantId: string, @Body() dto: SincronizarGhlDto) {
    return this.ghl.sincronizar(tenantId, dto.ghlContactIds)
  }

  @Get('ghl/buscar')
  @ApiOperation({ summary: 'Busca contactos EN VIVO en GHL (nombre/email/teléfono) para el modal de importación selectiva. No escribe en la DB.' })
  buscarGhl(@CurrentTenant() tenantId: string, @Query() dto: BuscarGhlDto) {
    return this.ghl.buscar(tenantId, { query: dto.query, cursorId: dto.cursorId, cursorDate: dto.cursorDate, limit: dto.limit ?? 20 })
  }

  @Patch('configurar-ghl')
  @ApiOperation({ summary: 'Guarda el access token de GHL (cifrado) y el key del custom field de RNC' })
  configurarGhl(@CurrentTenant() tenantId: string, @Body() dto: ConfigurarGhlDto) {
    return this.ghl.configurar(tenantId, dto)
  }

  @Get()
  @ApiOperation({ summary: 'Lista contactos con filtros y paginación' })
  @ApiQuery({ name: 'tipo', enum: ['CLIENTE', 'PROVEEDOR', 'CONSUMIDOR_FINAL'], required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'origen', enum: ['MANUAL', 'GHL'], required: false })
  @ApiQuery({ name: 'activo', type: Boolean, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  findAll(@CurrentTenant() tenantId: string, @Query() query: ListContactosDto) {
    return this.service.findAll(tenantId, query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un contacto' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza un contacto' })
  actualizar(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateContactoDto) {
    return this.service.actualizar(tenantId, id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete (activo=false)' })
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.remove(tenantId, id)
  }
}
