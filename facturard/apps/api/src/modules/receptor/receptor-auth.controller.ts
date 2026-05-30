import {
  Controller,
  Get,
  Post,
  Res,
  Body,
  HttpCode,
  Logger,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger'
import { memoryStorage } from 'multer'
import type { Response } from 'express'
import { ReceptorService } from './receptor.service'

// Tipo mínimo para el archivo multer (sin necesitar @types/multer)
interface MulterFile {
  fieldname: string
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

/**
 * ReceptorAuthController
 *
 * Implementa el protocolo de autenticación de la DGII para receptores de e-CF.
 * Las rutas están FUERA del prefijo global "api/v1":
 *   GET  /fe/autenticacion/api/semilla
 *   POST /fe/autenticacion/api/validacioncertificado
 *
 * Paso 7 del proceso de certificación DGII.
 */
@ApiTags('Receptor DGII — Autenticación')
@Controller('fe/autenticacion/api')
export class ReceptorAuthController {
  private readonly logger = new Logger(ReceptorAuthController.name)

  constructor(private readonly service: ReceptorService) {}

  /**
   * GET /fe/autenticacion/api/semilla
   *
   * Genera un UUID como semilla y lo guarda en Redis con TTL de 5 minutos.
   * El emisor debe firmar esta semilla con su P12 y enviarla en /validacioncertificado.
   *
   * Respuesta: XML con <SemillaModel>
   */
  @Get('semilla')
  @ApiOperation({
    summary: 'Genera semilla para autenticación de receptor DGII',
    description:
      'Endpoint PÚBLICO. Retorna un UUID que el emisor debe firmar con su P12 ' +
      'y enviar en POST /fe/autenticacion/api/validacioncertificado. ' +
      'La semilla expira en 5 minutos y es de un solo uso.',
  })
  async getSemilla(@Res() res: Response): Promise<void> {
    const result = await this.service.generarSemilla()
    this.logger.log(`[Semilla] Enviada: ${result.valor}`)

    res.set('Content-Type', 'application/xml; charset=utf-8')
    res.send(result.xml)
  }

  /**
   * POST /fe/autenticacion/api/validacioncertificado
   *
   * Recibe el XML firmado con la semilla.
   * Valida que la semilla existe en Redis (no expirada, un solo uso).
   * Emite un JWT de sesión de 1 hora para los endpoints de recepción.
   *
   * Acepta multipart/form-data con campo "xml" (archivo o texto).
   *
   * Respuesta JSON:
   * { "token": "...", "expira": "ISO", "expedido": "ISO" }
   */
  @Post('validacioncertificado')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('xml', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Valida certificado del emisor y emite token de sesión receptor',
    description:
      'Endpoint PÚBLICO. Enviar como multipart/form-data con el XML firmado en el campo "xml". ' +
      'La semilla dentro del XML debe haberse obtenido de GET /fe/autenticacion/api/semilla ' +
      'y no haber expirado (TTL 5 min). Retorna un JWT válido 1 hora.',
  })
  async validarCertificado(
    @UploadedFile() file: MulterFile | undefined,
    @Body('xml') xmlText: string | undefined,
  ): Promise<{ token: string; expira: string; expedido: string }> {
    // Aceptar el XML como archivo multipart O como campo texto del form
    const xml = file?.buffer?.toString('utf-8') ?? xmlText ?? ''

    const result = await this.service.validarCertificado(xml)
    return result
  }
}
