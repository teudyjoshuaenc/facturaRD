import {
  Controller,
  Post,
  Req,
  Res,
  Body,
  HttpCode,
  Logger,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger'
import { memoryStorage } from 'multer'
import type { Request, Response } from 'express'
import { ReceptorService } from './receptor.service'
import { ReceptorJwtGuard } from './receptor-jwt.guard'
import type { ReceptorJwtPayload } from './receptor-jwt.guard'

// Tipo mínimo multer sin @types/multer
interface MulterFile {
  fieldname: string
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

type ReceptorRequest = Request & { receptorPayload?: ReceptorJwtPayload }

/**
 * ReceptorEcfController
 *
 * Implementa los endpoints de recepción según el Paso 7 de certificación DGII.
 * Rutas FUERA del prefijo "api/v1":
 *   POST /fe/recepcion/api/ecf
 *   POST /fe/aprobacioncomercial/api/ecf
 *
 * Todos los endpoints requieren el JWT emitido por /validacioncertificado.
 */
@ApiTags('Receptor DGII — e-CF')
@ApiBearerAuth()
@Controller('fe')
export class ReceptorEcfController {
  private readonly logger = new Logger(ReceptorEcfController.name)

  constructor(private readonly service: ReceptorService) {}

  /**
   * POST /fe/recepcion/api/ecf
   *
   * Recibe el XML firmado de un e-CF emitido por otro contribuyente.
   * Guarda en tabla comprobantes_recibidos.
   * Retorna XML de Acuse de Recibo (ARECF).
   *
   * Header requerido: Authorization: Bearer {token de validacioncertificado}
   */
  @Post('recepcion/api/ecf')
  @HttpCode(200)
  @UseGuards(ReceptorJwtGuard)
  @UseInterceptors(FileInterceptor('xml', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Recibe un e-CF enviado por otro contribuyente',
    description:
      'Requiere token JWT de sesión receptor (de /validacioncertificado). ' +
      'Enviar como multipart/form-data con el XML del e-CF firmado en el campo "xml". ' +
      'Retorna XML ARECF (Acuse de Recibo).',
  })
  async recibirEcf(
    @UploadedFile() file: MulterFile | undefined,
    @Body('xml') xmlText: string | undefined,
    @Req() req: ReceptorRequest,
    @Res() res: Response,
  ): Promise<void> {
    const xml = file?.buffer?.toString('utf-8') ?? xmlText ?? ''
    const rncEmisor = req.receptorPayload?.sub ?? ''

    const result = await this.service.recibirEcf(xml, rncEmisor)
    this.logger.log(`[Recepcion] ARECF generado para ${result.eNCF} de RNC ${result.rncEmisor}`)

    res.set('Content-Type', 'application/xml; charset=utf-8')
    res.send(result.xml)
  }

  /**
   * POST /fe/aprobacioncomercial/api/ecf
   *
   * Recibe el XML de Aprobación Comercial (ACECF) del emisor.
   * Actualiza el estado del comprobante recibido.
   *
   * Header requerido: Authorization: Bearer {token}
   */
  @Post('aprobacioncomercial/api/ecf')
  @HttpCode(200)
  @UseGuards(ReceptorJwtGuard)
  @UseInterceptors(FileInterceptor('xml', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Recibe aprobación comercial de un e-CF (ACECF)',
    description:
      'Requiere token JWT de sesión receptor. ' +
      'Enviar como multipart/form-data con el XML de aprobación en el campo "xml". ' +
      'Retorna HTTP 200 si fue procesado correctamente.',
  })
  async aprobacionComercial(
    @UploadedFile() file: MulterFile | undefined,
    @Body('xml') xmlText: string | undefined,
    @Req() req: ReceptorRequest,
  ): Promise<{ ok: boolean; mensaje: string }> {
    const xml = file?.buffer?.toString('utf-8') ?? xmlText ?? ''
    const rncEmisor = req.receptorPayload?.sub ?? ''

    await this.service.registrarAprobacion(xml, rncEmisor)
    return { ok: true, mensaje: 'Aprobación comercial registrada' }
  }
}
