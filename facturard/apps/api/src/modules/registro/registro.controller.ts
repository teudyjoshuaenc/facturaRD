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
  DatosRegistroDto,
  IniciarRegistroDto,
  LoginRegistroDto,
  OfvDto,
  VerificarRegistroDto,
} from './dto/registro.dto'
import { PROVINCIAS_DGII } from './geo-dgii'

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
  @HttpCode(202)
  @ApiOperation({ summary: 'Envía el enlace para confirmar el correo (respuesta siempre genérica)' })
  async iniciar(@Body() dto: IniciarRegistroDto): Promise<{ mensaje: string }> {
    await this.service.iniciar(dto.email)
    return { mensaje: 'Si el correo es válido, te enviamos un enlace para continuar.' }
  }

  @Post('verificar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirma el correo y crea la contraseña' })
  verificar(@Body() dto: VerificarRegistroDto) {
    return this.service.verificar(dto.token, dto.password)
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicia sesión; si el registro está completo devuelve también la sesión de la empresa' })
  login(@Body() dto: LoginRegistroDto) {
    return this.service.login(dto.email, dto.password)
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

/** Catálogos públicos (Tabla III DGII) para los formularios. */
@ApiTags('Catálogos')
@Controller('catalogos')
export class CatalogosController {
  @Get('provincias')
  provincias() {
    return PROVINCIAS_DGII
  }
}
