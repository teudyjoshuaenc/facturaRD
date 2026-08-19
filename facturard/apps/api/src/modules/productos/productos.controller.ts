import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { ProductosService } from './productos.service'
import { CreateProductoDto } from './dto/create-producto.dto'
import { UpdateProductoDto } from './dto/update-producto.dto'
import { ListProductosDto } from './dto/list-productos.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator'

@ApiTags('Productos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('productos')
export class ProductosController {
  constructor(private readonly service: ProductosService) {}

  @Post()
  @ApiOperation({ summary: 'Crea un producto/servicio en el catálogo (borrador:true lo guarda sin terminar)' })
  crear(@CurrentTenant() tenantId: string, @Body() dto: CreateProductoDto) {
    return this.service.crear(tenantId, dto)
  }

  @Get()
  @ApiOperation({ summary: 'Lista el catálogo con filtros y paginación' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categoria', required: false })
  @ApiQuery({ name: 'tipo', enum: ['BIEN', 'SERVICIO'], required: false })
  @ApiQuery({ name: 'activo', type: Boolean, required: false })
  @ApiQuery({ name: 'clase', enum: ['publicado', 'borrador', 'todos'], required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  findAll(@CurrentTenant() tenantId: string, @Query() query: ListProductosDto) {
    return this.service.findAll(tenantId, query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un producto (incluye desactivados)' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza un producto' })
  actualizar(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateProductoDto) {
    return this.service.actualizar(tenantId, id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete (activo=false)' })
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.remove(tenantId, id)
  }
}
