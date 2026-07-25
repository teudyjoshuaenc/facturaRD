import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger'
import { TenantsService } from './tenants.service'
import { LOGO_MAX_BYTES } from '../../common/services/cloudinary.service'
import { DgiiContribuyentesService } from './dgii-contribuyentes.service'
import { CreateTenantDto } from './dto/create-tenant.dto'
import { BrandingDto } from './dto/branding.dto'
import { UpdateEmpresaDto } from './dto/update-empresa.dto'
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

  @Patch('empresa')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Actualiza datos de contacto del emisor (dirección/teléfono/correo/logo). RNC y razón social no son editables.',
  })
  updateEmpresa(@CurrentTenant() tenantId: string, @Body() dto: UpdateEmpresaDto) {
    return this.service.updateEmpresa(tenantId, dto)
  }

  // Subida REAL del archivo del logo. El path en Cloudinary se deriva del
  // tenantId del JWT (nunca de input del cliente) → aislamiento multi-tenant.
  // Tipos: PNG/JPG/SVG (el SVG se rasteriza a PNG para el PDF vía f_png). Máx 2 MB.
  @Post('logo')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Sube el archivo del logo del emisor (PNG/JPG/SVG, máx 2 MB) a Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Imagen del logo (PNG/JPG/SVG)' },
      },
    },
  })
  updateLogo(
    @CurrentTenant() tenantId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: LOGO_MAX_BYTES })],
        exceptionFactory: (error) =>
          new BadRequestException(
            error.includes('expected size')
              ? 'El logo supera el máximo de 2 MB. Sube una imagen más liviana.'
              : 'Adjunta un archivo de imagen en el campo "file" (PNG/JPG/SVG, máx 2 MB).',
          ),
      }),
    )
    file: Express.Multer.File,
  ) {
    // El tipo MIME se valida en el servicio ANTES de tocar Cloudinary (mensaje claro).
    return this.service.updateLogo(tenantId, file.buffer, file.mimetype)
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, SameTenantGuard)
  @ApiOperation({ summary: 'Obtiene un tenant por ID (solo el propio, excepto SUPER_ADMIN)' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user.tenantId, user.role)
  }
}
