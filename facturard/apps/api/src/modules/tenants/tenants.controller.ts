import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { TenantsService } from './tenants.service'
import { DgiiContribuyentesService } from './dgii-contribuyentes.service'
import { CreateTenantDto } from './dto/create-tenant.dto'
import { BrandingDto } from './dto/branding.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { SameTenantGuard } from '../../common/guards/same-tenant.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '@facturard/database'
import type { JwtPayload } from '../auth/strategies/jwt.strategy'

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly service: TenantsService,
    private readonly dgii: DgiiContribuyentesService,
  ) {}

  // ── Endpoint público — sin JWT ──────────────────────────────────────────────
  @Get('validar-rnc/:rnc')
  @ApiOperation({ summary: 'Valida un RNC contra el padrón de contribuyentes de la DGII (público)' })
  validarRnc(@Param('rnc') rnc: string) {
    return this.dgii.buscarPorRNC(rnc)
  }

  // ── Endpoints protegidos ────────────────────────────────────────────────────
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Crea un tenant (solo SUPER_ADMIN)' })
  create(@Body() dto: CreateTenantDto) {
    return this.service.create(dto)
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lista tenants. SUPER_ADMIN ve todos; ADMIN ve solo el suyo' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.tenantId, user.role)
  }

  @Patch('branding')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Actualiza el branding (logo/colores) del tenant autenticado' })
  updateBranding(@CurrentTenant() tenantId: string, @Body() dto: BrandingDto) {
    return this.service.updateBranding(tenantId, dto)
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, SameTenantGuard)
  @ApiOperation({ summary: 'Obtiene un tenant por ID (solo el propio, excepto SUPER_ADMIN)' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user.tenantId, user.role)
  }
}
