import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { AdminService, type Contexto } from './admin.service'
import { AdminGuard, AdminPasoGuard, HEADER_CONFIRMACION_ADMIN, SoloRolAdmin, type AdminRequest } from './admin-auth.guard'
import {
  ActualizarAdminDto,
  ActualizarClienteDto,
  AuditoriaDto,
  CodigoAdminDto,
  CrearAdminDto,
  ListarClientesDto,
  LoginAdminDto,
} from './dto/admin.dto'

const ctx = (req: AdminRequest): Contexto => ({ admin: req.admin!, ip: req.ip })

/** Acceso al panel: contraseña → 2FA obligatorio. */
@ApiTags('Admin — acceso')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly service: AdminService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Paso 1: correo + contraseña. Devuelve el token del paso 2FA.' })
  login(@Body() dto: LoginAdminDto, @Req() req: AdminRequest) {
    return this.service.login(dto.email, dto.password, req.ip)
  }

  @Post('2fa/configurar')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AdminPasoGuard)
  configurar(@Req() req: AdminRequest) {
    return this.service.configurarDosPasos(req.admin!)
  }

  @Post('2fa/activar')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AdminPasoGuard)
  activar(@Req() req: AdminRequest, @Body() dto: CodigoAdminDto) {
    return this.service.activarDosPasos(req.admin!, dto.codigo, req.ip)
  }

  @Post('2fa')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AdminPasoGuard)
  @ApiOperation({ summary: 'Paso 2: código de Google Authenticator. Devuelve la sesión del panel.' })
  codigo(@Req() req: AdminRequest, @Body() dto: CodigoAdminDto) {
    return this.service.verificarCodigoLogin(req.admin!, dto.codigo, req.ip)
  }
}

@ApiTags('Admin — panel')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('yo')
  yo(@Req() req: AdminRequest) {
    const a = req.admin!
    return { id: a.id, email: a.email, nombre: a.nombre, rol: a.rol }
  }

  @Post('confirmar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Código reciente para datos sensibles (5 min, header x-2fa-admin)' })
  confirmar(@Req() req: AdminRequest, @Body() dto: CodigoAdminDto) {
    return this.service.confirmar(ctx(req), dto.codigo)
  }

  @Get('clientes')
  clientes(@Query() q: ListarClientesDto) {
    return this.service.listarClientes(q.buscar, q.pagina, q.filtro)
  }

  @Get('clientes/:id')
  cliente(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detalleCliente(id)
  }

  @Patch('clientes/:id')
  actualizarCliente(@Req() req: AdminRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarClienteDto) {
    return this.service.actualizarCliente(ctx(req), id, dto)
  }

  @Post('clientes/:id/reiniciar-2fa')
  @HttpCode(200)
  reiniciar2fa(@Req() req: AdminRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.reiniciarDosPasosCliente(ctx(req), id)
  }

  @Post('clientes/:id/sensibles')
  @HttpCode(200)
  @ApiOperation({ summary: 'Acceso OFV y clave del certificado. Exige x-2fa-admin.' })
  sensibles(@Req() req: AdminRequest, @Param('id', ParseUUIDPipe) id: string) {
    this.service.exigirConfirmacion(ctx(req), req.headers[HEADER_CONFIRMACION_ADMIN] as string | undefined)
    return this.service.sensibles(ctx(req), id)
  }

  @Get('clientes/:id/certificado')
  @ApiOperation({ summary: 'Descarga el .p12 del cliente. Exige x-2fa-admin.' })
  async certificado(@Req() req: AdminRequest, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    this.service.exigirConfirmacion(ctx(req), req.headers[HEADER_CONFIRMACION_ADMIN] as string | undefined)
    const { archivo, nombre } = await this.service.descargarCertificado(ctx(req), id)
    res.set({
      'Content-Type': 'application/x-pkcs12',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    })
    res.send(archivo)
  }

  @Post('comprobantes/:id/reintentar')
  @HttpCode(200)
  reintentar(@Req() req: AdminRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.reintentarComprobante(ctx(req), id)
  }

  @Get('auditoria')
  auditoria(@Query() q: AuditoriaDto) {
    return this.service.auditoria(q.tenantId, q.limite)
  }

  @Get('usuarios')
  @SoloRolAdmin()
  usuarios() {
    return this.service.listarAdmins()
  }

  @Post('usuarios')
  @SoloRolAdmin()
  crearUsuario(@Req() req: AdminRequest, @Body() dto: CrearAdminDto) {
    return this.service.crearAdmin(ctx(req), dto)
  }

  @Patch('usuarios/:id')
  @SoloRolAdmin()
  actualizarUsuario(@Req() req: AdminRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarAdminDto) {
    return this.service.actualizarAdmin(ctx(req), id, dto)
  }
}
