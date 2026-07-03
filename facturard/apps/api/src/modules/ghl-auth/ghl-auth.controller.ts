import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger'
import { GhlAuthService, type GhlInitResult, type GhlOnboardingResult } from './ghl-auth.service'
import { GhlOnboardingDto } from './dto/ghl-onboarding.dto'

const MAX_P12_SIZE = 1024 * 1024 // 1 MB

@ApiTags('GHL Auth')
@Controller('ghl')
export class GhlAuthController {
  constructor(private readonly ghlAuthService: GhlAuthService) {}

  @Get('init')
  @ApiOperation({
    summary: 'Inicializa la sesión desde el iframe de GoHighLevel (sin JWT)',
    description:
      'Recibe el location_id de GHL. Si el location ya está vinculado a un tenant, ' +
      'devuelve un accessToken JWT. Si no, indica que se debe iniciar el flujo de onboarding.',
  })
  @ApiQuery({ name: 'location_id', required: true, description: 'Location ID de GoHighLevel' })
  @ApiQuery({ name: 'email', required: false, description: 'Email del usuario de GHL (opcional)' })
  init(
    @Query('location_id') locationId?: string,
    @Query('email') _email?: string,
  ): Promise<GhlInitResult> {
    return this.ghlAuthService.init(locationId)
  }

  @Post('onboarding')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Registra un nuevo tenant (RNC + P12 + passphrase) en una transacción atómica (sin JWT)',
    description:
      'Multipart/form-data: locationId, rnc, passphrase y el archivo P12 en el campo "file". ' +
      'Crea tenant + location + secuencias + certificado cifrado en una sola transacción. ' +
      'Devuelve el JWT del tenant recién creado.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'locationId', 'rnc', 'passphrase'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Archivo .p12 / .pfx' },
        locationId: { type: 'string' },
        rnc: { type: 'string' },
        passphrase: { type: 'string' },
      },
    },
  })
  onboarding(
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: MAX_P12_SIZE })] }))
    file: Express.Multer.File,
    @Body() dto: GhlOnboardingDto,
  ): Promise<GhlOnboardingResult> {
    return this.ghlAuthService.onboarding(dto, file.buffer, dto.passphrase)
  }
}
