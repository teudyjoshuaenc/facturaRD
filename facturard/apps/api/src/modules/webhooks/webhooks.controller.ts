import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { WebhooksService } from './webhooks.service'
import { CreateWebhookDto } from './dto/create-webhook.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator'

@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  /**
   * POST /api/v1/webhooks
   * Crea un webhook saliente o de entrada.
   */
  @Post()
  @ApiOperation({
    summary: 'Crea un webhook',
    description:
      'Para webhooks salientes (tipo=SALIENTE) FacturaRD hará POST a tu URL con el evento firmado HMAC. ' +
      'Para configurar el receiver de GHL usa POST /webhooks/ghl/configurar.',
  })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateWebhookDto) {
    return this.service.create(tenantId, dto)
  }

  /**
   * GET /api/v1/webhooks
   * Lista todos los webhooks activos del tenant.
   * Para GHL_ENTRADA incluye urlReceiverGHL y secretoHMAC.
   */
  @Get()
  @ApiOperation({
    summary: 'Lista los webhooks del tenant',
    description:
      'Los webhooks de tipo GHL_ENTRADA incluyen urlReceiverGHL (URL que debes configurar en GHL) ' +
      'y secretoHMAC (secreto HMAC que debes pegar en la configuración de GHL).',
  })
  findAll(@CurrentTenant() tenantId: string) {
    return this.service.findAll(tenantId)
  }

  /**
   * DELETE /api/v1/webhooks/:id
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Desactiva un webhook' })
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.remove(tenantId, id)
  }

  /**
   * POST /api/v1/webhooks/ghl/configurar
   *
   * Crea o actualiza el webhook receiver de GHL para el tenant autenticado.
   * Retorna la URL del receiver y el secreto HMAC para configurar en GoHighLevel.
   *
   * NOTA: Esta ruta debe ir ANTES de ':id' para no ser capturada como un ID.
   */
  @Post('ghl/configurar')
  @ApiOperation({
    summary: 'Configura el receiver de GoHighLevel',
    description:
      'Genera (o regenera) el secreto HMAC y retorna la URL del endpoint receptor. ' +
      'Copia ambos valores en la configuración de webhook de tu subcuenta en GoHighLevel.',
  })
  configurarGHL(@CurrentTenant() tenantId: string) {
    return this.service.configurarGHL(tenantId)
  }
}
