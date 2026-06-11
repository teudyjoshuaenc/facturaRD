import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { GhlAuthService, type GhlInitResult, type GhlOnboardingResult } from './ghl-auth.service'
import { GhlOnboardingDto } from './dto/ghl-onboarding.dto'

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
  @ApiOperation({
    summary: 'Registra un nuevo tenant a partir de un location_id de GoHighLevel (sin JWT)',
  })
  onboarding(@Body() dto: GhlOnboardingDto): Promise<GhlOnboardingResult> {
    return this.ghlAuthService.onboarding(dto)
  }
}
