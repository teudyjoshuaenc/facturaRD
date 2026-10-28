import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { memoryStorage } from 'multer'
import { RegistroService } from './registro.service'
import { RegistroJwtGuard, type RegistroRequest } from './registro-jwt.guard'
import {
  CodigoDosPasosDto,
  ConfigurarDosPasosEmpresaDto,
  DatosRegistroDto,
  IniciarRegistroDto,
  LoginRegistroDto,
  OfvDto,
} from './dto/registro.dto'
import { PROVINCIAS_DGII } from './geo-dgii'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator'

interface MulterFile {
  buffer: Buffer
  originalname: string
  size: number
}

const cuentaDe = (req: RegistroRequest): string => req.cuentaId!

@ApiTags('Registro directo')
@Controller('registro')
export class RegistroController {
  constructor(private readonly service: RegistroService) {}

  @Post('iniciar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Abre (o retoma) el registro con el correo. Sin contraseña ni correo de confirmación.' })
  iniciar(@Body() dto: IniciarRegistroDto) {
    return this.service.iniciar(dto.email)
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Entra con correo + código de Google Authenticator' })
  login(@Body() dto: LoginRegistroDto) {
    return this.service.login({ email: dto.email, locationId: dto.locationId }, dto.codigo)
  }

  @Get('estado')
  @ApiBearerAuth()
  @UseGuards(RegistroJwtGuard)
  estado(@Req() req: RegistroRequest) {
    return this.service.estado(cuentaDe(req))
  }

  @Post('dos-pasos/configurar')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(RegistroJwtGuard)
  @ApiOperation({ summary: 'Genera el QR para Google Authenticator' })
  configurarDosPasos(@Req() req: RegistroRequest) {
    return this.service.configurarDosPasos(cuentaDe(req))
  }

  @Post('dos-pasos/activar')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(RegistroJwtGuard)
  async activarDosPasos(@Req() req: RegistroRequest, @Body() dto: CodigoDosPasosDto) {
    await this.service.activarDosPasos(cuentaDe(req), dto.codigo)
    return { activo: true }
  }

  @Get('datos')
  @ApiBearerAuth()
  @UseGuards(RegistroJwtGuard)
  datos(@Req() req: RegistroRequest) {
    return this.service.obtenerDatos(cuentaDe(req))
  }

  @Put('datos')
  @ApiBearerAuth()
  @UseGuards(RegistroJwtGuard)
  @ApiOperation({ summary: 'Datos del contribuyente y del representante (crea la empresa la primera vez)' })
  guardarDatos(@Req() req: RegistroRequest, @Body() dto: DatosRegistroDto) {
    return this.service.guardarDatos(cuentaDe(req), dto)
  }

  @Post('certificado')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(RegistroJwtGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 1024 * 1024 } }))
  subirCertificado(
    @Req() req: RegistroRequest,
    @UploadedFile() file: MulterFile | undefined,
    @Body('passphrase') passphrase: string | undefined,
  ) {
    return this.service.subirCertificado(cuentaDe(req), file?.buffer, passphrase)
  }

  @Put('ofv')
  @ApiBearerAuth()
  @UseGuards(RegistroJwtGuard)
  @ApiOperation({ summary: 'Guarda (cifrado) el acceso a la Oficina Virtual. Exige código 2FA.' })
  async guardarOfv(@Req() req: RegistroRequest, @Body() dto: OfvDto) {
    await this.service.guardarOfv(cuentaDe(req), dto)
    return { guardado: true }
  }

  @Post('sensibles')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(RegistroJwtGuard)
  @ApiOperation({ summary: 'Muestra el acceso OFV guardado. Exige código 2FA.' })
  sensibles(@Req() req: RegistroRequest, @Body() dto: CodigoDosPasosDto) {
    return this.service.verSensibles(cuentaDe(req), dto.codigo)
  }

  @Post('completar')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(RegistroJwtGuard)
  completar(@Req() req: RegistroRequest) {
    return this.service.completar(cuentaDe(req))
  }
}

/**
 * Verificación en dos pasos desde la sesión de la EMPRESA: estado, activarla (empresas
 * que aún no la tienen) y confirmar el código para entrar a Empresa / Configuración.
 */
@ApiTags('Seguridad')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('seguridad/2fa')
export class SeguridadController {
  constructor(private readonly service: RegistroService) {}

  @Get()
  estado(@CurrentTenant() tenantId: string) {
    return this.service.estadoDosPasosTenant(tenantId)
  }

  @Post('configurar')
  @HttpCode(200)
  configurar(@CurrentTenant() tenantId: string, @Body() dto: ConfigurarDosPasosEmpresaDto) {
    return this.service.configurarDosPasosTenant(tenantId, dto.email)
  }

  @Post('activar')
  @HttpCode(200)
  async activar(@CurrentTenant() tenantId: string, @Body() dto: CodigoDosPasosDto) {
    await this.service.activarDosPasosTenant(tenantId, dto.codigo)
    return { activo: true }
  }

  @Post('confirmar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirma el código y devuelve el token (header x-2fa) para las operaciones sensibles' })
  confirmar(@CurrentTenant() tenantId: string, @Body() dto: CodigoDosPasosDto) {
    return this.service.confirmarTenant(tenantId, dto.codigo)
  }
}

/** Catálogos públicos (Tabla III DGII) para los formularios. */
@ApiTags('Catálogos')
@Controller('catalogos')
export class CatalogosController {
  @Get('provincias')
  provincias() {
    return PROVINCIAS_DGII
  }
}
